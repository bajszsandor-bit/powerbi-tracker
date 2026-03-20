/**
 * @file translation.js
 * @description Magyar fordítás – elsődleges: MyMemory API (ingyenes, 50K kar/nap, nincs regisztráció)
 * Fallback: Google Translate (@vitalets/google-translate-api)
 */

import { translate } from '@vitalets/google-translate-api';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * MyMemory API – ingyenes, 50 000 karakter/nap, nincs API kulcs, nincs hitelkártya.
 * @param {string} text
 * @returns {Promise<string|null>}
 */
async function myMemoryTranslate(text) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|hu&de=powerbi.tracker@outlook.com`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    // MyMemory néha visszaadja az eredeti szöveget ha nem tudja fordítani
    if (!translated || translated === text) return null;
    return translated;
  } catch {
    return null;
  }
}

/**
 * Google Translate fallback – rate limit retry logikával.
 * @param {string} text
 * @returns {Promise<string|null>}
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
 * LibreTranslate (fedilab public instance) – harmadik fallback, korlátlan.
 */
async function libreTranslate(text) {
  try {
    const res = await fetch('https://translate.fedilab.app/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'en', target: 'hu', format: 'text' }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const t = data?.translatedText;
    return (t && t !== text) ? t : null;
  } catch {
    return null;
  }
}

/**
 * Fordítás: MyMemory → LibreTranslate → Google Translate → null
 */
async function translateText(text) {
  if (!text || !text.trim()) return null;
  return (await myMemoryTranslate(text)) ?? (await libreTranslate(text)) ?? (await googleTranslate(text)) ?? null;
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
    const translated = (await myMemoryTranslate(combined)) ?? (await libreTranslate(combined)) ?? (await googleTranslate(combined));
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
