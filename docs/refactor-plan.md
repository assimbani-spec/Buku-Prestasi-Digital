# Rencana refactor BKP Digital

Dokumen ini hasil pemindaian kode per 30 Oktober 2026 memakai kosakata
`codebase-design` dari `mattpocock/skills`: **module**, **interface**,
**implementation**, **depth**, **deep**, **shallow**, **seam**, **adapter**,
**leverage**, **locality**. Istilah itu dipakai apa adanya supaya setiap
kandidat bisa dibandingkan dengan ukuran yang sama.

| Istilah | Arti di dokumen ini |
| :--- | :--- |
| module | Apa pun yang punya interface dan implementation: fungsi, berkas, atau irisan fitur |
| interface | Semua yang harus diketahui pemanggil: tipe, invarian, urutan, mode galat, konfigurasi |
| depth | Banyaknya perilaku yang didapat pemanggil per satuan interface |
| seam | Tempat interface sebuah module hidup dan bisa diganti tanpa menyentuh pemanggil |
| adapter | Yang mengisi seam: localStorage, Firestore, atau kelak Supabase dan D1 |
| leverage | Manfaat untuk pemanggil: satu interface melayani banyak tempat |
| locality | Manfaat untuk perawat: perubahan dan bug terkumpul di satu module |

Rencana ini **tidak mengubah** seam adapter data, `firestore.rules`, maupun
dial desain di `DESIGN.md`.

---

## 1. Analisis: di mana friksinya

Angka di bawah diukur langsung dari kode, bukan perkiraan.

| Module | Ukuran | Friksi |
| :--- | ---: | :--- |
| `src/App.tsx` | 3.534 baris, 45 `useState`, 8 `useEffect`, 11 `onSnapshot` | Routing, lima dashboard, semua query per peran, enam tempat menulis audit, dan penulisan poin ada dalam satu module |
| `src/components/AdminPanel.tsx` | 1.230 baris | Tiga tanggung jawab (master data, akun pengguna, audit) plus validasi dan penulisan audit di dalam komponen |
| `src/lib/data/localDriver.ts` | 483 baris, 17 `any` | Adapter, bukan masalah depth. Interface-nya kecil, implementation besar, dan sudah diuji 15 skenario |
| `src/lib/data/seed.ts` | 273 baris | Data contoh fiktif dimuat statis oleh `App.tsx` dan `auth.ts`, jadi ikut bundel produksi meski mode lokal tidak dipakai |
| `src/lib/supabase.ts` | 184 baris, tidak diimpor siapa pun | Module mati, tetapi `@supabase/supabase-js` masih jadi dependency di `package.json` |
| `src/lib/firebase.ts` | 213 baris | Konfigurasi Firebase dan tipe domain (`UserProfile`, `StudentRecord`, `PrestasiRecord`, `AuditLogRecord`) bercampur |
| `firestore.rules` | aturan 5 peran | Bentuk query per peran harus sejalan dengan aturan, tetapi bentuk itu hanya hidup di dalam `App.tsx` |

Temuan yang paling mahal:

1. **Tiga blok tulis yang hampir sama** untuk jurnal harian (L1117), non-rutin
   (L1186), dan rekap mingguan (L1255). Masing-masing menyusun payload, menulis
   `writeBatch`, dan menulis entri audit dengan tangan. Setiap perubahan bentuk
   audit harus disalin tiga kali.
2. **Audit dan poin tersebar di enam titik** (`buildAuditPayload` tiga kali,
   `logAuditSafe` dua kali, satu di `AdminPanel`). Tidak ada satu module yang
   memaksa invarian "setiap penulisan transaksi punya audit".
3. **Bentuk query per peran adalah interface tersembunyi.** Ia ditentukan oleh
   kombinasi `role`, `myStudentId`, `myChildIds`, `myRayonId`, dan
   `firestore.rules`. Tidak ada module yang bisa diuji tanpa merender React.
4. **Liputan tes belum menyentuh semua fitur.** 45 tes yang ada menguji adapter
   data (16), login (15), module santri (6), dan prestasi (8), ditambah 63
   skenario rules. Belum ada tes unit untuk alur jurnal, poin, atau pembuatan
   akun.
5. **Dashboard siswa saja 981 baris** di dalam `App.tsx` (L1697 sampai L2677),
   guru 527 baris, wali 318 baris.

### Uji hapus (deletion test)

- `src/lib/data/index.ts` (59 baris): **lulus**. Menghapusnya memaksa setiap
  layar memilih driver sendiri, dan pemilihan backend bocor ke seluruh kode.
  Ini seam nyata dengan dua adapter, jadi dipertahankan.
- `src/lib/supabase.ts`: **gagal**. Menghapusnya tidak memunculkan kompleksitas
  di tempat lain, jadi memang tidak earning its keep.
- `Auth` di `src/lib/auth.ts`: **lulus**. Dua adapter (lokal dan Firebase) dan
  satu interface untuk sesi.
- Pembungkus tipis di dalam `App.tsx` seperti `mapStudentDoc`: **gagal** sebagai
  module tersendiri. Ia sebaiknya jadi implementation di dalam module data per
  peran, bukan interface baru.

---

## 2. Kandidat deepening

### C1. Module prestasi: satu interface untuk submit dan verifikasi

**Berkas**: `src/App.tsx` (L1369 sampai L1500), `src/lib/audit.ts`,
`firestore.rules` (koleksi `prestasi`).

**Masalah**: aturan status (`pending` ke `verified` atau `rejected`), penulisan
poin, dan audit ditulis langsung di dalam handler React. Setiap handler tahu
urutan yang benar.

**Solusi**: module `src/features/prestasi/` dengan interface
`ajukanPrestasi(input, aktor)` dan `putuskanPrestasi(id, keputusan, aktor)`.
Keduanya menulis koleksi, transisi status, audit, dan poin dalam satu
`writeBatch`. Komponen hanya memanggil dan menampilkan hasil.

**Menang**:
- locality: transisi status dan audit di satu tempat
- interface adalah permukaan tes: dua fungsi, tanpa React
- menghapus dua salinan urutan tulis di `App.tsx`

**Bukti tes**: ajukan sebagai siswa, verifikasi sebagai guru, tolak dengan
alasan, coba verifikasi ganda, cek audit tercatat dengan aktor yang benar.

**Kekuatan**: Strong

---

### C2. Module jurnal: tiga penulisan menjadi satu funnel

**Berkas**: `src/App.tsx` L1100 sampai L1290.

**Masalah**: jurnal harian, non-rutin, dan rekap mingguan menyusun payload,
batch, dan audit sendiri-sendiri. Kunci pekan (`tahun_Pnn`) dihitung di dua
tempat.

**Solusi**: module `src/features/jurnal/` dengan `simpanJurnalHarian`,
`simpanNonRutin`, `simpanRekapMingguan`, dan satu helper `periodePekan(tanggal)`.
Setiap fungsi menerima aktor dan mengembalikan hasil, bukan menulis state React.

**Menang**:
- satu tempat untuk bentuk audit `jurnal_save`, `non_rutin_save`, `ttd_ortu`
- kunci pekan tidak lagi dihitung ulang di komponen
- tes bisa memeriksa poin harian dan saldo santri naik bersamaan

**Bukti tes**: simpan harian menaikkan `students.points` sebesar `poin_harian`,
simpan ulang di hari yang sama memperbarui bukan menggandakan, non-rutin
tersimpan per pekan, rekap wali menyimpan tanda tangan tanpa data URL di audit.

**Kekuatan**: Strong

---

### C3. Module poin: satu pintu untuk apresiasi dan konsekuensi

**Berkas**: `src/App.tsx` L1299 sampai L1365, `src/components/TambahSiswaModal.tsx`
(pemberian poin awal), `seed.ts` (poin contoh).

**Masalah**: pemberian poin menulis `poin_log`, menaikkan `students.points`, dan
menulis audit di handler. Nilai poin boleh datang dari input bebas, jadi aturan
"ambil dari master kategori" hanya kesepakatan, bukan invarian.

**Solusi**: module `src/features/poin/` dengan `catatPoin({ siswaId, kode,
aktor, catatan })`. Module membaca master kategori, menolak kode tak dikenal,
menulis log dan saldo atomik, dan menulis audit. Batas poin per hari yang kini
hanya dijaga rules dipindah ke sini sebagai pemeriksaan yang bisa diuji.

**Menang**:
- invarian poin berhenti bergantung pada disiplin handler
- satu interface untuk guru, admin, dan seed
- tes keamanan poin jadi mungkin tanpa emulator

**Bukti tes**: kode tak dikenal ditolak, poin diambil dari master, dua catatan
sehari ditolak, audit menyebut santri dan rayon.

**Kekuatan**: Worth exploring (menyentuh rules, jadi perlu satu putaran
persetujuan sebelum dikerjakan)

---

### C4. Hook data per peran: interface query yang bisa diuji

**Berkas**: `src/App.tsx` L620 sampai L880 (sebelas `onSnapshot`), `src/lib/rbac.ts`,
`firestore.rules`.

**Masalah**: bentuk query per peran adalah interface tersembunyi. Ia hanya bisa
diperiksa dengan merender aplikasi dan menebak dari layar. Saat `firestore.rules`
berubah, tidak ada tes yang menangkap query yang jadi tidak sah.

**Solusi**: module `src/features/data/` berisi `useSantriTerlihat(peran, profil)`,
`usePoinTerbaru`, `usePrestasiTerlihat`, `useNotifikasiSaya`, masing-masing
mengembalikan `{ data, memuat, galat }`. Setiap hook memilih query dari peran di
satu tempat, dan `App.tsx` berhenti menyusun `query(...)`.

**Menang**:
- leverage: satu hook dipakai siswa, wali, pembimbing, guru, admin
- locality: perubahan rules menyentuh satu module
- `memuat` dan `galat` seragam, tidak lagi diatur per efek

**Bukti tes**: dengan adapter lokal, isi data dua rayon dan dua wali, lalu
pastikan tiap peran hanya menerima baris yang boleh dilihat.

**Kekuatan**: Strong

---

### C5. Pecah `App.tsx`: router tipis dan lima view

**Berkas**: `src/App.tsx` (L1554 login, L1697 siswa, L2678 wali, L2996 guru,
L3523 admin).

**Masalah**: `App.tsx` adalah module dangkal berukuran 3.534 baris. Interface-nya
(hanya sebuah komponen) jauh lebih kecil dari implementation-nya, sehingga tidak
ada locality: mengubah satu kartu di dashboard siswa berarti membuka berkas yang
juga memuat login, query admin, dan penulisan poin.

**Solusi**: `App.tsx` tinggal sesi, rute, dan `Suspense`. Lima view pindah ke
`src/features/<peran>/View.tsx` dengan props eksplisit. Ini **wide refactor**,
jadi dikerjakan expand-contract: pindahkan satu view apa adanya (move-only) per
tiket, `App.tsx` tetap hijau di setiap langkah, dan hapus sisa setelah view
terakhir pindah.

**Menang**:
- interface `App` menyusut jadi sesi dan rute
- tiap view bisa dibaca dan diubah tanpa menyentuh peran lain
- bundel per peran tetap terpisah lewat `React.lazy` yang sudah ada

**Bukti tes**: tidak ada tes unit baru untuk JSX. Verifikasi: `tsc`, `build`,
dan dev server untuk tiap peran setelah satu view pindah. Tes perilaku sudah
dipindah ke C1 sampai C4 lebih dulu, jadi refactor ini murni pemindahan.

**Kekuatan**: Strong (tetapi paling akhir, setelah logika keluar dari komponen)

---

### C6. Panel admin: tiga view, satu module pengguna

**Berkas**: `src/components/AdminPanel.tsx` (1.230 baris).

**Masalah**: validasi akun, hashing, batch audit, tabel, dan navigasi tinggal di
satu komponen. Aturan "email tidak boleh ganda" dan "admin tidak bisa menghapus
dirinya" hanya bisa diuji lewat UI.

**Solusi**: module `src/features/pengguna/` dengan `buatAkun`, `aturUlangSandi`,
`ubahStatusAkun`, `hapusAkun`, semuanya menerima aktor dan menolak pelanggaran
dengan galat bertipe. `AdminPanel` tinggal tiga view: master, pengguna, audit.

**Menang**:
- aturan akun bisa diuji tanpa merender form
- penulisan audit pengguna berhenti diduplikasi di empat handler
- satu tempat yang tahu mode lokal versus Firestore

**Bukti tes**: email ganda ditolak, sandi pendek ditolak, akun tanpa tautan
santri ditolak, admin tidak bisa menghapus diri, audit `user_create` tercatat,
akun nonaktif tidak bisa masuk.

**Kekuatan**: Worth exploring

---

### C7. Seed demo keluar dari jalur produksi

**Berkas**: `src/App.tsx` L579, `src/lib/auth.ts` L136, `src/lib/data/seed.ts`.

**Masalah**: `ensureLocalSeed()` dipanggil statis dari dua tempat, sehingga data
santri fiktif dan kata sandi awal ikut ke bundel meski aplikasi dipakai dengan
backend lain. Ini juga membuat "mode lokal" sulit dibedakan dari "mode demo".

**Solusi**: pisahkan `seedDemo()` (data contoh) dari `pastikanAdminAwal()` (satu
akun admin bila basis data kosong). Seed demo hanya dimuat dinamis saat
`VITE_LOCAL_SEED=demo`, dan `auth.ts` hanya memanggil pembuatan admin awal.

**Menang**:
- data fiktif tidak lagi ikut bundel produksi
- interface `ensureLocalSeed` berhenti berarti dua hal
- tes seed tetap bisa memanggil seed demo secara eksplisit

**Bukti tes**: basis data kosong menghasilkan satu akun admin, tanpa
`VITE_LOCAL_SEED` tidak ada santri contoh, dengan flag tersebut data demo muncul
dan idempoten.

**Kekuatan**: Strong (kecil, risiko rendah)

---

### C8. Prefactor: tipe domain dan hapus module mati

**Berkas**: `src/lib/firebase.ts`, `src/lib/supabase.ts`, `supabase/migration.sql`,
`package.json`.

**Masalah**: tipe domain tinggal di berkas konfigurasi Firebase, sehingga module
fitur harus mengimpor konfigurasi untuk sekadar memakai tipe. `supabase.ts` tidak
diimpor siapa pun, tetapi dependency `@supabase/supabase-js` masih terpasang dan
berisi kunci placeholder yang mirip kunci asli.

**Solusi**: pindahkan tipe ke `src/lib/tipe.ts`, hapus `supabase.ts` dan ganti
`supabase/migration.sql` menjadi contoh skema di `docs/data-backend.md` bila
masih dibutuhkan. Hapus dependency yang tidak dipakai.

**Menang**:
- module fitur tidak lagi bergantung pada konfigurasi Firebase
- satu sumber tipe domain
- satu dependency dan satu berkas berisi kunci contoh hilang

**Bukti tes**: `tsc` dan `build` tetap hijau, tidak ada impor yang patah.

**Kekuatan**: Strong (prefactor, tanpa perubahan perilaku)

---

## 3. Urutan kerja

Tiap tiket adalah irisan vertikal: logika, pemanggil, dan tesnya dalam satu
tiket, sehingga bisa diverifikasi sendiri. Kolom **blocker** menyebut tiket yang
harus selesai lebih dulu.

| Tiket | Isi | Blocker | Bukti selesai |
| :--- | :--- | :--- | :--- |
| T0 | C8: tipe domain, hapus `supabase.ts` dan dependency mati | tidak ada | `tsc`, `build`, 27 tes lama tetap lulus |
| T1 | C7: pisahkan admin awal dari seed demo, muat dinamis | T0 | tes seed baru, akun admin tunggal di basis data kosong |
| T2 | C1: module prestasi + rewire `App.tsx` | T0 | tes prestasi (5 skenario), audit benar |
| T3 | C2: module jurnal (harian, non-rutin, rekap) + rewire | T0 | tes jurnal (5 skenario), saldo poin konsisten |
| T4 | C3: module poin + rewire guru dan seed | T3 | tes poin (4 skenario), rules tidak berubah |
| T5 | C4: hook data per peran + rewire query di `App.tsx` | T0 | tes cakupan data per peran (4 skenario) |
| T6 | C6: module pengguna + pecah panel admin | T0 | tes akun (6 skenario), panel tetap tiga tab |
| T7 | C5: pindahkan view siswa | T2, T3, T5 | `App.tsx` turun, dev server siswa bersih |
| T8 | C5: pindahkan view guru dan wali | T7 | idem, dua peran |
| T9 | C5: pindahkan view login dan admin | T6, T8 | `App.tsx` di bawah 300 baris |
| T10 | Perbarui `docs/data-backend.md` dan `README.md` untuk struktur baru | T9 | dokumen cocok dengan struktur |

Aturan pengerjaan:

1. **Tes dulu di seam, bukan di JSX.** Setiap module baru diuji lewat interface
   dengan adapter lokal yang sudah ada (`tests/local-driver.test.ts` menunjukkan
   caranya).
2. **Jangan ubah bentuk payload saat memindahkan.** `actorId`, `createdAt`
   memakai `serverTimestamp()`, `siswa_id`, dan `rayon` harus tetap sama agar
   `firestore.rules` dan audit lama tetap sah.
3. **Satu tiket, satu commit, satu pemeriksaan.** `npx tsc --noEmit` dan
   `npm run build` wajib hijau sebelum tiket berikutnya.
4. **Move-only untuk T7 sampai T9.** Tidak ada perubahan perilaku, gaya, atau
   teks di dalam view yang dipindah.

---

## 4. Status pelaksanaan

| Tiket | Status | Bukti |
| :--- | :--- | :--- |
| T0 | selesai | tipe domain di `src/lib/tipe.ts`, `supabase.ts` dan dependency-nya hilang, `tsc` + `build` bersih |
| T1 | selesai | `pastikanAdminAwal` membuat satu admin di basis data kosong; data contoh pindah ke `seedDemo.ts` dan hanya dimuat dengan `VITE_LOCAL_SEED=demo` |
| T2 | selesai | `src/features/prestasi/prestasi.ts`, 8 skenario di `tests/prestasi.test.ts`, audit dan poin di batch yang sama |
| T3-T10 | belum | mengikuti urutan di tabel tiket |

T0 dan T1 mengubah perilaku yang terlihat: basis data kosong kini hanya berisi
satu akun admin, bukan lima akun contoh. Data contoh harus diminta lewat flag.

---

## 5. Target terukur setelah selesai

| Ukuran | Sekarang | Target |
| :--- | ---: | ---: |
| Baris `src/App.tsx` | 3.534 | di bawah 300 |
| Berkas view di atas 400 baris | 3 (`App`, `AdminPanel`, `localDriver`) | 0 |
| Titik penulisan audit di luar module fitur | 7 | 0 |
| Tes perilaku fitur | 0 | minimal 24 skenario |
| Pemanggilan `collection(db, ...)` di berkas view | 11 | 0 |
| Module mati / dependency tak terpakai | `supabase.ts` + `@supabase/supabase-js` | 0 |

Target ini bukan janji angka bulat: bila C3 atau C6 dibatalkan setelah
didiskusikan, target tes diturunkan sesuai module yang benar-benar dikerjakan.

---

## 6. Yang sengaja tidak diubah

- **Seam adapter data** (`src/lib/data`) tetap: dua adapter nyata sudah cukup
  alasan, dan menambah adapter Supabase atau D1 cukup mengisi seam yang sama.
- **`firestore.rules`** tidak dilonggarkan demi refactor. Perubahan rules hanya
  lewat T4 dan harus disertai skenario emulator baru.
- **Dial desain** ENERGY 1 / RHYTHM 2 / MOTION 1 dan token di `src/index.css`
  tetap, termasuk aturan tanpa em dash dan target sentuh 44px.
- **Login mode lokal** tetap disebut sebagai alat demo di dokumentasi, bukan
  pengganti autentikasi server.
- **Grafik laporan** tetap `React.lazy`, karena memisahkan bundel sudah berhasil.

---

## 7. Risiko

| Risiko | Dampak | Mitigasi |
| :--- | :--- | :--- |
| Payload audit berubah tanpa sengaja | Rules menolak tulisan, atau audit lama tidak terbaca | Bandingkan payload sebelum dan sesudah pindah, tes memeriksa `actorId` dan `createdAt` |
| Refactor view merusak tampilan | Regresi visual tanpa tes | Move-only, satu view per tiket, cek dev server tiap peran |
| Hook data mengubah perilaku memuat | Layar kosong sesaat atau galat tak tampil | Hook wajib mengembalikan `memuat` dan `galat`, dan view wajib memakainya |
| Dua penulisan berjalan bersamaan | Saldo poin tidak konsisten | Semua penulisan poin lewat C3 dengan satu batch |
| Refactor berhenti di tengah | `App.tsx` setengah terpecah | Urutan tiket menjaga `App.tsx` hijau di setiap langkah |

---

## 8. Langkah pertama yang disarankan

Mulai dari **T0** dan **T1**. Keduanya kecil, tidak mengubah perilaku, dan
langsung mengurangi risiko: tipe domain pindah ke satu tempat, module mati
hilang, dan data santri fiktif berhenti ikut ke bundel produksi. Setelah itu
**T2 (prestasi)** jadi bukti pertama bahwa pola module fitur bekerja, sebelum
diterapkan ke jurnal dan poin yang lebih besar.
