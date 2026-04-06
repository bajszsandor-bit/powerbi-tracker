/**
 * @file Channels.jsx
 * @description Csatornák könyvtár – három fül (English top 30 / Magyar top 15 / Claude)
 * kategória- és szintszűrőkkel.
 */

import { useState } from 'react';

// ── Adatok ────────────────────────────────────────────────────────────────────

const EN_CHANNELS = [
  { rank: 1,  name: 'Guy in a Cube',                    category: 'Power BI',   level: 'Haladó',      description: 'Mély technikai magyarázatok, Fabric, DAX, modellezés',                        url: 'https://www.youtube.com/@GuyInACube',          badge: '🏆' },
  { rank: 2,  name: 'Learnit Training',                  category: 'Power BI',   level: 'Minden szint', description: 'Teljes Power BI tanfolyamok kezdőtől haladóig',                              url: 'https://www.youtube.com/@LearnitTraining',     badge: '📚' },
  { rank: 3,  name: 'Enterprise DNA',                    category: 'Power BI',   level: 'Haladó',      description: 'Haladó DAX, modellezés, üzleti esettanulmányok',                             url: 'https://www.youtube.com/@EnterpriseDNA',       badge: '🎯' },
  { rank: 4,  name: 'Curbal',                            category: 'Power BI',   level: 'Közepes',     description: 'Gyors, praktikus Power BI tippek, DAX trükkök',                              url: 'https://www.youtube.com/@Curbal',              badge: '⚡' },
  { rank: 5,  name: 'BI Elite',                          category: 'Power BI',   level: 'Haladó',      description: 'Custom vizualizációk, DAX, modellezés',                                      url: 'https://www.youtube.com/@BIElite',             badge: '💎' },
  { rank: 6,  name: 'RADACAD',                           category: 'Power BI',   level: 'Haladó',      description: 'Haladó Power BI + AI + Fabric',                                              url: 'https://www.youtube.com/@RADACAD',             badge: '🤖' },
  { rank: 7,  name: 'Avi Singh – PowerBIPro',            category: 'Power BI',   level: 'Kezdő',       description: 'Könnyen érthető, kezdőbarát oktatás',                                        url: 'https://www.youtube.com/@PowerBIPro',          badge: '🌟' },
  { rank: 8,  name: 'SQLBI',                             category: 'DAX',        level: 'Expert',      description: 'A világ legjobb DAX tananyagai – Alberto Ferrari',                           url: 'https://www.youtube.com/@SQLBI',               badge: '👑' },
  { rank: 9,  name: 'Leila Gharani',                     category: 'Excel + BI', level: 'Közepes',     description: 'Excel + Power BI profi oktatás',                                             url: 'https://www.youtube.com/@LeilaGharani',        badge: '⭐' },
  { rank: 10, name: 'How to Power BI (Bas)',             category: 'Power BI',   level: 'Közepes',     description: 'Modern design, UI/UX, dashboard építés',                                     url: 'https://www.youtube.com/@HowtoPowerBI',        badge: '🎨' },
  { rank: 11, name: 'Pragmatic Works',                   category: 'Power BI',   level: 'Minden szint', description: 'Teljes Power BI kurzusok, projektalapú oktatás',                            url: 'https://www.youtube.com/@PragmaticWorks',      badge: '🏗️' },
  { rank: 12, name: 'Microsoft Power BI',                category: 'Power BI',   level: 'Hivatalos',   description: 'Havi frissítések, újdonságok, Feature Summary',                              url: 'https://www.youtube.com/@MicrosoftPowerBI',    badge: '🔵' },
  { rank: 13, name: 'Power BI Tips',                     category: 'Power BI',   level: 'Közepes',     description: 'Theme-ek, layoutok, vizuális trükkök',                                       url: 'https://www.youtube.com/@PowerBITips',         badge: '💡' },
  { rank: 14, name: 'Analytics with Nags',               category: 'Power BI',   level: 'Közepes',     description: 'Teljes dashboard projektek lépésről lépésre',                                url: 'https://www.youtube.com/@AnalyticswithNags',   badge: '📊' },
  { rank: 15, name: 'Data Tutorials',                    category: 'Power BI',   level: 'Kezdő',       description: 'Gyakorlati Power BI példák',                                                 url: 'https://www.youtube.com/@DataTutorials1',      badge: '🎓' },
  { rank: 16, name: 'Marco Russo (SQLBI)',               category: 'DAX',        level: 'Expert',      description: 'DAX Patterns, mérték optimalizálás, Tabular',                                url: 'https://www.youtube.com/@SQLBI',               badge: '👑' },
  { rank: 17, name: 'Kasper de Jonge',                   category: 'DAX',        level: 'Expert',      description: 'DAX deep-dive, Power BI PM csapat tagja',                                    url: 'https://www.youtube.com/@KasperdeJonge',       badge: '🔬' },
  { rank: 18, name: 'Reid Havens',                       category: 'Power BI',   level: 'Haladó',      description: 'Power BI design, UX, governance best practices',                             url: 'https://www.youtube.com/@ReidHavens',          badge: '🎨' },
  { rank: 19, name: 'Chandeep Chhabra (BI Gorilla)',     category: 'Power BI',   level: 'Haladó',      description: 'Power Query M, DAX, modellezési trükkök',                                    url: 'https://www.youtube.com/@BIGorilla',           badge: '🦍' },
  { rank: 20, name: 'Kevin Stratvert',                   category: 'Excel + BI', level: 'Kezdő',       description: 'Microsoft eszközök, Excel, Power BI alapok',                                 url: 'https://www.youtube.com/@KevinStratvert',      badge: '📹' },
  { rank: 21, name: 'Excel Campus (Jon Acampora)',       category: 'Excel',      level: 'Közepes',     description: 'Excel automatizálás, Power Query, VBA',                                      url: 'https://www.youtube.com/@ExcelCampus',         badge: '📊' },
  { rank: 22, name: 'MyOnlineTrainingHub',               category: 'Excel',      level: 'Közepes',     description: 'Excel + Power BI részletes oktatás',                                         url: 'https://www.youtube.com/@MyOnlineTrainingHub', badge: '🎯' },
  { rank: 23, name: 'ExcelIsFun (Mike Girvin)',          category: 'Excel',      level: 'Expert',      description: 'Excel függvények, dinamikus tömbök, Power Query',                            url: 'https://www.youtube.com/@ExcelIsFun',          badge: '🏅' },
  { rank: 24, name: 'Chandoo',                           category: 'Excel + BI', level: 'Közepes',     description: 'Excel dashboard, vizualizáció, storytelling',                                url: 'https://www.youtube.com/@chandoo_',            badge: '📈' },
  { rank: 25, name: 'Mr. Excel (Bill Jelen)',            category: 'Excel',      level: 'Expert',      description: 'Excel tippek, Power Query, formulák',                                        url: 'https://www.youtube.com/@MrExcel',             badge: '📗' },
  { rank: 26, name: 'Luke Barousse',                     category: 'Data',       level: 'Közepes',     description: 'Data analyst karrierépítés, SQL, Power BI',                                  url: 'https://www.youtube.com/@LukeBarousse',        badge: '💼' },
  { rank: 27, name: 'Alex The Analyst',                  category: 'Data',       level: 'Kezdő',       description: 'Data analyst alapok, SQL, Python, Power BI',                                 url: 'https://www.youtube.com/@AlexTheAnalyst',      badge: '🔍' },
  { rank: 28, name: 'Power BI Park',                     category: 'Power BI',   level: 'Haladó',      description: 'DAX Studio, Tabular Editor, performance tuning',                             url: 'https://www.youtube.com/@PowerBIPark',         badge: '🏎️' },
  { rank: 29, name: 'Zebra BI',                          category: 'Power BI',   level: 'Közepes',     description: 'Profi vizualizációk, IBCS standard reportok',                                url: 'https://www.youtube.com/@ZebraBI',             badge: '🦓' },
  { rank: 30, name: 'Data Mozart',                       category: 'Power BI',   level: 'Haladó',      description: 'Power BI + Fabric + advanced analytics',                                     url: 'https://www.youtube.com/@DataMozart',          badge: '🎵' },
];

const HU_CHANNELS = [
  { rank: 1,  name: 'Data Science Magyarul',         category: 'Power BI',    level: 'Kezdő',       description: 'Kezdőbarát Power BI és adatvizualizáció',                           url: 'https://www.youtube.com/@DataScienceMagyarul',             badge: '🇭🇺' },
  { rank: 2,  name: 'BI Projekt',                    category: 'Power BI',    level: 'Közepes',     description: 'Gyakorlati Power BI példák, DAX',                                   url: 'https://www.youtube.com/@BIProjekt',                       badge: '🇭🇺' },
  { rank: 3,  name: 'Horizont Informatika',          category: 'Power BI',    level: 'Közepes',     description: 'Power BI oktatóvideók, esettanulmányok',                            url: 'https://www.youtube.com/@HorizontInformatika',             badge: '🇭🇺' },
  { rank: 4,  name: 'Training360 – Power BI',        category: 'Tanfolyam',   level: 'Minden szint', description: 'Hivatalos magyar oktatóanyagok, tanúsítványok',                   url: 'https://www.training360.com',                              badge: '🏫' },
  { rank: 5,  name: 'Netacademia – Power BI',        category: 'Tanfolyam',   level: 'Minden szint', description: 'Magyar nyelvű online tanfolyamok',                                url: 'https://www.netacademia.hu',                               badge: '🏫' },
  { rank: 6,  name: 'Fornax BI',                     category: 'Blog + Videó', level: 'Haladó',     description: 'Power BI blog + videók, best practices',                           url: 'https://fornaxbi.hu',                                      badge: '📝' },
  { rank: 7,  name: 'BI Consulting Hungary',         category: 'Power BI',    level: 'Expert',      description: 'DAX, modellezés, enterprise esettanulmányok',                       url: '#',                                                        badge: '💼' },
  { rank: 8,  name: 'DataViz Hungary',               category: 'Vizualizáció', level: 'Közepes',    description: 'Dashboard design, vizuális tippek',                                url: '#',                                                        badge: '🎨' },
  { rank: 9,  name: 'Power BI Magyar Közösség',      category: 'Közösség',    level: 'Minden szint', description: 'Aktív Facebook közösség, kérdések-válaszok',                      url: 'https://www.facebook.com/groups/powerbimagyar',            badge: '👥' },
  { rank: 10, name: 'Power BI Hungary Meetup',       category: 'Esemény',     level: 'Minden szint', description: 'Rendszeres előadások, networking, videók',                        url: 'https://www.meetup.com/Power-BI-Hungary',                  badge: '🤝' },
  { rank: 11, name: 'Excel Titkok (YouTube)',        category: 'Excel',       level: 'Közepes',     description: 'Magyar Excel oktatás, formulák, trükkök',                           url: '#',                                                        badge: '📊' },
  { rank: 12, name: 'Adatelemzés Magyarul',          category: 'Data',        level: 'Kezdő',       description: 'Adatelemzés alapjai magyarul',                                      url: '#',                                                        badge: '📈' },
  { rank: 13, name: 'Microsoft Magyarország',        category: 'Hivatalos',   level: 'Minden szint', description: 'Magyar Microsoft hírek, Power BI frissítések',                    url: 'https://www.microsoft.com/hu-hu',                          badge: '🔵' },
  { rank: 14, name: 'IVSZ – Digitalizáció',          category: 'Ipar',        level: 'Haladó',      description: 'Digitalizáció, BI trendek, magyar ipar',                           url: 'https://ivsz.hu',                                          badge: '🏭' },
  { rank: 15, name: 'Tableau Hungary User Group',    category: 'Vizualizáció', level: 'Haladó',     description: 'BI + adatvizualizáció magyar közösség',                            url: '#',                                                        badge: '👥' },
];

const CLAUDE_CHANNELS = [
  { rank: 1, name: 'Matt Wolfe',           category: 'AI Hírek',       level: 'Minden szint', description: 'AI hírek, eszközrecenziók (Claude is rendszeresen szerepel)',   url: 'https://www.youtube.com/@mreflow',       badge: '📰' },
  { rank: 2, name: 'The AI Advantage',     category: 'AI Eszközök',    level: 'Közepes',      description: 'AI eszközök, Claude tippek, automatizálás',                    url: 'https://www.youtube.com/@aiadvantage',   badge: '🛠️' },
  { rank: 3, name: 'Matthew Berman',       category: 'AI Hírek',       level: 'Haladó',       description: 'AI hírek, Claude Code tesztek, ügynökök',                      url: 'https://www.youtube.com/@matthew_berman',badge: '🤖' },
  { rank: 4, name: 'Skill Leap AI',        category: 'Claude Oktatók', level: 'Kezdő',        description: 'Claude oktatók, kezdőknek, prompt tippek',                     url: 'https://www.youtube.com/@skillleapai',   badge: '🎓' },
  { rank: 5, name: 'Wes Roth',             category: 'AI Hírek',       level: 'Haladó',       description: 'AI fejlesztések (Anthropic, OpenAI), elemzések',               url: 'https://www.youtube.com/@WesRoth',        badge: '📊' },
  { rank: 6, name: 'Alex Finn',            category: 'AI Eszközök',    level: 'Közepes',      description: 'Claude + no-code alkalmazásépítés',                            url: 'https://www.youtube.com/@alexfinnx',     badge: '⚡' },
  { rank: 7, name: 'AI Foundations',       category: 'Claude Oktatók', level: 'Közepes',      description: 'Claude projektek, vibe coding, automatizálás',                 url: 'https://www.youtube.com/@aifoundations', badge: '🏗️' },
  { rank: 8, name: 'Anthropic (hivatalos)',category: 'Hivatalos',       level: 'Minden szint', description: 'Claude bemutatók, frissítések, demók',                         url: 'https://www.youtube.com/@anthropic-ai',  badge: '🔵' },
];

// ── Szín logika ───────────────────────────────────────────────────────────────

const CATEGORY_CLASS = {
  'Power BI':       'channel-card--powerbi',
  'DAX':            'channel-card--dax',
  'Excel':          'channel-card--excel',
  'Excel + BI':     'channel-card--excel',
  'Data':           'channel-card--data',
  'Tanfolyam':      'channel-card--powerbi',
  'Blog + Videó':   'channel-card--data',
  'Vizualizáció':   'channel-card--dax',
  'Közösség':       'channel-card--data',
  'Esemény':        'channel-card--data',
  'Hivatalos':      'channel-card--powerbi',
  'Ipar':           'channel-card--data',
  'AI Hírek':       'channel-card--data',
  'AI Eszközök':    'channel-card--dax',
  'Claude Oktatók': 'channel-card--powerbi',
};

const LEVEL_CLASS = {
  'Kezdő':       'level-pill--beginner',
  'Közepes':     'level-pill--intermediate',
  'Haladó':      'level-pill--advanced',
  'Expert':      'level-pill--expert',
  'Minden szint':'level-pill--all',
  'Hivatalos':   'level-pill--all',
};

// ── Szűrő kategóriák ──────────────────────────────────────────────────────────

const EN_CATEGORIES     = ['Összes', 'Power BI', 'DAX', 'Excel', 'Excel + BI', 'Data'];
const EN_LEVELS         = ['Összes', 'Kezdő', 'Közepes', 'Haladó', 'Expert'];
const HU_CATEGORIES     = ['Összes', 'Power BI', 'Tanfolyam', 'Excel', 'Közösség', 'Vizualizáció'];
const HU_LEVELS         = ['Összes', 'Kezdő', 'Közepes', 'Haladó', 'Expert', 'Minden szint'];
const CLAUDE_CATEGORIES = ['Összes', 'AI Hírek', 'AI Eszközök', 'Claude Oktatók', 'Hivatalos'];
const CLAUDE_LEVELS     = ['Összes', 'Kezdő', 'Közepes', 'Haladó', 'Minden szint'];

// ── Komponensek ───────────────────────────────────────────────────────────────

function ChannelCard({ ch }) {
  const catClass = CATEGORY_CLASS[ch.category] || '';
  const lvlClass = LEVEL_CLASS[ch.level] || 'level-pill--all';
  const isYoutube = ch.url.includes('youtube.com') || ch.url.includes('youtu.be');
  const isDisabled = ch.url === '#';

  return (
    <article className={`channel-card ${catClass}`}>
      <div className="channel-card__rank-num">#{ch.rank}</div>

      <div className="channel-card__badge-emoji">{ch.badge}</div>

      <div className="channel-card__content">
        <div className="channel-card__top">
          <h3 className="channel-card__name">{ch.name}</h3>
          <div className="channel-card__chips">
            <span className={`channel-card__cat-chip channel-card__cat-chip--${catClass.replace('channel-card--', '')}`}>
              {ch.category}
            </span>
            <span className={`level-pill ${lvlClass}`}>{ch.level}</span>
          </div>
        </div>
        <p className="channel-card__description">{ch.description}</p>
        <div className="channel-card__footer">
          {isDisabled ? (
            <span className="channel-card__open-btn channel-card__open-btn--disabled">Hamarosan →</span>
          ) : (
            <a
              href={ch.url}
              target="_blank"
              rel="noopener noreferrer"
              className="channel-card__open-btn"
            >
              {isYoutube ? 'YouTube →' : 'Megnyitás →'}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function FilterPills({ options, active, onChange }) {
  return (
    <div className="filter-pills">
      {options.map((opt) => (
        <button
          key={opt}
          className={`filter-pill${active === opt ? ' filter-pill--active' : ''}`}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function ChannelTab({ channels, categories, levels }) {
  const [activeCat, setActiveCat] = useState('Összes');
  const [activeLvl, setActiveLvl] = useState('Összes');

  const filtered = channels.filter((ch) => {
    const catMatch = activeCat === 'Összes' || ch.category === activeCat;
    const lvlMatch = activeLvl === 'Összes' || ch.level === activeLvl;
    return catMatch && lvlMatch;
  });

  const uniqueCats = [...new Set(channels.map((c) => c.category))].length;

  return (
    <div className="channel-tab">
      <div className="channel-tab__stats">
        <span className="channel-tab__stat">{channels.length} csatorna</span>
        <span className="channel-tab__stat-sep">·</span>
        <span className="channel-tab__stat">{uniqueCats} kategória</span>
        {filtered.length !== channels.length && (
          <>
            <span className="channel-tab__stat-sep">·</span>
            <span className="channel-tab__stat channel-tab__stat--filtered">{filtered.length} találat</span>
          </>
        )}
      </div>

      <div className="channel-tab__filters">
        <div className="channel-tab__filter-group">
          <span className="channel-tab__filter-label">Kategória</span>
          <FilterPills options={categories} active={activeCat} onChange={setActiveCat} />
        </div>
        <div className="channel-tab__filter-group">
          <span className="channel-tab__filter-label">Szint</span>
          <FilterPills options={levels} active={activeLvl} onChange={setActiveLvl} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="channel-tab__empty">Nincs találat a választott szűrőkre.</div>
      ) : (
        <div className="channels-grid">
          {filtered.map((ch) => (
            <ChannelCard key={`${ch.rank}-${ch.name}`} ch={ch} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fő oldal ──────────────────────────────────────────────────────────────────

function Channels() {
  const [activeTab, setActiveTab] = useState('en');

  return (
    <main className="channels">
      <div className="channels__header">
        <h2 className="channels__title">Csatorna Könyvtár</h2>
        <p className="channels__subtitle">
          A legjobb Power BI, DAX, Excel és Claude tanulási források – kurátori válogatás
        </p>
      </div>

      <div className="channels__tabs">
        <button
          className={`channels__tab${activeTab === 'en' ? ' channels__tab--active' : ''}`}
          onClick={() => setActiveTab('en')}
        >
          🌍 Angol csatornák (top 30)
        </button>
        <button
          className={`channels__tab${activeTab === 'hu' ? ' channels__tab--active' : ''}`}
          onClick={() => setActiveTab('hu')}
        >
          🇭🇺 Magyar források (top 15)
        </button>
        <button
          className={`channels__tab${activeTab === 'claude' ? ' channels__tab--active' : ''}`}
          onClick={() => setActiveTab('claude')}
        >
          🤖 Claude csatornák (top 8)
        </button>
      </div>

      {activeTab === 'en' && (
        <ChannelTab
          channels={EN_CHANNELS}
          categories={EN_CATEGORIES}
          levels={EN_LEVELS}
        />
      )}
      {activeTab === 'hu' && (
        <ChannelTab
          channels={HU_CHANNELS}
          categories={HU_CATEGORIES}
          levels={HU_LEVELS}
        />
      )}
      {activeTab === 'claude' && (
        <ChannelTab
          channels={CLAUDE_CHANNELS}
          categories={CLAUDE_CATEGORIES}
          levels={CLAUDE_LEVELS}
        />
      )}
    </main>
  );
}

export default Channels;
