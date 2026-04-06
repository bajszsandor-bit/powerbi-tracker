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
 * Szavak listája amelyek oktatási/elemzési tartalomra utalnak.
 * Ha a cím ezek egyikét sem tartalmazza, a videó nem kerül be a Top 10-be.
 */
const RELEVANT_KEYWORDS = [
  'power bi', 'powerbi', 'dax', 'power query', 'fabric', 'pbix',
  'excel', 'dashboard', 'report', 'data', 'analytics', 'analysis',
  'pivot', 'chart', 'visualization', 'measure', 'calculation',
  'vlookup', 'xlookup', 'tableau', 'sql', 'bi ', ' bi',
  'tutorial', 'training', 'learn', 'course', 'tanulás', 'oktatás',
  'elemzés', 'adat', 'kimutatás', 'riport', 'műszerfal',
];

/**
 * Szavak listája amelyek nem oktatási tartalomra utalnak (ASMR, mém, vicc stb.).
 * Ha a cím bármelyiket tartalmazza, a videó ki lesz szűrve.
 */
const NEGATIVE_KEYWORDS = [
  'asmr', 'sleep', 'relaxing', 'relaxation', 'no talking', 'lofi', 'lo-fi',
  'pizza', 'kit-kat', 'kitkat', 'meme', 'joke', 'funny', 'prank',
  'mukbang', 'vlog', 'reaction', 'unboxing',
];

/**
 * Megvizsgálja, hogy egy videó tartalmilag releváns-e (nem ASMR, mém, reklám stb.).
 *
 * @param {object} video - Videó objektum
 * @returns {boolean}
 */
function isRelevantVideo(video) {
  const titleLower = (video.title || '').toLowerCase();
  const descLower = (video.description || '').slice(0, 500).toLowerCase();

  // Ha negatív kulcsszó van a címben → azonnal irreleváns
  if (NEGATIVE_KEYWORDS.some((kw) => titleLower.includes(kw))) return false;

  // Ha DAX függvény van benne → azonnal releváns
  if ((Number(video.dax_mentions) || Number(video.daxMentions) || 0) > 0) return true;

  // Cím alapján szűrés
  return RELEVANT_KEYWORDS.some((kw) => titleLower.includes(kw) || descLower.includes(kw));
}

/**
 * Szűri és rendezi a videókat pontszám alapján, visszaadja a Top 10-et.
 * Csak oktatási/elemzési tartalmak kerülnek be – ASMR, mém, reklám videók kizárva.
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

  // 1. Relevanciaszűrés – kizárja az ASMR, mém, reklám videókat
  const relevant = scored.filter(isRelevantVideo);
  const pool0 = relevant.length >= 5 ? relevant : scored;

  // 2. Csak az elmúlt 365 napon belüli videók
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  const fresh = pool0.filter((v) => {
    const date = v.publishedAt || v.published_at;
    if (!date) return false;
    return new Date(date) >= cutoff;
  });

  // Ha van elég friss → csak azok; egyébként legfrissebb elérhető
  const pool = fresh.length >= 5 ? fresh : pool0
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
