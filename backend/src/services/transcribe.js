/**
 * @file transcribe.js
 * @description Whisper-alapú felirat generálás Groq API-val (ingyenes, nincs hitelkártya).
 * Groq ingyenes kulcs: https://console.groq.com/keys
 * Limit: 28 800 mp audio/nap – Power BI videókhoz bőven elég.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);
const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';

/**
 * Letölti a videó hangját mp3-ba (64kbps – elég a speech-to-text-hez, ~4MB/10 perc).
 * Ha már létezik a temp fájl, újra használja.
 */
async function downloadAudio(videoId) {
  const tmpDir = os.tmpdir();

  // 1. Keresünk már letöltött fájlt bármilyen formátumban
  const exts = ['m4a', 'webm', 'opus', 'mp3', 'ogg'];
  for (const ext of exts) {
    const candidate = path.join(tmpDir, `pbi_audio_${videoId}.${ext}`);
    try {
      await fs.access(candidate);
      return candidate; // cached
    } catch {}
  }

  // 2. Letöltés – yt-dlp maga választja a legjobb audio formátumot
  const outTemplate = path.join(tmpDir, `pbi_audio_${videoId}.%(ext)s`);
  const args = [
    `https://www.youtube.com/watch?v=${videoId}`,
    '-f', 'bestaudio',
    '-o', outTemplate,
    '--no-playlist',
    '--no-warnings',
    '--quiet',
  ];

  await execFileAsync(YTDLP, args, { timeout: 300_000 }); // 5 perc max

  // 3. Megkeressük a ténylegesen letöltött fájlt
  for (const ext of exts) {
    const candidate = path.join(tmpDir, `pbi_audio_${videoId}.${ext}`);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }

  throw new Error('Audio letöltés sikertelen – fájl nem található');
}

/**
 * Groq Whisper-large-v3 átírás → timestampelt cue-ok tömbje.
 * @param {string} videoId
 * @param {string} groqApiKey
 * @returns {Promise<{start:number, end:number, text:string}[]>}
 */
export async function transcribeAudio(videoId, groqApiKey) {
  const audioPath = await downloadAudio(videoId);

  try {
    const { default: Groq, toFile } = await import('groq-sdk');
    const groq = new Groq({ apiKey: groqApiKey });

    const audioBuffer = await fs.readFile(audioPath);
    const ext = path.extname(audioPath).slice(1) || 'webm';
    const mimeMap = { m4a: 'audio/mp4', webm: 'audio/webm', mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/ogg' };
    const audioFile = await toFile(audioBuffer, `audio.${ext}`, { type: mimeMap[ext] || 'audio/webm' });

    const response = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
      language: 'en',
    });

    const cues = (response.segments || [])
      .map((seg) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      }))
      .filter((c) => c.text);

    return cues;
  } finally {
    try { await fs.unlink(audioPath); } catch {}
  }
}
