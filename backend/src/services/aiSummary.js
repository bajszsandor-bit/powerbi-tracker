/**
 * @file aiSummary.js
 * @description Claude AI alapú magyar oktatói összefoglaló generálás videókhoz.
 * Ha az ANTHROPIC_API_KEY nincs beállítva, a lefordított leírást adja vissza.
 */

import Anthropic from '@anthropic-ai/sdk';

let client = null;

function getClient() {
  if (!client && process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Claude AI-val részletes magyar oktatói összefoglalót generál egy videóhoz.
 * Ha nincs API kulcs, a meglévő description_hu-t adja vissza.
 *
 * @param {object} video - Videó objektum
 * @returns {Promise<string|null>} Magyar összefoglaló szöveg
 */
async function generateAiSummary(video) {
  const ai = getClient();

  // Fallback: nincs API kulcs → lefordított leírás
  if (!ai) {
    return video.description_hu || video.description || null;
  }

  const title = video.title || '';
  const channel = video.channel_title || '';
  const description = (video.description || '').slice(0, 2000);

  if (!title) return null;

  try {
    const message = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `Te egy Power BI és Excel oktatási szakértő vagy. Az alábbi YouTube videóhoz írj tömör, de informatív magyar oktatói leírást.

Videó adatok:
Cím: ${title}
Csatorna: ${channel}
Leírás (angolul): ${description}

Írj egy strukturált magyar összefoglalót az alábbi formátumban (csak a tartalmat, semmi más):

**Mit tanulhatsz?**
[2-3 mondat arról, mit sajátíthatsz el ebből a videóból]

**Főbb témák**
• [téma 1]
• [téma 2]
• [téma 3]

**Szint:** [Kezdő / Középhaladó / Haladó]

**Kinek ajánlott?**
[1 mondat]`,
        },
      ],
    });

    return message.content[0]?.text || null;
  } catch {
    return video.description_hu || video.description || null;
  }
}

export { generateAiSummary };
