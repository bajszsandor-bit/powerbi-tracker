# Power BI Learning Tracker

Lokálisan futó webalkalmazás, amely naponta automatikusan összegyűjti a legjobb Power BI oktatóvideókat YouTube-ról, és egy szép webes felületen megjeleníti a napi Top 10-et. Minden videónak saját oldala van, magyar fordítással és DAX függvény elemzéssel.

---

## Előfeltételek

### 1. Node.js telepítése

Töltsd le és telepítsd a Node.js 18+ verzióját: https://nodejs.org

```bash
node --version   # v18.0.0 vagy újabb
npm --version
```

### 2. yt-dlp telepítése (Windows)

A yt-dlp az alkalmazás szíve – ez gyűjti a videó adatokat YouTube-ról, API kulcs nélkül.

**Opció A – Winget (ajánlott):**
```bash
winget install yt-dlp
```

**Opció B – Manuális letöltés:**
1. Töltsd le a legújabb `yt-dlp.exe` fájlt: https://github.com/yt-dlp/yt-dlp/releases
2. Másold be a `C:\Windows\` mappába (vagy bármely PATH-ban lévő mappába)

**Ellenőrzés:**
```bash
yt-dlp --version
```

---

## Telepítés

```bash
# 1. Backend függőségek
cd backend
npm install

# 2. Frontend függőségek
cd ../frontend
npm install

# 3. Visszalépés a projekt gyökerébe
cd ..
```

---

## Indítás

Nyiss két terminált:

**Terminal 1 – Backend (localhost:3001):**
```bash
cd backend
npm run dev
```

**Terminal 2 – Frontend (localhost:3000):**
```bash
cd frontend
npm run dev
```

Majd nyisd meg: **http://localhost:3000**

---

## Fejlesztői parancsok

```bash
# Lint ellenőrzés
cd backend && npm run lint
cd frontend && npm run lint

# Unit tesztek
cd backend && npm test

# E2e tesztek (mindkét szerver futnia kell)
npx playwright test

# Manuális adatfrissítés
curl -X POST http://localhost:3001/api/refresh

# Backend státusz
curl http://localhost:3001/api/health
```

---

## Könyvtárstruktúra

```
powerbi-tracker/
├── frontend/          React + Vite (localhost:3000)
├── backend/           Node.js + Express (localhost:3001)
├── data/
│   ├── videos.db      SQLite adatbázis
│   └── transcripts/   Letöltött .vtt feliratok
├── tests/
│   ├── unit/          Jest unit tesztek
│   └── e2e/           Playwright e2e tesztek
└── docs/agent/        Projekt dokumentáció és iterációs tervek
```

---

## Technológiai stack

| Réteg | Technológia |
|-------|-------------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Adatbázis | SQLite (better-sqlite3) |
| Videó gyűjtés | yt-dlp |
| Fordítás | @vitalets/google-translate-api |
| Ütemező | node-cron |
| Tesztelés | Jest + Playwright |
