/**
 * @file vite.config.js
 * @description Vite konfiguráció – React plugin, proxy beállítás a backend API hívásokhoz.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,   // hálózaton is elérhető (telefon, tablet)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
