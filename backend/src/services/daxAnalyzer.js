/**
 * @file daxAnalyzer.js
 * @description DAX függvény nevek kinyerése szövegből regex segítségével.
 * A statikus dax-reference.json fájlból tölti be az ismert függvény neveket.
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** @type {Record<string, { description: string, example: string }>} */
const DAX_REFERENCE = require(resolve(__dirname, '../data/dax-reference.json'));

/** Rendezett DAX függvény nevek listája (hosszabb nevek előre, a rövidebb nevű false positive elkerülésére) */
const DAX_FUNCTION_NAMES = Object.keys(DAX_REFERENCE).sort((a, b) => b.length - a.length);

/**
 * Regex minta: NAGYBETŰS egyezés VAGY függvényhívás (NAME() formátum).
 * Elkerüli a hamis találatokat mint az "all", "if", "return" a folyószövegben.
 * Egyezik ha: nagybetűs (ALL, IF) VAGY kis/nagybetű + zárójelnyitás (Calculate()
 */
const escaped = DAX_FUNCTION_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
// Mintegy: \b(CALCULATE|SUM|...)\s*\( – függvényhívás formátum (kis/nagybetű)
const DAX_CALL_PATTERN = new RegExp(
  `\\b(${escaped.join('|')})\\s*\\(`,
  'gi'
);
// Mintegy: \b(CALCULATE|SUM|...)\b – de csak NAGYBETŰS egyezés
const DAX_UPPER_PATTERN = new RegExp(
  `\\b(${escaped.join('|')})\\b`,
  'g'  // NEM 'i' – csak nagybetűs egyezés
);

/**
 * Kinyeri az összes DAX függvény nevet egy szövegből.
 * Csak NAGYBETŰS szavakat vagy konkrét függvényhívásokat (NAME()) fogad el.
 *
 * @param {string | null} text - Az elemzendő szöveg (pl. felirat vagy leírás)
 * @returns {string[]} Talált DAX függvény nevek tömbje (rendezve, duplikátum nélkül)
 */
function extractDaxFunctions(text) {
  if (!text || !text.trim()) return [];

  const callMatches = [...text.matchAll(DAX_CALL_PATTERN)].map((m) => m[1].toUpperCase());
  const upperMatches = [...text.matchAll(DAX_UPPER_PATTERN)].map((m) => m[1].toUpperCase());
  const unique = [...new Set([...callMatches, ...upperMatches])];
  return unique.sort();
}

/**
 * Visszaadja egy DAX függvény leírását és példakódját a referencia fájlból.
 *
 * @param {string} functionName - DAX függvény neve (kis/nagybetű mindegy)
 * @returns {{ description: string, example: string } | null} Leírás és példa, vagy null ha nem ismert
 */
function getDaxReference(functionName) {
  return DAX_REFERENCE[functionName.toUpperCase()] || null;
}

/**
 * Visszaadja az összes ismert DAX függvény nevét.
 *
 * @returns {string[]} Ismert DAX függvény nevek tömbje
 */
function getAllDaxFunctionNames() {
  return DAX_FUNCTION_NAMES;
}

export { extractDaxFunctions, getDaxReference, getAllDaxFunctionNames, DAX_REFERENCE };
