/**
 * @file ytdlp.test.js
 * @description Unit tesztek a parseYtdlpOutput függvényhez.
 * A yt-dlp-t mock-olja – nem hív éles YouTube kéréseket.
 */

import { parseYtdlpOutput } from '../../backend/src/services/ytdlp.js';

describe('parseYtdlpOutput', () => {
  /**
   * Egy valós yt-dlp JSON sort generál tesztelési célra.
   *
   * @param {object} overrides - Felülírható mezők
   * @returns {string} JSON sor
   */
  function makeEntry(overrides = {}) {
    return JSON.stringify({
      id: 'abc123',
      title: 'Power BI DAX Tutorial',
      description: 'Learn DAX functions',
      uploader: 'Guy in a Cube',
      upload_date: '20240115',
      view_count: 10000,
      like_count: 500,
      thumbnail: 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg',
      webpage_url: 'https://www.youtube.com/watch?v=abc123',
      ...overrides,
    });
  }

  test('érvényes JSON sort helyesen dolgoz fel', () => {
    const raw = makeEntry();
    const result = parseYtdlpOutput(raw);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'abc123',
      title: 'Power BI DAX Tutorial',
      channelTitle: 'Guy in a Cube',
      publishedAt: '2024-01-15',
      viewCount: 10000,
      likeCount: 500,
    });
  });

  test('upload_date-t YYYY-MM-DD formátumra alakítja', () => {
    const raw = makeEntry({ upload_date: '20231205' });
    const result = parseYtdlpOutput(raw);
    expect(result[0].publishedAt).toBe('2023-12-05');
  });

  test('több JSON sort feldolgoz', () => {
    const raw = [
      makeEntry({ id: 'vid1', title: 'Video 1' }),
      makeEntry({ id: 'vid2', title: 'Video 2' }),
      makeEntry({ id: 'vid3', title: 'Video 3' }),
    ].join('\n');

    const result = parseYtdlpOutput(raw);
    expect(result).toHaveLength(3);
    expect(result.map((v) => v.id)).toEqual(['vid1', 'vid2', 'vid3']);
  });

  test('érvénytelen JSON sorokat kihagyja', () => {
    const raw = [
      makeEntry({ id: 'valid1', title: 'Valid' }),
      'nem JSON sor',
      '{ hiányos json',
      makeEntry({ id: 'valid2', title: 'Valid 2' }),
    ].join('\n');

    const result = parseYtdlpOutput(raw);
    expect(result).toHaveLength(2);
  });

  test('id nélküli bejegyzéseket kihagyja', () => {
    const raw = makeEntry({ id: undefined });
    const result = parseYtdlpOutput(raw);
    expect(result).toHaveLength(0);
  });

  test('cím nélküli bejegyzéseket kihagyja', () => {
    const raw = makeEntry({ title: '' });
    const result = parseYtdlpOutput(raw);
    expect(result).toHaveLength(0);
  });

  test('üres kimenet esetén üres tömböt ad vissza', () => {
    const result = parseYtdlpOutput('');
    expect(result).toHaveLength(0);
  });

  test('csak whitespace-ből álló kimenet esetén üres tömb', () => {
    const result = parseYtdlpOutput('   \n\n  ');
    expect(result).toHaveLength(0);
  });

  test('channel mező fallback-je uploader hiányában', () => {
    const raw = makeEntry({ uploader: undefined, channel: 'SQLBI' });
    const result = parseYtdlpOutput(raw);
    expect(result[0].channelTitle).toBe('SQLBI');
  });

  test('videoUrl generálódik webpage_url hiányában', () => {
    const raw = makeEntry({ webpage_url: undefined, id: 'testvid' });
    const result = parseYtdlpOutput(raw);
    expect(result[0].videoUrl).toBe('https://www.youtube.com/watch?v=testvid');
  });

  test('hiányzó upload_date esetén publishedAt null', () => {
    const raw = makeEntry({ upload_date: undefined });
    const result = parseYtdlpOutput(raw);
    expect(result[0].publishedAt).toBeNull();
  });

  test('description 5000 karakterre csonkítódik', () => {
    const longDesc = 'x'.repeat(6000);
    const raw = makeEntry({ description: longDesc });
    const result = parseYtdlpOutput(raw);
    expect(result[0].description.length).toBe(5000);
  });

  test('view_count és like_count 0 ha hiányzik', () => {
    const raw = makeEntry({ view_count: undefined, like_count: undefined });
    const result = parseYtdlpOutput(raw);
    expect(result[0].viewCount).toBe(0);
    expect(result[0].likeCount).toBe(0);
  });
});
