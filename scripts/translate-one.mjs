/**
 * Egy videó lefordítása claude-haiku-val
 * Használat: node scripts/translate-one.mjs VIDEO_ID
 */
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env') });

const DB_PATH = join(__dirname, '../backend/pbi_tracker.db');
const db = new Database(DB_PATH);

const videoId = process.argv[2];
if (!videoId) { console.error('Használat: node scripts/translate-one.mjs VIDEO_ID'); process.exit(1); }

const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId);
if (!video) { console.error('Videó nem található:', videoId); process.exit(1); }

console.log('Videó:', video.title?.slice(0, 60));

async function translateWithClaude(text) {
  if (!text?.trim()) return null;
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const r = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{ role: 'user', content: `Fordítsd magyarra természetes, folyékony stílusban. Power BI, DAX, Excel, tracker maradjon angolul. Csak a fordítást add vissza.\n\n${text.slice(0, 1500)}` }]
  });
  return r.content[0]?.text?.trim() || null;
}

async function main() {
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('Claude-haiku fordítás...');
    const titleHu = await translateWithClaude(video.title);
    console.log('Cím HU:', titleHu);
    const descHu = await translateWithClaude(video.description);
    db.prepare("UPDATE videos SET title_hu = ?, description_hu = ?, updated_at = datetime('now') WHERE id = ?")
      .run(titleHu, descHu, videoId);
    console.log('✅ Mentve!');
  } else {
    console.error('ANTHROPIC_API_KEY hiányzik!');
  }
  db.close();
}

main().catch(console.error);
