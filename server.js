// server.ts
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
var HOST = process.env.HOST || "0.0.0.0";
var APP_VERSION = process.env.APP_VERSION || "1.0.0";
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "100kb" }));
var CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self'",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com https://*.supabase.co wss://*.supabase.co",
  "manifest-src 'self'"
].join("; ");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", CSP);
  if (req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.get("/api/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    status: "ok",
    appName: "BKP Digital: Sistem Buku Kejar Prestasi",
    school: "SMK Thibbil Qulub Assimbani",
    version: APP_VERSION,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not_found" });
});
var distPath = path.resolve(__dirname, "dist");
var buildPath = path.resolve(__dirname, "build");
var staticDir = fs.existsSync(distPath) ? distPath : fs.existsSync(buildPath) ? buildPath : null;
if (staticDir) {
  app.use(
    express.static(staticDir, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    })
  );
}
app.get(/.*/, (_req, res) => {
  const indexPath = staticDir ? path.join(staticDir, "index.html") : null;
  if (indexPath && fs.existsSync(indexPath)) {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(indexPath);
  } else {
    res.status(503).send("BKP Digital: hasil build belum tersedia. Jalankan `npm run build` sebelum `npm start`.");
  }
});
var server = app.listen(PORT, HOST, () => {
  console.log(`BKP Digital berjalan di http://${HOST}:${PORT} (versi ${APP_VERSION})`);
});
function shutdown(signal) {
  console.log(`Menerima ${signal}, menutup server.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 1e4).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Server produksi BKP Digital: menyajikan hasil build Vite dan endpoint health.
 * Jalankan `npm run build` sebelum `npm start`.
 */
