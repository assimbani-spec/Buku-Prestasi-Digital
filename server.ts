/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Server produksi BKP Digital: menyajikan hasil build Vite dan endpoint health.
 * Jalankan `npm run build` sebelum `npm start`.
 */

import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const APP_VERSION = process.env.APP_VERSION || '1.0.0';

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));

// Header keamanan dasar. CSP mengizinkan Google Fonts dan backend data resmi
// (Firebase, Supabase), tetapi tidak mengizinkan skrip pihak ketiga.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self'",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com https://*.supabase.co wss://*.supabase.co",
  "manifest-src 'self'",
].join('; ');

app.use((req: Request, res: Response, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', CSP);
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    appName: 'BKP Digital: Sistem Buku Kejar Prestasi',
    school: 'SMK Thibbil Qulub Assimbani',
    version: APP_VERSION,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Endpoint /api yang tidak dikenal tidak boleh jatuh ke index.html.
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'not_found' });
});

// Tentukan direktori hasil build (dist lebih dulu, lalu build).
// Jangan pernah fallback ke __dirname: index.html di root adalah template Vite
// yang memuat /src/main.tsx dan akan tampil sebagai halaman kosong di produksi.
const distPath = path.resolve(__dirname, 'dist');
const buildPath = path.resolve(__dirname, 'build');
const staticDir = fs.existsSync(distPath)
  ? distPath
  : fs.existsSync(buildPath)
    ? buildPath
    : null;

if (staticDir) {
  app.use(
    express.static(staticDir, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
}

// SPA fallback routing. Gagal keras jika build belum ada.
app.get(/.*/, (_req: Request, res: Response) => {
  const indexPath = staticDir ? path.join(staticDir, 'index.html') : null;
  if (indexPath && fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(indexPath);
  } else {
    res
      .status(503)
      .send('BKP Digital: hasil build belum tersedia. Jalankan `npm run build` sebelum `npm start`.');
  }
});

const server = app.listen(PORT, HOST, () => {
  console.log(`BKP Digital berjalan di http://${HOST}:${PORT} (versi ${APP_VERSION})`);
});

function shutdown(signal: string): void {
  console.log(`Menerima ${signal}, menutup server.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
