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
    INSERT OR IGNORE INTO videos (
      id, title, description, channel_title, published_at,
      view_count, like_count, thumbnail_url, video_url,
      created_at, updated_at
    ) VALUES (
      :id, :title, :description, :channelTitle, :publishedAt,
      :viewCount, :likeCount, :thumbnailUrl, :videoUrl,
      datetime('now'), datetime('now')
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

export { upsertVideos, getAllVideos, getVideoCount };
