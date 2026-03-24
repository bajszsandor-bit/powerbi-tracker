/**
 * @file translation.js
 * @description Magyar fordítás – legjobb ingyenes beállítás:
 * DeepL (500K/hó) → Groq LLM (ingyenes API) → MyMemory → LibreTranslate → Google
 * Claude-haiku: csak ha ANTHROPIC_API_KEY be van állítva
 */

import { translate } from '@vitalets/google-translate-api';
import Anthropic from '@anthropic-ai/sdk';
import { getDictionaryContext, fixTechTerms } from './techDictionary.js';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Technikai szótár prompt-betét (legfontosabb angolul maradó szavak)
const STAY_EN_SHORT = [
  'Power BI', 'DAX', 'Excel', 'Power Query', 'dashboard', 'report',
  'measure', 'visual', 'filter', 'slicer', 'bookmark', 'dataset',
  'CALCULATE', 'FILTER', 'ALL', 'SUM', 'SUMX', 'RELATED', 'DirectQuery',
  'PBIX', 'KPI', 'RLS', 'OLS', 'Fabric', 'Azure', 'SharePoint',
].join(', ');

const TRANSLATE_PROMPT = (text) => {
  const dictCtx = getDictionaryContext(text);
  return `Fordítsd le magyarra. Csak a fordított szöveget add vissza, semmi mást.
Ezek maradjanak angolul: ${STAY_EN_SHORT}
${dictCtx ? '\n' + dictCtx : ''}

${text.slice(0, 2000)}`;
};

// Feliratok fordítása – természetes, élőbeszédszerű magyar
const CUE_TRANSLATE_PROMPT = (lines) => {
  const combinedText = lines.join(' ');
  const dictCtx = getDictionaryContext(combinedText);
  return `Fordítsd le ezeket az angol videófelirat sorokat természetes, élőbeszédszerű magyarra.
KÖTELEZŐ szabályok:
- PONTOSAN ${lines.length} sort adj vissza (ugyanannyi mint a bemenet)
- Minden sor formátuma: "SZÁM. fordítás" – ugyanolyan sorszámmal mint a bemenet
- NE vonj össze sorokat, NE tördelj szét sorokat
- Természetes, élőbeszéd stílusú magyar
- Ezek maradjanak angolul: ${STAY_EN_SHORT}
${dictCtx ? '- ' + dictCtx.split('\n').join('\n- ') : ''}
- CSAK a sorszámozott fordításokat add vissza, semmi más szöveget

${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`;
};

/** Claude-haiku – csak ha van API kulcs */
async function claudeTranslate(text) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: TRANSLATE_PROMPT(text) }],
    });
    const t = r.content[0]?.text?.trim();
    return (t && t !== text) ? t : null;
  } catch { return null; }
}

/** DeepL Free – 500 000 karakter/hó, legjobb fordítási minőség */
async function deeplTranslate(text) {
  if (!process.env.DEEPL_API_KEY) return null;
  try {
    const res = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
      },
      body: new URLSearchParams({ text: text.slice(0, 5000), target_lang: 'HU', source_lang: 'EN' }).toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const t = data?.translations?.[0]?.text;
    return (t && t !== text) ? t : null;
  } catch { return null; }
}

/** Groq LLM – ingyenes API, gyors, jó minőség (llama-3.1-8b-instant) */
async function groqTranslate(text) {
  if (!process.env.GROQ_API_KEY) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 600,
        messages: [{ role: 'user', content: TRANSLATE_PROMPT(text) }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const t = data?.choices?.[0]?.message?.content?.trim();
    return (t && t !== text) ? t : null;
  } catch { return null; }
}

/** Groq – feliratok természetes fordításához.
 *  Visszaad string[] (soronként) vagy null.
 *  Modellek: llama-3.3-70b-versatile → llama-3.1-8b-instant */
async function groqTranslateCues(lines) {
  if (!process.env.GROQ_API_KEY) return null;
  const prompt = CUE_TRANSLATE_PROMPT(lines);

  for (const model of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          temperature: 0.1,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const raw = (await res.json())?.choices?.[0]?.message?.content?.trim();
      if (!raw) continue;

      // Számozott sorok eltávolítása: "1. szöveg" → "szöveg"
      const parts = raw.split('\n')
        .map(l => l.replace(/^\d+[.)]\s*/, '').trim())
        .filter(l => l.length > 0);

      if (parts.length === lines.length) return parts;
      // Ha közel egyforma (±1), fogadjuk el (hiányzó sort pótoljuk)
      if (Math.abs(parts.length - lines.length) <= 1) {
        while (parts.length < lines.length) parts.push('');
        return parts.slice(0, lines.length);
      }
    } catch { /* következő model */ }
  }
  return null;
}

/** MyMemory – ingyenes, 50 000 karakter/nap */
async function myMemoryTranslate(text) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|hu&de=powerbi.tracker@outlook.com`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const t = data?.responseData?.translatedText;
    return (t && t !== text) ? t : null;
  } catch { return null; }
}

/** LibreTranslate – ingyenes public instance */
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
  } catch { return null; }
}

/** Google Translate – utolsó fallback, rate limit retry */
async function googleTranslate(text) {
  const DELAYS = [2000, 5000, 10000];
  for (let i = 0; i < 3; i++) {
    try {
      const res = await translate(text, { from: 'en', to: 'hu' });
      return res?.text || null;
    } catch (err) {
      if (err?.message?.includes('Too Many Requests') && i < 2) await sleep(DELAYS[i]);
      else return null;
    }
  }
  return null;
}

/** Magyar szöveg-e? (legalább egy ékezetes betű) */
function looksHungarian(t) {
  return t && /[áéíóöőúüű]/i.test(t);
}

/**
 * Fő fordítás: Claude → DeepL → Groq → MyMemory → LibreTranslate → Google
 * Minden lépésnél ellenőrzi, hogy a kimenet valóban magyar-e.
 */
async function translateText(text) {
  if (!text || !text.trim()) return null;
  const candidates = [
    () => claudeTranslate(text),
    () => deeplTranslate(text),
    () => groqTranslate(text),
    () => myMemoryTranslate(text),
    () => libreTranslate(text),
    () => googleTranslate(text),
  ];
  for (const fn of candidates) {
    const t = await fn();
    if (t && looksHungarian(t)) return t;
  }
  return null;
}

/** Videó cím, leírás, átírat fordítása. Idempotens: ha már van title_hu, kihagyja. */
async function translateVideo(video) {
  if (video.title_hu) {
    return {
      titleHu: video.title_hu,
      descriptionHu: video.description_hu || null,
      transcriptHu: video.transcript_hu || null,
    };
  }
  const titleHu = (await translateText(video.title || null)) || video.title || null;
  await sleep(1000);
  const descriptionHu = await translateText(video.description || null);
  await sleep(1000);
  const transcriptHu = await translateText(video.transcript || null);
  return { titleHu, descriptionHu, transcriptHu };
}

/**
 * VTT cue-ok fordítása csoportokban.
 * Cue fordítás sorrend: Claude → Groq → Ollama → MyMemory → LibreTranslate
 */
async function translateCues(cues, maxCues = 200) {
  if (!cues || !cues.length) return [];

  // Rövid transition cue-k kiszűrése (YouTube bilingual duplikátumok)
  const filtered = cues
    .slice(0, maxCues)
    .filter(c => (c.end - c.start) >= 0.15 && c.text?.trim());

  const CHUNK = 8; // kisebb chunk = pontosabb sorszám egyezés = kevesebb mismatch
  const result = [];

  for (let i = 0; i < filtered.length; i += CHUNK) {
    const chunk = filtered.slice(i, i + CHUNK);
    const lines = chunk.map(c => c.text);

    // 1. Groq batch fordítás (string[] visszatérés)
    let parts = await groqTranslateCues(lines);

    // 2. Ha Groq batch nem sikerült → Claude batch
    if (!parts) {
      const combined = lines.join('\n');
      const batchResult = await claudeTranslate(combined);
      if (batchResult) {
        parts = batchResult.split('\n')
          .map(l => l.replace(/^\d+[.)]\s*/, '').trim())
          .filter(l => l.length > 0);
        if (parts.length !== lines.length) parts = null; // sorszám nem stimmel
      }
    }

    // 3. Ha batch fordítás rendben van → használjuk
    if (parts && parts.length === lines.length) {
      let containsEnglish = false;
      const processed = [];
      for (let j = 0; j < chunk.length; j++) {
        const t = parts[j]?.trim();
        // Ha a fordítás gyanúsan angol maradt (nincs benne magyar karakter, de az eredetiben voltak kisbetűk)
        if (!looksHungarian(t) && /[a-z]/.test(lines[j])) {
          containsEnglish = true;
          break;
        }
        const fixed = fixTechTerms(t || lines[j], lines[j]);
        processed.push({ start: chunk[j].start, end: chunk[j].end, text: fixed });
      }

      if (!containsEnglish) {
        result.push(...processed);
        if (i + CHUNK < filtered.length) await sleep(600);
        continue; // Sikerült a batch
      }
    }

    // 4. Fallback: Soronkénti fordítás – ha a batch hibás vagy angol maradt
    console.log(`[TRANSLATE] Batch hiba a(z) ${i}. indexnél, soronkénti fallback...`);
    for (let j = 0; j < chunk.length; j++) {
      const t = await translateText(lines[j]);
      const fixed = fixTechTerms(t || lines[j], lines[j]);
      result.push({ start: chunk[j].start, end: chunk[j].end, text: fixed });
      if (j < chunk.length - 1) await sleep(300);
    }

    if (i + CHUNK < filtered.length) await sleep(600);
  }

  return result;
}

export { translateText, translateVideo, translateCues };
