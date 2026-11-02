# Checklist produksi BKP Digital

Dokumen ini menyatakan apa yang sudah siap dan apa yang masih harus diselesaikan
sebelum aplikasi dipakai data sekolah sungguhan.

## 1. Pilih backend data

| Backend | Status | Cocok untuk |
| :--- | :--- | :--- |
| `local` (localStorage) | siap | demo, pelatihan, satu perangkat |
| `firestore` | siap dipakai, 63 skenario aturan lulus di Firebase Emulator (`npm run test:rules`) | produksi dengan Firebase |
| Supabase | skema siap, adapter belum | produksi alternatif |
| Cloudflare D1 | skema dan wrangler siap, Worker belum | produksi alternatif |

Jangan pakai `local` untuk data nyata: data hanya ada di peramban, hilang bila
cache dibersihkan, dan tidak bisa diakses perangkat lain.

Lihat `docs/migrasi-backend.md` untuk langkah Supabase dan D1.

## 2. Konfigurasi

- `.env.local` (jangan di-commit):
  ```
  VITE_DATA_BACKEND=firestore
  VITE_FIREBASE_PROJECT_ID=proyek-sekolah
  VITE_FIREBASE_APP_ID=1:...:web:...
  VITE_FIREBASE_API_KEY=AIza...
  VITE_FIREBASE_AUTH_DOMAIN=proyek-sekolah.firebaseapp.com
  # Opsional. Kosongkan untuk database "(default)".
  # VITE_FIREBASE_FIRESTORE_DATABASE_ID=(default)
  ```
- Nilai di atas diambil dari Firebase Console > Project settings > Your apps.
  `firebase-applet-config.json` tetap dipakai sebagai nilai bawaan untuk
  pengembangan, tetapi aplikasi hasil build produksi dengan backend Firestore
  menolak berjalan bila masih menunjuk proyek contoh `triple-cinema-jnj8s` dan
  env belum diisi. Jadi data sekolah tidak bisa tanpa sengaja masuk ke proyek
  demo.
- Jangan menaruh kunci `service_role`, token D1, atau kata sandi apa pun di
  variabel `VITE_*`. Semua nilai `VITE_*` ikut ke bundel peramban; kunci web
  Firebase memang publik dan dilindungi oleh Auth serta `firestore.rules`.

## 3. Build dan hosting

```bash
bun install --frozen-lockfile   # lockfile proyek adalah bun.lock
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
- Akun baru di mode lokal dibuat dari panel admin (tab Pengguna). Minimal 8
  karakter. Kata sandi awal tidak lagi ditampilkan di layar login pada build
  produksi; sampaikan lewat jalur internal sekolah.
- Mode Firestore: buat akun di Firebase Authentication, lalu buat dokumen
  `profiles/{uid}` dengan `role`, `active: true`, dan penautan yang sesuai
  (`studentId`, `childIds`, atau `rayonId`). Profil hanya boleh dibuat admin;
  pengguna yang mendaftar sendiri tanpa profil tidak mendapat akses apa pun.
  Aplikasi tidak lagi membuat profil otomatis.
- Menonaktifkan pengguna cukup dengan `active: false` di profil. Untuk
  pencabutan penuh, nonaktifkan juga akunnya di Firebase Authentication.
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
- [ ] Jalankan `npm run test:rules` setelah mengubah `firestore.rules`. Butuh Java 11+ dan Firebase Emulator (diunduh otomatis oleh `firebase-tools`).
- [ ] Isi `nisn_index/{nisn}` untuk setiap santri lama sebelum menambah santri baru. Santri baru menulis kunci ini otomatis; data lama perlu backfill sekali agar keunikan NISN berlaku penuh, bukan hanya dari pengecekan klien.
- [ ] Uji akun nonaktif: setelah admin menonaktifkan profil, akun itu tidak bisa membaca atau menulis data. Untuk pencabutan penuh, nonaktifkan juga akunnya di Firebase Authentication.
- [ ] Uji simpan jurnal dua kali pada tanggal yang sama: poin hanya bertambah sekali.
- [ ] Uji login tiap peran dan pastikan data per peran tidak bocor.
- [ ] Uji dua akun berbeda: wali A tidak bisa membaca anak wali B.
- [ ] Ganti kata sandi akun admin awal.
- [ ] Cadangkan data: ekspor Firestore berkala, atau `pg_dump` untuk Supabase.
- [ ] Tentukan retensi `audit_log` (misalnya 12 bulan) dan hapus berkala.
- [ ] Siapkan pemantauan: `/api/health`, log server, dan peringatan kuota.

## 6. Yang belum siap untuk produksi

- Adapter Supabase dan D1 belum ada; baru skemanya.
- Pembuatan akun lintas backend masih manual. Di mode Firestore, akun Auth
  dibuat lewat Firebase Console lalu profilnya ditautkan; panel admin belum
  bisa membuat akun Auth dari aplikasi.
- Belum ada pengujian browser otomatis (end-to-end).
- `bun audit` masih melaporkan 2 peringatan transitif pada `@grpc/grpc-js@1.9.16`
  (1 high, 1 low). Versi itu dipatok Firebase `~1.9.0`; build peramban memakai
  WebChannel, bukan transport gRPC, tetapi peringatan tetap ada sampai Firebase
  menaikkan dependensinya. Jangan memaksa override tanpa menguji ulang Firestore.
- Poin harian masih dihitung di klien. Siswa yang memanggil SDK langsung dengan tanggal berbeda masih bisa menambah poin, jadi perhitungan resmi perlu dipindahkan ke server sebelum data dipakai untuk penghargaan.
- Panel admin belum bisa mengubah data santri yang sudah ada, baru menambah.
