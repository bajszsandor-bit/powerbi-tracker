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

export { translateText, translateVideo };
