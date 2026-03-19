/**
 * @file ytdlp.js (api)
 * @description yt-dlp állapot és videógyűjtés API route-ok.
 */

import { Router } from 'express';
import { checkYtdlpInstalled, collectVideos } from '../services/ytdlp.js';
import { upsertVideos, getVideoCount } from '../db/videoRepository.js';

const router = Router();

/**
 * GET /api/check-ytdlp
 * Ellenőrzi, hogy a yt-dlp telepítve van-e a rendszeren.
 *
 * @returns {{ installed: boolean, version: string|null, helpUrl: string, message?: string }}
 */
router.get('/check-ytdlp', async (req, res, next) => {
  try {
    const result = await checkYtdlpInstalled();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/collect
 * Elindítja a videógyűjtést yt-dlp-vel és elmenti az eredményeket az adatbázisba.
 * Figyelmeztetés: ez a folyamat akár 1-2 percig is tarthat.
 *
 * @returns {{ collected: number, inserted: number, total: number }}
 */
router.post('/collect', async (req, res, next) => {
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
    const total = getVideoCount();

    res.json({
      collected: videos.length,
      inserted,
      total,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
