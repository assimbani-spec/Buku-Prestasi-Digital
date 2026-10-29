# BKP Digital — Sistem Buku Kejar Prestasi
### SMK Thibbil Qulub Assimbani

Aplikasi modern untuk digitalisasi buku catatan pembiasaan santri/siswa, pencatatan poin karakter (apresiasi & konsekuensi), rekapitulasi kehadiran sholat 5 waktu, dan pengesahan tanda tangan digital oleh orang tua.

---

## 🛠️ Tech Stack
- **Framework**: Next.js 14 App Router + TypeScript
- **Styling**: Tailwind CSS (Desain Hijau-Putih sesuai identitas SMK Thibbil Qulub Assimbani)
- **Backend / Database**: Supabase JS Client (`@supabase/supabase-js`)
- **Icon**: Lucide React
- **Digital Signature**: `react-signature-canvas`

---

## 🎨 Design System
- Header & Sidebar: `bg-green-900` (`#1B5E20`)
- Tombol Utama & Aksen: `bg-green-700` (`#2E7D32`)
- Background Halaman: `bg-green-100` (`#E8F5E9`)
- Card & Surface: `bg-white` (`#FFFFFF`)
- Pelanggaran / Konsekuensi: `text-red-500` (`#EF4444`)
- Apresiasi / Reward: `text-yellow-500` (`#EAB308`)
- Typography: Font **Poppins** (Google Fonts)

---

## 👥 3 Role Utama & URL Akses
1. **Siswa** (`/siswa`) — Tampilan Mobile-First:
   - Header hijau dengan sapaan, nama, kelas, rayon, dan saldo poin
   - Form Jurnal Harian: Checkbox 5 waktu sholat fardhu (Subuh, Dzuhur, Ashar, Maghrib, Isya) + 3 pembiasaan karakter (Mengaji, Bangun Subuh, Grooming)
   - Tombol "Simpan Jurnal" langsung tersimpan ke Supabase / local state
   - Bottom Nav: Home, Jurnal, Poin, Profil

2. **Orang Tua / Wali** (`/ortu`) — Tampilan Mobile-First:
   - Header hijau sapaan ortu & nama ananda
   - Card Rekap Mingguan: jumlah hari penuh, izin sakit, haid/udzur
   - Area Tanda Tangan Digital interaktif dengan kanvas sentuh
   - Pengesahan langsung tersimpan ke Supabase Storage bucket `ttd`
   - Card Peringatan & Pelanggaran ananda

3. **Guru / Konselor BK** (`/guru`) — Tampilan Desktop Layout:
   - Sidebar hijau kiri: Menu Dashboard, Input Poin, Daftar Siswa, Logout
   - 3 Card Statistik: Total Siswa, Poin Apresiasi Hari Ini, Kasus Pelanggaran Minggu Ini
   - Form Input Poin: Dropdown pilih siswa + pilih kode (A1.1, K1.31, dll) + auto update saldo
   - Tabel 10 siswa terbaru dengan indikator predikat karakter

---

## 🗄️ Akun Default Demo (Seed Data)
| Role | Email | Password | Keterangan |
| :--- | :--- | :--- | :--- |
| **Siswa 1** | `siswa1@test.com` | `rahasia123` | Muhammad Faiz (X Farmasi A) |
| **Siswa 2** | `siswa2@test.com` | `rahasia123` | Aisyah Nurul Qulub (XI Keperawatan B) |
| **Orang Tua** | `ortu1@test.com` | `rahasia123` | Bapak Ahmad Rifa'i (Wali Faiz) |
| **Guru / BK** | `guru1@test.com` | `rahasia123` | Ustadz Hendra Gunawan, S.Pd.I |

---

## 🚀 CHECKLIST SETUP (8 LANGKAH SIAP JALAN)

1. **Clone & Buka Direktori Project**
   ```bash
   cd bkp-digital
   ```

2. **Install Seluruh Dependensi**
   ```bash
   npm install
   ```

3. **Buat File Konfigurasi `.env.local`**
   Salin dari template `.env.local.example`:
   ```bash
   cp .env.local.example .env.local
   ```

4. **Isi Kredensial Supabase di `.env.local`**
   Buka dashboard project Supabase Anda (`https://app.supabase.com`), ke menu **Project Settings -> API**, lalu salin:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT_REF].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

5. **Jalankan SQL Migration di Supabase**
   - Buka **SQL Editor** pada Dashboard Supabase Anda.
   - Buat query baru, salin seluruh isi file `supabase/migration.sql`.
   - Klik **RUN**. Seluruh tabel (`profiles`, `pembiasaan_harian`, `pembiasaan_mingguan`, `poin_log`, `notifikasi`, `master_kode_poin`), trigger auth, bucket `ttd`, RLS policy, serta 4 user demo otomatis terbuat.

6. **Konfirmasi Storage Bucket `ttd`**
   Pastikan bucket bernama `ttd` pada menu **Storage** Supabase memiliki akses **Public** agar foto tanda tangan digital orang tua dapat dimuat.

7. **Jalankan Server Development**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:3000`.

8. **Uji Coba Login dengan 3 Role**
   - Buka `http://localhost:3000`.
   - Gunakan tombol **1-Klik Masuk** di halaman login untuk langsung menguji dashboard Siswa, Orang Tua, atau Guru, atau ketikkan email & password demo di atas.
