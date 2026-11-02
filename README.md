# BKP Digital | Sistem Buku Kejar Prestasi
### SMK Thibbil Qulub Assimbani

Aplikasi modern untuk digitalisasi buku catatan pembiasaan santri/siswa, pencatatan poin karakter (apresiasi & konsekuensi), rekapitulasi kehadiran sholat 5 waktu, dan pengesahan tanda tangan digital oleh orang tua.

---

## Tech Stack
- **Frontend**: React 19 + Vite 8 (SPA, bukan Next.js) + TypeScript
- **Styling**: Tailwind CSS 4 (Desain Hijau-Putih sesuai identitas SMK Thibbil Qulub Assimbani)
- **Data**: satu facade di `src/lib/data`: **localStorage** (default, tanpa server) atau **Firestore**
- **Auth**: email dan kata sandi. Mode lokal memakai PBKDF2 di peramban, mode Firestore memakai Firebase Auth
- **Server Produksi**: Express (`server.js`) yang menyajikan `dist/` dengan header keamanan
- **Icon**: Lucide React
- **Digital Signature**: `react-signature-canvas`

> Supabase dan Cloudflare D1 belum terpasang. Skema database dan langkah
> deploy-nya sudah disiapkan di [`docs/migrasi-backend.md`](docs/migrasi-backend.md).
> Checklist produksi ada di [`docs/production.md`](docs/production.md).

---

## Arah desain

Arah lengkap dan alasan setiap keputusan ada di [`DESIGN.md`](DESIGN.md). Ringkasnya:

- Token warna dan radius didefinisikan sebagai `@theme` Tailwind 4 di `src/index.css`:
  `brand-800` (`#1B5E20`), `brand-700` (`#2E7D32`), `paper` (`#EEF3EA`), `surface`,
  `ink`, `muted`, `line`, `alert`, `danger`.
- Palet inti tiga hijau + satu aksen amber. Merah hanya untuk status, bukan dekorasi.
- Tipografi Poppins, ukuran minimum 12px, angka poin memakai `tabular-nums`.
- Fokus keyboard selalu terlihat (`:focus-visible`), kontrol memakai `cursor: pointer`,
  dan animasi non-esensial berhenti saat `prefers-reduced-motion: reduce`.
- Dial desain: ENERGY 1 / RHYTHM 2 / MOTION 1. Tidak ada gradien dekoratif, emoji
  penghias, atau animasi memantul.

---

## Backend data

Semua baca tulis lewat `src/lib/data/index.ts`, jadi layar tidak tahu backend mana
yang aktif. Pilih lewat `.env.local`:

```bash
VITE_DATA_BACKEND=local      # default: localStorage, tanpa server
VITE_DATA_BACKEND=firestore  # Firebase Firestore + fungsi `firestore.rules`
```

**Mode lokal** (dipakai sekarang): data disimpan di kunci `bkp.localdb.v2`, sesi di
`bkp.localsession.v4` dan berakhir setelah 12 jam. Login memakai email dan kata
sandi; lima percobaan gagal dalam 15 menit mengunci email itu selama 5 menit.
Basis data kosong hanya mendapat satu akun administrator (`admin@lokal.test`), lalu
akun lain dibuat dari panel admin. Data contoh 4 santri dan lima akun peran hanya
dimuat bila `VITE_LOCAL_SEED=demo`. Firebase tidak diinisialisasi selama mode lokal
aktif.

Batas mode lokal: tidak ada aturan keamanan (siapa pun yang membuka peramban bisa
membaca seluruh isi), tidak ada sinkronisasi antar perangkat, dan kuota localStorage
sekitar 5 MB. Cocok untuk pengembangan dan demo, belum untuk data santri nyata.

Kontrak adapter dan padanan aturan akses ada di
[`docs/data-backend.md`](docs/data-backend.md). Langkah migrasi Supabase dan
Cloudflare D1, termasuk skema SQL, ada di
[`docs/migrasi-backend.md`](docs/migrasi-backend.md).
Rencana refactor bertahap, termasuk module fitur yang akan dibentuk dan urutan
tiketnya, ada di [`docs/refactor-plan.md`](docs/refactor-plan.md).

---

## 5 Peran & Matriks Kewenangan

Role **hanya** dibaca dari dokumen `profiles/{uid}.role` di Firestore, tidak pernah dari
teks email. Routing, menu, dan query klien mengikuti tabel ini: dan aturan yang sama
ditegakkan ulang di `firestore.rules`.

| Peran | Field penaut di profil | Bisa baca | Bisa tulis |
| :--- | :--- | :--- | :--- |
| `siswa` | `studentId` | Data santrinya sendiri, poin_log & prestasi miliknya | Jurnal harian, pengajuan prestasi (**pending**), +poin harian maks 100 |
| `orang_tua` | `childIds: []` | Data anak-anaknya, poin_log, prestasi, rekap mingguan | Hanya kolom pengesahan TTD pada `pembiasaan_mingguan` |
| `pembimbing_rayon` | `rayonId` | Santri & transaksi di rayonnya | Poin santri rayonnya, verifikasi prestasi rayonnya |
| `guru` |: | Seluruh santri & transaksi | Poin, verifikasi prestasi, tambah santri |
| `admin` |: | Seluruh data + audit log | Semua di atas + master data (kelas, rayon, kategori poin) + ubah role & penautan profil |

### Skema `profiles/{uid}`
```jsonc
{
  "uid": "<uid>",
  "email": "guru@sekolah.id",
  "fullName": "Ust. Hendra",
  "role": "guru",            // siswa | orang_tua | guru | pembimbing_rayon | admin
  "studentId": "sis_123",    // wajib untuk role siswa
  "childIds": ["sis_123"],   // wajib untuk role orang_tua
  "rayonId": "Assimbani 1",  // wajib untuk role pembimbing_rayon
  "total_poin": 1000
}
```
Field lama (`anak_id`, `rayon`) masih dibaca sebagai fallback, tetapi **isi field baru**
agar scoping rules bekerja penuh.

### Koleksi Firestore
| Koleksi | Isi |
| :--- | :--- |
| `profiles` | Profil & role pengguna |
| `students` | Master santri (`rayon` = kunci scoping pembimbing) |
| `pembiasaan_harian` | Jurnal harian (id `<uid>_<YYYY-MM-DD>`) |
| `pembiasaan_mingguan` | Rekap pekanan + TTD orang tua |
| `poin_log` | Apresiasi/konsekuensi (`siswa_id`, `rayon`, `dicatat_oleh`) |
| `prestasi` | Pengajuan prestasi + status verifikasi |
| `pembiasaan_non_rutin` | Isian kegiatan 3-mingguan / 9-mingguan / semester (id `<studentId>_<tahun>_P<pekan>`) |
| `notifikasi` | Pemberitahuan resmi per akun (`user_id` = uid penerima) |
| `audit_log` | Jejak audit append-only (tidak bisa diubah/dihapus) |
| `master_kelas`, `master_rayon`, `master_kategori_poin` | Master data, tulis hanya admin |

### Alur pengajuan prestasi
1. Siswa membuka **Poin → + Ajukan Prestasi**. Dokumen dibuat dengan `status: "pending"`,
   `poin: 0`, tanpa `verifiedBy`. Rules **menolak** kiriman klien yang mencoba mengisi
   status/poin/verifiedBy secara langsung.
2. Guru / pembimbing rayon / admin membuka **Verifikasi Prestasi**, mengisi poin, lalu
   menekan **Verifikasi & Beri Poin** atau **Tolak**.
3. Verifikasi menulis tiga hal sekaligus dalam satu `writeBatch`: status prestasi,
   `increment` poin santri, dan entri `audit_log`.

---

## Akun pengguna

Login memakai email dan kata sandi di kedua mode. Perbedaannya:

- **Mode lokal**: administrator membuat santri di tab **Data Santri**, lalu akun
  di tab **Pengguna** pada panel admin.
  Form itu mengisi nama, email, kata sandi awal, dan peran, lalu menautkan akun ke
  santri (peran santri), anak (wali santri), atau rayon (pembimbing). Kata sandi
  disimpan sebagai hash PBKDF2 dengan salt acak, bukan teks biasa. Admin juga bisa
  mengatur ulang kata sandi, menonaktifkan, dan menghapus akun. Semua aksi tercatat
  di `audit_log` sebagai `user_create`, `user_update`, atau `user_delete`.
- **Mode Firestore**: akun login dibuat admin di Firebase Console (Authentication →
  Users), karena pembuatan akun Firebase butuh hak server yang tidak boleh ada di
  peramban. Panel admin pada mode ini menampilkan daftar akun dan menonaktifkan form
  pembuatan akun.

Akun awal mode lokal memakai kata sandi `bkp12345`. Yang selalu dibuat hanya
administrator; akun peran lain dibuat dari panel admin, atau ikut dibuat sebagai
contoh bila `VITE_LOCAL_SEED=demo`:

| Email | Peran | Kapan ada |
| :--- | :--- | :--- |
| `admin@lokal.test` | Administrator | selalu, saat basis data masih kosong |
| `guru@lokal.test` | Guru / BK | `VITE_LOCAL_SEED=demo` |
| `pembimbing@lokal.test` | Pembimbing rayon | `VITE_LOCAL_SEED=demo` |
| `faiz@lokal.test` | Santri | `VITE_LOCAL_SEED=demo` |
| `wali@lokal.test` | Wali santri | `VITE_LOCAL_SEED=demo` |

Ganti kata sandi akun awal lewat panel admin bila aplikasi dipakai bersama. Akun
mode lokal hanya berlaku pada peramban dan perangkat tempat akun itu dibuat.

Format email yang disarankan: `nama@thibbilqulub.sch.id`. Contoh isi profil tiap peran
ada pada bagian `profiles/{uid}` di atas.

---

## Status modul

| Modul | Status |
| :--- | :--- |
| Login, routing peran, peringatan penautan profil | Tersambung Firebase Auth + `profiles` |
| Jurnal pembiasaan harian & pekanan | Tersambung `pembiasaan_harian` (poin + audit atomik) |
| Kegiatan non-rutin | Tersambung `pembiasaan_non_rutin` (simpan per santri per pekan) |
| Poin apresiasi/konsekuensi | Tersambung `poin_log` + saldo `students.points` |
| Pengajuan & verifikasi prestasi | Tersambung `prestasi` + audit |
| Tanda tangan orang tua | Tersambung `pembiasaan_mingguan` (data URL, lihat batasan) |
| Laporan bulanan wali santri | Dihitung dari `poin_log` nyata, tanpa angka contoh |
| Pemberitahuan wali santri | Tersambung `notifikasi`, keadaan kosong bila belum ada |
| Master data & audit (admin) | Tersambung `master_*` + `audit_log` |
| Manajemen akun (admin) | Mode lokal: buat akun, atur ulang kata sandi, aktif/nonaktif, hapus, semua ber-audit |
| Borang kesehatan & buku UKS | **Belum tersedia**: modul lama hanya berisi data contoh, jadi tidak ditampilkan sebagai fitur |

---

## CHECKLIST SETUP

1. **Install dependensi** (lockfile `bun.lock`; Node.js ≥ 20)
   ```bash
   bun install
   ```

   Tanpa konfigurasi tambahan, aplikasi langsung berjalan di mode lokal. Masuk
   sebagai `admin@lokal.test` dengan kata sandi `bkp12345` (hanya ditampilkan di
   layar login saat mode pengembangan), lalu tambah akun lain dari panel admin.
   Tambahkan `VITE_LOCAL_SEED=demo` di `.env.local` bila ingin data santri contoh.
   Untuk memakai Firestore, isi `.env.local` dengan `VITE_DATA_BACKEND=firestore`
   dan variabel `VITE_FIREBASE_*` (lihat `.env.example`).

2. **Siapkan Firebase** (ganti proyek contoh dengan proyek sekolah)
   - Firebase Console → **Authentication** → aktifkan provider **Email/Password**.
   - Buat akun di tab **Users**. Jangan bagikan akses proyek ke pihak luar.
   - Deploy security rules (sudah tersedia `firebase.json`):
     ```bash
     npx firebase-tools deploy --only firestore:rules --project <project-id>
     ```
   - Isi `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, dan
     `VITE_FIREBASE_API_KEY` (beserta nilai lain bila perlu) di `.env.local`.
     Aplikasi hasil build produksi dengan backend Firestore menolak berjalan
     bila masih memakai proyek contoh tanpa env tersebut.

3. **Buat dokumen profil untuk setiap akun** di Firestore, koleksi `profiles`,
   ID dokumen = **UID akun tersebut**:
   ```json
   { "uid": "<uid>", "email": "guru@sekolah.id", "fullName": "Ust. Hendra", "role": "guru", "active": true, "total_poin": 0 }
   ```
   `role`: `siswa`, `orang_tua`, `guru`, `pembimbing_rayon`, atau `admin`.
   Sertakan `"active": true`. Profil hanya boleh dibuat admin; akun Auth yang
   belum punya profil tidak mendapat akses apa pun, dan aplikasi tidak lagi
   membuat profil otomatis.

   **Admin pertama harus dibuat manual** (bootstrap): buat akun Auth, lalu buat
   `profiles/{uid}` dengan `role: "admin"` dan `active: true` dari Firebase
   Console. Setelah itu admin bisa mengangkat pengguna lain lewat console maupun
   langsung di Firestore.

   Untuk santri lama, isi `nisn_index/{nisn}` berisi `{ nisn, studentId }` sekali
   agar kunci keunikan NISN berlaku untuk data lama. Santri baru menulis kunci ini
   otomatis dalam batch yang sama.

   Penautan minimal agar alur berjalan:
   - siswa → `profiles/{uid}.studentId` = ID dokumen di `students`
   - orang tua → `profiles/{uid}.childIds` = array ID dokumen `students`
   - pembimbing rayon → `profiles/{uid}.rayonId` = nilai `students.rayon` (mis. `Assimbani 1`)

   Jika belum ditautkan, aplikasi menampilkan peringatan kuning di bagian atas.

4. **Jalankan server development**
   ```bash
   bun run dev      # http://localhost:3000
   ```

5. **Build & jalankan seperti produksi**
   ```bash
   bun run build    # vite build -> dist/, lalu bundle server.ts -> server.js
   bun run start    # node server.js (PORT default 3000)
   ```
   Cek kesehatan server: `curl http://localhost:3000/api/health`

6. **Alur data yang perlu diisi lebih dulu**
   - Masuk sebagai guru → menu **Daftar Santri** → tombol **Tambah Santri**.
     Isi `studentEmail` (akun siswa) dan `waliEmail` (akun orang tua) agar santri
     tertaut ke akunnya.
   - Siswa masuk → isi jurnal → **Simpan** (tertulis ke `pembiasaan_harian`).
   - Guru → **Input Poin** (tertulis ke `poin_log`, saldo santri bertambah/berkurang).
   - Orang tua → **TTD Digital** → tanda tangan → simpan (`pembiasaan_mingguan`).

7. **Deploy**
   - Platform harus menjalankan `build` lalu `start` (Node ≥ 20), atau
     `vite build` + sajikan `dist/` lewat static host + `server.js` untuk `/api/health`.
   - Wajib menambahkan domain produksi ke **Firebase Console → Authentication →
     Settings → Authorized domains**, jika tidak login akan gagal di domain tersebut.

> Logout dan login memakai Firebase Auth sepenuhnya. Bila akun belum punya dokumen
> `profiles/{uid}`, aplikasi menolak masuk dan meminta admin menghubungkan akun.
> Ini disengaja agar akun baru tidak otomatis mendapat akses siswa.

---

## Verifikasi RBAC (sebelum dipakai pengguna nyata)

Rules sudah diuji terhadap emulator Firestore (63 skenario, 63 lulus, termasuk
scoping `pembiasaan_non_rutin`, akun nonaktif, NISN ganda, dan jurnal ganda).
Untuk mengulang di mesin Anda:

```bash
# tes adapter, login, module santri, dan module prestasi (tanpa emulator)
npm run test:local
npm run test:auth
npm run test:siswa
npm run test:prestasi

# tes aturan Firestore; butuh Java 11+ untuk emulator
npm run test:rules
```

`@firebase/rules-unit-testing` dan `firebase-tools` sudah tercatat sebagai
`devDependencies`, jadi `bun install` menyiapkan keduanya. Emulator Firestore
diunduh otomatis saat `npm run test:rules` pertama kali.

Skenario minimum yang wajib dicoba manual setelah rules dideploy:

| Uji | Harapan |
| :--- | :--- |
| Siswa membuka data santri lain lewat console | `permission-denied` |
| Orang tua membuka anak orang lain | `permission-denied` |
| Pembimbing rayon membuka santri rayon lain | `permission-denied` |
| Siswa mengirim prestasi dengan `status: "verified"` | `permission-denied` |
| Siswa mengubah `poin` / `status` prestasi yang sudah ada | `permission-denied` |
| Guru mengubah master kelas | `permission-denied` |
| Admin mengubah master kelas | berhasil |
| User mengubah `role` miliknya sendiri | `permission-denied` |

### Audit log
Setiap transaksi menulis entri ke `audit_log`: `actorId`, `actorEmail`,
`actorRole`, `action`, `collection`, `docId`, `siswa_id`, `rayon`, `createdAt`,
serta `before`/`after` yang sudah disanitasi (data URL TTD dibuang).

Rules mengunci koleksi ini:
- `actorId` wajib sama dengan uid pemanggil (tidak bisa memalsukan pelaku),
- `createdAt` wajib `request.time` (tidak bisa memundurkan waktu),
- `update` dan `delete` selalu ditolak; hanya guru/admin yang bisa membaca.

### Migrasi data lama
1. Isi `profiles.studentId` / `childIds` / `rayonId` untuk semua akun.
2. Pastikan `students.rayon` konsisten dengan `profiles.rayonId` pembimbing.
3. Isi `rayon` pada dokumen `poin_log` & `prestasi` lama bila ada (dokumen lama
   tanpa `rayon` tidak muncul di tampilan pembimbing rayon).
4. Setelah semua akun tertaut, fallback berbasis email (`studentEmail`,
   `waliEmail`) di `firestore.rules` boleh dihapus.

### Batasan yang masih tersisa
- Verifikasi poin harian siswa masih dibatasi rules (+100 per penulisan), belum
  dikunci per tanggal; penguncian per hari butuh Cloud Function.
- TTD disimpan sebagai data URL di Firestore (batas 1 MB). Untuk produksi
  sebaiknya pindahkan ke Firebase Storage dan simpan URL saja.
- Borang kesehatan, buku UKS, dan kalender menstruasi belum punya koleksi
  Firestore. Modul lamanya hanya data contoh, jadi sekarang ditampilkan sebagai
  "belum tersedia" dan tidak menerima isian.
- Rata-rata kelas, predikat, dan persentase konsistensi pembiasaan tidak ditampilkan
  karena tidak ada datanya di Firestore.
