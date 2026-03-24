/**
 * @file scheduler.js
 * @description Napi automatikus videógyűjtés ütemezése node-cron-nal.
 * - Naponta 08:00-kor fut automatikusan
 * - Indításkor fut, ha az adatbázis üres vagy a legutóbbi frissítés > 20 óra régi
 * - Párhuzamos futás megakadályozva (lock flag)
 * - Eredmények logolása: logs/refresh.log
 */

import cron from 'node-cron';
import { appendFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { checkYtdlpInstalled, collectVideos } from './ytdlp.js';
import { upsertVideos, getAllVideos, getLastUpdated, updateTranslations, updateAiSummary, getVideoById } from '../db/videoRepository.js';
import { translateVideo } from './translation.js';
import { generateAiSummary } from './aiSummary.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = join(__dirname, '../../../logs/refresh.log');
const STALE_THRESHOLD_MS = 20 * 60 * 60 * 1000; // 20 óra

/**
 * @type {{ running: boolean, lastRefresh: string|null, lastStatus: 'idle'|'running'|'ok'|'error'|'skipped', lastMessage: string }}
 */
const state = {
  running: false,
  lastRefresh: null,
  lastStatus: 'idle',
  lastMessage: 'Még nem futott frissítés.',
};

/**
 * Naplóbejegyzést ír a logs/refresh.log fájlba.
 *
 * @param {string} message - A naplóüzenet
 * @returns {Promise<void>}
 */
async function log(message) {
  const line = `[CRON] ${new Date().toISOString()} – ${message}\n`;
  process.stdout.write(line);
  try {
    await mkdir(dirname(LOG_PATH), { recursive: true });
    await appendFile(LOG_PATH, line, 'utf8');
  } catch {
    // naplózási hiba nem állítja meg az appot
  }
}

/**
 * Elvégzi a videógyűjtést. Párhuzamos futás esetén kihagyja.
 *
 * @returns {Promise<void>}
 */
async function runRefresh() {
  if (state.running) {
    await log('Kihagyva – már fut egy frissítés.');
    return;
  }

  state.running = true;
  state.lastStatus = 'running';

  try {
    const ytdlp = await checkYtdlpInstalled();
    if (!ytdlp.installed) {
      state.lastStatus = 'skipped';
      state.lastMessage = `yt-dlp nincs telepítve. Telepítési link: ${ytdlp.helpUrl}`;
      await log(state.lastMessage);
      return;
    }

    await log('Frissítés megkezdve...');
    const videos = await collectVideos();
    const inserted = upsertVideos(videos);
    const total = getAllVideos().length;
    await log(`Videók összegyűjtve – Új: ${inserted}, Összes: ${total}`);

    // Auto-fordítás: lefordítatlan videók (title_hu IS NULL)
    const untranslated = getAllVideos().filter(v => !v.title_hu);
    if (untranslated.length > 0) {
      await log(`Auto-fordítás indul – ${untranslated.length} lefordítatlan videó...`);
      let translated = 0;
      for (const video of untranslated) {
        try {
          // Anthropic claude-haiku ha elérhető, különben MyMemory/LibreTranslate
          const apiKey = process.env.ANTHROPIC_API_KEY;
          let titleHu, descriptionHu;
          if (apiKey) {
            const { default: Anthropic } = await import('@anthropic-ai/sdk');
            const client = new Anthropic({ apiKey });
            const prompt = `Fordítsd magyarra professzionálisan ezt a Power BI videó leírást. Csak a fordítást add vissza, semmi mást.\n\nCím: ${video.title}\n\nLeírás:\n${(video.description || '').slice(0, 1500)}`;
            const msg = await client.messages.create({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 1024,
              messages: [{ role: 'user', content: prompt }],
            });
            const full = msg.content[0]?.text || '';
            const lines = full.split('\n');
            titleHu = lines[0].replace(/^Cím:\s*/i, '').trim();
            descriptionHu = lines.slice(1).join('\n').trim() || full;
          } else {
            const result = await translateVideo(video);
            titleHu = result.titleHu;
            descriptionHu = result.descriptionHu;
          }
          updateTranslations(video.id, { titleHu, descriptionHu, transcriptHu: null });
          translated++;
          await log(`  ✓ Lefordítva: ${video.title?.slice(0, 50)}`);
          // 800ms szünet a rate limit elkerüléséhez
          await new Promise(r => setTimeout(r, 800));
        } catch (err) {
          await log(`  ✗ Fordítási hiba (${video.id}): ${err.message}`);
        }
      }
      await log(`Auto-fordítás kész – ${translated}/${untranslated.length} videó lefordítva.`);
    } else {
      await log('Minden videó már le van fordítva.');
    }

    state.lastRefresh = new Date().toISOString();
    state.lastStatus = 'ok';
    state.lastMessage = `Összegyűjtve: ${videos.length}, Új: ${inserted}, Lefordítva: ${untranslated.length}, Összes DB: ${total}`;
    await log(`Frissítés kész – ${state.lastMessage}`);
  } catch (err) {
    state.lastStatus = 'error';
    state.lastMessage = err.message;
    await log(`Hiba a frissítés során: ${err.message}`);
  } finally {
    state.running = false;
  }
}

/**
 * Eldönti, hogy szükséges-e indításkori frissítés.
 * Igen, ha az adatbázis üres VAGY a legutóbbi frissítés > 20 óra régi.
 *
 * @returns {boolean}
 */
function shouldRefreshOnStartup() {
  const videos = getAllVideos();
  if (videos.length === 0) return true;

  const lastUpdated = getLastUpdated();
  if (!lastUpdated) return true;

  const ageMs = Date.now() - new Date(lastUpdated).getTime();
  return ageMs > STALE_THRESHOLD_MS;
}

/**
 * Visszaadja az ütemező aktuális állapotát.
 *
 * @returns {{ running: boolean, lastRefresh: string|null, lastStatus: string, lastMessage: string, nextRun: string }}
 */
function getSchedulerStatus() {
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(8, 0, 0, 0);
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  return {
    ...state,
    nextRun: nextRun.toISOString(),
  };
}

/**
 * Befejezetlen importok folytatása indításkor.
 * Megkeresi az is_imported=1 videókat ahol title_hu vagy ai_summary_hu hiányzik,
 * és elvégzi a fordítást + AI összefoglalót.
 */
async function resumeIncompleteImports() {
  const all = getAllVideos();
  const incomplete = all.filter(v => v.is_imported && (!v.title_hu || !v.ai_summary_hu));
  if (!incomplete.length) return;

  await log(`Befejezetlen importok: ${incomplete.length} videó – folytatás...`);

  for (const video of incomplete) {
    try {
      // Fordítás ha hiányzik
      if (!video.title_hu) {
        const { titleHu, descriptionHu } = await translateVideo({
          id: video.id, title: video.title, description: video.description, title_hu: null,
        });
        if (titleHu) {
          updateTranslations(video.id, { titleHu, descriptionHu: descriptionHu || video.description_hu, transcriptHu: null });
          await log(`  ✓ Fordítás kész: ${video.title?.slice(0, 50)}`);
        }
      }

      // AI összefoglaló ha hiányzik
      const fresh = getVideoById(video.id);
      if (fresh && !fresh.ai_summary_hu) {
        const summary = await generateAiSummary({
          title: video.title,
          channel_title: video.channel_title,
          description: video.description,
          description_hu: fresh.description_hu,
        });
        if (summary) {
          updateAiSummary(video.id, summary);
          await log(`  ✓ AI összefoglaló kész: ${video.title?.slice(0, 50)}`);
        }
      }

      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      await log(`  ✗ Hiba (${video.id}): ${err.message}`);
    }
  }

  await log('Befejezetlen importok feldolgozva.');
}

/**
 * Elindítja az ütemezőt.
 * - Naponta 08:00-kor fut (cron: '0 8 * * *')
 * - Indításkor fut, ha szükséges
 * - Indításkor mindig befejezi a félbehagyott importokat
 *
 * @returns {void}
 */
function startScheduler() {
  // Napi 08:00 ütemezés
  cron.schedule('0 8 * * *', () => {
    log('Napi ütemezett frissítés indul...');
    runRefresh();
  });

  // Indításkor: félbehagyott importok befejezése (mindig fut)
  setTimeout(() => resumeIncompleteImports(), 4000);

  // Indításkori adatfrissítés ha szükséges
  if (shouldRefreshOnStartup()) {
    log('Indításkori frissítés szükséges – elindul...');
    setTimeout(() => runRefresh(), 3000);
  } else {
    log('Indításkori frissítés kihagyva – az adatok frissek.');
    state.lastStatus = 'skipped';
    state.lastMessage = 'Az adatok frissek, nincs szükség indításkori frissítésre.';
  }
}

export { startScheduler, getSchedulerStatus, runRefresh };
