/**
 * @file videos.js (api)
 * @description Videó lista API route-ok.
 */

import { Router } from 'express';
import { getAllVideos, getVideoById } from '../db/videoRepository.js';
import { getTop10 } from '../services/scoring.js';
import { getDaxReference } from '../services/daxAnalyzer.js';

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
    res.json(top10);
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
      daxFunctions,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
