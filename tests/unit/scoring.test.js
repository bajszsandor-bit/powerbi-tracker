/**
 * @file scoring.test.js
 * @description Unit tesztek a scoring algoritmushoz és a Top 10 kiválasztáshoz.
 */

import { getFreshnessScore, scoreVideo, getTop10 } from '../../backend/src/services/scoring.js';

// Rögzített referencia dátum a tesztek reprodukálhatóságához
const NOW = new Date('2024-02-15T12:00:00Z');

/** @param {number} daysAgo - Hány nappal ezelőtti dátumot adjunk vissza */
function daysAgoDate(daysAgo) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// getFreshnessScore
// ---------------------------------------------------------------------------

describe('getFreshnessScore', () => {
  test('mai videó 100 pontot kap', () => {
    expect(getFreshnessScore(daysAgoDate(0), NOW)).toBe(100);
  });

  test('5 napos videó 50 pontot kap', () => {
    expect(getFreshnessScore(daysAgoDate(5), NOW)).toBe(50);
  });

  test('10 napos videó 0 pontot kap (határeset)', () => {
    expect(getFreshnessScore(daysAgoDate(10), NOW)).toBe(0);
  });

  test('11 napos videó 0 pontot kap (minimum 0)', () => {
    expect(getFreshnessScore(daysAgoDate(11), NOW)).toBe(0);
  });

  test('30 napos videó 0 pontot kap', () => {
    expect(getFreshnessScore(daysAgoDate(30), NOW)).toBe(0);
  });

  test('null publishedAt esetén 0 pontot kap', () => {
    expect(getFreshnessScore(null, NOW)).toBe(0);
  });

  test('érvénytelen dátum esetén 0 pontot kap', () => {
    expect(getFreshnessScore('nem-dátum', NOW)).toBe(0);
  });

  test('jövőbeli videó 100 pontot kap', () => {
    expect(getFreshnessScore(daysAgoDate(-5), NOW)).toBe(100);
  });

  test('1 napos videó 90 pontot kap', () => {
    expect(getFreshnessScore(daysAgoDate(1), NOW)).toBe(90);
  });

  test('9 napos videó 10 pontot kap', () => {
    expect(getFreshnessScore(daysAgoDate(9), NOW)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// scoreVideo
// ---------------------------------------------------------------------------

describe('scoreVideo', () => {
  test('minden mező megadva – helyes összpontszám', () => {
    const video = {
      viewCount: 1000,
      likeCount: 500,
      publishedAt: daysAgoDate(0),
      daxMentions: 10,
    };
    // 1000*0.3 + 500*0.4 + 100*0.2 + 10*0.1 = 300 + 200 + 20 + 1 = 521
    expect(scoreVideo(video, NOW)).toBeCloseTo(521);
  });

  test('régi videónak (>30 nap) 0 a frissességi összetevője', () => {
    const video = {
      viewCount: 1000,
      likeCount: 500,
      publishedAt: daysAgoDate(31),
      daxMentions: 0,
    };
    // 1000*0.3 + 500*0.4 + 0*0.2 + 0*0.1 = 300 + 200 = 500
    expect(scoreVideo(video, NOW)).toBeCloseTo(500);
  });

  test('daxMentions hiánya esetén 0-ként kezeli', () => {
    const video = {
      viewCount: 100,
      likeCount: 100,
      publishedAt: daysAgoDate(0),
    };
    // 100*0.3 + 100*0.4 + 100*0.2 + 0*0.1 = 30 + 40 + 20 = 90
    expect(scoreVideo(video, NOW)).toBeCloseTo(90);
  });

  test('0 nézettség és 0 like esetén csak frissességi pontszám számít', () => {
    const video = {
      viewCount: 0,
      likeCount: 0,
      publishedAt: daysAgoDate(0),
      daxMentions: 0,
    };
    // 0 + 0 + 100*0.2 + 0 = 20
    expect(scoreVideo(video, NOW)).toBeCloseTo(20);
  });

  test('null/undefined mezők 0-ként kezelődnek', () => {
    const video = {
      viewCount: null,
      likeCount: undefined,
      publishedAt: null,
      daxMentions: null,
    };
    expect(scoreVideo(video, NOW)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getTop10
// ---------------------------------------------------------------------------

describe('getTop10', () => {
  test('1 évnél régebbi videók kiszűrésre kerülnek', () => {
    const videos = [
      { id: 'old', viewCount: 999999, likeCount: 999999, publishedAt: daysAgoDate(400) },
      { id: 'new', viewCount: 100, likeCount: 100, publishedAt: daysAgoDate(0) },
    ];
    const result = getTop10(videos, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('new');
  });

  test('pontszám szerint csökkenő sorrendbe rendez', () => {
    const videos = [
      { id: 'low', viewCount: 100, likeCount: 10, publishedAt: daysAgoDate(0) },
      { id: 'high', viewCount: 10000, likeCount: 5000, publishedAt: daysAgoDate(0) },
      { id: 'mid', viewCount: 1000, likeCount: 500, publishedAt: daysAgoDate(0) },
    ];
    const result = getTop10(videos, NOW);
    expect(result[0].id).toBe('high');
    expect(result[1].id).toBe('mid');
    expect(result[2].id).toBe('low');
  });

  test('legfeljebb 10 videót ad vissza', () => {
    const videos = Array.from({ length: 15 }, (_, i) => ({
      id: `vid${i}`,
      viewCount: i * 100,
      likeCount: i * 50,
      publishedAt: daysAgoDate(i % 9),
    }));
    const result = getTop10(videos, NOW);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  test('ha kevesebb mint 10 friss videó van, csak azok kerülnek vissza', () => {
    const videos = [
      { id: 'a', viewCount: 100, likeCount: 50, publishedAt: daysAgoDate(1) },
      { id: 'b', viewCount: 200, likeCount: 100, publishedAt: daysAgoDate(2) },
    ];
    const result = getTop10(videos, NOW);
    expect(result).toHaveLength(2);
  });

  test('üres lista esetén üres tömböt ad vissza', () => {
    expect(getTop10([], NOW)).toHaveLength(0);
  });

  test('minden videónak van score és freshnessScore mezője', () => {
    const videos = [{ id: 'x', viewCount: 100, likeCount: 50, publishedAt: daysAgoDate(0) }];
    const result = getTop10(videos, NOW);
    expect(typeof result[0].score).toBe('number');
    expect(typeof result[0].freshnessScore).toBe('number');
  });

  test('pontosan 10 napos videó bekerül de 0 freshness score-ral', () => {
    const videos = [
      { id: 'exactly10', viewCount: 100, likeCount: 50, publishedAt: daysAgoDate(10) },
    ];
    expect(getTop10(videos, NOW)).toHaveLength(1);
  });

  test('9 napos videó (freshnessScore=10) megjelenik', () => {
    const videos = [
      { id: 'day9', viewCount: 100, likeCount: 50, publishedAt: daysAgoDate(9) },
    ];
    const result = getTop10(videos, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].freshnessScore).toBe(10);
  });
});
