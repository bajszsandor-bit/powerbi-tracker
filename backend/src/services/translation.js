/**
 * @file translation.js
 * @description Magyar fordítás Google Translate-tel (ingyenes, kulcs/regisztráció/hitelkártya nélkül).
 * Rate limit védelem: progresszív várakozás + retry logika.
 * Normál használatban (1 videó/session) a rate limit nem jelent problémát.
 */

import { translate } from '@vitalets/google-translate-api';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Google Translate hívás rate limit detektálással és retry-jal.
 * "Too Many Requests" esetén vár (2s → 5s → 10s), majd újrapróbál.
 * @param {string} text - Fordítandó szöveg
 * @returns {Promise<string|null>} Fordítás vagy null hiba esetén
 */
async function googleTranslate(text) {
  const RETRY_DELAYS = [2000, 5000, 10000];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await translate(text, { from: 'en', to: 'hu' });
      return res?.text || null;
    } catch (err) {
      const isRateLimit = err?.message?.includes('Too Many Requests');
      if (isRateLimit && attempt < 2) {
        await sleep(RETRY_DELAYS[attempt]);
      } else {
        return null;
      }
    }
  }
  return null;
}

/**
 * Lefordít egy szöveget angolról magyarra.
 * Hiba esetén az eredeti szöveget adja vissza (graceful fallback).
 */
async function translateText(text) {
  if (!text || !text.trim()) return null;
  return (await googleTranslate(text)) ?? null; // null ha nem sikerült, NEM az eredeti angol szöveg
}

/**
 * Lefordítja egy videó cím, leírás és felirat mezőit magyarra.
 * Idempotens: ha már van title_hu értéke, kihagyja.
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
  await sleep(1500);

  const descriptionHu = await translateText(video.description || null);
  await sleep(1500);

  const transcriptHu = await translateText(video.transcript || null);

  return { titleHu, descriptionHu, transcriptHu };
}

/**
 * Lefordítja az angol VTT cue-ok szövegét magyarra, csoportokban.
 * 8 cue/hívás \n elválasztóval, 1500ms delay között.
 * 200 cue esetén ~37 másodperc (normál használatban elegendő).
 */
async function translateCues(cues, maxCues = 200) {
  if (!cues || !cues.length) return [];
  const limited = cues.slice(0, maxCues);
  const CHUNK = 8;
  const result = [];

  for (let i = 0; i < limited.length; i += CHUNK) {
    const chunk = limited.slice(i, i + CHUNK);
    const combined = chunk.map((c) => c.text).join('\n');
    const translated = await googleTranslate(combined);
    const parts = (translated || combined).split('\n');
    for (let j = 0; j < chunk.length; j++) {
      result.push({
        start: chunk[j].start,
        end: chunk[j].end,
        text: (parts[j] || chunk[j].text).trim(),
      });
    }
    if (i + CHUNK < limited.length) await sleep(1500);
  }

  return result;
}

export { translateText, translateVideo, translateCues };
