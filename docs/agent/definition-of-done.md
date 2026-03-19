# Definition of Done

Egy backlog elem akkor tekinthető **késznek**, ha az összes alábbi feltétel teljesül:

## Kód

- [ ] A feladat teljesen implementálva van a backlog leírása alapján
- [ ] Nincs TODO komment vagy félkész kódrészlet
- [ ] ESLint + Prettier hibamentesen lefut: `npm run lint`
- [ ] Nincs unused import vagy változó

## Tesztek

- [ ] Unit tesztek megírva és lefutnak: `npm run test`
- [ ] Playwright e2e smoke teszt megírva és lefut: `npm run test:e2e`
- [ ] Meglévő tesztek nem törtek el

## Alkalmazás állapot

- [ ] Frontend elérhető: localhost:3000
- [ ] Backend elérhető: localhost:3001
- [ ] Nincs console.error a böngészőben normál használat közben

## Dokumentáció

- [ ] Érintett függvények JSDoc kommenttel ellátva
- [ ] Ha új `.env` változó kell: `.env.example` frissítve

## State mentése

- [ ] `docs/agent/state.md` frissítve:
  - Melyik backlog elem készült el
  - Milyen technikai döntések születtek
  - Mi nem készült el (ha volt)
  - Javasolt következő iteráció

## Git

- [ ] `git commit -m "[OUT-XX] Leírás"` elvégezve
- [ ] Fejlesztő jóváhagyta a push-t
- [ ] `git push` elvégezve

## Megállás

- [ ] Az ügynök **megállt** – nem folytatja automatikusan a következőt
