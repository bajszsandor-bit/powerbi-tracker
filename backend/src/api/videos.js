/**
 * @file videos.js (api)
 * @description Videó lista API route-ok.
 */

import { Router } from 'express';
import { getAllVideos, getVideoById, getLastUpdated, updateDaxFunctions, updateTranslations, updateAiSummary, markAsImported, getImportedVideos, updateTranscriptCues } from '../db/videoRepository.js';
import { getTop10 } from '../services/scoring.js';
import { getDaxReference, extractDaxFunctions } from '../services/daxAnalyzer.js';
import { checkYtdlpInstalled, collectVideos, fetchSingleVideo } from '../services/ytdlp.js';
import { upsertVideos } from '../db/videoRepository.js';
import { translateVideo, translateCues } from '../services/translation.js';
import { generateAiSummary } from '../services/aiSummary.js';
import { downloadTranscript } from '../services/transcript.js';

const router = Router();

/**
 * GET /api/top10
 * Visszaadja a scoring alapján kiválasztott Top 10 videót.
 * Csak az elmúlt 30 napon belüli videók szerepelnek.
 *
 * @returns {object[]} Top 10 videó score és freshnessScore mezőkkel
 */
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

    const videos = await collectVideos();
    const inserted = upsertVideos(videos);

    // Minden frissen gyűjtött videó elemzése háttérben (nem blokkolja a választ)
    res.json({
      collected: videos.length,
      inserted,
      total: getAllVideos().length,
      lastUpdated: getLastUpdated(),
    });

    // DAX elemzés + magyar fordítás háttérben
    (async () => {
      for (const video of videos) {
        try {
          // DAX függvények kinyerése a cím + leírásból
          const text = `${video.title || ''} ${video.description || ''}`;
          const daxFns = extractDaxFunctions(text);
          updateDaxFunctions(video.id, daxFns);

          // Magyar fordítás (cím + leírás)
          const saved = getVideoById(video.id);
          if (saved && !saved.title_hu) {
            const { titleHu, descriptionHu } = await translateVideo({
              id: video.id,
              title: video.title,
              description: video.description,
              title_hu: null,
            });
            updateTranslations(video.id, { titleHu, descriptionHu, transcriptHu: null });
          }

          // AI magyar oktatói összefoglaló generálása (ha nincs még)
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
        } catch {
          // egyedi hiba nem állítja le a többi elemzését
        }
      }
    })();
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

    const rawFunctions = video.dax_functions ? JSON.parse(video.dax_functions) : [];
    const daxFunctions = rawFunctions.map((name) => ({
      name,
      ...getDaxReference(name),
    }));

    const transcriptCuesHu = video.transcript_cues_hu
      ? JSON.parse(video.transcript_cues_hu)
      : [];

    res.json({
      ...video,
      transcriptAvailable: Boolean(video.has_transcript),
      titleHu: video.title_hu || null,
      aiSummaryHu: video.ai_summary_hu || null,
      daxFunctions,
      transcriptCuesHu,
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

    // Cache: ha már van lefordított cue → azonnal visszaadja
    if (video.transcript_cues_hu) {
      return res.json({ cues: JSON.parse(video.transcript_cues_hu), cached: true });
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

    // DAX elemzés
    const text = `${video.title || ''} ${video.description || ''}`;
    const daxFns = extractDaxFunctions(text);
    updateDaxFunctions(video.id, daxFns);

    // Felirat letöltés (angol, yt-dlp auto-sub)
    const videoUrl = video.videoUrl || `https://www.youtube.com/watch?v=${video.id}`;
    const { plainText: transcriptEn, cues: transcriptCues } = await downloadTranscript(video.id, videoUrl);

    // Magyar fordítás (cím + leírás + felirat szöveg)
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

    // Szinkronizált magyar cue-ok fordítása (max 200 mondat)
    if (transcriptCues && transcriptCues.length > 0) {
      const cuesHu = await translateCues(transcriptCues, 200);
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

    const final = getVideoById(video.id);
    res.json({
      id: video.id,
      title: video.title,
      titleHu: final?.title_hu || null,
      hasTranscript: Boolean(final?.has_transcript),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
