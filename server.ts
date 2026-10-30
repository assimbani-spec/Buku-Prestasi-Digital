/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API health endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    appName: 'BKP Digital — Sistem Buku Kejar Prestasi',
    school: 'SMK Thibbil Qulub Assimbani',
    timestamp: new Date().toISOString()
  });
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
  app.use(express.static(staticDir));
}

// SPA fallback routing — gagal keras jika build belum ada.
app.all(/.*/, (req: Request, res: Response) => {
  const indexPath = staticDir ? path.join(staticDir, 'index.html') : null;
  if (indexPath && fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res
      .status(503)
      .send('BKP Digital: hasil build belum tersedia. Jalankan `npm run build` sebelum `npm start`.');
  }
});

app.listen(PORT, () => {
  console.log(`BKP Digital server is running on port ${PORT}`);
});
