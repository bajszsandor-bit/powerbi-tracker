/**
 * Bulk fordítás Ollama mistral:7b-vel
 * Lefordítja az összes title_hu IS NULL videót
 * Futtatás: node scripts/bulk-translate-ollama.mjs
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../backend/pbi_tracker.db');

const db = new Database(DB_PATH);

async function ollamaTranslate(text) {
  if (!text?.trim()) return null;
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral:7b',
        prompt: `Te egy profi magyar műszaki fordító vagy. Fordítsd le az alábbi szöveget természetes, folyékony magyarra.\n\nSzabályok:\n- Csak a fordítást add vissza, semmilyen más szöveget ne írj\n- A szakmai angol kifejezéseket (Power BI, DAX, Excel, Microsoft, dashboard, report, measure, stb.) hagyd angolul\n- Természetes magyar mondatszerkezetet használj, ne szó szerint fordíts\n- Ha rövidítés vagy tulajdonnév, hagyd eredeti formában\n\nSzöveg:\n${text.slice(0, 1500)}`,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const t = data?.response?.trim();
    return (t && t !== text) ? t : null;
  } catch (e) {
    console.error('  Ollama hiba:', e.message);
    return null;
  }
}

async function main() {
  const videos = db.prepare("SELECT id, title, description FROM videos WHERE title_hu IS NULL").all();
  console.log(`\n🦙 Ollama bulk fordítás – ${videos.length} videó\n`);

  const update = db.prepare(`
    UPDATE videos SET title_hu = ?, description_hu = ?, updated_at = datetime('now') WHERE id = ?
  `);

  let done = 0;
  for (const v of videos) {
    process.stdout.write(`[${done + 1}/${videos.length}] ${v.title?.slice(0, 55)}... `);

    const titleHu = await ollamaTranslate(v.title);
    const descHu = await ollamaTranslate(v.description);

    if (titleHu) {
      update.run(titleHu, descHu || null, v.id);
      console.log(`✓`);
    } else {
      console.log(`✗ (Ollama nem válaszolt)`);
    }
    done++;
  }

  console.log(`\n✅ Kész! ${done} videó feldolgozva.\n`);
  db.close();
}

main().catch(console.error);
