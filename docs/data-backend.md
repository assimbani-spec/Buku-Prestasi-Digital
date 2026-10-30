# Lapisan data: localStorage, Firestore, dan adapter berikutnya

Aplikasi tidak lagi memanggil `firebase/firestore` langsung dari layar. Semua
baca tulis lewat satu pintu: `src/lib/data/index.ts`.

```
src/lib/data/
  config.ts           pilih backend dari VITE_DATA_BACKEND
  index.ts            facade: doc, collection, getDoc, onSnapshot, ...
  localDriver.ts      backend localStorage (default)
  firestoreDriver.ts  backend Firebase Firestore
  seed.ts             data contoh untuk mode lokal
src/lib/auth.ts       facade sesi (mode lokal / Firebase)
src/lib/firebaseAuthBridge.ts  dimuat dinamis, hanya untuk Firebase
```

## Memilih backend

Buat `.env.local` (jangan di-commit) lalu isi salah satu:

```
VITE_DATA_BACKEND=local      # default bila variabel tidak diisi
VITE_DATA_BACKEND=firestore  # perlu konfigurasi Firebase yang valid
```

Nilai lain dianggap `local` supaya salah tulis tidak diam-diam menembak server.

## Mode lokal (sekarang)

- Data disimpan sebagai satu kunci `bkp.localdb.v2` berisi JSON seluruh koleksi.
- Sesi disimpan sebagai JSON di `bkp.localsession.v3`.
- Login memakai email dan kata sandi. Kredensial disimpan di dokumen
  `profiles` sebagai `passwordHash` (PBKDF2-SHA256, 120.000 iterasi),
  `passwordSalt`, dan `passwordIterations`. Tidak ada teks kata sandi.
- Administrator membuat akun dari panel admin, menu Pengguna. Aksi itu menulis
  `profiles` dan entri audit `user_create` dalam satu batch.
- Data contoh dibuat sekali oleh `ensureLocalSeed()`: 5 profil (satu per peran,
  kata sandi awal `bkp12345`), 4 santri, 4 entri poin, 1 pengajuan prestasi
  pending, 2 notifikasi, dan beberapa master kelas/rayon. Semua fiktif.
- "Hapus data lokal dan mulai ulang" di halaman login menghapus seluruh isi.
- Firebase tidak diinisialisasi selama backend lokal aktif: `firebaseApp()`,
  `firebaseAuth()`, dan `firebaseDb()` baru membuat koneksi saat dipanggil.

Batas yang perlu diketahui:

- Tidak ada aturan keamanan. Siapa pun yang membuka peramban bisa membaca dan
  mengubah seluruh isi localStorage, termasuk mengganti hash kata sandi. Batas
  peran hanya ada di query layar. Login ini mencegah salah masuk, bukan mencegah
  penyalahgunaan.
- Tidak ada sinkronisasi antar perangkat atau antar peramban.
- Kuota localStorage umumnya 5 MB; cukup untuk demo, tidak untuk data nyata.
- `firestore.rules` tidak berlaku di mode ini.

Karena itu mode lokal dipakai untuk pengembangan dan demo. Untuk data santri
sungguhan, pindah ke Firestore, Supabase, atau Cloudflare D1.

## Kontrak adapter

Adapter apa pun harus menyediakan ekspor berikut dengan perilaku yang sama
seperti Firestore untuk bagian yang dipakai aplikasi. Hanya `==` dan `in`
yang dipakai sebagai operator `where`; `orderBy` (asc/desc) dan `limit` dipakai
di beberapa layar.

| Ekspor | Perilaku yang dibutuhkan |
| --- | --- |
| `doc(db, koleksi, id)` / `doc(collection(...))` | referensi dokumen; id acak bila tidak diberikan |
| `collection(db, nama)` | referensi koleksi |
| `query(ref, ...constraint)` | gabungan `where`/`orderBy`/`limit` |
| `where(field, op, value)` | minimal `==` dan `in` |
| `orderBy(field, 'asc' \| 'desc')` | urut naik/turun, nilai kosong di akhir |
| `limit(n)` | batasi jumlah hasil |
| `getDoc(ref)` | `{ id, exists(), data(), get(field) }` |
| `getDocFromServer(ref)` | sama, melewati cache bila ada |
| `getDocs(ref)` | `{ docs: [...], empty, size, forEach }` |
| `onSnapshot(ref, next, error?)` | panggil `next` saat data berubah, kembalikan fungsi berhenti |
| `setDoc(ref, data, { merge })` | tulis penuh atau gabung |
| `addDoc(collection, data)` | tulis dengan id otomatis, kembalikan referensi |
| `updateDoc(ref, data)` | gagal bila dokumen tidak ada |
| `deleteDoc(ref)` | hapus dokumen |
| `writeBatch(db)` | `set`/`update`/`delete` lalu `commit()`; semua atau tidak sama sekali |
| `increment(n)` | tambah nilai numerik yang sudah ada |
| `serverTimestamp()` | waktu server, bukan waktu perangkat |
| `Timestamp` | objek waktu dengan `toMillis()` dan `toDate()` |

Sesi (`src/lib/auth.ts`) membutuhkan `watchAuthUser(callback)`,
`signInWithEmail(email, password)`, dan `signOutUser()`, plus tipe `AppUser`
(`uid`, `email`, `displayName`).

## Menambah adapter Supabase

1. Buat `src/lib/data/supabaseDriver.ts` dengan ekspor pada tabel di atas.
   Petakan koleksi ke tabel lewat konstanta, misalnya
   `students → students`, `poin_log → poin_log`, `profiles → profiles`.
2. Waktu: simpan `timestamptz`, kembalikan pembungkus dengan `toMillis()` agar
   pemanggil tidak berubah.
3. `onSnapshot`: Supabase Realtime hanya mengirim perubahan, bukan snapshot
   awal. Kirim hasil `select` dulu, lalu berlangganan `postgres_changes` dan
   muat ulang query saat ada perubahan.
4. `writeBatch`: gunakan satu fungsi RPC PostgreSQL berisi transaksi. Jangan
   mengandalkan beberapa request HTTP berurutan karena bisa putus di tengah.
5. `increment`: gunakan RPC `update ... set poin = poin + $1` agar tidak ada
   kehilangan penulisan bersamaan.
6. Tambahkan nilai baru di `DataBackend` (`src/lib/data/config.ts`), lalu
   pilih driver di `src/lib/data/index.ts`.
7. Wajib: Row Level Security di setiap tabel. Contoh pemetaan aturan:

   | Aturan Firestore | Padanan PostgreSQL |
   | --- | --- |
   | siswa hanya membaca dirinya | `students.id = auth.uid()` atau lewat `profiles.student_id` |
   | wali hanya anaknya | `exists (select 1 from profiles where uid = auth.uid() and students.id = any(child_ids))` |
   | pembimbing hanya rayonnya | `students.rayon = (select rayon_id from profiles where uid = auth.uid())` |
   | admin kelola master | `exists (select 1 from profiles where uid = auth.uid() and role = 'admin')` |
   | audit log append-only | hanya `insert`, tanpa `update`/`delete` untuk semua peran |

## Menambah adapter Cloudflare D1

D1 hanya bisa diakses dari Worker, jadi aplikasi memerlukan Worker perantara
(lihat `server.ts` sebagai titik awal) dengan endpoint JSON:

- `GET /api/students?rayon=...`, `GET /api/poin?siswa_id=...`
- `POST /api/prestasi`, `PATCH /api/prestasi/:id`
- `POST /api/audit`

Skema D1 mengikuti `supabase/migration.sql` dengan penyesuaian tipe
(`TEXT` untuk id, `INTEGER` untuk poin, `INTEGER` epoch milidetik untuk waktu).
Transaksi memakai `db.batch([...])`, sedangkan `onSnapshot` diganti polling
berkala atau Durable Object + WebSocket. Aturan akses ditegakkan di Worker
berdasarkan sesi, bukan di peramban; jangan pernah menerima `user_id` dari
klien.

## Langkah migrasi dari mode lokal

1. Ekspor data: buka DevTools, jalankan `localStorage.getItem('bkp.localdb.v2')`,
   simpan sebagai berkas JSON.
2. Buat skema di backend tujuan, lalu impor per koleksi dengan skrip yang
   memetakan `createdAt` ke tipe waktu backend.
3. Isi `profiles` lebih dulu (peran, `studentId`, `childIds`, `rayonId`),
   baru `students`, `poin_log`, `prestasi`, `notifikasi`, `master_*`.
4. Set `VITE_DATA_BACKEND` ke adapter baru, jalankan ulang, dan uji per peran:
   siswa, wali, pembimbing rayon, guru, admin.
5. Hapus data lokal setelah migrasi terverifikasi.

## Keamanan

- Jangan menaruh kunci layanan (service role, D1 token, Firebase admin) di
  kode klien. Hanya kunci publik yang boleh ada di bundel.
- Setiap tabel atau koleksi harus punya aturan akses; jangan mengandalkan
  penyembunyian tombol di antarmuka.
- Audit log ditulis di sisi server atau lewat aturan yang memaksa `actorId`
  sama dengan pengguna yang masuk dan `createdAt` sama dengan waktu server.
