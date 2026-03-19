# Technikai megkötések (Constraints)

## yt-dlp szabályok

- A `yt-dlp` parancsokat mindig a Node.js `child_process.execFile()` vagy `spawn()` segítségével futtasd – SOHA ne `exec()` shell injection miatt
- Minden yt-dlp hívás előtt ellenőrizd, hogy a program telepítve van-e
- yt-dlp hívások között legalább 2 másodperc delay (ne terheljük túl a YouTube-ot)
- Timeout: minden yt-dlp hívásnak legyen max 60 másodperces timeout

## Fordítás

- `@vitalets/google-translate-api` hívások között legalább 500ms delay
- Ha a fordítás sikertelen: az eredeti angol szöveg marad (nem crashel)
- Fordítás csak egyszer fut le videónként – cache-elve az adatbázisban

## Kódminőség

- Minden fájl tetején JSDoc komment: mi a fájl célja
- Minden exportált függvényhez JSDoc: `@param`, `@returns`
- Max fájlhossz: 300 sor – ha hosszabb, bontsd szét
- `console.log` csak fejlesztési célra – éles kódban `logger` modult használj
- Nincs unused import, nincs unused változó
- ESLint + Prettier kötelező, hibamentesen kell lefutnia

## Frontend (React)

- Csak funkcionális komponensek + hooks (class component TILOS)
- Minden API híváshoz: loading state + error state kezelése
- Ha yt-dlp nincs telepítve: barátságos hibaüzenet, NEM technikai hibaüzenet
- Reszponzív: mobil (320px+) és desktop (1024px+)

## Backend (Node.js/Express)

- Minden route-hoz hibakezelő middleware
- Async/await mindenhol – callback stílus TILOS
- SQLite tranzakciók tömeges íráskor

## Adatbázis

- Séma változtatáshoz migration script
- Minden tábla: `created_at`, `updated_at` mezők
- `PRAGMA foreign_keys = ON` kötelező

## Tesztelés

- yt-dlp hívásokat mock-olni kell a tesztekben (ne hívja élesben)
- Minden service függvényhez unit teszt (Jest)
- Minden UI oldalhoz Playwright e2e smoke teszt
- Tesztek helye: `tests/unit/` és `tests/e2e/`

## Git

- Commit üzenet: `[OUT-XX] Rövid leírás`
- Egy commit = egy backlog elem
- Push előtt fejlesztő jóváhagyása kötelező

## Tiltott viselkedések

- **TILOS** API kulcsot használni vagy kérni
- **TILOS** új feature-t kitalálni, ami nincs a backlogban
- **TILOS** egyszerre több backlog elemet kezelni
- **TILOS** a state.md kihagyása az iteráció végén
- **TILOS** push a fejlesztő jóváhagyása nélkül
- **TILOS** automatikusan továbblépni a következő iterációra
