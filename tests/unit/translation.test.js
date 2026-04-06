/**
 * @file translation.test.js
 * @description Unit tesztek a fordítási fallback logikához és idempotencia ellenőrzéséhez.
 * Az éles Google Translate hívásokat mock-olja – nem igényel internet kapcsolatot.
 */

import { jest } from '@jest/globals';

// Mock: @vitalets/google-translate-api modul cseréje
const mockTranslate = jest.fn();

jest.unstable_mockModule('@vitalets/google-translate-api', () => ({
  translate: mockTranslate,
}));

// Dinamikus import a mock beállítása UTÁN
const { translateText, translateVideo } = await import(
  '../../backend/src/services/translation.js'
);

beforeEach(() => {
  mockTranslate.mockReset();
  global.fetch = jest.fn(() => Promise.reject(new Error('Fetch disabled in unit test')));
});

// ---------------------------------------------------------------------------
// translateText
// ---------------------------------------------------------------------------

describe('translateText', () => {
  test('sikeres fordítás esetén a lefordított szöveget adja vissza', async () => {
    mockTranslate.mockResolvedValue({ text: 'Helló világ' });
    const result = await translateText('Hello world');
    expect(result).toBe('Helló világ');
  });

  test('hálózati hiba esetén null-t ad vissza (fallback feljebb történik)', async () => {
    mockTranslate.mockRejectedValue(new Error('Network error'));
    const result = await translateText('Hello world');
    expect(result).toBeNull();
  });

  test('timeout hiba esetén null-t ad vissza', async () => {
    mockTranslate.mockRejectedValue(new Error('Request timeout'));
    const result = await translateText('Power BI tutorial');
    expect(result).toBeNull();
  });

  test('null szöveg esetén null-t ad vissza', async () => {
    const result = await translateText(null);
    expect(result).toBeNull();
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  test('üres szöveg esetén az üres stringet adja vissza', async () => {
    const result = await translateText('');
    expect(result).toBe('');
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  test('csak whitespace esetén a whitespace-t adja vissza', async () => {
    const result = await translateText('   ');
    expect(result).toBe('   ');
    expect(mockTranslate).not.toHaveBeenCalled();
  });

  test('ha a fordítás üres szöveget ad vissza, null-t ad vissza', async () => {
    mockTranslate.mockResolvedValue({ text: '' });
    const result = await translateText('Hello');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// translateVideo – idempotencia
// ---------------------------------------------------------------------------

describe('translateVideo – idempotencia', () => {
  test('ha title_hu már létezik, nem hív fordítót', async () => {
    const video = {
      id: 'abc',
      title: 'Power BI Tutorial',
      title_hu: 'Power BI Oktatóanyag',
      description_hu: 'Leírás magyarul',
      transcript_hu: 'Felirat magyarul',
    };
    const result = await translateVideo(video);
    expect(mockTranslate).not.toHaveBeenCalled();
    expect(result.titleHu).toBe('Power BI Oktatóanyag');
  });

  test('ha title_hu nincs, minden mezőt lefordít', async () => {
    mockTranslate
      .mockResolvedValueOnce({ text: 'Magyar cím' })
      .mockResolvedValueOnce({ text: 'Magyar leírás' })
      .mockResolvedValueOnce({ text: 'Magyar felirat' });

    const video = {
      id: 'abc',
      title: 'English title',
      description: 'English description',
      transcript: 'English transcript',
      title_hu: null,
    };
    const result = await translateVideo(video);
    expect(result.titleHu).toBe('Magyar cím');
    expect(result.descriptionHu).toBe('Magyar leírás');
    expect(result.transcriptHu).toBe('Magyar felirat');
    expect(mockTranslate).toHaveBeenCalledTimes(3);
  });

  test('fordítási hiba esetén az eredeti mezők maradnak', async () => {
    mockTranslate.mockRejectedValue(new Error('API error'));

    const video = {
      id: 'xyz',
      title: 'Original title',
      description: 'Original description',
      title_hu: null,
    };
    const result = await translateVideo(video);
    expect(result.titleHu).toBe('Original title');
    expect(result.descriptionHu).toBeNull();
  });

  test('ha transcript nincs, transcriptHu null marad', async () => {
    mockTranslate
      .mockResolvedValueOnce({ text: 'Magyar cím' })
      .mockResolvedValueOnce({ text: 'Magyar leírás' });

    const video = {
      id: 'abc',
      title: 'Title',
      description: 'Description',
      transcript: null,
      title_hu: null,
    };
    const result = await translateVideo(video);
    expect(result.transcriptHu).toBeNull();
  });
});
