/**
 * @file transcript.js
 * @description Videó feliratok letöltése yt-dlp-vel és VTT fájlok feldolgozása.
 * Letölt: yt-dlp --write-auto-sub --sub-lang en --skip-download
 * Kimenet: data/transcripts/[videoId].txt (tiszta szöveg)
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getYtdlpPath } from './ytdlp.js';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRANSCRIPTS_DIR = resolve(__dirname, '../../../data/transcripts');

/**
 * Visszaadja egy videó felirat fájljának elérési útját.
 *
 * @param {string} videoId - YouTube videó azonosító
 * @returns {string} A .txt felirat fájl elérési útja
 */
function getTranscriptPath(videoId) {
  return resolve(TRANSCRIPTS_DIR, `${videoId}.txt`);
}

/**
 * Feldolgoz egy VTT tartalmú szöveget: eltávolítja az időbélyegeket,
 * a fejlécet és a duplikált sorokat, visszaadja a tiszta szöveget.
 *
 * @param {string} vttContent - A VTT fájl nyers tartalma
 * @returns {string} Tiszta szöveg időbélyegek nélkül
 */
function parseVtt(vttContent) {
  const lines = vttContent.split('\n');
  const textLines = [];
  let prevLine = '';

  for (const raw of lines) {
    const line = raw.trim();

    // WEBVTT fejléc és metadata blokkok kihagyása
    if (line.startsWith('WEBVTT') || line.startsWith('Kind:') || line.startsWith('Language:')) {
      continue;
    }

    // Időbélyeg sorok kihagyása (pl. "00:00:01.000 --> 00:00:03.000")
    if (/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(line)) {
      continue;
    }

    // Sorszám sorok kihagyása (csak számot tartalmazó sorok)
    if (/^\d+$/.test(line)) {
      continue;
    }

    // HTML tagek eltávolítása (pl. <c>, <i>, <b>, pozíció tagek)
    const cleaned = line.replace(/<[^>]+>/g, '').trim();

    // Üres és duplikált sorok kihagyása
    if (!cleaned || cleaned === prevLine) {
      continue;
    }

    textLines.push(cleaned);
    prevLine = cleaned;
  }

  return textLines.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Letölti egy videó automatikus feliratát yt-dlp-vel.
 * A VTT fájlt feldolgozza és .txt-ként menti el.
 * Ha nincs felirat, gracefully null-t ad vissza.
 *
 * @param {string} videoId - YouTube videó azonosító
 * @param {string} videoUrl - YouTube videó URL
 * @returns {Promise<string | null>} A tiszta felirat szöveg, vagy null ha nincs
 */
async function downloadTranscript(videoId, videoUrl) {
  if (!existsSync(TRANSCRIPTS_DIR)) {
    mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
  }

  const outputTemplate = resolve(TRANSCRIPTS_DIR, videoId);
  const expectedVtt = `${outputTemplate}.en.vtt`;

  const BASE_SUB_ARGS = [
    videoUrl, '--write-auto-sub', '--sub-lang', 'en',
    '--skip-download', '--sub-format', 'vtt', '-o', outputTemplate, '--quiet',
  ];

  // Próbálja Android API-val (kevésbé rate-limitelt), majd sima fallback
  for (const extraArgs of [['--extractor-args', 'youtube:player_client=android'], []]) {
    try {
      await execFileAsync(getYtdlpPath(), [...BASE_SUB_ARGS, ...extraArgs], { timeout: 60_000 });
      if (existsSync(expectedVtt)) break; // siker
    } catch { /* következő próba */ }
  }

  try {
    if (!existsSync(expectedVtt)) {
      return { plainText: null, cues: [] };
    }

    const vttContent = readFileSync(expectedVtt, 'utf8');
    const cleanText = parseVtt(vttContent);
    const cues = parseVttCues(vttContent);

    // Eredeti VTT törlése, csak a tiszta txt marad
    try {
      unlinkSync(expectedVtt);
    } catch {
      // nem kritikus
    }

    if (!cleanText) return { plainText: null, cues: [] };

    const txtPath = getTranscriptPath(videoId);
    writeFileSync(txtPath, cleanText, 'utf8');

    return { plainText: cleanText, cues };
  } catch {
    return { plainText: null, cues: [] };
  }
}

/**
 * Visszaadja egy videó feliratát, ha már le van töltve.
 * Ha még nincs, null-t ad vissza (nem tölt le automatikusan).
 *
 * @param {string} videoId - YouTube videó azonosító
 * @returns {string | null} A felirat szövege, vagy null ha nincs
 */
function getStoredTranscript(videoId) {
  const txtPath = getTranscriptPath(videoId);
  if (!existsSync(txtPath)) return null;
  return readFileSync(txtPath, 'utf8');
}

/**
 * Időbélyeges VTT tartalmát cue objektumok tömbjévé alakítja.
 * Visszaadja: [{start: másodperc, end: másodperc, text: string}]
 *
 * @param {string} vttContent - A VTT fájl nyers tartalma
 * @returns {{ start: number, end: number, text: string }[]}
 */
function parseVttCues(vttContent) {
  const cues = [];
  const lines = vttContent.split('\n');
  let i = 0;

  function tsToSec(ts) {
    const [h, m, s] = ts.replace(',', '.').split(':');
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    const match = line.match(
      /^(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/
    );
    if (match) {
      const start = tsToSec(match[1]);
      const end = tsToSec(match[2]);
      i++;
      const parts = [];
      while (i < lines.length && lines[i].trim()) {
        const clean = lines[i].replace(/<[^>]+>/g, '').trim();
        if (clean) parts.push(clean);
        i++;
      }
      if (parts.length) {
        const text = parts.join(' ');
        // YouTube auto-sub ismétlések kiszűrése
        if (!cues.length || cues[cues.length - 1].text !== text) {
          cues.push({ start, end, text });
        }
      }
    } else {
      i++;
    }
  }
  return cues;
}

export { parseVtt, parseVttCues, downloadTranscript, getStoredTranscript, getTranscriptPath };
