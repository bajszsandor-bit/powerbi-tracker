# State – Ügynök memória

> Ez a fájl automatikusan frissül minden iteráció végén.

---

## Legutóbbi állapot

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
