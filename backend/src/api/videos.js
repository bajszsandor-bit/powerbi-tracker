/**
 * @file videos.js (api)
 * @description Videó lista API route-ok.
 */

import express, { Router } from 'express';
import { getAllVideos, getVideoById, getLastUpdated, updateDaxFunctions, updateTranslations, updateAiSummary, markAsImported, getImportedVideos, updateTranscriptCues, updateChapters, getRelatedVideos } from '../db/videoRepository.js';
import { getTop10 } from '../services/scoring.js';
import { getDaxReference, extractDaxFunctions } from '../services/daxAnalyzer.js';
import { checkYtdlpInstalled, fetchSingleVideo } from '../services/ytdlp.js';
import { upsertVideos } from '../db/videoRepository.js';
import { translateVideo, translateCues } from '../services/translation.js';
import { generateAiSummary } from '../services/aiSummary.js';
import { downloadTranscript } from '../services/transcript.js';
import { transcribeAudio, transcribeLocalAudio, transcribeWithFlask, ensureFlaskRunning } from '../services/transcribe.js';
import { generateDubtrack, dubtrackExists, getDubtrackPath } from '../services/dubtrack.js';
import { runRefresh } from '../services/scheduler.js';
import fsPromises from 'fs/promises';
import os from 'os';
import path from 'path';

const router = Router();

/**
 * GET /api/top10
 * Visszaadja a scoring alapján kiválasztott Top 10 videót.
 * Csak az elmúlt 30 napon belüli videók szerepelnek.
 *
 * @returns {object[]} Top 10 videó score és freshnessScore mezőkkel
 */
/**
 * GET /api/stats
 * Archívum statisztikák – összes videó, DAX, összefoglalók, csatornák.
 */
router.get('/stats', (req, res, next) => {
  try {
    const all = getAllVideos();
    const withDax = all.filter(v => v.dax_functions && v.dax_functions !== '[]').length;
    const withSummary = all.filter(v => v.ai_summary_hu).length;
    const withTranscript = all.filter(v => v.has_transcript).length;
    const translated = all.filter(v => v.title_hu).length;
    const channels = [...new Set(all.map(v => v.channel_title).filter(Boolean))].length;

    // Top DAX függvények
    const daxCount = {};
    all.forEach(v => {
      if (!v.dax_functions) return;
      try {
        JSON.parse(v.dax_functions).forEach(fn => {
          daxCount[fn] = (daxCount[fn] || 0) + 1;
        });
      } catch { /* skip */ }
    });
    const topDax = Object.entries(daxCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    res.json({ total: all.length, withDax, withSummary, withTranscript, translated, channels, topDax });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/search?q=QUERY
 * Teljes szöveges keresés cím, leírás, AI összefoglaló, DAX függvények alapján.
 */
router.get('/search', (req, res, next) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q || q.length < 2) return res.json({ results: [], query: q });

    const all = getAllVideos();
    const results = [];

    for (const v of all) {
      const searchText = [
        v.title, v.title_hu, v.description, v.description_hu,
        v.ai_summary_hu, v.channel_title, v.dax_functions,
      ].filter(Boolean).join(' ').toLowerCase();

      if (!searchText.includes(q)) continue;

      // Relevancia: cím egyezés fontosabb
      let score = 0;
      if ((v.title_hu || v.title || '').toLowerCase().includes(q)) score += 10;
      if ((v.ai_summary_hu || '').toLowerCase().includes(q)) score += 5;
      if ((v.dax_functions || '').toLowerCase().includes(q)) score += 8;
      if ((v.description_hu || v.description || '').toLowerCase().includes(q)) score += 2;

      // Snippet – első egyező sor az AI summaryból vagy leírásból
      const snippetSrc = v.ai_summary_hu || v.description_hu || v.description || '';
      const idx = snippetSrc.toLowerCase().indexOf(q);
      const snippet = idx >= 0
        ? '…' + snippetSrc.slice(Math.max(0, idx - 40), idx + 80).replace(/\n/g, ' ') + '…'
        : '';

      results.push({
        id: v.id,
        title: v.title_hu || v.title,
        channel: v.channel_title,
        thumbnail_url: v.thumbnail_url,
        dax_functions: v.dax_functions ? JSON.parse(v.dax_functions).slice(0, 5) : [],
        snippet,
        score,
      });
    }

    results.sort((a, b) => b.score - a.score);
    res.json({ results: results.slice(0, 30), query: q, total: results.length });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/learning-paths
 * Visszaadja a 3 tanulási útvonalat videólistával.
 */
router.get('/learning-paths', (req, res, next) => {
  try {
    const all = getAllVideos();

    const BEGINNER_KEYWORDS = /beginner|kezd[oő]|alap|intro|introduction|getting started|start|first|what is|mi a|basics/i;
    const INTERMEDIATE_DAX = ['CALCULATE', 'FILTER', 'ALL', 'ALLEXCEPT', 'SUMX', 'COUNTROWS', 'DIVIDE', 'HASONEVALUE'];
    const ADVANCED_DAX = ['SAMEPERIODLASTYEAR', 'TOTALYTD', 'PARALLELPERIOD', 'RANKX', 'TOPN', 'CALCULATETABLE', 'EARLIER', 'USERELATIONSHIP', 'CROSSFILTER', 'ALLSELECTED'];

    function parseDax(v) {
      try { return JSON.parse(v.dax_functions || '[]'); } catch { return []; }
    }

    function hasAny(arr, targets) {
      return targets.some(t => arr.includes(t));
    }

    function videoCard(v) {
      return {
        id: v.id,
        title: v.title_hu || v.title,
        title_orig: v.title,
        channel: v.channel_title,
        thumbnail_url: v.thumbnail_url,
        dax_functions: parseDax(v).slice(0, 6),
        duration_seconds: v.duration_seconds,
      };
    }

    // Kezdő: beginner kulcsszó a títelben VAGY 0-1 DAX függvény
    const beginner = all
      .filter(v => BEGINNER_KEYWORDS.test(v.title || '') || parseDax(v).length <= 1)
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 8)
      .map(videoCard);

    // Középhaladó: tartalmaz intermediate DAX függvényeket (2-6 össz)
    const intermediate = all
      .filter(v => {
        const fns = parseDax(v);
        return fns.length >= 2 && fns.length <= 9 && hasAny(fns, INTERMEDIATE_DAX);
      })
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 8)
      .map(videoCard);

    // Haladó: tartalmaz advanced DAX függvényeket VAGY 10+ függvény
    const advanced = all
      .filter(v => {
        const fns = parseDax(v);
        return fns.length >= 7 || hasAny(fns, ADVANCED_DAX);
      })
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 8)
      .map(videoCard);

    res.json([
      {
        id: 'beginner',
        title: 'Kezdő',
        icon: '🌱',
        description: 'Alapok és bevezető videók – ideális ha most ismerkedsz a Power BI-jal',
        color: '#16a34a',
        videos: beginner,
      },
      {
        id: 'intermediate',
        title: 'Középhaladó',
        icon: '⚡',
        description: 'CALCULATE, FILTER, SUM – az igazi DAX gondolkodásmód elsajátítása',
        color: '#f59e0b',
        videos: intermediate,
      },
      {
        id: 'advanced',
        title: 'Haladó',
        icon: '🔥',
        description: 'Time intelligence, RANKX, komplex modellek – profi szint',
        color: '#dc2626',
        videos: advanced,
      },
    ]);
  } catch (err) {
    next(err);
  }
});

router.get('/top10', (req, res, next) => {
  try {
    const videos = getAllVideos();
    const top10 = getTop10(videos).map((v) => ({
      ...v,
      transcriptAvailable: Boolean(v.has_transcript),
      titleHu: v.title_hu || null,
    }));
    const lastUpdated = getLastUpdated();
    res.json({ videos: top10, lastUpdated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/refresh
 * Elindítja a videógyűjtést yt-dlp-vel és visszaadja az eredményt.
 * Figyelmeztetés: ez a folyamat akár 1-2 percig is tarthat.
 *
 * @returns {{ collected: number, inserted: number, total: number, lastUpdated: string|null }}
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const ytdlpStatus = await checkYtdlpInstalled();
    if (!ytdlpStatus.installed) {
      return res.status(503).json({
        error: 'yt-dlp nincs telepítve',
        message: ytdlpStatus.message,
        helpUrl: ytdlpStatus.helpUrl,
      });
    }

    // Elindítjuk a frissítést a háttérben
    runRefresh().catch(err => console.error('[REFRESH] Háttér hiba:', err.message));

    res.json({
      message: 'Frissítés elindítva a háttérben.',
      status: 'running'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/videos/:id
 * Visszaad egy videót azonosító alapján, DAX függvény részletekkel kiegészítve.
 *
 * @returns {object} Videó objektum daxFunctions tömbje részletes referenciával
 */
router.get('/videos/:id', (req, res, next) => {
  try {
    const video = getVideoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Videó nem található' });

    let rawFunctions = [];
    try { rawFunctions = video.dax_functions ? JSON.parse(video.dax_functions) : []; } catch { /* sérült JSON */ }
    const daxFunctions = rawFunctions.map((name) => ({
      name,
      ...getDaxReference(name),
    }));

    let transcriptCuesHu = [];
    try { transcriptCuesHu = video.transcript_cues_hu ? JSON.parse(video.transcript_cues_hu) : []; } catch { /* sérült JSON */ }

    const chaptersJson = video.chapters_json ? JSON.parse(video.chapters_json) : [];

    // Háttérben fordítjuk a leírást ha hiányzik (nem blokkolja a választ)
    const looksHungarian = (t) => t && /[áéíóöőúüű]/i.test(t);
    if (!video.ai_summary_hu && !looksHungarian(video.description_hu)) {
      setImmediate(async () => {
        try {
          const { translateText } = await import('../services/translation.js');
          const descHu = await translateText((video.description || '').slice(0, 1500));
          if (descHu && looksHungarian(descHu)) {
            updateTranslations(video.id, { titleHu: video.title_hu, descriptionHu: descHu, transcriptHu: null });
            // Ha van Anthropic kulcs, AI összefoglalót generálunk, különben a fordítást mentjük
            const summary = await generateAiSummary({ ...video, description_hu: descHu });
            if (summary && looksHungarian(summary)) updateAiSummary(video.id, summary);
            else updateAiSummary(video.id, descHu);
          }
        } catch {}
      });
    }

    res.json({
      ...video,
      transcriptAvailable: Boolean(video.has_transcript),
      titleHu: video.title_hu || null,
      aiSummaryHu: video.ai_summary_hu || video.description_hu || null,
      daxFunctions,
      transcriptCuesHu,
      chaptersJson,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/videos/:id/subtitles
 * Bármely videóhoz letölti az automatikus feliratot és lefordítja magyarra.
 * Ha már van transcript_cues_hu, azonnal visszaadja (cache).
 *
 * @returns {{ cues: {start,end,text}[], cached: boolean }}
 */
router.post('/videos/:id/subtitles', async (req, res, next) => {
  try {
    const video = getVideoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Videó nem található' });

    // Cache: ha már van cue
    if (video.transcript_cues_hu && req.query.force !== 'true') {
      const cached = JSON.parse(video.transcript_cues_hu);
      // Ellenőrzés: az első 20 cue legalább 30%-a tartalmaz ékezetes betűt
      // (műszaki tartalomnál sok valid magyar mondat ékezet nélkül is helyes)
      const sample = cached.slice(0, Math.min(20, cached.length));
      const huCount = sample.filter(c => /[áéíóöőúüű]/i.test(c.text)).length;
      const ratio = sample.length ? huCount / sample.length : 0;
      if (ratio >= 0.3) {
        // Jól néznek ki – visszaadja gyorsan; a maradék <20% angolt háttérben fordítja
        const englishCues = cached.filter(c => !/[áéíóöőúüű]/i.test(c.text));
        if (englishCues.length > 0) {
          // Háttérben fordítja az angol cue-kat és menti
          translateCues(englishCues, englishCues.length).then(translated => {
            const merged = cached.map(c => {
              const fix = translated.find(t => t.start === c.start);
              return fix && /[áéíóöőúüű]/i.test(fix.text) ? fix : c;
            });
            updateTranscriptCues(video.id, merged);
          }).catch(() => {});
        }
        return res.json({ cues: cached, cached: true });
      }
      // Többségében angol → fordítja le újra az egészet
      const cuesHu = await translateCues(cached, 200);
      if (cuesHu.length) updateTranscriptCues(video.id, cuesHu);
      return res.json({ cues: cuesHu, cached: false });
    }

    const ytdlpStatus = await checkYtdlpInstalled();
    if (!ytdlpStatus.installed) {
      return res.status(503).json({ error: 'yt-dlp nincs telepítve' });
    }

    const videoUrl = video.video_url || `https://www.youtube.com/watch?v=${video.id}`;
    const { plainText: transcriptEn, cues: transcriptCues } = await downloadTranscript(video.id, videoUrl);

    if (!transcriptCues || !transcriptCues.length) {
      return res.status(404).json({ error: 'Ehhez a videóhoz nincs automatikus felirat' });
    }

    // Magyar fordítás mentése (plain text + szinkron cue-ok)
    if (!video.transcript_hu && transcriptEn) {
      const { translateText } = await import('../services/translation.js');
      const transcriptHu = await translateText(transcriptEn.slice(0, 4000));
      const saved = getVideoById(video.id);
      if (saved) {
        const db3 = (await import('../db/database.js')).getDatabase();
        db3.prepare(`UPDATE videos SET transcript_hu = :t, has_transcript = 1, updated_at = datetime('now') WHERE id = :id`).run({ t: transcriptHu || transcriptEn, id: video.id });
      }
    }

    const cuesHu = await translateCues(transcriptCues, 200);
    if (cuesHu.length) updateTranscriptCues(video.id, cuesHu);

    res.json({ cues: cuesHu, cached: false });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/archive
 * Visszaadja az összes manuálisan importált és archivált videót.
 *
 * @returns {object[]} Importált videók tömbje
 */
router.get('/archive', (req, res, next) => {
  try {
    const videos = getImportedVideos().map((v) => ({
      ...v,
      titleHu: v.title_hu || null,
      transcriptAvailable: Boolean(v.has_transcript),
    }));
    res.json({ videos });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/import-video
 * Egy felhasználó által megadott YouTube URL alapján lekéri, lefordítja és elmenti a videót.
 * Szinkron feldolgozás – a válasz csak az elemzés végeztével érkezik.
 *
 * @body {{ url: string }}
 * @returns {{ id: string, title: string, titleHu: string|null }}
 */
router.post('/import-video', async (req, res, next) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Hiányzó URL' });
    }
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return res.status(400).json({ error: 'Csak YouTube URL-t fogadunk el' });
    }

    const ytdlpStatus = await checkYtdlpInstalled();
    if (!ytdlpStatus.installed) {
      return res.status(503).json({ error: 'yt-dlp nincs telepítve', message: ytdlpStatus.message });
    }

    const video = await fetchSingleVideo(url.trim());
    if (!video) {
      return res.status(404).json({ error: 'A videó nem található vagy nem elérhető' });
    }

    upsertVideos([video]);
    markAsImported(video.id);

    // Azonnali válasz – a további feldolgozás háttérben folytatódik
    res.json({
      id: video.id,
      title: video.title,
      titleHu: null,
      processing: true,
    });

    // Háttérfeldolgozás (fordítás, felirat, AI összefoglaló)
    (async () => {
      try {
        // DAX elemzés
        const text = `${video.title || ''} ${video.description || ''}`;
        updateDaxFunctions(video.id, extractDaxFunctions(text));

        // Felirat letöltés
        const videoUrl = video.videoUrl || `https://www.youtube.com/watch?v=${video.id}`;
        console.log(`[IMPORT] ${video.id}: felirat letöltés...`);
        const { plainText: transcriptEn, cues: transcriptCues } = await downloadTranscript(video.id, videoUrl);
        console.log(`[IMPORT] ${video.id}: felirat ${transcriptCues?.length ?? 0} cue, szöveg ${transcriptEn?.length ?? 0} kar`);

        // Magyar fordítás
        const saved = getVideoById(video.id);
        if (saved && !saved.title_hu) {
          const { titleHu, descriptionHu, transcriptHu } = await translateVideo({
            id: video.id,
            title: video.title,
            description: video.description,
            title_hu: null,
            transcript: transcriptEn ? transcriptEn.slice(0, 4000) : null,
          });
          updateTranslations(video.id, { titleHu, descriptionHu, transcriptHu });
          if (transcriptEn) {
            const db2 = (await import('../db/database.js')).getDatabase();
            db2.prepare(`UPDATE videos SET has_transcript = 1 WHERE id = :id`).run({ id: video.id });
          }
        }

        // Magyar felirat cue-ok
        if (transcriptCues && transcriptCues.length > 0) {
          console.log(`[IMPORT] ${video.id}: ${transcriptCues.length} cue fordítás...`);
          const cuesHu = await translateCues(transcriptCues, 200);
          console.log(`[IMPORT] ${video.id}: ${cuesHu.length} lefordított cue`);
          if (cuesHu.length) updateTranscriptCues(video.id, cuesHu);
        }

        // AI összefoglaló
        const fresh = getVideoById(video.id);
        if (fresh && !fresh.ai_summary_hu) {
          const summary = await generateAiSummary({
            title: video.title,
            channel_title: video.channelTitle,
            description: video.description,
            description_hu: fresh.description_hu,
          });
          if (summary) updateAiSummary(video.id, summary);
        }

        // DAX újrakinyerés a kész adatokkal
        const done = getVideoById(video.id);
        const fullText = `${video.title || ''} ${video.description || ''} ${done?.ai_summary_hu || ''} ${done?.transcript_hu || ''}`;
        updateDaxFunctions(video.id, extractDaxFunctions(fullText));
      } catch (err) { console.error(`[IMPORT] ${video.id} háttérfeldolgozás hiba:`, err.message); }
    })();
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/videos/:id/analyze-chapter
 * Body: { chapterIndex, chapterTitle, chapterTime, chapterEndTime }
 * Uses stored transcript_hu + Anthropic API for senior-level Hungarian analysis.
 *
 * @returns {{ analysis: string, cached: boolean }}
 */
router.post('/videos/:id/analyze-chapter', async (req, res, next) => {
  try {
    const video = getVideoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Videó nem található' });

    const { chapterTitle, chapterTime, chapterEndTime } = req.body;

    const transcriptContext = video.transcript_hu || video.transcript || '';
    const videoTitle = video.title_hu || video.title || '';

    const timeLabel = chapterEndTime
      ? `${formatChapterTime(chapterTime)} – ${formatChapterTime(chapterEndTime)}`
      : formatChapterTime(chapterTime);

    const prompt = `Te egy senior Power BI szakértő vagy. A tanuló éppen ezt a fejezetet nézi:

Videó: "${videoTitle}"
Fejezet: "${chapterTitle}" (${timeLabel})
${transcriptContext ? `\nVideó átirat:\n${transcriptContext.slice(0, 2000)}\n` : ''}

FELADATOD: Csak azt add hozzá, amit a videó NEM mond el! Ne ismételd a videó tartalmát!

Írj egy tömör, strukturált kiegészítést markdown-ban:

## Miért fontos ez?
(1-2 mondat – kontextus, amire a videó nem tér ki)

## Amit a videó nem mondott el
(2-3 konkrét szakmai tipp, best practice, vagy buktatók)

## Gyakorlati példa
(1 konkrét DAX/Power BI példa ha releváns, egyébként hagyd ki)

Maximum 350 szó. Tömör, pontos, senior szintű.`;

    let analysis = null;

    // 1. Claude-haiku (ha van API kulcs)
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const message = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        });
        analysis = message.content[0]?.text || null;
      } catch { /* folytatjuk Groq-kal */ }
    }

    // 2. Groq fallback (ingyenes API, llama-3.3-70b)
    if (!analysis && process.env.GROQ_API_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
          body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(20000),
        });
        if (groqRes.ok) analysis = (await groqRes.json())?.choices?.[0]?.message?.content?.trim() || null;
      } catch { /* folytatjuk */ }
    }

    if (!analysis) {
      return res.json({
        analysis: `**${chapterTitle}** (${timeLabel})\n\nAz AI elemzéshez add meg a GROQ_API_KEY vagy ANTHROPIC_API_KEY környezeti változót.`,
        cached: false,
      });
    }

    res.json({ analysis, cached: false });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/videos/generate-chapters-all
 * Batch: minden fejezet nélküli videóhoz generál fejezeteket (háttérben).
 * FONTOS: ez a route az /:id előtt kell, hogy az Express ne kezelje "all"-t ID-ként!
 */
router.post('/videos/generate-chapters-all', async (req, res) => {
  const videos = getAllVideos();
  const missing = videos.filter(v => !v.chapters || v.chapters.length === 0);
  res.json({ total: missing.length, message: 'Fejezet-generálás háttérben fut...' });

  (async () => {
    for (const v of missing) {
      try {
        await fetch(`http://localhost:3001/api/videos/${v.id}/generate-chapters`, { method: 'POST' });
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        console.error(`[generate-chapters-all] hiba: ${v.id}`, e.message);
      }
    }
    console.log('✅ Összes fejezet generálás kész');
  })();
});

/**
 * POST /api/videos/:id/generate-chapters
 * Claude-haiku alapján 5–9 fejezetet generál a transcript_hu-ból.
 * @returns {{ chapters: Array<{time, timeStr, title}> }}
 */
router.post('/videos/:id/generate-chapters', async (req, res, next) => {
  try {
    const video = getVideoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Videó nem található' });

    // transcript_hu hiányában a cue-okból építünk szöveget
    let transcript = video.transcript_hu || video.transcript || '';
    if (transcript.length < 200 && video.transcript_cues_hu) {
      try {
        const cues = JSON.parse(video.transcript_cues_hu);
        transcript = cues.map(c => c.text).join(' ');
      } catch { /* skip */ }
    }
    if (transcript.length < 200) {
      return res.status(400).json({ error: 'Nincs elég átírat a fejezet-generáláshoz' });
    }

    const durationMin = Math.round((video.duration || 600) / 60);
    const prompt = `Az alábbi Power BI oktatóvideó magyar átiratából generálj 5-9 fejezetet.
Videó cím: ${video.title_hu || video.title}
Videó hossza: ~${durationMin} perc

Átirat (első 4000 karakter):
${transcript.slice(0, 4000)}

Válaszolj CSAK JSON tömbként, semmi más szöveg:
[{"timeStr":"MM:SS","title":"Magyar fejezet cím"}]

Szabályok:
- 5-9 fejezet
- timeStr formátum: "MM:SS" (pl. "02:30"), HH:MM:SS is elfogadott
- Az első fejezet mindig "00:00"
- Logikus tartalmi egységek (bevezetés, témák, összefoglalás)
- Rövid, informatív magyar címek (3-7 szó)
- Az időpontok arányosan oszoljanak el a videó hosszán belül`;

    let raw = null;

    // 1. Claude-haiku (ha van API kulcs)
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        });
        raw = msg.content[0].text.trim();
      } catch { /* folytatjuk Groq-kal */ }
    }

    // 2. Groq fallback (ingyenes API)
    if (!raw && process.env.GROQ_API_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
          body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(20000),
        });
        if (groqRes.ok) raw = (await groqRes.json())?.choices?.[0]?.message?.content?.trim() || null;
      } catch { /* folytatjuk */ }
    }

    if (!raw) return res.status(503).json({ error: 'Fejezet generálás nem sikerült. Ellenőrizd a GROQ_API_KEY-t.' });
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: 'Érvénytelen AI válasz', raw });

    const parsed = JSON.parse(jsonMatch[0]);
    const chapters = parsed.map(ch => {
      const parts = ch.timeStr.split(':').map(Number);
      const time = parts.length === 2
        ? parts[0] * 60 + parts[1]
        : parts[0] * 3600 + parts[1] * 60 + parts[2];
      return { time, timeStr: ch.timeStr, title: ch.title };
    });

    updateChapters(req.params.id, chapters);
    res.json({ chapters });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/videos/:id/analyze-ollama
 * Szakértői elemzés: Claude → Groq
 * @returns {{ summary: string }}
 */
router.post('/videos/:id/analyze-ollama', async (req, res, next) => {
  try {
    const video = getVideoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Videó nem található' });

    const summary = await generateAiSummary({
      title: video.title,
      channel_title: video.channel_title,
      description: video.description,
      description_hu: video.description_hu,
    });

    if (!summary) return res.status(502).json({ error: 'Elemzés nem sikerült. Ellenőrizd az API key-t.' });

    updateAiSummary(video.id, summary);
    res.json({ summary });
  } catch (err) {
    next(err);
  }
});

function formatChapterTime(seconds) {
  if (seconds === null) return '??:??';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * POST /api/videos/:id/transcribe
 * Groq Whisper-large-v3 felirat generálás videókhoz amiknek nincs YouTube auto-caption.
 * Ingyenes: https://console.groq.com/keys (GROQ_API_KEY a .env-be)
 *
 * @returns {{ cues: object[], generated: boolean }}
 */
router.post('/videos/:id/transcribe', async (req, res, next) => {
  try {
    const video = getVideoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Videó nem található' });

    if (!process.env.GROQ_API_KEY) {
      return res.status(400).json({
        error: 'GROQ_API_KEY nincs beállítva',
        hint: 'Ingyenes kulcs (nincs hitelkártya): https://console.groq.com/keys → add hozzá a .env-hez',
      });
    }

    // 1. Whisper átírás (angol) – Flask szerver > Groq fallback
    let cuesEn;
    const flaskAvailable = await ensureFlaskRunning();
    if (flaskAvailable) {
      console.log('[TRANSCRIBE] Faster-Whisper Flask szerver elérhető – azt használjuk');
      cuesEn = await transcribeWithFlask(video.id);
    } else {
      console.log('[TRANSCRIBE] Flask szerver nem indult el – Groq Whisper fallback');
      if (!process.env.GROQ_API_KEY) {
        return res.status(400).json({
          error: 'Sem a helyi Whisper szerver (http://127.0.0.1:5000), sem GROQ_API_KEY nincs elérhető.',
          hint: 'Indítsd el: python C:/Users/bajsz/Desktop/Szinkron/app.py',
        });
      }
      try {
        cuesEn = await transcribeAudio(video.id, process.env.GROQ_API_KEY);
      } catch (err) {
        const msg = err?.message || '';
        const retryMatch = msg.match(/try again in (\d+m\d+s|\d+s)/i);
        if (msg.includes('rate_limit_exceeded') || msg.includes('429')) {
          return res.status(429).json({
            error: 'Groq rate limit – próbáld újra pár perc múlva',
            retryAfter: retryMatch?.[1] || '5 perc',
          });
        }
        throw err;
      }
    }

    if (!cuesEn.length) {
      return res.status(422).json({ error: 'Az átírás nem adott vissza szöveget' });
    }

    // 2. Magyar fordítás
    const cuesHu = await translateCues(cuesEn, 200);

    // 3. Mentés DB-be
    updateTranscriptCues(video.id, cuesHu);

    res.json({ cues: cuesHu, generated: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/videos/:id/translate
 * Lefordítja a videó címét és leírását claude-haiku-val (fallback: translateVideo).
 * Ha már van title_hu, force=true query paraméterrel felülírható.
 * @returns {{ titleHu, descriptionHu }}
 */
router.post('/videos/:id/translate', async (req, res, next) => {
  try {
    const video = getVideoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Videó nem található' });

    const isHu = (t) => t && /[áéíóöőúüű]/i.test(t);
    if (isHu(video.title_hu) && req.query.force !== 'true') {
      return res.json({ titleHu: video.title_hu, descriptionHu: video.description_hu, cached: true });
    }

    const { titleHu, descriptionHu } = await translateVideo({
      id: video.id,
      title: video.title,
      description: video.description,
      title_hu: null, // force translate
    });

    // Ha nincs magyar karakter a fordításban (pl. angol cím), mentsük az eredetit fallbackként
    const finalTitleHu = isHu(titleHu) ? titleHu : (titleHu || video.title_hu || video.title);
    const finalDescHu = isHu(descriptionHu) ? descriptionHu : (descriptionHu || video.description_hu);
    updateTranslations(video.id, {
      titleHu: finalTitleHu,
      descriptionHu: finalDescHu,
      transcriptHu: null,
    });

    res.json({ titleHu: finalTitleHu, descriptionHu: finalDescHu });
  } catch (err) {
    next(err);
  }
});

/** Fordítás folyamat állapota – GET /api/translate-all/progress */
let translateProgress = { running: false, done: 0, total: 0, current: '' };

/**
 * GET /api/translate-all/progress
 * Visszaadja az aktuális fordítás folyamat állapotát.
 */
router.get('/translate-all/progress', (req, res) => {
  res.json(translateProgress);
});

/**
 * POST /api/translate-all
 * Lefordítja az összes videót ahol hiányzik a magyar cím – háttérben fut.
 * @returns {{ queued: number }}
 */
router.post('/translate-all', async (req, res, next) => {
  try {
    const all = getAllVideos();
    const isHu = (t) => t && /[áéíóöőúüű]/i.test(t);
    const untranslated = all.filter(v => !isHu(v.title_hu));

    translateProgress = { running: true, done: 0, total: untranslated.length, current: '' };
    res.json({ queued: untranslated.length, message: `${untranslated.length} videó fordítása elindítva háttérben` });

    // Háttérben fordít – nem blokkolja a választ
    (async () => {
      for (const video of untranslated) {
        translateProgress.current = video.title || video.id;
        try {
          const { titleHu, descriptionHu } = await translateVideo({
            id: video.id,
            title: video.title,
            description: video.description,
            title_hu: null,
          });
          if (isHu(titleHu)) {
            updateTranslations(video.id, { titleHu, descriptionHu: isHu(descriptionHu) ? descriptionHu : video.description_hu, transcriptHu: null });
          }
          await new Promise(r => setTimeout(r, 500));
        } catch { /* folytatódik a következővel */ }
        translateProgress.done++;
      }
      translateProgress.running = false;
      translateProgress.current = '';
    })();
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/videos/:id/related
 * Kapcsolódó videók DAX függvény átfedés alapján.
 */
router.get('/videos/:id/related', (req, res, next) => {
  try {
    const related = getRelatedVideos(req.params.id, 4);
    res.json({ related });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reextract-dax-ai
 * Claude haiku AI-alapú DAX kinyerés az összes videóra ahol dax_functions üres.
 */
router.post('/reextract-dax-ai', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: 'ANTHROPIC_API_KEY hiányzik' });
  }
  const all = getAllVideos();
  const empty = all.filter(v => {
    try { return !JSON.parse(v.dax_functions || '[]').length; } catch { return true; }
  });
  res.json({ queued: empty.length, message: `${empty.length} videó AI DAX kinyerés elindítva` });

  (async () => {
    const { getAllDaxFunctionNames } = await import('../services/daxAnalyzer.js');
    const allDax = getAllDaxFunctionNames();
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    for (const video of empty) {
      try {
        const title = video.title_hu || video.title || '';
        const summary = (video.ai_summary_hu || video.description_hu || video.description || '').slice(0, 500);
        const transcript = (video.transcript_hu || '').slice(0, 800);

        const msg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `Melyik DAX függvények szerepelnek ebben a Power BI videóban? Csak JSON tömb, pl ["CALCULATE","SUM"]. Ha nincs: []\n\nVideó: "${title}"\n${summary}\n${transcript}\n\nElérhető: ${allDax.slice(0, 60).join(',')}`,
          }],
        });
        const text = msg.content[0]?.text || '[]';
        const match = text.match(/\[[\s\S]*?\]/);
        if (match) {
          const found = JSON.parse(match[0]).filter(fn => allDax.includes(fn.toUpperCase())).map(fn => fn.toUpperCase());
          if (found.length) updateDaxFunctions(video.id, found);
        }
        await new Promise(r => setTimeout(r, 500));
      } catch { /* folytatódik */ }
    }
  })();
});

/**
 * POST /api/reextract-dax
 * Újra kinyeri a DAX függvényeket az összes videóból (title + description + ai_summary_hu + transcript_hu).
 */
router.post('/reextract-dax', (req, res) => {
  const all = getAllVideos();
  let updated = 0;
  for (const video of all) {
    try {
      const text = `${video.title || ''} ${video.description || ''} ${video.ai_summary_hu || ''} ${video.transcript_hu || ''}`;
      const fns = extractDaxFunctions(text);
      updateDaxFunctions(video.id, fns);
      updated++;
    } catch { /* folytatódik */ }
  }
  res.json({ updated, total: all.length });
});

/**
 * POST /api/videos/:id/ai-panel
 * AI oldalpanel – Microsoft Learn keresés + Claude-haiku elemzés.
 * Body: { chapterTitle, chapterTime, chapterEndTime, videoTitle }
 * @returns {{ analysis, sources: [{title, url}] }}
 */
router.post('/videos/:id/ai-panel', async (req, res, next) => {
  try {
    const video = getVideoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Videó nem található' });

    const { chapterTitle, chapterTime, chapterEndTime } = req.body;
    const videoTitle = video.title_hu || video.title || '';

    // 1. Microsoft Learn keresés (hivatalos forrás)
    const query = encodeURIComponent(`power bi ${chapterTitle}`);
    let sources = [];
    let docsContext = '';

    try {
      const searchRes = await fetch(
        `https://learn.microsoft.com/api/search?search=${query}&locale=en-us&%24top=3&facet=products%2Fpower-bi`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (searchRes.ok) {
        const data = await searchRes.json();
        const results = data.results?.slice(0, 3) || [];
        sources = results.map(r => ({ title: r.title, url: r.url }));
        docsContext = results
          .map(r => `**${r.title}**\n${r.description || ''}\nForrás: ${r.url}`)
          .join('\n\n');
      }
    } catch { /* Microsoft Learn nem elérhető – csak videó kontextus */ }

    // 2. AI elemzés – Claude → Groq → Ollama
    const timeLabel = chapterEndTime !== null
      ? `${formatChapterTime(chapterTime)}–${formatChapterTime(chapterEndTime)}`
      : formatChapterTime(chapterTime);

    const transcriptSnippet = (video.transcript_hu || video.transcript || '').slice(0, 1500);

    const panelPrompt = `Te egy senior Power BI / adatelemzési szakértő vagy. A következő videófejezetet egészítsd ki szakmailag magyarul.

Videó: "${videoTitle}"
Fejezet: "${chapterTitle}" (${timeLabel})

${transcriptSnippet ? `Videó átirat kontextus:\n${transcriptSnippet}\n\n` : ''}${docsContext ? `Microsoft Learn hivatalos dokumentáció:\n${docsContext}\n\n` : ''}

Kérlek:
1. Magyarázd el röviden miről szól ez a fejezet (2-3 mondat)
2. Adj hozzá 1-2 szakmai tippet vagy best practice-t ami a videóban nem hangzik el
3. Ha DAX függvény vagy Power BI funkció szerepel, adj egy gyakorlati példát
4. Maximum 400 szó, strukturált markdown formátumban, tömören

Ne ismételd meg amit a videóban már elmondanak – csak KIEGÉSZÍTSD!`;

    let analysis = null;

    // Claude-haiku (ha van API kulcs)
    if (!analysis && process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const message = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 900,
          messages: [{ role: 'user', content: panelPrompt }],
        });
        analysis = message.content[0]?.text || null;
      } catch { /* folytatjuk */ }
    }

    // Groq llama-3.3-70b fallback (ingyenes)
    if (!analysis && process.env.GROQ_API_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
          body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 900, messages: [{ role: 'user', content: panelPrompt }] }),
          signal: AbortSignal.timeout(25000),
        });
        if (groqRes.ok) analysis = (await groqRes.json())?.choices?.[0]?.message?.content?.trim() || null;
      } catch { /* folytatjuk */ }
    }

    res.json({ analysis: analysis || '', sources });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/videos/:id/chapters
 * Body: { chapters: [{time: number, timeStr: string, title: string}] }
 */
router.put('/videos/:id/chapters', async (req, res, next) => {
  try {
    const video = getVideoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Videó nem található' });
    const { chapters } = req.body;
    if (!Array.isArray(chapters)) return res.status(400).json({ error: 'chapters tömb kötelező' });
    updateChapters(req.params.id, chapters);
    res.json({ ok: true, count: chapters.length });
  } catch (err) { next(err); }
});

/**
 * POST /api/videos/:id/extract-dax-ai
 * Claude haiku azonosítja a DAX függvényeket a videó szövegéből (fordított tartalomnál is működik).
 */
router.post('/videos/:id/extract-dax-ai', async (req, res, next) => {
  try {
    const video = getVideoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Videó nem található' });

    const { getAllDaxFunctionNames } = await import('../services/daxAnalyzer.js');
    const allDax = getAllDaxFunctionNames();
    const title = video.title_hu || video.title || '';
    const summary = video.ai_summary_hu || video.description_hu || video.description || '';
    const transcript = (video.transcript_hu || video.transcript || '').slice(0, 2000);

    const daxPrompt = `Az alábbi Power BI videó tartalmából azonosítsd, melyik DAX függvények szerepelnek vagy kerülnek bemutatásra.

Videó: "${title}"
Összefoglaló: ${summary.slice(0, 500)}
Átirat: ${transcript.slice(0, 800)}

Elérhető DAX függvények listája (csak ezek közül választhatsz):
${allDax.slice(0, 80).join(', ')}

Válaszolj CSAK egy JSON tömbben, pl: ["CALCULATE","FILTER","SUM"]
Ha nincs egyértelmű DAX függvény a videóban, válaszolj: []`;

    let daxText = null;

    if (!daxText && process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const message = await client.messages.create({
          model: 'claude-haiku-4-5-20251001', max_tokens: 400,
          messages: [{ role: 'user', content: daxPrompt }],
        });
        daxText = message.content[0]?.text || null;
      } catch { /* folytatjuk */ }
    }

    if (!daxText && process.env.GROQ_API_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
          body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 400, messages: [{ role: 'user', content: daxPrompt }] }),
          signal: AbortSignal.timeout(15000),
        });
        if (groqRes.ok) daxText = (await groqRes.json())?.choices?.[0]?.message?.content?.trim() || null;
      } catch { /* folytatjuk */ }
    }

    if (!daxText) return res.json({ daxFunctions: [] });
    const match = daxText.match(/\[[\s\S]*?\]/);
    if (!match) return res.json({ daxFunctions: [] });

    const found = JSON.parse(match[0]).filter(fn => allDax.includes(fn.toUpperCase())).map(fn => fn.toUpperCase());
    updateDaxFunctions(video.id, found);
    res.json({ daxFunctions: found });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/videos/:id/quiz
 * 5 feleletválasztós kvíz kérdés generálása claude-haiku-val az AI összefoglaló alapján.
 * @returns {{ questions: [{q, options, correct}] }}
 */
router.get('/videos/:id/quiz', async (req, res, next) => {
  try {
    const video = getVideoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Videó nem található' });

    const summary = video.ai_summary_hu || video.description_hu || video.description || '';
    const title = video.title_hu || video.title || '';
    const daxFns = video.dax_functions ? JSON.parse(video.dax_functions) : [];

    if (!summary && !daxFns.length) {
      return res.status(422).json({ error: 'Nincs elég tartalom a kvíz generálásához – fordítás szükséges' });
    }

    const prompt = `Te egy Power BI oktató vagy. Generálj 5 feleletválasztós kvíz kérdést CSAK erről a videóról:

Videó: "${title}"
${summary ? `Összefoglaló:\n${summary.slice(0, 1200)}\n` : ''}${daxFns.length ? `DAX függvények: ${daxFns.join(', ')}\n` : ''}

KÖTELEZŐ FORMÁTUM – csak ezt add vissza (valid JSON tömb, semmi más):
[
  {
    "q": "Kérdés szövege?",
    "options": ["A válasz", "B válasz", "C válasz", "D válasz"],
    "correct": 0
  }
]

Szabályok:
- Pontosan 5 kérdés
- "correct" az options tömb 0-alapú indexe
- Egyértelműen helyes válasz legyen
- Magyar nyelvű kérdések és válaszok
- Power BI / DAX témájú kérdések`;

    let rawText = null;

    // Claude-haiku (ha van API kulcs)
    if (!rawText && process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const message = await client.messages.create({
          model: 'claude-haiku-4-5-20251001', max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        });
        rawText = message.content[0]?.text || null;
      } catch { /* folytatjuk */ }
    }

    // Groq fallback (ingyenes)
    if (!rawText && process.env.GROQ_API_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
          body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(30000),
        });
        if (groqRes.ok) rawText = (await groqRes.json())?.choices?.[0]?.message?.content?.trim() || null;
      } catch { /* folytatjuk */ }
    }

    if (!rawText) return res.status(500).json({ error: 'Kvíz generálás sikertelen' });
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: 'Kvíz generálás sikertelen' });

    const questions = JSON.parse(jsonMatch[0]);
    res.json({ questions: questions.slice(0, 5) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/translate
 * Body: { texts: string[] }
 * Fordít egy szöveg tömböt magyarra (fejezet cím fordításhoz).
 * @returns {{ translations: string[] }}
 */
router.post('/translate', async (req, res, next) => {
  try {
    const { texts } = req.body;
    if (!Array.isArray(texts) || !texts.length) return res.status(400).json({ error: 'texts tömb kötelező' });
    const { translateText } = await import('../services/translation.js');
    const isHu = (t) => t && /[áéíóöőúüű]/i.test(t);
    const translations = [];
    for (const text of texts) {
      if (!text || isHu(text)) { translations.push(text); continue; }
      try {
        const hu = await translateText(text);
        translations.push((hu && isHu(hu)) ? hu : text);
      } catch { translations.push(text); }
    }
    res.json({ translations });
  } catch (err) { next(err); }
});

/**
 * POST /api/videos/:id/import-srt
 * Body: { srtContent: string }
 * SRT vagy TXT felirat importálása – felülírja a meglévő transcriptCuesHu-t.
 */
router.post('/videos/:id/import-srt', (req, res, next) => {
  try {
    const video = getVideoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Videó nem található' });

    const { srtContent } = req.body;
    if (!srtContent || typeof srtContent !== 'string') {
      return res.status(400).json({ error: 'srtContent kötelező' });
    }

    const cues = parseSrt(srtContent);
    if (!cues.length) return res.status(400).json({ error: 'Nem sikerült cue-kat kinyerni a fájlból' });

    // DB mentés – ugyanaz a mező mint a Whisper átiratnál
    updateTranscriptCues(req.params.id, cues);

    res.json({ ok: true, count: cues.length, cues });
  } catch (err) { next(err); }
});

/**
 * POST /api/videos/:id/whisper-transcribe
 * Fájl feltöltés → Groq Whisper átírás → cue-ok mentése DB-be.
 * Fájl küldése: raw binary body, Content-Type: audio/mpeg stb.
 * Query param: ?filename=video.mp3
 */
router.post('/videos/:id/whisper-transcribe',
  express.raw({ type: '*/*', limit: '50mb' }),
  async (req, res, next) => {
    try {
      const video = getVideoById(req.params.id);
      if (!video) return res.status(404).json({ error: 'Videó nem található' });
      if (!process.env.GROQ_API_KEY) return res.status(400).json({ error: 'GROQ_API_KEY hiányzik' });
      if (!req.body || !req.body.length) return res.status(400).json({ error: 'Üres fájl' });

      const filename = (req.query.filename || 'audio.mp3').replace(/[^a-zA-Z0-9._-]/g, '_');
      const tmpPath = path.join(os.tmpdir(), `whisper_${Date.now()}_${filename}`);

      await fsPromises.writeFile(tmpPath, req.body);
      try {
        const cues = await transcribeLocalAudio(tmpPath, process.env.GROQ_API_KEY);
        if (!cues.length) return res.status(400).json({ error: 'Nem sikerült szöveget felismerni' });
        updateTranscriptCues(req.params.id, cues);
        res.json({ ok: true, count: cues.length, cues });
      } finally {
        try { await fsPromises.unlink(tmpPath); } catch {}
      }
    } catch (err) { next(err); }
  }
);

/** SRT szöveg → [{start, end, text}] cue tömb */
function parseSrt(content) {
  const cues = [];
  // SRT blokkok: szám \n időbélyeg \n szöveg \n\n
  const blocks = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    // Időbélyeg sor keresése: 00:00:01,000 --> 00:00:04,000
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;

    const match = timeLine.match(/(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})/);
    if (!match) continue;

    const start = srtTimeToSeconds(match[1]);
    const end = srtTimeToSeconds(match[2]);

    // Szöveg sorok (időbélyeg és sorszám után)
    const timeIdx = lines.indexOf(timeLine);
    const textLines = lines.slice(timeIdx + 1).filter(l => l.trim() && !/^\d+$/.test(l.trim()));
    const text = textLines.join(' ').trim();

    if (text && end > start) cues.push({ start, end, text });
  }
  return cues;
}

/**
 * GET /api/videos/:id/dubtrack
 * Visszaadja a generált WAV fájlt vagy 404-et ha még nincs.
 */
router.get('/videos/:id/dubtrack', async (req, res) => {
  const { id } = req.params;
  const exists = await dubtrackExists(id);
  if (!exists) return res.status(404).json({ error: 'Nincs dubtrack – generáld először' });
  const filePath = getDubtrackPath(id);
  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const stat = await fsPromises.stat(filePath);
  res.setHeader('Content-Length', stat.size);
  const { createReadStream } = await import('fs');
  createReadStream(filePath).pipe(res);
});

/** Dubtrack generálás valósidejű progressjéhez (videoId → {done, total}) */
const dubtrackProgress = new Map();

/**
 * GET /api/videos/:id/dubtrack-progress
 * Visszaadja a folyamatban lévő dubtrack generálás előrehaladását.
 */
router.get('/videos/:id/dubtrack-progress', (req, res) => {
  const p = dubtrackProgress.get(req.params.id);
  res.json(p ?? { done: 0, total: 0 });
});

/**
 * POST /api/videos/:id/generate-dubtrack
 * Generálja a teljes magyar szinkronsávot (WAV) a cue-ok alapján.
 * Body: { voice?, rate?, pitch? }
 * @returns {{ url, duration, cueCount }}
 */
router.post('/videos/:id/generate-dubtrack', async (req, res) => {
  const video = getVideoById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Videó nem található' });

  const { voice = 'noemi', rate = '-10%', pitch = '-5Hz' } = req.body;
  const id = req.params.id;
  res.setHeader('Content-Type', 'application/json');
  dubtrackProgress.set(id, { done: 0, total: 0 });

  try {
    // 1. Teljes angol átírat letöltése – minden cue kell a dubtrackhez
    const videoUrl = video.video_url || `https://www.youtube.com/watch?v=${video.id}`;
    let allEnCues = [];
    try {
      const { cues: enCues } = await downloadTranscript(video.id, videoUrl);
      allEnCues = enCues || [];
    } catch (err) {
      console.warn('[DUBTRACK] Átírat letöltés hiba:', err.message);
    }

    // 2. Meglévő fordítás betöltése (cache)
    let cachedHu = [];
    try {
      cachedHu = video.transcript_cues_hu ? JSON.parse(video.transcript_cues_hu) : [];
    } catch { cachedHu = []; }

    // 3. Ha az angol cue-k száma > lefordított cue-k száma → fordítsuk le a többit is
    let allCues;
    if (allEnCues.length > cachedHu.length + 10) {
      console.log(`[DUBTRACK] Teljes fordítás: ${allEnCues.length} en cue, eddig ${cachedHu.length} hu cue`);
      // Lefordítjuk az összes angol cue-t (nincs limit)
      const fullHu = await translateCues(allEnCues, allEnCues.length);
      if (fullHu.length > cachedHu.length) {
        updateTranscriptCues(video.id, fullHu);
        console.log(`[DUBTRACK] Mentve ${fullHu.length} lefordított cue`);
      }
      allCues = fullHu;
    } else {
      // Már elegendő fordítás van – használjuk a cache-t
      allCues = cachedHu;
    }

    if (!allCues.length) {
      dubtrackProgress.delete(id);
      return res.status(400).json({ error: 'Nincs felirat – először generálj feliratot' });
    }

    console.log(`[DUBTRACK] ${allCues.length} cue-val generálás indul`);
    const result = await generateDubtrack(id, allCues, {
      voice, rate, pitch,
      onProgress: (done, total) => {
        dubtrackProgress.set(id, { done, total });
        console.log(`[DUBTRACK] ${id}: ${done}/${total} (${Math.round(done/total*100)}%)`);
      },
    });
    dubtrackProgress.delete(id);
    res.json({ url: `/api/videos/${id}/dubtrack`, duration: result.duration, cueCount: result.cueCount });
  } catch (err) {
    dubtrackProgress.delete(id);
    console.error('[DUBTRACK] Generálás hiba:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function srtTimeToSeconds(t) {
  const clean = t.replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  return 0;
}

export default router;
