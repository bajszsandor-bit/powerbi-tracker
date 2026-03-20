/**
 * @file translation.js
 * @description Magyar fordítás @vitalets/google-translate-api csomaggal (ingyenes, kulcs nélkül).
 * Rate limiting: hívások között 500ms delay.
 * Ha a fordítás sikertelen, az eredeti angol szöveg marad (graceful fallback).
 * Idempotens: ha a videónak már van title_hu értéke, nem fordít újra.
 */

import { translate } from '@vitalets/google-translate-api';

const TRANSLATE_DELAY_MS = 500;

/**
 * Várakozik a megadott milliszekundum ideig.
 *
 * @param {number} ms - Várakozási idő
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lefordít egy szöveget angolról magyarra.
 * Hiba esetén az eredeti szöveget adja vissza (fallback).
 *
 * @param {string | null} text - A fordítandó szöveg
 * @returns {Promise<string | null>} A lefordított szöveg, vagy az eredeti hiba esetén
 */
async function translateText(text) {
  if (!text || !text.trim()) return text;

  try {
    const result = await translate(text, { from: 'en', to: 'hu' });
    return result.text || text;
  } catch {
    return text;
  }
}

/**
 * Lefordítja egy videó cím, leírás és felirat mezőit magyarra.
 * Ha a videónak már van title_hu értéke (nem null/üres), kihagyja (idempotens).
 * Rate limiting: minden fordítási hívás között 500ms delay.
 *
 * @param {object} video - Videó objektum az adatbázisból
 * @param {string} video.id - YouTube videó azonosító
 * @param {string} [video.title] - Angol cím
 * @param {string} [video.description] - Angol leírás
 * @param {string} [video.title_hu] - Magyar cím (ha már létezik, kihagyja)
 * @param {string} [video.transcript] - Angol felirat szöveg (opcionális)
 * @returns {Promise<{ titleHu: string|null, descriptionHu: string|null, transcriptHu: string|null }>}
 */
async function translateVideo(video) {
  if (video.title_hu) {
    return {
      titleHu: video.title_hu,
      descriptionHu: video.description_hu || null,
      transcriptHu: video.transcript_hu || null,
    };
  }

  const titleHu = await translateText(video.title || null);
  await sleep(TRANSLATE_DELAY_MS);

  const descriptionHu = await translateText(video.description || null);
  await sleep(TRANSLATE_DELAY_MS);

  const transcriptHu = await translateText(video.transcript || null);

  return { titleHu, descriptionHu, transcriptHu };
}

/**
 * Lefordítja az angol VTT cue-ok szövegét magyarra, csoportokban.
 * Minden csoport 5 mondatot tartalmaz, elválasztó: ` ||| `
 * Legfeljebb maxCues cue-t fordít (alapértelmezett: 200).
 *
 * @param {{ start: number, end: number, text: string }[]} cues - Angol cue-ok
 * @param {number} [maxCues=200] - Maximum fordítandó cue-ok száma
 * @returns {Promise<{ start: number, end: number, text: string }[]>} Magyar cue-ok
 */
async function translateCues(cues, maxCues = 200) {
  if (!cues || !cues.length) return [];
  const limited = cues.slice(0, maxCues);
  const CHUNK = 5;
  const SEP = ' ||| ';
  const result = [];

  for (let i = 0; i < limited.length; i += CHUNK) {
    const chunk = limited.slice(i, i + CHUNK);
    const combined = chunk.map((c) => c.text).join(SEP);
    let translated;
    try {
      const res = await translate(combined, { from: 'en', to: 'hu' });
      translated = res.text || combined;
    } catch {
      translated = combined;
    }
    const parts = translated.split(SEP);
    for (let j = 0; j < chunk.length; j++) {
      result.push({
        start: chunk[j].start,
        end: chunk[j].end,
        text: (parts[j] || chunk[j].text).trim(),
      });
    }
    await sleep(TRANSLATE_DELAY_MS);
  }

  return result;
}

export { translateText, translateVideo, translateCues };
