/**
 * @file Channels.jsx
 * @description Top YouTube csatornák két szekcióban:
 * Power BI csatornák és Excel csatornák (forrás: YouTube_Csatornak.xlsx)
 */

const POWERBI_CHANNELS = [
  {
    rank: 1,
    name: 'How to Power BI',
    handle: '@HowtoPowerBI',
    url: 'https://www.youtube.com/@HowtoPowerBI/videos',
    avatar: '📖',
    specialty: 'Lépésről lépésre Power BI oktatás',
    description: 'Jól strukturált sorozatok kezdőknek és középhaladóknak. Vizualizáció, DAX alapok, adatkapcsolatok témánként.',
    level: 'Kezdő',
    language: 'Angol',
  },
  {
    rank: 2,
    name: 'Microsoft Power BI',
    handle: '@MicrosoftPowerBI',
    url: 'https://www.youtube.com/@MicrosoftPowerBI/videos',
    avatar: '🏢',
    specialty: 'Hivatalos bejelentések, új funkciók demói',
    description: 'A Microsoft hivatalos Power BI csatornája. Minden havi kiadáshoz bemutató videó, konferencia előadások és termékújdonságok.',
    level: 'Minden szint',
    language: 'Angol',
  },
  {
    rank: 3,
    name: 'Power BI Tips',
    handle: '@PowerBITips',
    url: 'https://www.youtube.com/@PowerBITips/videos',
    avatar: '💡',
    specialty: 'Power BI tippek és praktikus megoldások',
    description: 'Gyors, praktikus Power BI tippek és trükkök. Vizualizációs megoldások, DAX minták, dashboard best practices.',
    level: 'Középhaladó',
    language: 'Angol',
  },
  {
    rank: 4,
    name: 'DFW Power BI User Group',
    handle: '@dfwpowerbiusergroup1374',
    url: 'https://www.youtube.com/@dfwpowerbiusergroup1374/videos',
    avatar: '👥',
    specialty: 'Közösségi meetup előadások',
    description: 'Dallas-Fort Worth Power BI felhasználói csoport meetup felvételei. Valós üzleti esetek és közösségi tudásmegosztás.',
    level: 'Középhaladó–Haladó',
    language: 'Angol',
  },
  {
    rank: 5,
    name: 'Next Level Power BI Reports',
    handle: '@nextlevelpowerbireports',
    url: 'https://www.youtube.com/@nextlevelpowerbireports/videos',
    avatar: '🚀',
    specialty: 'Prémium Power BI riport design',
    description: 'Profi Power BI riportok és dashboardok készítése. Haladó vizualizációs technikák, egyedi designok.',
    level: 'Haladó',
    language: 'Angol',
  },
];

const EXCEL_CHANNELS = [
  {
    rank: 1,
    name: 'Dataképzés | ProfiExcel | Csáki Dávid',
    handle: '@datakepzes',
    url: 'https://www.youtube.com/@datakepzes/videos',
    avatar: '🇭🇺',
    specialty: 'Magyar Excel és adat oktatás',
    description: 'Magyar nyelvű Excel és adatelemzés oktatás Csáki Dávidtól. Érthetően, praktikusan – kezdőktől a profikig.',
    level: 'Minden szint',
    language: 'Magyar',
  },
  {
    rank: 2,
    name: 'Excel Cápa',
    handle: '@excelcapa5191',
    url: 'https://www.youtube.com/@excelcapa5191/videos',
    avatar: '🦈',
    specialty: 'Magyar Excel trükkök és tippek',
    description: 'Magyar nyelvű Excel tartalom – praktikus tippek, trükkök, és megoldások a mindennapi irodai munkához.',
    level: 'Kezdő–Középhaladó',
    language: 'Magyar',
  },
  {
    rank: 3,
    name: 'ExcelTitok',
    handle: '@ExcelTitok',
    url: 'https://www.youtube.com/@ExcelTitok/videos',
    avatar: '🔐',
    specialty: 'Excel titkok és haladó funkciók',
    description: 'Magyar nyelvű Excel oktatás – kevésbé ismert funkciók, rejtett lehetőségek és profi megoldások.',
    level: 'Középhaladó',
    language: 'Magyar',
  },
  {
    rank: 4,
    name: 'Excelneked',
    handle: '@Excelneked',
    url: 'https://www.youtube.com/@Excelneked/videos',
    avatar: '📊',
    specialty: 'Excel a mindennapi munkában',
    description: 'Magyar Excel oktatás mindennapi problémákra. Formulas, táblázatok, pivot, és praktikus munkamódszerek.',
    level: 'Kezdő',
    language: 'Magyar',
  },
  {
    rank: 5,
    name: 'How to Excel',
    handle: '@HowToExcelBlog',
    url: 'https://www.youtube.com/@HowToExcelBlog/videos',
    avatar: '📘',
    specialty: 'Excel blog és videó oktatás',
    description: 'How To Excel Blog – átfogó Excel oktatás képletektől a Power Query-ig. Tiszta, jól strukturált tartalom.',
    level: 'Minden szint',
    language: 'Angol',
  },
  {
    rank: 6,
    name: 'Excel Visual',
    handle: '@ExcelVisual',
    url: 'https://www.youtube.com/@ExcelVisual/videos',
    avatar: '🎨',
    specialty: 'Excel vizualizáció és diagramok',
    description: 'Vizuálisan vonzó Excel grafikonok és dashboardok készítése. Adatvizualizáció és design tippek.',
    level: 'Középhaladó',
    language: 'Angol',
  },
  {
    rank: 7,
    name: 'Ms Excel',
    handle: '@MsExcels',
    url: 'https://www.youtube.com/@MsExcels/videos',
    avatar: '💚',
    specialty: 'Microsoft Excel funkciók bemutatása',
    description: 'Excel függvények, képletek és funkciók részletes bemutatása. Rövid, tömör oktatóvideók.',
    level: 'Kezdő–Középhaladó',
    language: 'Angol',
  },
  {
    rank: 8,
    name: 'The Excel Hub',
    handle: '@theexcelhub',
    url: 'https://www.youtube.com/@theexcelhub/videos',
    avatar: '🔷',
    specialty: 'Excel és VBA oktatás',
    description: 'Excel funkciók és VBA automatizáció. Haladó képletek, makrók és munkafolyamat-optimalizáció.',
    level: 'Középhaladó–Haladó',
    language: 'Angol',
  },
  {
    rank: 9,
    name: 'MyExcelOnline.com',
    handle: '@MyExcelOnline',
    url: 'https://www.youtube.com/@MyExcelOnline/videos',
    avatar: '🌐',
    specialty: 'Online Excel kurzusok és tippek',
    description: 'John Michaloudis Excel oktatási platformja. Napi tippek, trükkök és teljes kurzusok kezdőktől haladókig.',
    level: 'Minden szint',
    language: 'Angol',
  },
  {
    rank: 10,
    name: 'MrExcel.com',
    handle: '@MrXL',
    url: 'https://www.youtube.com/@MrXL/videos',
    avatar: '👑',
    specialty: 'Excel legendák – Bill Jelen csatornája',
    description: 'Bill Jelen (MrExcel) – az egyik legtekintélyesebb Excel oktató. Napi tippek, trükkök, és évtizedes tapasztalat.',
    level: 'Minden szint',
    language: 'Angol',
  },
];

const LEVEL_COLOR = {
  'Kezdő': 'channel-card__level--beginner',
  'Kezdő–Középhaladó': 'channel-card__level--beginner',
  'Középhaladó': 'channel-card__level--intermediate',
  'Középhaladó–Haladó': 'channel-card__level--advanced',
  'Haladó': 'channel-card__level--advanced',
  'Minden szint': 'channel-card__level--all',
};

function ChannelCard({ ch }) {
  return (
    <article className="channel-card">
      <div className="channel-card__rank">#{ch.rank}</div>
      <div className="channel-card__avatar">{ch.avatar}</div>
      <div className="channel-card__body">
        <div className="channel-card__header">
          <h3 className="channel-card__name">{ch.name}</h3>
          <span className="channel-card__handle">{ch.handle}</span>
          {ch.language === 'Magyar' && (
            <span className="channel-card__lang-badge">🇭🇺 Magyar</span>
          )}
        </div>
        <p className="channel-card__specialty">{ch.specialty}</p>
        <p className="channel-card__desc">{ch.description}</p>
        <div className="channel-card__footer">
          <span className={`channel-card__level ${LEVEL_COLOR[ch.level] || ''}`}>
            {ch.level}
          </span>
          <a
            href={ch.url}
            target="_blank"
            rel="noopener noreferrer"
            className="channel-card__link"
          >
            ▶ Csatorna megnyitása
          </a>
        </div>
      </div>
    </article>
  );
}

function ChannelSection({ title, icon, channels }) {
  return (
    <section className="channels__section">
      <h3 className="channels__section-title">{icon} {title}</h3>
      <div className="channels__grid">
        {channels.map((ch) => (
          <ChannelCard key={ch.handle} ch={ch} />
        ))}
      </div>
    </section>
  );
}

function Channels() {
  return (
    <main className="channels">
      <div className="channels__header">
        <h2 className="channels__title">YouTube Csatornák</h2>
        <p className="channels__subtitle">
          A legjobb Power BI és Excel oktatócsatornák – minden videó friss, legutóbbi feltöltés
        </p>
      </div>
      <ChannelSection
        title="Power BI csatornák"
        icon="📊"
        channels={POWERBI_CHANNELS}
      />
      <ChannelSection
        title="Excel csatornák"
        icon="🟢"
        channels={EXCEL_CHANNELS}
      />
    </main>
  );
}

export default Channels;
