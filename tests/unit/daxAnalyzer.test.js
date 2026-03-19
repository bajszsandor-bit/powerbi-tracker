/**
 * @file daxAnalyzer.test.js
 * @description Unit tesztek a DAX függvény kinyerő regex-hez.
 * Legalább 10 különböző eset, beleértve edge case-eket.
 */

import { extractDaxFunctions, getDaxReference, getAllDaxFunctionNames } from '../../backend/src/services/daxAnalyzer.js';

describe('extractDaxFunctions', () => {
  test('egyszerű CALCULATE kinyerése', () => {
    const result = extractDaxFunctions('Use CALCULATE to change the filter context.');
    expect(result).toContain('CALCULATE');
  });

  test('több függvény kinyerése egy szövegből', () => {
    const text = 'Today we use CALCULATE with FILTER and SUM to get results.';
    const result = extractDaxFunctions(text);
    expect(result).toContain('CALCULATE');
    expect(result).toContain('FILTER');
    expect(result).toContain('SUM');
  });

  test('kis- és nagybetű keveredése – normalizálja nagybetűsre', () => {
    const result = extractDaxFunctions('calculate and sumx are powerful DAX functions.');
    expect(result).toContain('CALCULATE');
    expect(result).toContain('SUMX');
  });

  test('duplikált függvény csak egyszer szerepel a kimenetben', () => {
    const text = 'CALCULATE is great. CALCULATE modifies context. Use CALCULATE often.';
    const result = extractDaxFunctions(text);
    expect(result.filter((f) => f === 'CALCULATE')).toHaveLength(1);
  });

  test('üres szövegből üres tömböt ad vissza', () => {
    expect(extractDaxFunctions('')).toHaveLength(0);
  });

  test('null szövegből üres tömböt ad vissza', () => {
    expect(extractDaxFunctions(null)).toHaveLength(0);
  });

  test('szóhatár – nem illeszkedik ismeretlen függvényre (SUMXYZ nem SUMX)', () => {
    const result = extractDaxFunctions('Use SUMXYZ function here.');
    expect(result).not.toContain('SUMX');
  });

  test('dátum időintelligencia függvények kinyerése', () => {
    const text = 'DATESYTD, SAMEPERIODLASTYEAR and TOTALYTD are time intelligence functions.';
    const result = extractDaxFunctions(text);
    expect(result).toContain('DATESYTD');
    expect(result).toContain('SAMEPERIODLASTYEAR');
    expect(result).toContain('TOTALYTD');
  });

  test('iteráló függvények kinyerése (SUMX, AVERAGEX, MAXX)', () => {
    const text = 'SUMX iterates rows. So does AVERAGEX and MAXX.';
    const result = extractDaxFunctions(text);
    expect(result).toContain('SUMX');
    expect(result).toContain('AVERAGEX');
    expect(result).toContain('MAXX');
  });

  test('VAR és RETURN kinyerése', () => {
    const text = 'Define a VAR variable and use RETURN to output it.';
    const result = extractDaxFunctions(text);
    expect(result).toContain('VAR');
    expect(result).toContain('RETURN');
  });

  test('eredmény rendezett sorrendben van', () => {
    const text = 'SUMX CALCULATE FILTER AVERAGE';
    const result = extractDaxFunctions(text);
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
  });

  test('zárójellel együtt is felismeri a függvényt', () => {
    const text = 'CALCULATE([Sales], FILTER(Sales, Sales[Year] = 2024))';
    const result = extractDaxFunctions(text);
    expect(result).toContain('CALCULATE');
    expect(result).toContain('FILTER');
  });

  test('legalább 50 függvény van a referenciában', () => {
    expect(getAllDaxFunctionNames().length).toBeGreaterThanOrEqual(50);
  });
});

describe('getDaxReference', () => {
  test('CALCULATE referenciát visszaadja', () => {
    const ref = getDaxReference('CALCULATE');
    expect(ref).not.toBeNull();
    expect(ref.description).toBeTruthy();
    expect(ref.example).toBeTruthy();
  });

  test('kis betűs névből is megtalálja', () => {
    const ref = getDaxReference('sumx');
    expect(ref).not.toBeNull();
  });

  test('ismeretlen függvényre null-t ad vissza', () => {
    expect(getDaxReference('NOTADAXFUNCTION')).toBeNull();
  });
});
