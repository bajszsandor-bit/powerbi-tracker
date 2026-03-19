# State – Ügynök memória

> Ez a fájl automatikusan frissül minden iteráció végén.

---

## Legutóbbi állapot

**Elkészült iteráció:** OUT-03

**Dátum:** 2026-03-19

**Elvégzett munka:**
- `backend/src/services/scoring.js` – `getFreshnessScore`, `scoreVideo`, `getTop10`
  - Formula: `(views*0.3) + (likes*0.4) + (freshnessScore*0.2) + (daxMentions*0.1)`
  - `freshnessScore`: 100 - (napok * 10), minimum 0; 10+ napos videók = 0 → kiszűrve
- `backend/src/api/videos.js` – `GET /api/top10` route
- `backend/src/app.js` – videosRouter regisztrálva
- `tests/unit/scoring.test.js` – 23 unit teszt (getFreshnessScore, scoreVideo, getTop10)
- Teszteredmény: 36/36 unit teszt zöld (23 scoring + 13 ytdlp)

**Technikai döntések:**
- A `freshnessScore = 0` küszöb a 10 napos határnál van (nem 30 napon), mert `100 - 10*10 = 0` – a 30 napos filter implicit
- `daxMentions` mezőt a scoring elfogadja (alapértelmezett 0), OUT-06-ban kerül feltöltésre
- Referencia dátum (`now`) paraméter a scoring függvényekben → determinisztikus unit tesztek

**Ami nem készült el:** –

**Következő javasolt iteráció:** OUT-04

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
