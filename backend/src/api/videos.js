/**
 * @file videos.js (api)
 * @description Videó lista API route-ok.
 */

import { Router } from 'express';
import { getAllVideos, getVideoById, getLastUpdated, updateDaxFunctions, updateTranslations, updateAiSummary } from '../db/videoRepository.js';
import { getTop10 } from '../services/scoring.js';
import { getDaxReference, extractDaxFunctions } from '../services/daxAnalyzer.js';
import { checkYtdlpInstalled, collectVideos, fetchSingleVideo } from '../services/ytdlp.js';
import { upsertVideos } from '../db/videoRepository.js';
import { translateVideo } from '../services/translation.js';
import { generateAiSummary } from '../services/aiSummary.js';

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

    res.json({
      ...video,
      transcriptAvailable: Boolean(video.has_transcript),
      titleHu: video.title_hu || null,
      aiSummaryHu: video.ai_summary_hu || null,
      daxFunctions,
    });
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

    // DAX elemzés
    const text = `${video.title || ''} ${video.description || ''}`;
    const daxFns = extractDaxFunctions(text);
    updateDaxFunctions(video.id, daxFns);

    // Magyar fordítás
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
    });
  } catch (err) {
    next(err);
  }
});

export default router;
