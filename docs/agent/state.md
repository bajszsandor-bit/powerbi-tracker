# State – Ügynök memória

> Ez a fájl automatikusan frissül minden iteráció végén.

---

## Legutóbbi állapot

**Elkészült iteráció:** OUT-02

**Dátum:** 2026-03-19

**Elvégzett munka:**
- `backend/src/services/ytdlp.js` – yt-dlp service: `checkYtdlpInstalled`, `collectVideos`, `parseYtdlpOutput`; `execFile()` (nem `exec()`) használata shell injection megelőzéséhez; 2 mp delay yt-dlp hívások között; 60 mp timeout
- `backend/src/db/videoRepository.js` – `upsertVideos` (INSERT OR IGNORE, manuális BEGIN/COMMIT/ROLLBACK tranzakcióval), `getAllVideos`, `getVideoCount`
- `backend/src/api/ytdlp.js` – `GET /api/check-ytdlp` és `POST /api/collect` route-ok
- `backend/src/app.js` – ytdlpRouter regisztrálva
- `backend/jest.config.js` → `jest.config.cjs` átnevezve (ESM kompatibilitás); `package.json` test script frissítve `--experimental-vm-modules`-ra
- `tests/unit/ytdlp.test.js` – 13 unit teszt a `parseYtdlpOutput` függvényre (mock, nincs éles YouTube hívás)
- `tests/e2e/home.spec.js` – `/api/check-ytdlp` smoke teszt hozzáadva
- Teszteredmény: 13/13 unit teszt + 3/3 e2e teszt zöld

**Technikai döntések:**
- `node:sqlite` nem támogatja a `db.transaction()` metódust (better-sqlite3-hoz képest) → manuális `BEGIN`/`COMMIT`/`ROLLBACK` az `upsertVideos`-ban
- Jest ESM: `jest.config.cjs` (CommonJS konfig) + `--experimental-vm-modules` flag
- `YTDLP_PATH` env változó: lehetővé teszi a yt-dlp elérési útjának testreszabását (pl. Windows-on teljes elérési út)
- description max 5000 karakter (DB méret optimalizálás)

**Ami nem készült el:** –

**Következő javasolt iteráció:** OUT-03

---

## Előző iteráció

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
