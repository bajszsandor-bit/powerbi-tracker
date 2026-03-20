/**
 * @file translation.js
 * @description Magyar fordítás DeepL Free API-val (elsődleges) és Google Translate-tel (fallback).
 * DeepL Free: 500 000 karakter/hó, regisztrációval ingyenes.
 * DEEPL_API_KEY környezeti változóban kell megadni a kulcsot.
 * Ha nincs kulcs, automatikusan Google Translate-re esik vissza.
 */

import * as deepl from 'deepl-node';
import { translate } from '@vitalets/google-translate-api';

const DEEPL_KEY = process.env.DEEPL_API_KEY || null;
const TRANSLATE_DELAY_MS = 300;

/** @type {deepl.Translator | null} */
const deeplClient = DEEPL_KEY ? new deepl.Translator(DEEPL_KEY) : null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lefordít egy szöveget angolról magyarra.
 * Először DeepL-t próbál (ha van kulcs), utána Google Translate fallback.
 */
async function translateText(text) {
  if (!text || !text.trim()) return text;

  if (deeplClient) {
    try {
      const result = await deeplClient.translateText(text, 'en', 'hu');
      return result.text || text;
    } catch { /* fallback */ }
  }

  try {
    const result = await translate(text, { from: 'en', to: 'hu' });
    return result.text || text;
  } catch {
    return text;
  }
}

/**
 * Lefordítja egy videó cím, leírás és felirat mezőit magyarra.
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
 * DeepL-lel: minden cue külön kérés (pontosabb szinkronizálás).
 * Google Translate fallback: \n elválasztós batch fordítás.
 */
async function translateCues(cues, maxCues = 200) {
  if (!cues || !cues.length) return [];
  const limited = cues.slice(0, maxCues);

  if (deeplClient) {
    // DeepL: batch fordítás tömbként (egy API hívás, max 50 szöveg)
    const CHUNK = 50;
    const result = [];
    for (let i = 0; i < limited.length; i += CHUNK) {
      const chunk = limited.slice(i, i + CHUNK);
      try {
        const texts = chunk.map((c) => c.text);
        const translations = await deeplClient.translateText(texts, 'en', 'hu');
        for (let j = 0; j < chunk.length; j++) {
          result.push({
            start: chunk[j].start,
            end: chunk[j].end,
            text: translations[j]?.text?.trim() || chunk[j].text,
          });
        }
      } catch {
        // DeepL hiba → visszaesés az eredeti szövegre
        for (const c of chunk) result.push(c);
      }
      await sleep(TRANSLATE_DELAY_MS);
    }
    return result;
  }

  // Google Translate fallback: \n elválasztós batch
  const CHUNK = 8;
  const result = [];
  for (let i = 0; i < limited.length; i += CHUNK) {
    const chunk = limited.slice(i, i + CHUNK);
    const combined = chunk.map((c) => c.text).join('\n');
    let translated;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await translate(combined, { from: 'en', to: 'hu' });
        translated = res.text || null;
        if (translated) break;
      } catch {
        if (attempt < 2) await sleep(3000 * (attempt + 1));
      }
    }
    if (!translated) translated = combined;
    const parts = translated.split('\n');
    for (let j = 0; j < chunk.length; j++) {
      result.push({
        start: chunk[j].start,
        end: chunk[j].end,
        text: (parts[j] || chunk[j].text).trim(),
      });
    }
    await sleep(500);
  }
  return result;
}

export { translateText, translateVideo, translateCues };
