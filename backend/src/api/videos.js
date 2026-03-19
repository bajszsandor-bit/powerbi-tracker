/**
 * @file videos.js (api)
 * @description Videó lista API route-ok.
 */

import { Router } from 'express';
import { getAllVideos } from '../db/videoRepository.js';
import { getTop10 } from '../services/scoring.js';

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
    }));
    res.json(top10);
  } catch (err) {
    next(err);
  }
});

export default router;
