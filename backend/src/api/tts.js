/**
 * @file tts.js
 * @description Edge TTS (Microsoft Neural TTS) API végpont.
 * Ingyenes, kulcs/regisztráció nélkül – hu-HU-NoemiNeural hangot használ.
 * POST /api/tts/speak  { text: string, voice?: string }  → MP3 audio
 */

import { Router } from 'express';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const router = Router();

// Elérhető magyar hangok
const VOICES = {
  noemi: 'hu-HU-NoemiNeural',    // Nőies (alapértelmezett)
  szabolcs: 'hu-HU-SzabolcsNeural', // Férfias
};

/**
 * POST /api/tts/speak
 * Body: { text: string, voice?: 'noemi'|'szabolcs' }
 * Returns: MP3 audio (audio/mpeg)
 */
router.post('/speak', async (req, res, next) => {
  try {
    const { text, voice = 'noemi' } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Szöveg megadása kötelező' });
    }

    const voiceName = VOICES[voice] || VOICES.noemi;
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(text.trim());

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 óra cache

    audioStream.pipe(res);
    audioStream.on('error', next);
  } catch (err) {
    next(err);
  }
});

export default router;
