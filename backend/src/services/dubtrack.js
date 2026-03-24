/**
 * @file dubtrack.js
 * @description Teljes magyar szinkronsáv generálás – WAV fájl cue-ok alapján.
 * Minden cue-hoz TTS MP3 → ffmpeg PCM konverzió → silence gap → WAV összefűzés.
 * Eredmény: egyetlen WAV fájl amit <audio> elem játszik le szinkronban.
 */

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DUBTRACKS_DIR = path.join(__dirname, '../../../data/dubtracks');
const VOICE_SAMPLES_DIR = path.join(__dirname, '../../../data/voice-samples');

const FLASK_URL = process.env.FLASK_WHISPER_URL || 'http://127.0.0.1:5000';
const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';

const FFMPEG = process.env.FFMPEG_PATH ||
  'C:/Users/bajsz/AppData/Local/Programs/Python/Python312/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';

const SAMPLE_RATE = 24000;
const BYTES_PER_SAMPLE = 2; // 16-bit
const CHANNELS = 1;
const BYTES_PER_SEC = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS; // 48000

const VOICES = {
  noemi: 'hu-HU-NoemiNeural',
  tamas: 'hu-HU-TamasNeural',
};

// +25% fix sebesség: magyar szöveg ~30-35%-kal hosszabb az angolnál,
// ezért +25% Edge Neural rate-tel a legtöbb szegmens természetesen belefér.
// Neural hang +25%-nál még teljesen természetesen hangzik – nincs robot effekt.
const DUBTRACK_RATE = '+25%';

function makeWavHeader(dataSize) {
  const buf = Buffer.alloc(44);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);            // PCM
  buf.writeUInt16LE(CHANNELS, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(BYTES_PER_SEC, 28);
  buf.writeUInt16LE(BYTES_PER_SAMPLE * CHANNELS, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

function silencePcm(seconds) {
  const bytes = Math.round(Math.max(0, seconds) * BYTES_PER_SEC);
  return Buffer.alloc(bytes, 0);
}

/** TTS MP3 → raw 16-bit PCM at 24kHz mono via ffmpeg pipe */
async function mp3ToPcm(mp3Buffer) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = FFMPEG.replace(/\//g, '\\');
    const proc = spawn(ffmpegPath, [
      '-i', 'pipe:0',
      '-ar', String(SAMPLE_RATE),
      '-ac', String(CHANNELS),
      '-f', 's16le',
      'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'ignore'] });

    const chunks = [];
    proc.stdout.on('data', c => chunks.push(c));
    proc.stdout.on('end', () => resolve(Buffer.concat(chunks)));
    proc.stdin.on('error', () => {});
    proc.on('error', reject);
    proc.on('close', code => {
      if (code !== 0 && chunks.length === 0) reject(new Error(`ffmpeg exit ${code}`));
    });

    proc.stdin.write(mp3Buffer);
    proc.stdin.end();
  });
}

/** msedge-tts → MP3 buffer (tiszta szöveg, SSML tag nélkül) */
async function ttsToMp3(text, voiceName, rate, pitch) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text, { rate, pitch });
  return new Promise((resolve, reject) => {
    const chunks = [];
    audioStream.on('data', c => chunks.push(c));
    audioStream.on('end', () => resolve(Buffer.concat(chunks)));
    audioStream.on('error', reject);
  });
}

/** Ellenőrzi, hogy az XTTS v2 Flask szerver fut és a modell betöltve van-e */
async function isXttsReady() {
  try {
    const res = await fetch(`${FLASK_URL}/api/tts-clone/ready`, {
      signal: AbortSignal.timeout(3000),
    });
    const d = await res.json();
    return d.ready === true;
  } catch {
    return false;
  }
}

/**
 * Letölti az eredeti videó első ~25 másodpercét hangmintaként.
 * XTTS v2-nek legalább 6s tiszta beszéd kell – a 25s bőven elég.
 * Cache: data/voice-samples/{videoId}.wav
 */
async function extractVoiceSample(videoId) {
  await fs.mkdir(VOICE_SAMPLES_DIR, { recursive: true });
  const samplePath = path.join(VOICE_SAMPLES_DIR, `${videoId}.wav`);
  try { await fs.access(samplePath); return samplePath; } catch { /* letöltés szükséges */ }

  const ffmpegPath = FFMPEG.replace(/\//g, '\\');
  const tmpTemplate = path.join(os.tmpdir(), `vcsample_${videoId}.%(ext)s`);
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // yt-dlp: legjobb audio, max 10MB (nem a teljes videó)
  for (const extraArgs of [['--extractor-args', 'youtube:player_client=android'], []]) {
    try {
      await execFileAsync(YTDLP, [
        ytUrl, '-f', 'bestaudio[filesize<10M]/bestaudio',
        '-o', tmpTemplate, '--no-playlist', '--quiet', ...extraArgs,
      ], { timeout: 120_000 });

      // megkeressük a letöltött fájlt
      let tmpFile = null;
      for (const ext of ['webm', 'opus', 'm4a', 'mp3', 'ogg']) {
        const c = path.join(os.tmpdir(), `vcsample_${videoId}.${ext}`);
        try { await fs.access(c); tmpFile = c; break; } catch { /* folytatás */ }
      }
      if (!tmpFile) continue;

      // ffmpeg: 5s-tól 25s-ig kivágás → 22050Hz mono WAV (XTTS ajánlott formátum)
      await execFileAsync(ffmpegPath, [
        '-i', tmpFile, '-ss', '5', '-t', '25',
        '-ar', '22050', '-ac', '1', '-y', samplePath,
      ], { timeout: 60_000 });

      try { await fs.unlink(tmpFile); } catch { /* nem kritikus */ }
      console.log(`[DUBTRACK] Hangminta kész: ${videoId}.wav`);
      return samplePath;
    } catch { /* következő próba */ }
  }
  throw new Error(`Nem sikerült hangmintát letölteni: ${videoId}`);
}

/**
 * XTTS v2 hangklónozás – Flask API hívás.
 * Az eredeti előadó hangjában generál magyar PCM-et.
 * Timeout: 3 perc (CPU inference hosszabb szövegnél lassú)
 */
async function ttsXtts(text, speakerWav) {
  const res = await fetch(`${FLASK_URL}/api/tts-clone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, speaker_wav: speakerWav, language: 'hu' }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`XTTS ${res.status}: ${await res.text()}`);
  const wavBuf = Buffer.from(await res.arrayBuffer());
  // XTTS WAV → 24kHz 16-bit PCM (mp3ToPcm bármilyen audio formátumot kezel)
  return mp3ToPcm(wavBuf);
}

/**
 * Természetes szünetekkel generál PCM-et.
 * A szöveget <break time="Xms"/> tagoknál szétvágjuk → minden részhez
 * soros TTS hívás → közé valódi PCM csend kerül.
 * Így az eredeti előadó ritmusát tükrözi a magyar hang.
 */
async function ttsWithBreaks(text, voiceName, rate, pitch, speakerWav = null) {
  // Mondathatár szünetek hozzáadása
  const textWithBreaks = text
    .replace(/([.!?])\s+([A-ZÁÉÍÓÖŐÚÜŰ])/g, '$1<break time="280ms"/>$2')
    .replace(/([,;:])\s+/g, '$1<break time="120ms"/> ');

  // Szétvágás <break time="Xms"/> tagoknál
  // pl. "Mondat.<break time="280ms"/>Következő" → ["Mondat.", "280", "Következő"]
  const parts = textWithBreaks.split(/<break time="(\d+)ms"\/>/);

  // Soros TTS: páros index = szöveg chunk, páratlan = break marker (ms)
  const pcmParts = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const chunk = parts[i].trim();
      if (chunk.length > 0) {
        try {
          let pcm;
          if (speakerWav) {
            // XTTS v2: eredeti előadó hangján
            pcm = await ttsXtts(chunk, speakerWav);
          } else {
            // Fallback: msedge-tts Neural hang
            const mp3 = await ttsToMp3(chunk, voiceName, rate, pitch);
            pcm = mp3.length > 0 ? await mp3ToPcm(mp3) : Buffer.alloc(0);
          }
          if (pcm.length > 0) pcmParts.push(pcm);
        } catch { /* üres chunk kihagyva */ }
      }
    } else {
      const ms = parseInt(parts[i], 10);
      if (ms > 0) pcmParts.push(silencePcm(ms / 1000));
    }
  }

  return pcmParts.length > 0 ? Buffer.concat(pcmParts) : Buffer.alloc(0);
}

/**
 * PCM puha trim: levágja a maxSecs utáni részt, de 150ms fade-out-tal zárja.
 * Sokkal kellemesebb mint a hard cut, ha mégis kifut a szöveg.
 */
function softTrim(pcm, maxSecs) {
  const maxBytes = Math.round(maxSecs * BYTES_PER_SEC) & ~1;
  if (pcm.length <= maxBytes) return pcm; // belefér, nincs vágás

  const trimmed = Buffer.from(pcm.slice(0, maxBytes));
  // 150ms fade-out az utolsó szavaknál
  const fadeSamples = Math.round(0.15 * SAMPLE_RATE);
  const fadeStartSample = trimmed.length / BYTES_PER_SAMPLE - fadeSamples;
  for (let i = 0; i < fadeSamples; i++) {
    const byteIdx = (fadeStartSample + i) * BYTES_PER_SAMPLE;
    if (byteIdx + 1 >= trimmed.length) break;
    const sample = trimmed.readInt16LE(byteIdx);
    const gain = 1.0 - i / fadeSamples;
    trimmed.writeInt16LE(Math.round(sample * gain), byteIdx);
  }
  return trimmed;
}

/** Interpunkció-mentes, kisbetűs szólista összehasonlításhoz */
function normalizeWords(text) {
  return text.toLowerCase().replace(/[.,!?;:()\-]/g, '').trim().split(/\s+/);
}

/**
 * Eltávolítja a Whisper sliding window ismétléseket.
 * Minden cue-ból kivágja azt a prefixet ami az előző cue végén már szerepelt.
 */
function dedupCues(cues) {
  const result = [];
  for (let i = 0; i < cues.length; i++) {
    const curr = cues[i];
    if (i === 0) { result.push(curr); continue; }
    const prev = result[result.length - 1];
    const prevNorm = normalizeWords(prev.text);
    const currNorm = normalizeWords(curr.text);
    const currRaw = curr.text.trim().split(/\s+/);
    let overlapLen = 0;
    for (let n = Math.min(prevNorm.length, currNorm.length, 15); n >= 2; n--) {
      const prevTail = prevNorm.slice(-n).join(' ');
      const currHead = currNorm.slice(0, n).join(' ');
      if (prevTail === currHead) {
        overlapLen = n; break;
      }
    }
    if (overlapLen > 0) {
      const dedupRaw = currRaw.slice(overlapLen).join(' ').trim();
      // Csak akkor hagyjuk el ha teljesen üres – rövid szegmenseket is megtartjuk
      if (dedupRaw.length > 5 || (dedupRaw.length > 0 && currRaw.length > overlapLen + 1)) {
        result.push({ ...curr, text: dedupRaw });
      }
    } else {
      result.push(curr);
    }
  }
  return result;
}

/**
 * Összevonja a cue-kat szegmensekbe.
 * Az eredeti előadó szüneteit (gap) SSML <break> tagekké alakítja –
 * a TTS pontosan ott tart szünetet ahol az eredeti előadó is.
 *   gap 0.4–0.8s  → 200ms break
 *   gap 0.8–1.5s  → 400ms break
 */
function mergeCues(cues, maxDuration = 18, maxGap = 2.0) {
  const segments = [];
  let cur = null;
  for (const cue of cues) {
    if (!cur) {
      cur = { start: cue.start, end: cue.end, text: cue.text };
    } else {
      const gap = cue.start - cur.end;
      const dur = cue.end - cur.start;
      if (gap > maxGap || dur > maxDuration) {
        segments.push(cur);
        cur = { start: cue.start, end: cue.end, text: cue.text };
      } else {
        // Gap → SSML break: az előadó szünete megjelenik a TTS-ben is
        let separator;
        if (gap >= 0.8) separator = '<break time="400ms"/>';
        else if (gap >= 0.4) separator = '<break time="200ms"/>';
        else separator = ' ';
        cur.end = cue.end;
        cur.text += separator + cue.text;
      }
    }
  }
  if (cur) segments.push(cur);
  return segments;
}

/**
 * Generálja a teljes dubtrack WAV fájlt.
 * @param {string} videoId
 * @param {{start:number, end:number, text:string}[]} cues
 * @param {{voice?, rate?, pitch?, onProgress?}} options
 * @returns {Promise<{path: string, duration: number, cueCount: number}>}
 */
export async function generateDubtrack(videoId, cues, options = {}) {
  const {
    voice = 'noemi',
    pitch = '-5Hz',
    onProgress = null,
    clone = true,   // true = XTTS hangklónozás ha elérhető
  } = options;

  const voiceName = VOICES[voice] || VOICES.noemi;

  // XTTS elérhetőség + hangminta letöltés
  let speakerWav = null;
  if (clone) {
    if (await isXttsReady()) {
      try {
        speakerWav = await extractVoiceSample(videoId);
        console.log(`[DUBTRACK] 🎤 Hangklónozás aktív: ${path.basename(speakerWav)}`);
      } catch (err) {
        console.warn(`[DUBTRACK] Hangminta hiba, fallback msedge-tts: ${err.message}`);
      }
    } else {
      console.log('[DUBTRACK] XTTS nem elérhető – msedge-tts Neural hangot használ');
    }
  }

  const allHun = cues.filter(c => c.text && c.text.trim().length > 0);

  // 1. Deduplikáció – Whisper sliding window ismétlések eltávolítása
  const deduped = dedupCues(allHun);
  // 2. Összevonás hosszabb szegmensekbe – természetesebb TTS
  const segments = mergeCues(deduped);
  console.log(`[DUBTRACK] ${videoId}: ${allHun.length} cue → ${deduped.length} dedup → ${segments.length} szegmens`);
  if (!segments.length) throw new Error('Nincs magyar felirat a dubtrack generáláshoz');

  await fs.mkdir(DUBTRACKS_DIR, { recursive: true });

  const pcmChunks = [];
  let cursor = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // Silence gap a szegmens kezdetéig
    if (seg.start > cursor + 0.01) {
      pcmChunks.push(silencePcm(seg.start - cursor));
      cursor = seg.start;
    }

    // TTS generálás dinamikus sebességgel – az előadó ritmusát követi
    try {
      const nextStart = segments[i + 1]?.start ?? (seg.end + 5);
      const maxSecs = Math.max(0.5, nextStart - seg.start - 0.15); // kicsit szűkebb ablak a biztonság kedvéért

      // 1. Első próba: alap sebesség (+25%)
      let currentRate = DUBTRACK_RATE;
      let pcm = await ttsWithBreaks(seg.text, voiceName, currentRate, pitch, speakerWav);
      let actualSecs = pcm.length / BYTES_PER_SEC;

      // 2. Ha túl hosszú, próbáljuk gyorsítani (max +40%-ig)
      if (actualSecs > maxSecs && !speakerWav) { // XTTS-nél nem tudunk sebességet állítani ilyen egyszerűen
        const neededRate = Math.min(40, Math.round(25 + (actualSecs / maxSecs - 1) * 100));
        if (neededRate > 25) {
          const newRate = `+${neededRate}%`;
          console.log(`[DUBTRACK] ⚡ Gyorsítás: ${seg.start.toFixed(1)}s -> ${newRate} (kell: ${actualSecs.toFixed(1)}s, van: ${maxSecs.toFixed(1)}s)`);
          pcm = await ttsWithBreaks(seg.text, voiceName, newRate, pitch, speakerWav);
          currentRate = newRate;
          actualSecs = pcm.length / BYTES_PER_SEC;
        }
      }

      if (pcm.length > 0) {
        const fitted = softTrim(pcm, maxSecs);
        const finalSecs = fitted.length / BYTES_PER_SEC;
        const trimmed = fitted.length < pcm.length;
        console.log(`[DUBTRACK] ${seg.start.toFixed(1)}s: ablak=${maxSecs.toFixed(1)}s TTS=${finalSecs.toFixed(1)}s rate=${currentRate}${trimmed ? ' ⚠️ vágva' : ' ✓'}`);
        pcmChunks.push(fitted);
        cursor = seg.start + finalSecs;
      }
    } catch (err) {
      console.warn(`[DUBTRACK] szegmens ${seg.start}s hiba:`, err.message);
    }

    if (onProgress) onProgress(i + 1, segments.length);
  }

  // Ending silence
  const lastSeg = segments[segments.length - 1];
  if (cursor < lastSeg.end) {
    pcmChunks.push(silencePcm(lastSeg.end - cursor));
  }

  const pcmData = Buffer.concat(pcmChunks);
  const header = makeWavHeader(pcmData.length);
  const wavData = Buffer.concat([header, pcmData]);

  const outPath = path.join(DUBTRACKS_DIR, `${videoId}.wav`);
  await fs.writeFile(outPath, wavData);

  const duration = pcmData.length / BYTES_PER_SEC;
  console.log(`[DUBTRACK] Kész: ${videoId}.wav – ${duration.toFixed(1)}s, ${(wavData.length / 1048576).toFixed(1)}MB`);
  return { path: outPath, duration, cueCount: segments.length };
}

export async function dubtrackExists(videoId) {
  try {
    await fs.access(path.join(DUBTRACKS_DIR, `${videoId}.wav`));
    return true;
  } catch {
    return false;
  }
}

export function getDubtrackPath(videoId) {
  return path.join(DUBTRACKS_DIR, `${videoId}.wav`);
}
