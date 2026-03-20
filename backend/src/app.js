/**
 * @file app.js
 * @description Express alkalmazás konfiguráció.
 * CORS, JSON middleware, route-ok regisztrálása és hibakezelő middleware.
 */

import express from 'express';
import cors from 'cors';
import healthRouter from './api/health.js';
import ytdlpRouter from './api/ytdlp.js';
import videosRouter from './api/videos.js';

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
  })
);

app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api', ytdlpRouter);
app.use('/api', videosRouter);

/**
 * Globális hibakezelő middleware.
 * Minden nem kezelt Express hibát fog el és 500-as választ küld.
 *
 * @param {Error} err - A keletkezett hiba
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Következő middleware
 * @returns {void}
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ERROR]', err.message);
  }
  res.status(500).json({ error: 'Belső szerverhiba', message: err.message });
});

export default app;
