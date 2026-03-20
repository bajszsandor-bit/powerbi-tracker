/**
 * @file videoRepository.js
 * @description Videó adatok CRUD műveletei az SQLite adatbázisban.
 * Duplikátum szűrés: az INSERT OR IGNORE megakadályozza az ismételt mentést.
 */

import { getDatabase } from './database.js';

/**
 * @typedef {Object} VideoInput
 * @property {string} id - YouTube videó azonosító
 * @property {string} title - Videó cím (angol)
 * @property {string} [description] - Videó leírás (angol)
 * @property {string} [channelTitle] - Csatorna neve
 * @property {string} [publishedAt] - Publikálás dátuma (YYYY-MM-DD)
 * @property {number} [viewCount] - Nézettség
 * @property {number} [likeCount] - Like-ok száma
 * @property {string} [thumbnailUrl] - Thumbnail URL
 * @property {string} [videoUrl] - YouTube URL
 */

/**
 * Több videót ment az adatbázisba egy tranzakcióban.
 * Duplikátumokat figyelmen kívül hagyja (INSERT OR IGNORE).
 *
 * @param {VideoInput[]} videos - Mentendő videók tömbje
 * @returns {number} Ténylegesen beszúrt (új) sorok száma
 */
function upsertVideos(videos) {
  const db = getDatabase();

  const insert = db.prepare(`
    INSERT OR REPLACE INTO videos (
      id, title, description, channel_title, published_at,
      view_count, like_count, thumbnail_url, video_url,
      created_at, updated_at
    ) VALUES (
      :id, :title, :description, :channelTitle, :publishedAt,
      :viewCount, :likeCount, :thumbnailUrl, :videoUrl,
      COALESCE((SELECT created_at FROM videos WHERE id = :id), datetime('now')),
      datetime('now')
    )
  `);

  let inserted = 0;
  db.exec('BEGIN');
  try {
    for (const row of videos) {
      const result = insert.run({
        id: row.id,
        title: row.title,
        description: row.description || null,
        channelTitle: row.channelTitle || null,
        publishedAt: row.publishedAt || null,
        viewCount: row.viewCount || 0,
        likeCount: row.likeCount || 0,
        thumbnailUrl: row.thumbnailUrl || null,
        videoUrl: row.videoUrl || null,
      });
      inserted += result.changes;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return inserted;
}

/**
 * Visszaadja az összes videót az adatbázisból.
 *
 * @returns {object[]} Videók tömbje
 */
function getAllVideos() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM videos ORDER BY created_at DESC').all();
}

/**
 * Visszaadja az adatbázisban tárolt videók számát.
 *
 * @returns {number} Videók száma
 */
function getVideoCount() {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) as count FROM videos').get();
  return row.count;
}

/**
 * Frissíti egy videó felirat állapotát az adatbázisban.
 *
 * @param {string} videoId - YouTube videó azonosító
 * @param {boolean} hasTranscript - Van-e felirat
 * @returns {void}
 */
function updateTranscriptStatus(videoId, hasTranscript) {
  const db = getDatabase();
  db.prepare(
    `UPDATE videos SET has_transcript = :hasTranscript, updated_at = datetime('now') WHERE id = :id`
  ).run({ hasTranscript: hasTranscript ? 1 : 0, id: videoId });
}

/**
 * Elmenti egy videó magyar fordításait az adatbázisba.
 *
 * @param {string} videoId - YouTube videó azonosító
 * @param {{ titleHu: string|null, descriptionHu: string|null, transcriptHu: string|null }} translations
 * @returns {void}
 */
function updateTranslations(videoId, { titleHu, descriptionHu, transcriptHu }) {
  const db = getDatabase();
  db.prepare(
    `UPDATE videos SET
      title_hu = :titleHu,
      description_hu = :descriptionHu,
      transcript_hu = :transcriptHu,
      updated_at = datetime('now')
    WHERE id = :id`
  ).run({ titleHu: titleHu || null, descriptionHu: descriptionHu || null, transcriptHu: transcriptHu || null, id: videoId });
}

/**
 * Elmenti egy videó DAX függvény adatait az adatbázisba.
 *
 * @param {string} videoId - YouTube videó azonosító
 * @param {string[]} daxFunctions - Talált DAX függvény nevek tömbje
 * @returns {void}
 */
function updateDaxFunctions(videoId, daxFunctions) {
  const db = getDatabase();
  db.prepare(
    `UPDATE videos SET
      dax_functions = :daxFunctions,
      dax_mentions = :daxMentions,
      updated_at = datetime('now')
    WHERE id = :id`
  ).run({
    daxFunctions: JSON.stringify(daxFunctions),
    daxMentions: daxFunctions.length,
    id: videoId,
  });
}

/**
 * Visszaad egy videót azonosító alapján.
 *
 * @param {string} videoId - YouTube videó azonosító
 * @returns {object | null} A videó objektuma, vagy null ha nem található
 */
function getVideoById(videoId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM videos WHERE id = :id').get({ id: videoId }) || null;
}

/**
 * Visszaadja a legutóbb frissített videó updated_at dátumát.
 * Ha nincs egyetlen videó sem, null-t ad vissza.
 *
 * @returns {string | null} ISO dátum string vagy null
 */
function getLastUpdated() {
  const db = getDatabase();
  const row = db.prepare('SELECT MAX(updated_at) as last FROM videos').get();
  return row?.last || null;
}

/**
 * Elmenti egy videó AI-generált magyar összefoglalóját.
 *
 * @param {string} videoId
 * @param {string} summary
 */
function updateAiSummary(videoId, summary) {
  const db = getDatabase();
  db.prepare(
    `UPDATE videos SET ai_summary_hu = :summary, updated_at = datetime('now') WHERE id = :id`
  ).run({ summary, id: videoId });
}

/**
 * Elmenti egy videó szinkronizált magyar felirat cue-jait.
 *
 * @param {string} videoId
 * @param {{ start: number, end: number, text: string }[]} cues
 */
function updateTranscriptCues(videoId, cues) {
  const db = getDatabase();
  db.prepare(
    `UPDATE videos SET transcript_cues_hu = :cues, updated_at = datetime('now') WHERE id = :id`
  ).run({ cues: JSON.stringify(cues), id: videoId });
}

/**
 * Megjelöl egy videót manuálisan importáltként.
 *
 * @param {string} videoId - YouTube videó azonosító
 */
function markAsImported(videoId) {
  const db = getDatabase();
  db.prepare(
    `UPDATE videos SET is_imported = 1, updated_at = datetime('now') WHERE id = :id`
  ).run({ id: videoId });
}

/**
 * Visszaadja az összes manuálisan importált videót.
 *
 * @returns {object[]} Importált videók tömbje (legújabb elöl)
 */
function getImportedVideos() {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM videos WHERE is_imported = 1 ORDER BY created_at DESC'
  ).all();
}

export { upsertVideos, getAllVideos, getVideoCount, updateTranscriptStatus, updateTranslations, updateDaxFunctions, getVideoById, getLastUpdated, updateAiSummary, markAsImported, getImportedVideos, updateTranscriptCues };
