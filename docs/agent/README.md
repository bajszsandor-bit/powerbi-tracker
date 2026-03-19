# Power BI Learning Tracker

Napi automatikus Power BI videó aggregátor – localhost:3000-en fut, magyarul.
**Nem kell API kulcs** – a yt-dlp eszközzel működik.

---

## Telepítés lépései

### 1. yt-dlp telepítése (Windows)

1. Menj ide: **https://github.com/yt-dlp/yt-dlp/releases**
2. Töltsd le: `yt-dlp.exe`
3. Másold be ide: `C:\Windows\` (vagy bárhova ami a PATH-ban van)
4. Ellenőrzés – nyisd meg a Parancssort és írd be:
   ```
   yt-dlp --version
   ```
   Ha verziószámot látsz, sikerült!

### 2. Projekt telepítése

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### 3. Indítás

```bash
# Terminal 1 – Backend
cd backend && npm run dev
# → http://localhost:3001

# Terminal 2 – Frontend
cd frontend && npm run dev
# → http://localhost:3000
```

Nyisd meg: **http://localhost:3000**

Az első indításkor automatikusan elindul a videó gyűjtés (2-3 percet vesz igénybe).

---

## Napi automatikus frissítés

Minden reggel **08:00-kor** automatikusan frissül a Top 10.
Ha a gépet 08:00 után kapcsolod be, az első indításkor is lefut.

---

## Kézi frissítés

Kattints a "Frissítés most" gombra a weboldalon, vagy:
```bash
curl -X POST http://localhost:3001/api/refresh
```

---

## Fejlesztői parancsok

```bash
cd backend && npm run test      # Unit tesztek
npm run test:e2e                # E2e tesztek
cd backend && npm run lint      # Linter
```
