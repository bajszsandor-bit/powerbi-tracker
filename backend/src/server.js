/**
 * @file server.js
 * @description HTTP szerver belépési pont.
 * Betölti a .env konfigurációt, inicializálja az adatbázist és elindítja a szervert.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });
import app from './app.js';
import { initDatabase } from './db/database.js';
import { startScheduler } from './services/scheduler.js';

const PORT = process.env.PORT || 3001;

initDatabase();

app.listen(PORT, () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SERVER] Backend fut: http://localhost:${PORT}`);
  }
  startScheduler();
});
