/**
 * @file transcript.test.js
 * @description Unit tesztek a VTT → tiszta szöveg konvertáló függvényhez.
 * Nem tölt le valódi feliratot – csak a parseVtt függvényt teszteli.
 */

import { parseVtt } from '../../backend/src/services/transcript.js';

describe('parseVtt', () => {
  test('WEBVTT fejlécet eltávolítja', () => {
    const vtt = `WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello world`;
    expect(parseVtt(vtt)).toBe('Hello world');
  });

  test('időbélyeg sorokat eltávolítja', () => {
    const vtt = `WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nFirst line\n\n00:00:02.000 --> 00:00:04.000\nSecond line`;
    expect(parseVtt(vtt)).toBe('First line Second line');
  });

  test('duplikált egymás utáni sorokat eltávolítja', () => {
    const vtt = `WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello\n\n00:00:02.000 --> 00:00:04.000\nHello\n\n00:00:04.000 --> 00:00:06.000\nWorld`;
    expect(parseVtt(vtt)).toBe('Hello World');
  });

  test('HTML tageket eltávolítja', () => {
    const vtt = `WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n<c>Hello</c> <i>world</i>`;
    expect(parseVtt(vtt)).toBe('Hello world');
  });

  test('Kind: és Language: metaadatsorokat eltávolítja', () => {
    const vtt = `WEBVTT\nKind: captions\nLanguage: en\n\n00:00:00.000 --> 00:00:02.000\nHello`;
    expect(parseVtt(vtt)).toBe('Hello');
  });

  test('sorszám sorokat eltávolítja', () => {
    const vtt = `WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000\nFirst\n\n2\n00:00:02.000 --> 00:00:04.000\nSecond`;
    expect(parseVtt(vtt)).toBe('First Second');
  });

  test('üres VTT esetén üres stringet ad vissza', () => {
    expect(parseVtt('')).toBe('');
  });

  test('csak fejlécet tartalmazó VTT esetén üres stringet ad vissza', () => {
    expect(parseVtt('WEBVTT\nKind: captions\nLanguage: en')).toBe('');
  });

  test('több mondatot szóközzel fűz össze', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:02.000',
      'Power BI is great.',
      '',
      '00:00:02.000 --> 00:00:04.000',
      'DAX is powerful.',
      '',
      '00:00:04.000 --> 00:00:06.000',
      'Let me show you CALCULATE.',
    ].join('\n');
    expect(parseVtt(vtt)).toBe('Power BI is great. DAX is powerful. Let me show you CALCULATE.');
  });

  test('vegyes HTML tagekkel ellátott VTT-t helyesen dolgoz fel', () => {
    const vtt = `WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n<00:00:00.500><c>CALCULATE</c> function`;
    expect(parseVtt(vtt)).toBe('CALCULATE function');
  });

  test('felesleges whitespace-t normalizálja', () => {
    const vtt = `WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n  hello   world  `;
    expect(parseVtt(vtt)).toBe('hello world');
  });

  test('vesszős időbélyeget is felismeri (00:00:00,000 --> formátum)', () => {
    const vtt = `WEBVTT\n\n00:00:00,000 --> 00:00:02,000\nSRT style`;
    expect(parseVtt(vtt)).toBe('SRT style');
  });
});
