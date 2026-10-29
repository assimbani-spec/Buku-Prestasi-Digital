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

// Determine static build output directory (check dist first, fallback to build or root)
const distPath = path.resolve(__dirname, 'dist');
const buildPath = path.resolve(__dirname, 'build');
const staticDir = fs.existsSync(distPath) ? distPath : (fs.existsSync(buildPath) ? buildPath : __dirname);

app.use(express.static(staticDir));

// SPA fallback routing
app.all(/.*/, (req: Request, res: Response) => {
  const indexPath = path.join(staticDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('BKP Digital application build not found. Please run npm run build.');
  }
});

app.listen(PORT, () => {
  console.log(`BKP Digital server is running on port ${PORT}`);
});
