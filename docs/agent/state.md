# State – Ügynök memória

> Ez a fájl automatikusan frissül minden iteráció végén.

---

## Legutóbbi állapot

**Elkészült iteráció:** OUT-05

**Dátum:** 2026-03-19

**Elvégzett munka:**
- `backend/src/services/translation.js` – `translateText`, `translateVideo`
  - `@vitalets/google-translate-api` (ingyenes, API kulcs nélkül)
  - Fallback: hiba esetén az eredeti angol szöveg marad
  - Idempotens: ha `title_hu` már létezik, nem fordít újra
  - Rate limiting: 500ms delay hívások között
- `backend/src/db/videoRepository.js` – `updateTranslations` hozzáadva
- `backend/src/api/videos.js` – `titleHu` mező hozzáadva a top10 válaszhoz
- `backend/jest.config.cjs` – `moduleDirectories` bővítve (`backend/node_modules`)
- `tests/unit/translation.test.js` – 11 unit teszt (fallback, idempotencia, null kezelés)
- `tests/e2e/home.spec.js` – `titleHu` mező smoke teszt
- Teszteredmény: 59/59 unit teszt + 4/4 e2e teszt zöld

**Technikai döntések:**
- `jest.config.cjs` `moduleDirectories` bővítve: a `@vitalets/google-translate-api` `backend/node_modules`-ban van, de a tesztek a projekt gyökeréből futnak
- `translateVideo` `jest.unstable_mockModule`-lal mock-olható (ESM async mock)

**Ami nem készült el:** –

**Következő javasolt iteráció:** OUT-06

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
