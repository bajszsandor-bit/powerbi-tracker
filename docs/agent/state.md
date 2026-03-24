# State – Ügynök memória

> Ez a fájl automatikusan frissül minden iteráció végén.

---

## Legutóbbi állapot
 
**Elkészült iteráció:** OUT-11 ✅ SZINKRON ÉS FORDÍTÁS JAVÍTVA
 
**Dátum:** 2026-03-24
 
**Elvégzett munka:**
- `backend/src/services/dubtrack.js` – Adaptív beszédsebesség (Adaptive Rate) +40%-ig, javított deduplikáció
- `backend/src/services/translation.js` – Fallback soronkénti fordításra batch hiba vagy hiányzó ékezetek esetén
- `docs/agent/goal.md` – Frissítve a Whisper és Dubbing funkciókkal
- Backend és Frontend linter hibák (unused vars, eqeqeq) javítva
 
**Technikai döntések:**
- Adaptív sebesség: ha a magyar TTS hosszabb az angol eredetinél, kiszámoljuk a szükséges gyorsítást (Edge TTS rate paraméter)
- Szigorúbb magyar nyelv ellenőrzés (`looksHungarian`) ékezet-alapú regex-szel
 
**Ami nem készült el:** –
 
**Következő javasolt iteráció:** nincs – a projekt alapvető problémái javítva
 
---

## Előző iteráció (OUT-10)
 
**Elkészült iteráció:** OUT-10

**Dátum:** 2026-03-20

**Elvégzett munka:**
- `backend/src/services/scheduler.js` – node-cron ütemező (08:00), indításkori feltételes frissítés (üres DB vagy > 20 óra régi), párhuzamos futás lock, `logs/refresh.log` naplózás
- `backend/src/app.js` – `GET /api/status` endpoint (lastRefresh, nextRun, lastStatus, lastMessage, running)
- `backend/src/server.js` – `startScheduler()` hívás szerver indulás után
- `tests/e2e/home.spec.js` – 1 új teszt; összesen 10/10 e2e zöld

**Technikai döntések:**
- `state` modul-szintű objektum tárol futási állapotot (running flag = párhuzamos futás megakadályozása)
- `nextRun` mindig a következő 08:00-ra mutat
- Indításkor 3 mp késleltetés hogy a szerver teljesen inicializálódjon

**Ami nem készült el:** –

**Következő javasolt iteráció:** OUT-10

---

## Előző iteráció (OUT-08)

**Elkészült iteráció:** OUT-08

**Dátum:** 2026-03-20

**Elvégzett munka:**
- `frontend/src/pages/VideoDetail.jsx` – YouTube iframe, magyar/angol toggle, felirat panel, DAX kártyák
- `frontend/src/App.jsx` – react-router-dom Routes, header Link, app-header CSS osztályok
- `frontend/src/main.jsx` – BrowserRouter wrapper
- `frontend/src/index.css` – app-header, detail, lang-toggle, dax-card, detail-state stílusok
- `tests/e2e/home.spec.js` – 2 új teszt; összesen 9/9 e2e zöld
- `frontend/package.json` – react-router-dom dependency hozzáadva

**Technikai döntések:**
- `youtube-nocookie.com` iframe embed (GDPR-barát)
- Felirat görgethető max-height 300px panelban
- DAX kártyák auto-fill gridje (min 260px)

**Ami nem készült el:** –

**Következő javasolt iteráció:** OUT-09

---

## Előző iteráció (OUT-07)

**Elkészült iteráció:** OUT-07

**Dátum:** 2026-03-20

**Elvégzett munka:**
- `frontend/src/pages/Home.jsx` – teljes Top 10 főoldal: VideoCard, DaxBadge, szűrő toggle, spinner, üres/hibás/no-ytdlp állapot, `POST /api/refresh` integráció
- `frontend/src/index.css` – video-card, dax-badge, filter-btn, refresh-btn, spinner, reszponzív grid stílusok
- `backend/src/api/videos.js` – `GET /api/top10` visszaad `{ videos, lastUpdated }`, `POST /api/refresh` új endpoint
- `backend/src/db/videoRepository.js` – `getLastUpdated()` függvény
- `tests/e2e/home.spec.js` – 3 új teszt (top10 struktúra, toolbar, DAX szűrő toggle); összesen 7/7 e2e zöld
- `.claude/launch.json` – Vite `--root frontend` argumens fix

**Technikai döntések:**
- `/api/top10` válasz struktúra megváltozott: `array` → `{ videos: [], lastUpdated: null }` (breaking change, de csak frontend fogyasztja)
- Vite preview: `--root frontend` pozicionális argumens szükséges a helyes node_modules feloldáshoz

**Ami nem készült el:** –

**Következő javasolt iteráció:** OUT-08

---

## Előző iteráció (OUT-06)

**Elkészült iteráció:** OUT-06

**Dátum:** 2026-03-19

**Elvégzett munka:**
- `backend/src/data/dax-reference.json` – 55 DAX függvény leírással és példakóddal
- `backend/src/services/daxAnalyzer.js` – `extractDaxFunctions` (regex alapú, szóhatárral), `getDaxReference`, `getAllDaxFunctionNames`
- `backend/src/db/videoRepository.js` – `updateDaxFunctions`, `getVideoById` hozzáadva
- `backend/src/api/videos.js` – `GET /api/videos/:id` endpoint (daxFunctions részletes referenciával)
- `tests/unit/daxAnalyzer.test.js` – 16 unit teszt (regex, kis/nagybetű, duplikátum, 50+ függvény ellenőrzés)
- `tests/e2e/home.spec.js` – `GET /api/videos/:id` 404 smoke teszt
- Teszteredmény: 75/75 unit teszt + 5/5 e2e teszt zöld

**Technikai döntések:**
- DAX regex szóhatár (`\b`) → nem illeszkedik pl. `SUMXYZ`-re
- Függvény nevek hossz szerint rendezve a regexben (hosszabbak előre) → helyes illeszkedési sorrend
- `dax_functions` TEXT-ként tárolva JSON-ként; `dax_mentions` = tömb hossza
- OUT-03 scoring formula `daxMentions` mezőt már kezel (OUT-06 tölti fel az adatot)

**Ami nem készült el:** –

**Következő javasolt iteráció:** OUT-07

---

## Előző iteráció (OUT-03)

**Elkészült iteráció:** OUT-03

**Dátum:** 2026-03-19

**Elvégzett munka:**
- `backend/src/services/scoring.js` – `getFreshnessScore`, `scoreVideo`, `getTop10`
- `backend/src/api/videos.js` – `GET /api/top10` route
- 23 unit teszt + 36/36 összesen zöld

---

## Előző iteráció (OUT-02)

**Elkészült iteráció:** OUT-02

**Dátum:** 2026-03-19

**Elvégzett munka:**
- `backend/src/services/ytdlp.js` – yt-dlp service: `checkYtdlpInstalled`, `collectVideos`, `parseYtdlpOutput`
- `backend/src/db/videoRepository.js` – `upsertVideos` (INSERT OR IGNORE, manuális tranzakció)
- `backend/src/api/ytdlp.js` – `GET /api/check-ytdlp` és `POST /api/collect`
- Jest ESM fix: `jest.config.cjs` + `--experimental-vm-modules`
- Teszteredmény: 13/13 unit teszt + 3/3 e2e teszt zöld

---

## Előző iteráció (OUT-01)

**Elkészült iteráció:** OUT-01

**Dátum:** 2026-03-19

**Elvégzett munka:**
- Teljes könyvtárstruktúra létrehozva (`frontend/`, `backend/`, `data/`, `tests/`)
- Backend: Node.js + Express fut a localhost:3001-en, `GET /api/health` → `{ status: "ok" }`
- SQLite adatbázis: `data/videos.db` létrejön indításkor, `videos` tábla elkészítve
- Frontend: React + Vite manuálisan inicializálva (npm create interaktív volt), fut localhost:3000-en
- `.env`, `.env.example`, `README.md` elkészítve
- ESLint + Prettier mindkét oldalon hibamentesen fut
- Playwright e2e teszt: 2/2 zöld

**Technikai döntések:**
- `node:sqlite` (Node.js 24 beépített modul) a `better-sqlite3` helyett – nincs szükség Visual Studio Build Tools-ra, nativ fordítás nélkül működik
- Playwright e2e tesztek port 3002-n futnak (port 3000 már foglalt egy másik alkalmazás által a fejlesztői gépen); normál dev mód marad 3000-en
- ESLint frontend konfig: `react/jsx-uses-vars` szabály hozzáadva a JSX komponensek false-positive `no-unused-vars` hibájának elkerülésére
