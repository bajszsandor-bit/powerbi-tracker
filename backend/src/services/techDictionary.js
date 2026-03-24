/**
 * @file techDictionary.js
 * @description Power BI / Excel / adatelemzés technikai szótár.
 *
 * STAY_ENGLISH: ezek a szavak maradjanak angolul a fordításban
 * TRANSLATE_TO_HU: következetesen így fordítandók magyarra
 */

// ─── Maradjon angolul ────────────────────────────────────────────────────────
export const STAY_ENGLISH = [
  // Microsoft termékek
  'Power BI', 'Power BI Desktop', 'Power BI Service', 'Power BI Mobile',
  'Excel', 'SharePoint', 'Teams', 'OneDrive', 'Azure', 'Fabric',
  'Copilot', 'Microsoft 365', 'Office 365',

  // Power BI funkciók
  'DAX', 'Power Query', 'M language',
  'dashboard', 'report', 'dataset', 'dataflow', 'workspace',
  'visual', 'visuals', 'slicer', 'filter', 'bookmark',
  'drill-through', 'drillthrough', 'drill through',
  'tooltip', 'cross-filter', 'cross-highlight',
  'row-level security', 'RLS', 'object-level security', 'OLS',
  'measure', 'measures', 'calculated column', 'calculated table',
  'data model', 'star schema', 'snowflake schema',
  'relationship', 'cardinality', 'fact table', 'dimension table',
  'Power Query Editor', 'Query Editor',
  'navigation pane', 'field pane', 'format pane',
  'canvas', 'report canvas', 'page', 'report page',

  // DAX függvények (mind nagybetűs maradjon)
  'CALCULATE', 'FILTER', 'ALL', 'ALLEXCEPT', 'RELATED', 'RELATEDTABLE',
  'SUMX', 'AVERAGEX', 'COUNTX', 'MAXX', 'MINX',
  'SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN', 'DISTINCTCOUNT',
  'IF', 'SWITCH', 'AND', 'OR', 'NOT', 'BLANK', 'ISBLANK',
  'DIVIDE', 'ROUND', 'INT', 'ABS',
  'DATEADD', 'DATESYTD', 'DATESMTD', 'DATESQTD',
  'TOTALYTD', 'TOTALMTD', 'TOTALQTD',
  'SAMEPERIODLASTYEAR', 'PREVIOUSMONTH', 'PREVIOUSYEAR',
  'USERELATIONSHIP', 'CROSSFILTER',
  'RANKX', 'TOPN', 'GENERATE',
  'VAR', 'RETURN',

  // Fájl / adat formátumok
  'PBIX', 'PBIT', 'CSV', 'JSON', 'XML', 'API', 'REST', 'SQL',
  'DirectQuery', 'Import mode', 'Live Connection',
  'KPI', 'SSAS', 'SSRS', 'SSIS',
];

// ─── Következetes magyar fordítások ──────────────────────────────────────────
export const TRANSLATE_TO_HU = {
  // Általános adatelemzés
  'calculated column': 'számított oszlop',
  'calculated table': 'számított tábla',
  'date table': 'dátumtábla',
  'date dimension': 'dátum dimenzió',
  'lookup table': 'keresőtábla',
  'summary table': 'összesítő tábla',
  'aggregation': 'összesítés',
  'aggregations': 'összesítések',
  'time intelligence': 'időintelligencia',
  'data refresh': 'adatfrissítés',
  'incremental refresh': 'növekményes frissítés',
  'data source': 'adatforrás',
  'data sources': 'adatforrások',
  'data type': 'adattípus',
  'data types': 'adattípusok',
  'data transformation': 'adatátalakítás',
  'data cleaning': 'adattisztítás',
  'data quality': 'adatminőség',
  'data validation': 'adatellenőrzés',
  'metadata': 'metaadat',

  // Power BI specifikus
  'report page': 'jelentésoldalon',
  'navigation': 'navigáció',
  'conditional formatting': 'feltételes formázás',
  'custom visual': 'egyéni vizualizáció',
  'custom visuals': 'egyéni vizualizációk',
  'performance analyzer': 'teljesítményelemző',
  'what-if parameter': 'mi-ha paraméter',
  'field parameter': 'mezőparaméter',
  'decomposition tree': 'lebontásfa',
  'key influencers': 'kulcstényezők',
  'smart narrative': 'intelligens narráció',

  // Általános programozás / üzlet
  'best practice': 'legjobb gyakorlat',
  'best practices': 'legjobb gyakorlatok',
  'use case': 'felhasználási eset',
  'use cases': 'felhasználási esetek',
  'step by step': 'lépésről lépésre',
  'workflow': 'munkafolyamat',
  'end user': 'végfelhasználó',
  'end users': 'végfelhasználók',
  'stakeholder': 'érdekelt fél',
  'stakeholders': 'érdekelt felek',
  'dashboard design': 'dashboard tervezés',
  'report design': 'jelentéstervezés',
  'layout': 'elrendezés',
  'color theme': 'színtéma',
  'template': 'sablon',
  'templates': 'sablonok',
};

/**
 * Visszaadja a prompt-ba illeszthető szótár-kontextust.
 * Csak a szövegben előforduló kifejezéseket veszi bele (ne legyen túl hosszú).
 */
export function getDictionaryContext(text) {
  const lowerText = text.toLowerCase();
  const lines = [];

  // Fordítandó kifejezések amelyek szerepelnek a szövegben
  const relevantTranslations = Object.entries(TRANSLATE_TO_HU)
    .filter(([en]) => lowerText.includes(en.toLowerCase()))
    .map(([en, hu]) => `"${en}" → "${hu}"`);

  if (relevantTranslations.length > 0) {
    lines.push('Következetes fordítások:');
    lines.push(...relevantTranslations);
  }

  return lines.join('\n');
}

/**
 * Post-process: javítja a fordításban tévesen magyarosított DAX/Power BI szavakat.
 * Pl. ha "calculate" lett "számít" helyett "CALCULATE" marad.
 */
export function fixTechTerms(translatedText, originalText) {
  if (!translatedText) return translatedText;
  let result = translatedText;

  // DAX függvények: nagybetűsen maradjanak
  const daxFunctions = STAY_ENGLISH.filter(t => /^[A-Z]+$/.test(t));
  for (const fn of daxFunctions) {
    // Ha a fordítás kisbetűsítette a DAX függvénynevet, visszaállítja
    const regex = new RegExp(`\\b${fn.toLowerCase()}\\b`, 'gi');
    result = result.replace(regex, (match) => {
      // Csak ha az eredeti szövegben is szerepel nagybetűsen
      if (originalText && originalText.includes(fn)) return fn;
      return match;
    });
  }

  return result;
}
