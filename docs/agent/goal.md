# Projekt cél és architektúra

## Az alkalmazásról

**Alkalmazás neve:** Power BI Learning Tracker

**Rövid leírás:**
Egy lokálisan futó webalkalmazás (localhost:3000), amely naponta automatikusan összegyűjti
a legjobb Power BI oktatóvideókat YouTube-ról, elemzi őket, és egy szép webes felületen
megjeleníti a napi Top 10-et. Minden videónak saját oldala van, magyar fordítással
(cím, leírás, felirat), és DAX függvény elemzéssel.

**Célközönség:** Te magad – Power BI tanuláshoz, napi friss tartalom magyarul.

## Technológiai stack

- **Frontend:** React (Vite) – localhost:3000
- **Backend:** Node.js + Express – localhost:3001
- **Adatbázis:** SQLite (lokális, egyszerű, nincs szerver szükséges)
- **Videó gyűjtés:** `yt-dlp` (ingyenes, telepíthető Windows-ra, NEM kell API kulcs)
- **Feliratok:** `yt-dlp --write-auto-sub` (automatikus feliratok letöltése)
- **Fordítás:** `@vitalets/google-translate-api` (ingyenes, kulcs nélkül)
- **Ütemező:** `node-cron` – napi automatikus frissítés gép indításakor
- **Tesztelés:** Playwright (e2e), Jest (unit)
- **Linter:** ESLint + Prettier

## Miért yt-dlp?

- **Ingyenes** – semmilyen API kulcs vagy regisztráció nem szükséges
- **Megbízható** – aktívan karbantartott, nagy közösség használja
- **Sokoldalú** – videó metaadatok, feliratok, minden elérhető belőle
- **Lokális** – a gépeden fut, nem függ külső szolgáltatástól

## Fő funkciók

1. **Napi Top 10 videó** – score alapján rangsorolva (nézettség, like, frissesség, DAX tartalom)
2. **Automatikus frissítés** – gép bekapcsolásakor fut, majd naponta egyszer
3. **Videó saját oldal** – minden videónak `/video/:id` route-on saját részletes oldala
4. **Magyar fordítás** – cím + leírás + felirat magyarul
5. **DAX elemzés** – a feliratból kinyert DAX függvények listája példákkal
6. **Keresés és szűrés** – témák szerint (DAX, vizualizáció, adatmodell stb.)

## Videó forrás stratégia (yt-dlp alapú)

### Keresési kifejezések (yt-dlp search)
A `yt-dlp` képes YouTube keresést végezni API kulcs nélkül:
```
yt-dlp "ytsearch20:Power BI DAX tutorial" --dump-json --no-download
yt-dlp "ytsearch20:Power BI tips tricks" --dump-json --no-download
yt-dlp "ytsearch20:Power BI beginner 2024" --dump-json --no-download
yt-dlp "ytsearch20:Power BI measures calculated columns" --dump-json --no-download
```

### Csatornák (yt-dlp channel scrape)
```
yt-dlp "https://www.youtube.com/@GuyInACube/videos" --dump-json --no-download --playlist-end 10
yt-dlp "https://www.youtube.com/@SQLBI/videos" --dump-json --no-download --playlist-end 10
yt-dlp "https://www.youtube.com/@PragmaticWorks/videos" --dump-json --no-download --playlist-end 10
yt-dlp "https://www.youtube.com/@MicrosoftPowerBI/videos" --dump-json --no-download --playlist-end 10
```

### Felirat letöltés
```
yt-dlp --write-auto-sub --sub-lang en --skip-download --output "data/transcripts/%(id)s" [URL]
```

## Scoring algoritmus (Top 10 kiválasztás)

```
score = (views * 0.3) + (likes * 0.4) + (freshnessScore * 0.2) + (daxMentions * 0.1)

freshnessScore: 100 ha ma jelent meg, -10 pont/nap (max 30 napos videók kerülnek be)
daxMentions: a feliratban talált DAX függvény hivatkozások száma
```

## Állapot tárolása

- **Az állapot a repositoryban és az SQLite adatbázisban van, NEM a beszélgetésben**
- `docs/agent/state.md` – ügynök iterációs memória
- `data/videos.db` – SQLite adatbázis a videó adatoknak
- `data/transcripts/` – letöltött feliratok `.vtt` fájlként

## Könyvtárstruktúra (cél)

```
/
├── frontend/                   ← React + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Home.jsx        ← Top 10 lista
│   │   │   └── VideoDetail.jsx ← Videó saját oldal
│   │   └── App.jsx
│   └── package.json
├── backend/                    ← Node.js + Express
│   ├── src/
│   │   ├── api/                ← Express route-ok
│   │   ├── services/
│   │   │   ├── ytdlp.js        ← yt-dlp parancsok futtatása
│   │   │   ├── transcript.js   ← VTT felirat feldolgozás
│   │   │   ├── translate.js    ← Magyar fordítás
│   │   │   ├── scoring.js      ← Top 10 scoring
│   │   │   └── daxAnalyzer.js  ← DAX függvény kinyerés
│   │   ├── db/                 ← SQLite műveletek
│   │   └── scheduler.js        ← node-cron ütemező
│   └── package.json
├── data/
│   ├── videos.db               ← SQLite adatbázis
│   └── transcripts/            ← Letöltött .vtt feliratok
├── docs/
│   └── agent/
│       ├── backlog.md
│       ├── constraints.md
│       ├── definition-of-done.md
│       ├── goal.md
│       ├── runbook.md
│       └── state.md
├── tests/
│   ├── unit/
│   └── e2e/
└── .env.example
```
