/**
 * @file tts.js
 * @description Edge TTS (Microsoft Neural TTS) API végpont.
 * Ingyenes, kulcs/regisztráció nélkül.
 * POST /api/tts/speak  { text, voice?, rate?, pitch? }  → MP3 audio
 */

import { Router } from 'express';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const router = Router();

// Elérhető magyar hangok
const VOICES = {
  noemi:   'hu-HU-NoemiNeural',   // Nőies (alapértelmezett)
  tamas:   'hu-HU-TamasNeural',   // Férfias
  szabolcs:'hu-HU-SzabolcsNeural',// Férfias (régi)
};

/**
 * POST /api/tts/speak
 * Body: { text: string, voice?: 'noemi'|'tamas', rate?: string, pitch?: string }
 *   rate:  '-10%' | '0%' | '+10%' stb.  (Edge TTS sebesség)
 *   pitch: '-5Hz' | '0Hz' | '+5Hz' stb. (Edge TTS magasság)
 * Returns: MP3 audio (audio/mpeg)
 */
/** 24kHz 48kbps MP3 csönd ~300ms (~1800 bájt) */
const SILENCE_300MS = Buffer.alloc(1800, 0);

/**
 * TTS stream → Buffer
 */
function streamToBuffer(audioStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    audioStream.on('data', c => chunks.push(c));
    audioStream.on('end', () => resolve(Buffer.concat(chunks)));
    audioStream.on('error', reject);
  });
}

router.post('/speak', async (req, res, next) => {
  try {
    const { text, voice = 'noemi', rate = '-10%', pitch = '-2Hz' } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Szöveg megadása kötelező' });
    }

    const voiceName = VOICES[voice] || VOICES.noemi;

    // Mondatokra bontás – minden mondat után szünet
    const sentences = text.trim()
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    const buffers = [];
    for (const sentence of sentences) {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(sentence, { rate, pitch });
      const buf = await streamToBuffer(audioStream);
      if (buf.length > 0) {
        buffers.push(buf);
        if (sentences.length > 1) buffers.push(SILENCE_300MS); // szünet mondatok közt
      }
    }

    const audio = Buffer.concat(buffers);

    if (!audio.length) return res.status(500).json({ error: 'TTS hiba' });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audio.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(audio);
  } catch (err) {
    next(err);
  }
});

export default router;
