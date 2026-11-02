# Migrasi backend: Supabase dan Cloudflare D1

Dokumen ini menyiapkan dua backend produksi yang diminta. Keduanya **belum
dipakai kode**: aplikasi masih berjalan dengan `VITE_DATA_BACKEND=local` atau
`firestore`. Skema di `supabase/schema.sql` dan `cloudflare/schema.sql` sudah
disiapkan agar migrasi tidak dimulai dari nol.

## 1. Kontrak yang harus dipenuhi adapter

Semua komponen hanya memakai `src/lib/data/index.ts`. Adapter baru cukup
mengekspor bentuk yang sama seperti `localDriver`:

| Ekspor | Perilaku yang diharapkan |
| :--- | :--- |
| `doc`, `collection`, `query`, `where`, `orderBy`, `limit` | Membentuk referensi dan query, tanpa I/O |
| `getDoc`, `getDocs`, `onSnapshot` | Baca satu, baca banyak, langganan perubahan |
| `setDoc`, `updateDoc`, `addDoc`, `deleteDoc` | Tulis satu dokumen |
| `writeBatch` | Tulis beberapa dokumen secara atomik |
| `increment`, `serverTimestamp`, `Timestamp` | Penanda nilai khusus |

Nama koleksi dan field mengikuti `src/lib/tipe.ts` serta `firestore.rules`.
Jangan mengubah nama field saat migrasi: adapter yang menerjemahkan.

## 2. Supabase

Langganan yang dipakai:

- **Auth** untuk login email dan kata sandi (GoTrue). Mode lokal memakai
  PBKDF2 di peramban; mode Supabase harus memakai `auth.signInWithPassword`
  sehingga hash tidak pernah menyentuh aplikasi.
- **Postgres** untuk data, dengan RLS sebagai pengganti `firestore.rules`.
- **Realtime** opsional untuk menggantikan `onSnapshot`.

Langkah:

1. Buat proyek Supabase, lalu jalankan `supabase/schema.sql` di SQL Editor.
2. Aktifkan penyedia Email di Authentication, matikan pendaftaran publik
   (`Disable signup`) karena akun dibuat admin lewat dashboard atau Edge
   Function dengan service role.
3. Isi `.env.local`:
   ```
   VITE_DATA_BACKEND=supabase
   VITE_SUPABASE_URL=https://<proyek>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
4. Buat `src/lib/data/supabaseDriver.ts` yang memetakan tabel ke API di atas,
   lalu daftarkan di `src/lib/data/index.ts`.
5. Samakan setiap aturan `firestore.rules` dengan policy RLS. Skema sudah memuat
   policy inti; sisa aturan per peran wajib diuji sebelum produksi.

Catatan keamanan:

- Kunci `service_role` tidak boleh ada di bundel peramban. Hanya `anon key`.
- Pembuatan akun dari panel admin butuh server (Edge Function) karena Auth
  admin API memerlukan service role.
- Uji dengan dua akun berbeda bahwa satu wali tidak bisa membaca anak wali lain.

## 3. Cloudflare D1

D1 adalah SQLite di edge. Tidak ada autentikasi bawaan, jadi login harus lewat
Cloudflare Worker yang memegang sesi (cookie HttpOnly atau token) dan memanggil
D1 lewat binding.

Langkah:

1. `wrangler d1 create bkp-digital`
2. Isi `database_id` di `cloudflare/wrangler.toml`.
3. `wrangler d1 execute bkp-digital --file=cloudflare/schema.sql`
4. Buat Worker API di `cloudflare/worker.ts` dengan rute baca/tulis yang
   memanggil D1 dan memeriksa sesi pada setiap permintaan.
5. Buat `src/lib/data/d1Driver.ts` yang memanggil Worker API, lalu daftarkan di
   `src/lib/data/index.ts`.
6. Isi `.env.local` dengan `VITE_DATA_BACKEND=d1` dan `VITE_API_BASE_URL`.

Catatan keamanan:

- Jangan menaruh token D1 di peramban. Hanya Worker yang memegang binding.
- Setiap query wajib memakai parameter terikat, bukan penggabungan string.
- Batas gratis D1: 5 juta baris dibaca dan 100 ribu baris ditulis per hari.
  Untuk satu sekolah, angka ini cukup, tetapi audit log perlu retensi.

## 4. Urutan pemotongan yang disarankan

1. Selesaikan module fitur (T3 sampai T10 di `docs/refactor-plan.md`) supaya
   penulisan data terkumpul di sedikit tempat.
2. Implementasikan driver Supabase, uji di proyek percobaan.
3. Pindahkan data dari Firestore atau ekspor localStorage.
4. Baru pertimbangkan D1 bila biaya atau latensi Supabase menjadi masalah.
5. Jangan menjalankan dua backend untuk data yang sama tanpa strategi sinkron.

## 5. Yang belum dikerjakan

- `supabaseDriver.ts` dan `d1Driver.ts` belum ada.
- Policy RLS di skema adalah titik awal, belum setara seluruh
  `firestore.rules`.
- Pembuatan akun lintas backend masih manual (Firebase Console atau dashboard
  Supabase) sampai ada server admin.
