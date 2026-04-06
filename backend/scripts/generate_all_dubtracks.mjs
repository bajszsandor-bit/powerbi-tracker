/**
 * Sorban generálja az összes meglévő videó dubtrackjét.
 * Futtatás: node scripts/generate_all_dubtracks.mjs
 */

const BASE = 'http://localhost:3001/api';

const VIDEOS = [
  'x7mzOYEn0XA',
  'PlgM_b5QlJ8',
  'cYwioeHu_OU',
  '9MkwbP7-x6k',
  'iPEkHyE7Npw',
  '5IdkGBU4nDk',
  'jDSoSJz4ams',
  'wtyokiDANFo',
  'Rh19eC8rON4',
  'GtIysBPLB_U',
  '8Zz9Ekm6YrY',
];

function ts() {
  return new Date().toLocaleTimeString('hu-HU');
}

async function generateDubtrack(id) {
  console.log(`\n[${ts()}] === ${id} indítás ===`);
  try {
    const res = await fetch(`${BASE}/videos/${id}/generate-dubtrack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voice: 'noemi', pitch: '-5Hz' }),
      signal: AbortSignal.timeout(30 * 60 * 1000), // 30 perc max
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`[${ts()}] ✅ ${id} KÉSZ: ${data.duration?.toFixed(1)}s, ${data.cueCount} szegmens`);
      return true;
    } else {
      console.log(`[${ts()}] ⚠️ ${id} hiba: ${data.error}`);
      return false;
    }
  } catch (err) {
    console.log(`[${ts()}] ❌ ${id} kivétel: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(`[${ts()}] Dubtrack generálás minden videóhoz (${VIDEOS.length} db)`);
  let ok = 0, fail = 0;
  for (const id of VIDEOS) {
    const success = await generateDubtrack(id);
    if (success) ok++; else fail++;
  }
  console.log(`\n[${ts()}] === VÉGE: ${ok} sikeres, ${fail} hibás ===`);
}

main();
