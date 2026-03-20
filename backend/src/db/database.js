/**
 * @file database.js
 * @description SQLite adatbázis inicializálás és kapcsolat kezelés.
 * Létrehozza a data/videos.db fájlt és a szükséges táblákat, ha még nem léteznek.
 * A Node.js 24 beépített node:sqlite modulját használja (telepítés nélkül elérhető).
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../../data');
const DB_PATH = resolve(DATA_DIR, 'videos.db');

/** @type {DatabaseSync | null} */
let db = null;

/**
 * Inicializálja az SQLite adatbázist.
 * Létrehozza a data/ könyvtárat és a videos.db fájlt, ha még nem léteznek.
 * Beállítja a foreign keys pragma-t és létrehozza a videos táblát.
 *
 * @returns {DatabaseSync} Az adatbázis kapcsolat
 */
function initDatabase() {
  if (db) return db;

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new DatabaseSync(DB_PATH);

  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      channel_title TEXT,
      published_at TEXT,
      view_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      thumbnail_url TEXT,
      video_url TEXT,
      has_transcript INTEGER DEFAULT 0,
      transcript_hu TEXT,
      title_hu TEXT,
      description_hu TEXT,
      dax_functions TEXT,
      dax_mentions INTEGER DEFAULT 0,
      score REAL DEFAULT 0,
      ai_summary_hu TEXT,
      is_imported INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Migráció: ai_summary_hu oszlop hozzáadása ha még nincs
  try {
    db.exec('ALTER TABLE videos ADD COLUMN ai_summary_hu TEXT');
  } catch {
    // Oszlop már létezik – normális újraindításkor
  }

  // Migráció: is_imported oszlop hozzáadása ha még nincs
  try {
    db.exec('ALTER TABLE videos ADD COLUMN is_imported INTEGER DEFAULT 0');
  } catch {
    // Oszlop már létezik – normális újraindításkor
  }

  // Migráció: transcript_cues_hu oszlop hozzáadása ha még nincs
  try {
    db.exec('ALTER TABLE videos ADD COLUMN transcript_cues_hu TEXT');
  } catch {
    // Oszlop már létezik – normális újraindításkor
  }

  // Migráció: chapters_json oszlop hozzáadása ha még nincs
  try {
    db.exec('ALTER TABLE videos ADD COLUMN chapters_json TEXT');
  } catch {
    // Oszlop már létezik – normális újraindításkor
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DB] SQLite adatbázis inicializálva: ${DB_PATH}`);
  }

  return db;
}

/**
 * Visszaadja az aktuális adatbázis kapcsolatot.
 * Ha még nincs inicializálva, meghívja az initDatabase()-t.
 *
 * @returns {DatabaseSync} Az adatbázis kapcsolat
 */
function getDatabase() {
  if (!db) return initDatabase();
  return db;
}

export { initDatabase, getDatabase };
