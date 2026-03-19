/**
 * @file server.js
 * @description HTTP szerver belépési pont.
 * Betölti a .env konfigurációt, inicializálja az adatbázist és elindítja a szervert.
 */

import 'dotenv/config';
import app from './app.js';
import { initDatabase } from './db/database.js';

const PORT = process.env.PORT || 3001;

initDatabase();

app.listen(PORT, () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SERVER] Backend fut: http://localhost:${PORT}`);
  }
});
