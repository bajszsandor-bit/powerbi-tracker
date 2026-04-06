/**
 * @file transcribe.js
 * @description Whisper-alapú felirat generálás Groq API-val (ingyenes, nincs hitelkártya).
 * Groq ingyenes kulcs: https://console.groq.com/keys
 * Limit: 28 800 mp audio/nap – Power BI videókhoz bőven elég.
 *
 * Nagy fájlok (>24MB) automatikusan 10 perces részekre darabolódnak,
 * majd az eredmények összeilleszkednek.
 */

import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const execFileAsync = promisify(execFile);
const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const FFMPEG = process.env.FFMPEG_PATH ||
  'C:/Users/bajsz/AppData/Local/Programs/Python/Python312/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const FLASK_URL = process.env.FLASK_WHISPER_URL || 'http://127.0.0.1:5000';
const FLASK_APP = process.env.FLASK_APP_PATH || 'C:/Users/bajsz/Desktop/Szinkron/app.py';

// Helyi Faster-Whisper (Python venv)
// A backend/src/services könyvtárban vagyunk, a venv a backend/venv_whisper-ben van.
const WHISPER_VENV_PYTHON = path.join(__dirname, '..', '..', 'venv_whisper', 'Scripts', 'python.exe');
const TRANSCRIBE_SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'transcribe_local.py');

const MAX_SIZE = 24 * 1024 * 1024; // 24MB – Groq limit alatt tartva
const CHUNK_SECS = 600;             // 10 perces részek

/**
 * Letölti a videó hangját 64kbps mp3-ba.
 * 64kbps: ~4.8MB/10 perc → 1 óra ~28MB (chunkolva kezelhető).
 */
async function downloadAudio(videoId) {
  const tmpDir = os.tmpdir();

  // Megkeressük ha már le van töltve
  const exts = ['m4a', 'webm', 'opus', 'mp3', 'ogg'];
  for (const ext of exts) {
    const candidate = path.join(tmpDir, `pbi_audio_${videoId}.${ext}`);
    try { await fs.access(candidate); return candidate; } catch {}
  }

  // Letöltés – yt-dlp maga választja a legjobb audio formátumot (nincs ffmpeg konverzió)
  const outTemplate = path.join(tmpDir, `pbi_audio_${videoId}.%(ext)s`);
  await execFileAsync(YTDLP, [
    `https://www.youtube.com/watch?v=${videoId}`,
    '-f', 'bestaudio[filesize<24M]/bestaudio',
    '-o', outTemplate,
    '--no-playlist', '--no-warnings', '--quiet',
  ], { timeout: 300_000 });

  for (const ext of exts) {
    const candidate = path.join(tmpDir, `pbi_audio_${videoId}.${ext}`);
    try { await fs.access(candidate); return candidate; } catch {}
  }
  throw new Error('Audio letöltés sikertelen – fájl nem található');
}

/**
 * Nagy fájlt ffmpeg segment muxerrel 10 perces részekre vágja.
 * @param {string} filePath
 * @param {string} tmpDir
 * @returns {Promise<{file: string, offsetSecs: number}[]>}
 */
async function splitAudio(filePath, tmpDir) {
  const stat = await fs.stat(filePath);
  if (stat.size <= MAX_SIZE) {
    return [{ file: filePath, offsetSecs: 0 }];
  }

  const ext = path.extname(filePath).slice(1) || 'm4a';
  const segPattern = path.join(tmpDir, `pbi_seg_${Date.now()}_%03d.${ext}`);
  await execFileAsync(FFMPEG, [
    '-i', filePath,
    '-f', 'segment',
    '-segment_time', String(CHUNK_SECS),
    '-c', 'copy',
    '-y', segPattern,
  ], { timeout: 120_000 });

  // Megkeressük a létrejött szeleteket
  const dir = await fs.readdir(tmpDir);
  const prefix = path.basename(segPattern).replace(`%03d.${ext}`, '');
  const segFiles = dir
    .filter(f => f.startsWith(prefix) && f.endsWith(`.${ext}`))
    .sort()
    .map((f, i) => ({ file: path.join(tmpDir, f), offsetSecs: i * CHUNK_SECS }));

  return segFiles.length ? segFiles : [{ file: filePath, offsetSecs: 0 }];
}

/**
 * Egy audiófájl átírása Groq Whisper-large-v3-mal.
 */
async function transcribeChunk(filePath, groqApiKey) {
  const { default: Groq, toFile } = await import('groq-sdk');
  const groq = new Groq({ apiKey: groqApiKey });

  const audioBuffer = await fs.readFile(filePath);
  const ext2 = path.extname(filePath).replace(/^\./, '') || 'mp3';
  const mimeMap = { m4a: 'audio/mp4', webm: 'audio/webm', mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/ogg' };
  const audioFile = await toFile(audioBuffer, `audio.${ext2}`, { type: mimeMap[ext2] || 'audio/mpeg' });

  const response = await groq.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-large-v3',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
    language: 'en',
  });

  return (response.segments || [])
    .map(seg => ({ start: seg.start, end: seg.end, text: seg.text.trim() }))
    .filter(c => c.text);
}

/**
 * Helyi audiófájl átírása Groq Whisper-large-v3-mal.
 * (Külső híváshoz – pl. feltöltött fájl)
 */
export async function transcribeLocalAudio(filePath, groqApiKey) {
  const tmpDir = os.tmpdir();
  const chunks = await splitAudio(filePath, tmpDir);
  const allCues = [];

  for (const { file, offsetSecs } of chunks) {
    try {
      const cues = await transcribeChunk(file, groqApiKey);
      for (const c of cues) {
        allCues.push({ start: c.start + offsetSecs, end: c.end + offsetSecs, text: c.text });
      }
    } finally {
      if (file !== filePath) {
        try { await fs.unlink(file); } catch {}
      }
    }
  }

  return allCues;
}

/**
 * YouTube videó átírása. 
 * Preferálja a helyi Faster-Whisper-t, ha a USE_LOCAL_WHISPER=true.
 * Egyébként Groq-ot használ.
 */
export async function transcribeAudio(videoId, groqApiKey) {
  if (process.env.USE_LOCAL_WHISPER === 'true' || !groqApiKey) {
    try {
      console.log(`[WHISPER] Helyi transzkripció indítása: ${videoId}`);
      return await transcribeWithLocalPython(videoId);
    } catch (err) {
      console.error('[WHISPER] Helyi hiba, fallback Groq-ra:', err.message);
      if (!groqApiKey) throw err;
    }
  }

  const audioPath = await downloadAudio(videoId);
  const tmpDir = os.tmpdir();

  try {
    const chunks = await splitAudio(audioPath, tmpDir);
    const allCues = [];

    for (const { file, offsetSecs } of chunks) {
      try {
        const cues = await transcribeChunk(file, groqApiKey);
        for (const c of cues) {
          allCues.push({ start: c.start + offsetSecs, end: c.end + offsetSecs, text: c.text });
        }
      } finally {
        if (file !== audioPath) {
          try { await fs.unlink(file); } catch {}
        }
      }
    }

    return allCues;
  } finally {
    try { await fs.unlink(audioPath); } catch {}
  }
}

/**
 * YouTube videó hangjának átírása helyi Python szkripttel.
 */
export async function transcribeWithLocalPython(videoId) {
  const audioPath = await downloadAudio(videoId);
  try {
    console.log(`[WHISPER] Python szkript indítása: ${audioPath}`);
    const { stdout } = await execFileAsync(WHISPER_VENV_PYTHON, [
      TRANSCRIBE_SCRIPT,
      audioPath,
      process.env.WHISPER_MODEL || 'small'
    ], { 
      maxBuffer: 50 * 1024 * 1024,
      timeout: 600_000 // 10 perc
    });
    
    const results = JSON.parse(stdout);
    if (results.error) throw new Error(results.error);
    return results;
  } finally {
    try { await fs.unlink(audioPath); } catch {}
  }
}

/**
 * Ellenőrzi hogy a helyi Faster-Whisper Flask szerver fut-e.
 * @returns {Promise<boolean>}
 */
async function pingFlask() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(`${FLASK_URL}/api/list`, { signal: ctrl.signal });
    clearTimeout(timer);
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Elindítja a Flask szervert a háttérben, ha még nem fut.
 * Megvárja amíg elérhető lesz (max 60 mp – a modell betöltése ~15-30 mp).
 * @returns {Promise<boolean>} true ha sikerült elindítani/már fut
 */
export async function ensureFlaskRunning() {
  if (await pingFlask()) return true;

  console.log('[FLASK] Szerver indítása a háttérben...');
  const proc = spawn('python', [FLASK_APP], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PATH: `${path.dirname(FFMPEG)}${path.delimiter}${process.env.PATH}`,
    },
  });
  proc.unref();

  // Megvárjuk amíg elindul (max 60 mp, 2 másodpercenként ellenőrzés)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    if (await pingFlask()) {
      console.log('[FLASK] Szerver kész!');
      return true;
    }
  }

  console.log('[FLASK] Nem sikerült elindítani 60 mp alatt');
  return false;
}

export { pingFlask as isFlaskWhisperRunning };

/**
 * YouTube videó átírása a helyi Faster-Whisper Flask szerverrel.
 * Előfeltétel: python C:/Users/bajsz/Desktop/Szinkron/app.py fut.
 * @param {string} videoId
 * @returns {Promise<{start:number, end:number, text:string}[]>}
 */
export async function transcribeWithFlask(videoId) {
  const audioPath = await downloadAudio(videoId);
  // Windows path kell a Flask szervernek
  const winPath = audioPath.replace(/\//g, '\\');

  try {
    const r = await fetch(`${FLASK_URL}/api/transcribe-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: winPath, language: 'en' }),
      signal: AbortSignal.timeout(600_000), // 10 perc max
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || `Flask hiba: ${r.status}`);
    }

    const { filename } = await r.json();

    // SRT letöltése
    const srtRes = await fetch(`${FLASK_URL}/outputs/${filename}`);
    const srtText = await srtRes.text();

    // SRT → cue tömb
    return parseSrtToCues(srtText);
  } finally {
    try { await fs.unlink(audioPath); } catch {}
  }
}

/** SRT szöveg → [{start, end, text}] */
function parseSrtToCues(content) {
  const cues = [];
  const blocks = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;
    const m = timeLine.match(/(\d{1,2}:\d{2}:\d{2}[,.]?\d{0,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]?\d{0,3})/);
    if (!m) continue;
    const start = srtToSec(m[1]);
    const end = srtToSec(m[2]);
    const idx = lines.indexOf(timeLine);
    const text = lines.slice(idx + 1).filter(l => l.trim() && !/^\d+$/.test(l.trim())).join(' ').trim();
    if (text && end > start) cues.push({ start, end, text });
  }
  return cues;
}

function srtToSec(t) {
  const [hms, ms = '0'] = t.replace(',', '.').split('.');
  const parts = hms.split(':').map(Number);
  const [h, m, s] = parts.length === 3 ? parts : [0, ...parts];
  return h * 3600 + m * 60 + s + parseFloat(`0.${ms}`);
}
