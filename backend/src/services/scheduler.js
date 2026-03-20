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
import { upsertVideos, getAllVideos, getLastUpdated } from '../db/videoRepository.js';

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

    state.lastRefresh = new Date().toISOString();
    state.lastStatus = 'ok';
    state.lastMessage = `Összegyűjtve: ${videos.length}, Új: ${inserted}, Összes DB: ${total}`;
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
 * Elindítja az ütemezőt.
 * - Naponta 08:00-kor fut (cron: '0 8 * * *')
 * - Indításkor fut, ha szükséges
 *
 * @returns {void}
 */
function startScheduler() {
  // Napi 08:00 ütemezés
  cron.schedule('0 8 * * *', () => {
    log('Napi ütemezett frissítés indul...');
    runRefresh();
  });

  // Indításkori azonnali frissítés ha szükséges
  if (shouldRefreshOnStartup()) {
    log('Indításkori frissítés szükséges – elindul...');
    // Kis késleltetés hogy a szerver teljesen elinduljon
    setTimeout(() => runRefresh(), 3000);
  } else {
    log('Indításkori frissítés kihagyva – az adatok frissek.');
    state.lastStatus = 'skipped';
    state.lastMessage = 'Az adatok frissek, nincs szükség indításkori frissítésre.';
  }
}

export { startScheduler, getSchedulerStatus, runRefresh };
