/**
 * @file health.js
 * @description GET /api/health endpoint – ellenőrzi, hogy a backend fut-e.
 */

import { Router } from 'express';

const router = Router();

/**
 * GET /api/health
 * Visszaad egy egyszerű állapotjelzőt, hogy a szerver működik.
 *
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @returns {void}
 */
router.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

export default router;
