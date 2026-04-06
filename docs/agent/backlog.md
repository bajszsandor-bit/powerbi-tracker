# Product Backlog – Power BI Learning Tracker (yt-dlp verzió)

## Globális megkötések

- Minden iteráció végén a frontend localhost:3000-en működjön
- Minden UI oldalhoz kötelező Playwright e2e teszt
- Nincs API kulcs – minden yt-dlp alapú

---

## Iterációk

### OUT-01 – Projekt alapstruktúra és fejlesztői környezet
**Leírás:** Hozd létre a teljes könyvtárstruktúrát, inicializáld a frontend (React+Vite) és backend (Node.js+Express) projekteket, SQLite adatbázis alapbeállítás.

**Elfogadási kritériumok:**
- [ ] `frontend/` – React+Vite fut, `npm run dev` → localhost:3000
- [ ] `backend/` – Express fut, `npm run dev` → localhost:3001
- [ ] `GET /api/health` endpoint visszaad `{ status: "ok" }`
- [ ] SQLite adatbázis létrejön `data/videos.db`-ben indításkor
- [ ] `README.md` leírja a telepítési lépéseket (yt-dlp telepítés is benne)
- [ ] E2e teszt: a főoldal betölt és nem dob hibát

---

### OUT-02 – yt-dlp telepítés ellenőrzés és videó metaadat gyűjtés
**Leírás:** A backend ellenőrzi, hogy a `yt-dlp` telepítve van-e a gépen. Ha igen, keresési kifejezések és csatornák alapján letölti a videók metaadatait (cím, nézettség, like stb.) és elmenti SQLite-ba.

**Elfogadási kritériumok:**
- [ ] `GET /api/check-ytdlp` endpoint: visszaadja hogy telepítve van-e a yt-dlp (`{ installed: true/false, version: "..." }`)
- [ ] Ha nincs telepítve: az API visszaad egy segítő hibaüzenetet a telepítési linkkel
- [ ] 4 keresési kifejezés + 4 csatorna lekérdezése yt-dlp-vel
- [ ] Videó adatok mentése: `id, title, description, channelTitle, publishedAt, viewCount, likeCount, thumbnailUrl, videoUrl`
- [ ] Duplikátumok szűrése
- [ ] Unit teszt: JSON feldolgozó függvény (yt-dlp output → adatbázis formátum)
- [ ] E2e teszt: `/api/check-ytdlp` endpoint válaszol

---

### OUT-03 – Scoring algoritmus és Top 10 kiválasztás
**Leírás:** A begyűjtött videókból scoring alapján kiválasztja a napi Top 10-et.

**Elfogadási kritériumok:**
- [ ] Scoring: `(views*0.3) + (likes*0.4) + (freshnessScore*0.2) + (daxMentions*0.1)`
- [ ] `freshnessScore`: 100 - (napok száma * 10), minimum 0, csak 30 napon belüli videók
- [ ] `GET /api/top10` visszaad 10 videót score szerint rendezve
- [ ] Unit teszt: scoring függvény különböző bemenetekre
- [ ] Unit teszt: csak 30 napon belüli videók kerülnek be

---

### OUT-04 – Felirat letöltés yt-dlp-vel (VTT feldolgozás)
**Leírás:** Minden Top 10 videóhoz letölti az automatikus angol feliratot yt-dlp-vel (.vtt formátum), feldolgozza és elmenti az adatbázisba.

**Elfogadási kritériumok:**
- [ ] `yt-dlp --write-auto-sub --sub-lang en --skip-download` parancs futtatása
- [ ] VTT fájl feldolgozása: időbélyegek eltávolítása, tiszta szöveg kinyerése
- [ ] Ha nincs felirat: graceful fallback (null, nem crashel)
- [ ] `hasTranscript` boolean mező az adatbázisban
- [ ] Feliratok mentése: `data/transcripts/[videoId].txt`
- [ ] Unit teszt: VTT → tiszta szöveg konvertáló függvény
- [ ] E2e teszt: `/api/top10` visszaad `transcriptAvailable` mezőt

---

### OUT-05 – Magyar fordítás (cím, leírás, felirat)
**Leírás:** A Top 10 videó angol tartalmának fordítása magyarra `@vitalets/google-translate-api` csomaggal (ingyenes, kulcs nélkül).

**Elfogadási kritériumok:**
- [ ] `titleHu`, `descriptionHu`, `transcriptHu` mezők az adatbázisban
- [ ] Rate limiting: kérések között 500ms delay
- [ ] Ha a fordítás sikertelen: az eredeti angol szöveg marad
- [ ] Fordítás csak egyszer fut (ha már lefordítva, nem hívja újra)
- [ ] Unit teszt: fallback logika fordítási hiba esetén
- [ ] E2e teszt: `/api/top10` visszaad `titleHu` mezőt

---

### OUT-06 – DAX függvény elemző
**Leírás:** A felirat szövegéből kinyeri az említett DAX függvényeket, listázza és példával mutatja be őket.

**Elfogadási kritériumok:**
- [ ] Legalább 50 DAX függvény neve egy statikus listában (regex alapú kinyerés)
- [ ] Minden videóhoz: `daxFunctions: ["CALCULATE", "SUMX", ...]` az adatbázisban
- [ ] Minden DAX függvényhez: rövid leírás + példakód (statikus `dax-reference.json` fájlból)
- [ ] `daxMentions` szám bekerül a scoring-ba (OUT-03 frissítése)
- [ ] Unit teszt: DAX kinyerő regex legalább 10 különböző esettel
- [ ] E2e teszt: videó detail API visszaad `daxFunctions` tömböt

---

### OUT-07 – Frontend: Főoldal (Top 10 lista)
**Leírás:** React főoldal, amely megjeleníti a napi Top 10 videót kártyákban.

**Elfogadási kritériumok:**
- [ ] 10 videókártya: thumbnail, magyar cím, csatorna neve, score, DAX badge-ek
- [ ] Szűrő: "Csak DAX videók" / "Összes" toggle
- [ ] "Utolsó frissítés: [dátum]" megjelenítés
- [ ] "Frissítés most" gomb → `POST /api/refresh`
- [ ] Betöltési állapot (loading spinner)
- [ ] Hibás állapot kezelése (ha yt-dlp nincs telepítve: barátságos hibaüzenet)
- [ ] Reszponzív layout (mobil + desktop)
- [ ] E2e teszt: 10 kártya megjelenik, szűrő működik

---

### OUT-08 – Frontend: Videó részletes oldal
**Leírás:** Minden videónak saját oldala `/video/:id` route-on.

**Elfogadási kritériumok:**
- [ ] Route: `/video/:id`
- [ ] Beágyazott YouTube iframe lejátszó
- [ ] Magyar cím + leírás (angol toggle-lal)
- [ ] Magyar felirat szöveg görgethető panel (ha elérhető)
- [ ] DAX függvények szekció: név, leírás, példakód szintaxis kiemeléssel
- [ ] Vissza gomb a főoldalra
- [ ] E2e teszt: az oldal betölt, a főbb szekciók megjelennek

---

### OUT-09 – Napi automatikus frissítés (node-cron)
**Leírás:** Gép bekapcsolásakor azonnal fut egy frissítés, majd naponta 08:00-kor.

**Elfogadási kritériumok:**
- [ ] `node-cron` ütemező: naponta 08:00-kor fut
- [ ] Indításkor fut, ha az adatbázis üres vagy a legutóbbi frissítés > 20 óra régi
- [ ] `GET /api/status` visszaadja az utolsó frissítés idejét és státuszát
- [ ] Párhuzamos futás megakadályozása
- [ ] Hibák logolása: `logs/refresh.log`
- [ ] E2e teszt: `/api/status` visszaad `lastRefresh` mezőt

---

### OUT-10 – yt-dlp telepítési útmutató oldal + csiszolás
**Leírás:** Ha a yt-dlp nincs telepítve, a webapp egy barátságos telepítési útmutatót mutat. Teljes tesztelés, README véglegesítés.

**Elfogadási kritériumok:**
- [ ] Ha yt-dlp hiányzik: a főoldalon megjelenik a telepítési útmutató lépésekkel
- [ ] Telepítési link: `https://github.com/yt-dlp/yt-dlp/releases`
- [ ] Teljes Playwright e2e teszt suite hibamentesen lefut
- [ ] README tartalmaz: telepítés, yt-dlp telepítés, indítás, használat
- [ ] Nincs console.error böngészőben normál használat közben

---

### OUT-11 – Szinkronhang szinkronizáció és fordítás minőség javítás
**Leírás:** Dinamikus beszédsebesség (Adaptive Rate) bevezetése a dubtracking-nél, javított felirat deduplikáció és hibatűrőbb batch fordítás.

**Elfogadási kritériumok:**
- [x] Backlog és terv elkészítve
- [x] `dubtrack.js`: A hangsebesség dinamikusan igazodik az időablakhoz (max +40%).
- [x] `dubtrack.js`: A `softTrim` csak végső esetben vág le szavakat.
- [x] `translation.js`: Ha a batch fordítás sorrendje vagy száma hibás, automatikus fallback soronkénti fordításra.
- [x] `goal.md` frissítve a Whisper és Dubbing funkciókkal.
- [x] Manuális teszt: legalább 1 videó teljes újragenerálása és ellenőrzése.

---

### OUT-12 – Indítási és frissítési folyamat javítása
**Leírás:** Aszinkron frissítési folyamat, folyamatjelzés a felületen és asztali indító ikonok.

**Elfogadási kritériumok:**
- [x] `/api/refresh` aszinkron módon fut, nem okoz timeout-ot
- [x] Frontend folyamatjelzőn mutatja a gyűjtés haladását (csatornák alapján)
- [x] Asztali `PowerBI_Tracker_START.bat` és `STOP.bat` létrehozva
- [x] Új videók esetén automatikus DAX és AI elemzés lefut a háttérben

---

### OUT-15 – Chrome Bővítmény (Auto-Szinkron YouTube-ra)
**Leírás:** Saját Chrome bővítmény készítése, amely beépül a YouTube felületébe, elküldi az aktuális videót a helyi (Power BI Tracker) backendnek letöltésre, feliratozásra és szinkronizálásra, majd lejátssza a magyar hangot a némított eredeti videó felett.

**Elfogadási kritériumok:**
- [ ] `extension/` mappa létrehozva
- [ ] `manifest.json` (Manifest V3) elkészítve
- [ ] Content script gombot injektál a YouTube lejátszó felületére ("Magyar Szinkron")
- [ ] Bővítmény kommunikál a `localhost:3001` szerverünkkel CORS hiba nélkül
- [ ] A YouTube videó némítása és a `/api/videos/:id/dubtrack` audió lejátszása megtörténik szinkronban a képpel
- [ ] Minimális Popup UI a státusz (Készül/Kész) és a beállítások ellenőrzéséhez

---

> **Megjegyzés:** Új backlog elemet csak a fejlesztő adhat hozzá.

---

### OUT-16 – Fordítási és szinkronizációs logikai hibák javítása
**Leírás:** Szavankénti borzalmas fordítások, elnémuló magyar hang és sorszámtévesztések javítása a translation.js felokosításával.

**Elfogadási kritériumok:**
- [x] `looksHungarian` okosabban engedi át az angol szakszavakkal tűzdelt, de ékezet nélküli magyar mondatokat
- [x] Üres stringes array-kiegészítés eltávolítva (nincs szinkron némulás)
- [x] Claude batch `CUE_TRANSLATE_PROMPT`-ot kap sorszámozáshoz a `TRANSLATE_PROMPT` helyett
- [x] Batch hiba esetén "divide and conquer" alapon felezi a feladatot (chunk halving), így szinte sosincs csonka kontextus nélküli hívás
