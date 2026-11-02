# Checklist produksi BKP Digital

Dokumen ini menyatakan apa yang sudah siap dan apa yang masih harus diselesaikan
sebelum aplikasi dipakai data sekolah sungguhan.

## 1. Pilih backend data

| Backend | Status | Cocok untuk |
| :--- | :--- | :--- |
| `local` (localStorage) | siap | demo, pelatihan, satu perangkat |
| `firestore` | siap dipakai, 40 skenario aturan tersedia di `tests/firestore-rules.test.mjs` (butuh Firebase Emulator) | produksi dengan Firebase |
| Supabase | skema siap, adapter belum | produksi alternatif |
| Cloudflare D1 | skema dan wrangler siap, Worker belum | produksi alternatif |

Jangan pakai `local` untuk data nyata: data hanya ada di peramban, hilang bila
cache dibersihkan, dan tidak bisa diakses perangkat lain.

Lihat `docs/migrasi-backend.md` untuk langkah Supabase dan D1.

## 2. Konfigurasi

- `.env.local` (jangan di-commit):
  ```
  VITE_DATA_BACKEND=firestore
  ```
- Firebase: `firebase-applet-config.json` harus menunjuk proyek produksi.
- Jangan menaruh kunci `service_role`, token D1, atau kata sandi apa pun di
  variabel `VITE_*`. Semua nilai `VITE_*` ikut ke bundel peramban.

## 3. Build dan hosting

```bash
bun install --frozen-lockfile   # atau npm ci
npm run build                    # menghasilkan dist/
npm start                        # server.js, default port 3000
```

- Sajikan lewat HTTPS. Kata sandi lokal memakai WebCrypto yang hanya aktif di
  HTTPS atau localhost.
- `server.js` sudah memasang CSP, HSTS (bila HTTPS), `nosniff`, pembatasan
  frame, cache immutable untuk `assets/`, dan `no-store` untuk `index.html`.
- Bila memakai hosting statis, atur ulang header tersebut di sana.
- Balikkan proxy harus meneruskan `X-Forwarded-Proto` agar HSTS aktif.

## 4. Akun dan kata sandi

- Basis data lokal kosong hanya berisi satu akun `admin@lokal.test` dengan kata
  sandi awal `bkp12345`. Ganti kata sandi itu sebelum dipakai bersama.
- Akun baru dibuat dari panel admin (tab Pengguna). Minimal 8 karakter.
- Mode Firestore: buat akun di Firebase Console, lalu hubungkan profilnya.
- Login lokal membatasi 5 percobaan gagal per email dalam 15 menit, lalu
  mengunci 5 menit. Sesi lokal berakhir setelah 12 jam.
- Batas percobaan di peramban bisa dilewati siapa pun yang menguasai perangkat.
  Untuk produksi, gunakan backend dengan autentikasi server (Firebase,
  Supabase) dan aktifkan rate limit di sisi server.

## 5. Sebelum go-live

- [ ] `npm run build` sukses dan `dist/` disajikan lewat HTTPS.
- [ ] `npx tsc --noEmit` bersih.
- [ ] `npm run test:local`, `test:auth`, `test:siswa`, `test:prestasi` lulus.
- [ ] Proyek Firebase sudah milik sekolah, bukan proyek contoh, dan `firestore.rules` sudah di-deploy: `firebase deploy --only firestore:rules`.
- [ ] Jalankan `tests/firestore-rules.test.mjs` dengan Firebase Emulator setelah perubahan aturan.
- [ ] Uji login tiap peran dan pastikan data per peran tidak bocor.
- [ ] Uji dua akun berbeda: wali A tidak bisa membaca anak wali B.
- [ ] Ganti kata sandi akun admin awal.
- [ ] Cadangkan data: ekspor Firestore berkala, atau `pg_dump` untuk Supabase.
- [ ] Tentukan retensi `audit_log` (misalnya 12 bulan) dan hapus berkala.
- [ ] Siapkan pemantauan: `/api/health`, log server, dan peringatan kuota.

## 6. Yang belum siap untuk produksi

- Adapter Supabase dan D1 belum ada; baru skemanya.
- Pembuatan akun lintas backend masih manual.
- Belum ada pengujian browser otomatis (end-to-end).
- Panel admin belum bisa mengubah data santri yang sudah ada, baru menambah.
