// server.ts
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 3e3;
app.use(express.json());
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    appName: "BKP Digital \u2014 Sistem Buku Kejar Prestasi",
    school: "SMK Thibbil Qulub Assimbani",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
var distPath = path.resolve(__dirname, "dist");
var buildPath = path.resolve(__dirname, "build");
var staticDir = fs.existsSync(distPath) ? distPath : fs.existsSync(buildPath) ? buildPath : __dirname;
app.use(express.static(staticDir));
app.all(/.*/, (req, res) => {
  const indexPath = path.join(staticDir, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("BKP Digital application build not found. Please run npm run build.");
  }
});
app.listen(PORT, () => {
  console.log(`BKP Digital server is running on port ${PORT}`);
});
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
