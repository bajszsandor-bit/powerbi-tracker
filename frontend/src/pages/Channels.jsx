/**
 * @file Channels.jsx
 * @description Top 10 Power BI YouTube csatorna – statikus kurátor lista
 * a legjobb oktatócsatornákról leírással és közvetlen linkekkel.
 */

const CHANNELS = [
  {
    rank: 1,
    name: 'Guy in a Cube',
    handle: '@GuyInACube',
    url: 'https://www.youtube.com/@GuyInACube/videos',
    avatar: '🎲',
    specialty: 'Általános Power BI, tipptár, heti újdonságok',
    description:
      'Adam Saxton és Patrick LeBlanc (Microsoft MVP) csatornája. Hetente friss videók Power BI újdonságokról, tippekről, DAX-ról és Power Query-ről. Kötelező követés mindenkinek.',
    level: 'Minden szint',
    language: 'Angol',
  },
  {
    rank: 2,
    name: 'SQLBI',
    handle: '@SQLBI',
    url: 'https://www.youtube.com/@SQLBI/videos',
    avatar: '📊',
    specialty: 'DAX, adatmodellezés – mélységi oktatás',
    description:
      'Marco Russo és Alberto Ferrari a világ legelismertebb DAX szakértői. Ha komolyan veszed a DAX-ot és az adatmodellezést, ez a csatorna elengedhetetlen. Részletes, tudományos igényű tartalom.',
    level: 'Haladó',
    language: 'Angol',
  },
  {
    rank: 3,
    name: 'Microsoft Power BI',
    handle: '@MicrosoftPowerBI',
    url: 'https://www.youtube.com/@MicrosoftPowerBI/videos',
    avatar: '🏢',
    specialty: 'Hivatalos bejelentések, új funkciók demói',
    description:
      'A Microsoft hivatalos Power BI csatornája. Minden havi kiadáshoz bemutató videó, konferencia előadások és termékújdonságok. Érdemes feliratkozni az aktuális hírekért.',
    level: 'Minden szint',
    language: 'Angol',
  },
  {
    rank: 4,
    name: 'Pragmatic Works',
    handle: '@PragmaticWorks',
    url: 'https://www.youtube.com/@PragmaticWorks/videos',
    avatar: '⚙️',
    specialty: 'Power BI, Power Query, adatintegráció',
    description:
      'Vállalati szintű Power BI és adatplatform oktatás. Ingyenes bootcamp-ek, teljes kurzusok, Power Query deep dive-ok. Sűrű tartalom-feltöltés.',
    level: 'Kezdő–Középhaladó',
    language: 'Angol',
  },
  {
    rank: 5,
    name: 'Chandoo',
    handle: '@chandoo_',
    url: 'https://www.youtube.com/@chandoo_/videos',
    avatar: '✨',
    specialty: 'Excel, Power BI, adatvizualizáció',
    description:
      'Chandoo.org tulajdonosa. Kiválóan magyaráz komplex témákat egyszerűen. Különösen erős a vizualizációs tippekben és az Excel → Power BI átmenetnél.',
    level: 'Kezdő–Középhaladó',
    language: 'Angol',
  },
  {
    rank: 6,
    name: 'How to Power BI',
    handle: '@HowtoPowerBI',
    url: 'https://www.youtube.com/@HowtoPowerBI/videos',
    avatar: '📖',
    specialty: 'Kezdőknek szánt Power BI sorozatok',
    description:
      'Lépésről lépésre felépített oktatási sorozatok kezdőknek és középhaladóknak. Jól strukturált playlist-ek témánként: vizualizáció, DAX alapok, adatkapcsolatok.',
    level: 'Kezdő',
    language: 'Angol',
  },
  {
    rank: 7,
    name: 'Curbal',
    handle: '@Curbal',
    url: 'https://www.youtube.com/@Curbal/videos',
    avatar: '🔵',
    specialty: 'DAX Fridays sorozat, Power Query',
    description:
      'Ruth Pozuelo Martinez "DAX Fridays" sorozata legendás – hetente egy DAX függvény részletes bemutatása. Több száz epizód, kiváló referencia-anyag.',
    level: 'Középhaladó',
    language: 'Angol',
  },
  {
    rank: 8,
    name: 'Enterprise DNA',
    handle: '@EnterpriseDNA',
    url: 'https://www.youtube.com/@EnterpriseDNA/videos',
    avatar: '🧬',
    specialty: 'Üzleti riportok, haladó DAX, dashboardok',
    description:
      'Sam McKay és csapata üzleti szempontból közelíti meg a Power BI-t. Valós üzleti eseteket mutatnak be, haladó DAX mintákkal és profi dashboard designnal.',
    level: 'Középhaladó–Haladó',
    language: 'Angol',
  },
  {
    rank: 9,
    name: 'Avi Singh – PowerBIPro',
    handle: '@AviSinghPowerBIPro',
    url: 'https://www.youtube.com/@AviSinghPowerBIPro/videos',
    avatar: '🏆',
    specialty: 'Power BI best practices, career advice',
    description:
      'Avi Singh Microsoft MVP. Kiváló tippek a Power BI legjobb gyakorlatairól, karrierépítésről BI területen, és valós vállalati megoldásokról.',
    level: 'Minden szint',
    language: 'Angol',
  },
  {
    rank: 10,
    name: 'Goodly',
    handle: '@GoodlyCo',
    url: 'https://www.youtube.com/@GoodlyCo/videos',
    avatar: '💡',
    specialty: 'Power BI vizualizáció, interaktív riportok',
    description:
      'Wyn Hopkins fókusza a szép és interaktív Power BI riportok készítése. Vizualizációs tippek, egyéni vizualizációk, és kreatív megoldások az adatok bemutatására.',
    level: 'Középhaladó',
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

/**
 * Egy csatorna kártyát renderel.
 *
 * @param {{ ch: object }} props
 */
function ChannelCard({ ch }) {
  return (
    <article className="channel-card">
      <div className="channel-card__rank">#{ch.rank}</div>
      <div className="channel-card__avatar">{ch.avatar}</div>
      <div className="channel-card__body">
        <div className="channel-card__header">
          <h3 className="channel-card__name">{ch.name}</h3>
          <span className="channel-card__handle">{ch.handle}</span>
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

/**
 * Channels oldal – Top 10 Power BI YouTube csatorna.
 *
 * @returns {JSX.Element}
 */
function Channels() {
  return (
    <main className="channels">
      <div className="channels__header">
        <h2 className="channels__title">Top 10 Power BI YouTube Csatorna</h2>
        <p className="channels__subtitle">
          A legjobb ingyenes Power BI oktatócsatornák – kezdőktől a haladókig
        </p>
      </div>
      <div className="channels__grid">
        {CHANNELS.map((ch) => (
          <ChannelCard key={ch.handle} ch={ch} />
        ))}
      </div>
    </main>
  );
}

export default Channels;
