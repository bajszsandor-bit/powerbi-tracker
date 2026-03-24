/**
 * @file aiSummary.js
 * @description Magyar oktatói összefoglaló – legjobb ingyenes beállítás:
 * Claude-haiku (ha van kulcs) → Groq llama-3.3-70b (ingyenes) → Ollama → leírás fallback
 */

import Anthropic from '@anthropic-ai/sdk';

const SUMMARY_PROMPT = (title, channel, description) =>
  `Te egy Power BI és Excel oktatási szakértő vagy. Az alábbi YouTube videóhoz írj tömör, de informatív magyar oktatói leírást.

Videó adatok:
Cím: ${title}
Csatorna: ${channel}
Leírás: ${description}

Írj egy strukturált magyar összefoglalót az alábbi formátumban (csak a tartalmat, semmi más):

**Mit tanulhatsz?**
[2-3 mondat arról, mit sajátíthatsz el ebből a videóból]

**Főbb témák**
• [téma 1]
• [téma 2]
• [téma 3]

**Szint:** [Kezdő / Középhaladó / Haladó]

**Kinek ajánlott?**
[1 mondat]`;

/** Claude-haiku – csak ha van API kulcs */
async function claudeSummary(prompt) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });
    return msg.content[0]?.text || null;
  } catch { return null; }
}

/** Groq llama-3.1-8b-instant – ingyenes, magasabb rate limit */
async function groqSummary(prompt) {
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
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const t = data?.choices?.[0]?.message?.content?.trim();
    return (t && /[áéíóöőúüű]/i.test(t)) ? t : null;
  } catch { return null; }
}

/**
 * Magyar oktatói összefoglalót generál.
 * Sorrend: Claude → Groq (llama-3.3-70b) → leírás fallback
 */
async function generateAiSummary(video) {
  const title = video.title || '';
  const channel = video.channel_title || '';
  const description = (video.description_hu || video.description || '').slice(0, 2000);
  if (!title) return null;

  const prompt = SUMMARY_PROMPT(title, channel, description);

  return (await claudeSummary(prompt))
    ?? (await groqSummary(prompt))
    ?? video.description_hu
    ?? video.description
    ?? null;
}

export { generateAiSummary };
