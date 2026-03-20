/**
 * @file scoring.js
 * @description Power BI videók pontozási algoritmusa és Top 10 kiválasztás.
 * Formula: (views*0.3) + (likes*0.4) + (freshnessScore*0.2) + (daxMentions*0.1)
 * Csak az elmúlt 30 napon belüli videók kerülnek be (freshnessScore > 0).
 */

/**
 * Kiszámítja egy videó frissességi pontszámát.
 * 100 pont ha ma jelent meg, minden nappal 10 pontot veszít.
 * 30 napon túli videók 0 pontot kapnak.
 *
 * @param {string | null} publishedAt - A publikálás dátuma (YYYY-MM-DD)
 * @param {Date} [now] - Opcionális referencia dátum (teszteléshez)
 * @returns {number} Frissességi pontszám (0–100)
 */
function getFreshnessScore(publishedAt, now = new Date()) {
  if (!publishedAt) return 0;

  const published = new Date(publishedAt);
  if (isNaN(published.getTime())) return 0;

  const diffMs = now.getTime() - published.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 100;
  return Math.max(0, 100 - diffDays * 10);
}

/**
 * Kiszámítja egy videó összpontszámát.
 * A daxMentions mező OUT-06-ban kerül bevezetésre; addig 0 az alapértelmezett.
 *
 * @param {object} video - Videó objektum az adatbázisból
 * @param {number} video.viewCount - Nézettség
 * @param {number} video.likeCount - Like-ok száma
 * @param {string | null} video.publishedAt - Publikálás dátuma (YYYY-MM-DD)
 * @param {number} [video.daxMentions] - DAX függvény említések száma (OUT-06)
 * @param {Date} [now] - Opcionális referencia dátum (teszteléshez)
 * @returns {number} Összpontszám
 */
function scoreVideo(video, now = new Date()) {
  const views = Number(video.viewCount) || 0;
  const likes = Number(video.likeCount) || 0;
  const daxMentions = Number(video.daxMentions) || 0;
  const freshness = getFreshnessScore(video.publishedAt, now);

  return views * 0.3 + likes * 0.4 + freshness * 0.2 + daxMentions * 0.1;
}

/**
 * Szűri és rendezi a videókat pontszám alapján, visszaadja a Top 10-et.
 * Dátum nélküli videók is szerepelnek (freshnessScore = 0), de pontszám alapján hátrébb kerülnek.
 *
 * @param {object[]} videos - Videók tömbje az adatbázisból
 * @param {Date} [now] - Opcionális referencia dátum (teszteléshez)
 * @returns {object[]} Top 10 videó score mezővel kiegészítve, csökkenő sorrendben
 */
function getTop10(videos, now = new Date()) {
  const scored = videos.map((video) => ({
    ...video,
    freshnessScore: getFreshnessScore(video.publishedAt || video.published_at, now),
    score: scoreVideo({ ...video, publishedAt: video.publishedAt || video.published_at }, now),
  }));

  // Csak az elmúlt 365 napon belüli videók
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  const fresh = scored.filter((v) => {
    const date = v.publishedAt || v.published_at;
    if (!date) return false;
    return new Date(date) >= cutoff;
  });

  // Ha van elég friss → csak azok; egyébként legfrissebb elérhető
  const pool = fresh.length >= 5 ? fresh : scored
    .filter((v) => v.publishedAt || v.published_at)
    .sort((a, b) => {
      const da = new Date(a.publishedAt || a.published_at);
      const db2 = new Date(b.publishedAt || b.published_at);
      return db2 - da;
    });

  return (pool.length > 0 ? pool : scored)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

export { getFreshnessScore, scoreVideo, getTop10 };
