# Runbook – Az ügynök munkafolyamata

**Kötelező betartani – eltérés nem megengedett.**

---

## Iteráció menete

### 1. Kontextus betöltése

Olvasd el ebben a sorrendben:
1. `docs/agent/goal.md`
2. `docs/agent/state.md`
3. `docs/agent/backlog.md`
4. `docs/agent/constraints.md`
5. `docs/agent/definition-of-done.md`

### 2. Backlog elem kiválasztása

- Válaszd a **legkisebb sorszámú, még el nem végzett** elemet
- Írd le röviden mit fogsz csinálni

### 3. Implementáció

- Kövesd a `constraints.md` szabályait
- yt-dlp hívásokat mock-old a tesztekben
- Async/await mindenhol

### 4. Tesztek és linter

```bash
cd backend && npm run lint
cd frontend && npm run lint
cd backend && npm run test
npm run test:e2e
```

Csak akkor folytass, ha minden hibamentesen lefut.

### 5. Manuális ellenőrzés

- Nyisd meg: `http://localhost:3000`
- Ellenőrizd a DevTools Console-t: nem lehet console.error

### 6. State.md frissítése

```markdown
## Legutóbbi állapot

**Elkészült iteráció:** OUT-XX
**Dátum:** [mai dátum]
**Elvégzett munka:** [mit csináltál]
**Technikai döntések:** [miért úgy]
**Ami nem készült el:** [ha van]
**Következő javasolt iteráció:** OUT-XX+1
```

### 7. Git commit és megállás

```bash
git add .
git commit -m "[OUT-XX] Leírás"
```

Kérd meg a fejlesztőt: *"Kész az OUT-XX. Jóváhagyod a push-t?"*

Ha jóváhagyta: `git push`

**ÁLLJ MEG – ne kezdj bele a következő iterációba.**

---

## Tiltott viselkedések

- **TILOS** API kulcsot használni vagy kérni
- **TILOS** új feature-t kitalálni
- **TILOS** több backlog elemet egyszerre kezelni
- **TILOS** state.md kihagyása
- **TILOS** push jóváhagyás nélkül
- **TILOS** automatikusan továbblépni

---

## Hasznos parancsok

```bash
# Indítás
cd backend && npm run dev      # → localhost:3001
cd frontend && npm run dev     # → localhost:3000

# yt-dlp ellenőrzés
yt-dlp --version

# Manuális frissítés
curl -X POST http://localhost:3001/api/refresh

# Státusz
curl http://localhost:3001/api/status

# Top 10
curl http://localhost:3001/api/top10
```
