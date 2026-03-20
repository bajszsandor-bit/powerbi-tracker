/**
 * @file ytdlp.js
 * @description yt-dlp parancsok biztonságos futtatása és videó metaadatok gyűjtése.
 * Minden hívás execFile()-t használ (nem exec()) a shell injection megelőzésére.
 * yt-dlp hívások között legalább 2 másodperc delay van.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const YTDLP_TIMEOUT_MS = 60_000;
const YTDLP_DELAY_MS = 2_000;

const SEARCH_QUERIES = [];

// Csatornák az Excel fájlból (Excel csatornák + Power BI csatornák)
const CHANNEL_URLS = [
  // Power BI csatornák
  'https://www.youtube.com/@HowtoPowerBI/videos',
  'https://www.youtube.com/@MicrosoftPowerBI/videos',
  'https://www.youtube.com/@PowerBITips/videos',
  'https://www.youtube.com/@dfwpowerbiusergroup1374/videos',
  'https://www.youtube.com/@nextlevelpowerbireports/videos',
  // Excel csatornák
  'https://www.youtube.com/@datakepzes/videos',
  'https://www.youtube.com/@HowToExcelBlog/videos',
  'https://www.youtube.com/@ExcelVisual/videos',
  'https://www.youtube.com/@MsExcels/videos',
  'https://www.youtube.com/@theexcelhub/videos',
  'https://www.youtube.com/@MyExcelOnline/videos',
  'https://www.youtube.com/@MrXL/videos',
  'https://www.youtube.com/@excelcapa5191/videos',
  'https://www.youtube.com/@ExcelTitok/videos',
  'https://www.youtube.com/@Excelneked/videos',
];

/**
 * Megkeresi a yt-dlp futtatható fájl elérési útját.
 * A YTDLP_PATH környezeti változóból, vagy az alapértelmezett 'yt-dlp' parancsból veszi.
 *
 * @returns {string} A yt-dlp elérési útja
 */
function getYtdlpPath() {
  return process.env.YTDLP_PATH || 'yt-dlp';
}

/**
 * Várakozik a megadott milliszekundum ideig.
 *
 * @param {number} ms - Várakozási idő ms-ban
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ellenőrzi, hogy a yt-dlp telepítve van-e a rendszeren.
 *
 * @returns {Promise<{ installed: boolean, version: string | null, helpUrl: string }>}
 */
async function checkYtdlpInstalled() {
  const helpUrl = 'https://github.com/yt-dlp/yt-dlp/releases';
  try {
    const { stdout } = await execFileAsync(getYtdlpPath(), ['--version'], {
      timeout: 10_000,
      windowsHide: true,
    });
    return {
      installed: true,
      version: stdout.trim(),
      helpUrl,
    };
  } catch {
    return {
      installed: false,
      version: null,
      helpUrl,
      message: `A yt-dlp nincs telepítve. Telepítési útmutató: ${helpUrl}`,
    };
  }
}

/**
 * Egy yt-dlp parancsot futtat és visszaadja a nyers JSON sorait.
 *
 * @param {string[]} args - A yt-dlp argumentumok tömbje
 * @returns {Promise<string>} A parancs stdout kimenete
 */
async function runYtdlp(args) {
  const { stdout } = await execFileAsync(getYtdlpPath(), args, {
    timeout: YTDLP_TIMEOUT_MS,
    maxBuffer: 50 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
}

/**
 * Egy yt-dlp JSON kimenetet (soronként egy JSON objektum) videó objektumok tömbjévé alakít.
 * Hiányos vagy érvénytelen sorok csendesen kihagyásra kerülnek.
 *
 * @param {string} rawOutput - A yt-dlp --dump-json kimenete
 * @returns {import('../db/videoRepository.js').VideoInput[]} Feldolgozott videó objektumok
 */
function parseYtdlpOutput(rawOutput) {
  return rawOutput
    .split('\n')
    .filter((line) => line.trim().startsWith('{'))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map((entry) => ({
      id: entry.id || null,
      title: entry.title || '',
      description: (entry.description || '').slice(0, 5000),
      channelTitle: entry.uploader || entry.channel || '',
      publishedAt: entry.upload_date
        ? `${entry.upload_date.slice(0, 4)}-${entry.upload_date.slice(4, 6)}-${entry.upload_date.slice(6, 8)}`
        : null,
      viewCount: Number(entry.view_count) || 0,
      likeCount: Number(entry.like_count) || 0,
      thumbnailUrl: entry.thumbnail || null,
      videoUrl: entry.webpage_url || (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : null),
    }))
    .filter((v) => v.id && v.title);
}

/**
 * Összegyűjti a Power BI videók metaadatait keresési kifejezések és csatornák alapján.
 * yt-dlp hívások között 2 másodperc delay van.
 *
 * @returns {Promise<import('../db/videoRepository.js').VideoInput[]>} Az összes összegyűjtött videó (duplikátumok nélkül)
 */
async function collectVideos() {
  const all = [];
  const seenIds = new Set();

  const sources = [
    ...SEARCH_QUERIES.map((q) => ({ type: 'search', query: q })),
    ...CHANNEL_URLS.map((url) => ({ type: 'channel', url })),
  ];

  for (const source of sources) {
    try {
      let args;
      if (source.type === 'search') {
        args = [source.query, '--dump-json', '--no-download', '--playlist-end', '5'];
      } else {
        args = [source.url, '--dump-json', '--no-download', '--playlist-end', '1'];
      }

      const raw = await runYtdlp(args);
      const videos = parseYtdlpOutput(raw);

      for (const video of videos) {
        if (!seenIds.has(video.id)) {
          seenIds.add(video.id);
          all.push(video);
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[yt-dlp] ${source.type} gyűjtés kész – ${videos.length} videó`);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[yt-dlp] Hiba a gyűjtésnél:`, err.message);
      }
    }

    await sleep(YTDLP_DELAY_MS);
  }

  return all;
}

/**
 * Egyetlen YouTube videó metaadatait kéri le egy URL alapján.
 *
 * @param {string} url - YouTube videó URL
 * @returns {Promise<import('../db/videoRepository.js').VideoInput | null>} Videó objektum vagy null
 */
async function fetchSingleVideo(url) {
  const raw = await runYtdlp([url, '--dump-json', '--no-download', '--no-playlist']);
  const videos = parseYtdlpOutput(raw);
  return videos[0] || null;
}

export { checkYtdlpInstalled, collectVideos, parseYtdlpOutput, getYtdlpPath, fetchSingleVideo };
