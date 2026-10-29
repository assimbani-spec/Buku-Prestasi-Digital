-- ═══════════════════════════════════════════════════════════════════
-- BKP DIGITAL — SISTEM BUKU KEJAR PRESTASI
-- SMK THIBBIL QULUB ASSIMBANI
-- SQL MIGRATION: TABLES, RLS, TRIGGERS, STORAGE, & SEED DATA
-- ═══════════════════════════════════════════════════════════════════

-- Aktifkan ekstensi pgcrypto untuk uuid & hashing password jika belum ada
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABEL: PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('siswa', 'orang_tua', 'guru')),
    kelas TEXT,
    rayon TEXT,
    anak_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Relasi khusus untuk role orang_tua
    avatar_url TEXT,
    total_poin INT DEFAULT 1000, -- Standar awal poin karakter
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABEL: PEMBIASAAN_HARIAN (Jurnal Harian Siswa)
CREATE TABLE IF NOT EXISTS public.pembiasaan_harian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    tahajud TEXT DEFAULT 'tidak', -- '4_rakaat', '2_rakaat', 'tidak', 'menstruasi'
    dhuha TEXT DEFAULT 'tidak',   -- '4_rakaat', '2_rakaat', 'tidak', 'menstruasi'
    subuh BOOLEAN NOT NULL DEFAULT FALSE,
    dzuhur BOOLEAN NOT NULL DEFAULT FALSE,
    ashar BOOLEAN NOT NULL DEFAULT FALSE,
    maghrib BOOLEAN NOT NULL DEFAULT FALSE,
    isya BOOLEAN NOT NULL DEFAULT FALSE,
    sholat_berjamaah BOOLEAN NOT NULL DEFAULT TRUE,
    mengaji BOOLEAN NOT NULL DEFAULT FALSE,
    zikir_pagi BOOLEAN NOT NULL DEFAULT FALSE,
    zikir_sore BOOLEAN NOT NULL DEFAULT FALSE,
    bangun_subuh BOOLEAN NOT NULL DEFAULT FALSE,
    grooming BOOLEAN NOT NULL DEFAULT FALSE,
    tidur_awal BOOLEAN NOT NULL DEFAULT FALSE, -- Tidur Sebelum Pukul 22.00
    air_putih BOOLEAN NOT NULL DEFAULT FALSE,  -- Minum Air Putih 1,5-2L
    mandi_2x BOOLEAN NOT NULL DEFAULT FALSE,   -- Mandi 2 kali setiap hari
    kelompok_belajar BOOLEAN NOT NULL DEFAULT FALSE, -- Aktif dlm kelompok belajar
    sedang_menstruasi BOOLEAN NOT NULL DEFAULT FALSE,
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (siswa_id, tanggal)
);

-- 3. TABEL: PEMBIASAAN_MINGGUAN (Rekap Mingguan & TTD Orang Tua)
CREATE TABLE IF NOT EXISTS public.pembiasaan_mingguan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    minggu_ke INT NOT NULL,
    tahun INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    sholat_jumat_keputrian BOOLEAN NOT NULL DEFAULT FALSE, -- Sholat Jumat / Keputrian
    puasa_sunnah BOOLEAN NOT NULL DEFAULT FALSE,           -- Puasa Sunnah
    berinfak BOOLEAN NOT NULL DEFAULT FALSE,               -- Berinfak
    tablet_tambah_darah BOOLEAN NOT NULL DEFAULT FALSE,    -- Tablet Tambah Darah / Vit.
    olahraga BOOLEAN NOT NULL DEFAULT FALSE,               -- Olahraga Minimal 15 Menit
    keramas_2x BOOLEAN NOT NULL DEFAULT FALSE,             -- Keramas min. 2x Seminggu
    kebersihan_diri BOOLEAN NOT NULL DEFAULT FALSE,        -- Kuku, Telinga, dan Bercukur
    piket_rayon BOOLEAN NOT NULL DEFAULT FALSE,            -- Piket Rayon
    daur_ulang BOOLEAN NOT NULL DEFAULT FALSE,             -- Bawa Bahan Daur Ulang
    ekstrakurikuler BOOLEAN NOT NULL DEFAULT FALSE,        -- Ekstrakurikuler
    seni_budaya BOOLEAN NOT NULL DEFAULT FALSE,            -- Seni Budaya
    kumpul_rayon BOOLEAN NOT NULL DEFAULT FALSE,           -- Kumpul Rayon
    ttd_ortu BOOLEAN NOT NULL DEFAULT FALSE,
    ttd_url TEXT,
    catatan_ortu TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (siswa_id, minggu_ke, tahun)
);

-- 4. TABEL: POIN_LOG (Catatan Apresiasi & Konsekuensi)
CREATE TABLE IF NOT EXISTS public.poin_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tipe TEXT NOT NULL CHECK (tipe IN ('apresiasi', 'konsekuensi')),
    kode TEXT NOT NULL,
    deskripsi TEXT NOT NULL,
    poin INT NOT NULL,
    dicatat_oleh UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABEL REFERENSI: MASTER KODE POIN
CREATE TABLE IF NOT EXISTS public.master_kode_poin (
    kode TEXT PRIMARY KEY,
    tipe TEXT NOT NULL CHECK (tipe IN ('apresiasi', 'konsekuensi')),
    kategori TEXT NOT NULL,
    deskripsi TEXT NOT NULL,
    poin INT NOT NULL
);

-- 5. TABEL: NOTIFIKASI
CREATE TABLE IF NOT EXISTS public.notifikasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    judul TEXT NOT NULL,
    pesan TEXT NOT NULL,
    tipe TEXT NOT NULL DEFAULT 'info', -- 'info', 'reward', 'warning', 'reminder'
    sudah_dibaca BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABEL: BORANG_KESEHATAN (Skrining Pengukuran Fisik, Gigi, & Penyakit Hal 72 & 116)
CREATE TABLE IF NOT EXISTS public.borang_kesehatan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    periode TEXT NOT NULL, -- Contoh: 'MEB 1 s.d 9 Periode STS Ganjil'
    tanggal_periksa DATE DEFAULT CURRENT_DATE,
    tinggi_badan NUMERIC(5,2) NOT NULL,     -- cm
    berat_badan NUMERIC(5,2) NOT NULL,      -- kg
    tekanan_darah TEXT NOT NULL,            -- mmHg
    lingkar_pinggang NUMERIC(5,2) NOT NULL, -- cm
    gigi_berlubang BOOLEAN NOT NULL DEFAULT FALSE,
    karang_gigi BOOLEAN NOT NULL DEFAULT FALSE,
    gusi_bengkak BOOLEAN NOT NULL DEFAULT FALSE,
    gusi_berdarah BOOLEAN NOT NULL DEFAULT FALSE,
    riwayat_pingsan INT NOT NULL DEFAULT 0,
    riwayat_mimisan INT NOT NULL DEFAULT 0,
    riwayat_kejang INT NOT NULL DEFAULT 0,
    riwayat_rawat_rs INT NOT NULL DEFAULT 0,
    catatan_pjok_uks TEXT,
    ttd_ortu BOOLEAN DEFAULT FALSE,
    ttd_pembimbing BOOLEAN DEFAULT FALSE,
    ttd_pembina_uks BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TABEL: KUNJUNGAN_UKS (Buku Catatan Masuk & Pertolongan UKS Sekolah)
CREATE TABLE IF NOT EXISTS public.kunjungan_uks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    jam_masuk TIME NOT NULL,
    jam_keluar TIME NOT NULL,
    penyebab TEXT NOT NULL,
    tindak_lanjut TEXT NOT NULL,
    petugas_uks TEXT NOT NULL,
    paraf BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. TABEL: KALENDER_MENSTRUASI (Khusus Siswi Muslimah Hal 120)
CREATE TABLE IF NOT EXISTS public.kalender_menstruasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    bulan TEXT NOT NULL,
    tgl_mulai DATE NOT NULL,
    tgl_selesai DATE NOT NULL,
    banyaknya_hari INT NOT NULL,
    jarak_siklus INT NOT NULL,
    paraf_ortu BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. TABEL: DAFTAR_PRESTASI (Hal 114)
CREATE TABLE IF NOT EXISTS public.daftar_prestasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    kejuaraan_lomba TEXT NOT NULL,
    tingkat TEXT NOT NULL, -- 'Sekolah', 'Kecamatan', 'Kabupaten', 'Provinsi', 'Nasional'
    capaian TEXT NOT NULL,
    poin INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pembiasaan_harian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pembiasaan_mingguan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poin_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_kode_poin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifikasi ENABLE ROW LEVEL SECURITY;

-- Policy Profiles: Semua user login bisa membaca profil (untuk demo & relasi guru-siswa-ortu)
CREATE POLICY "Profiles dapat dibaca oleh user login" 
    ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "User dapat update profil sendiri" 
    ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Policy Pembiasaan Harian
CREATE POLICY "Semua user login dapat membaca pembiasaan harian" 
    ON public.pembiasaan_harian FOR SELECT TO authenticated USING (true);

CREATE POLICY "Siswa dapat insert/upsert jurnal harian sendiri" 
    ON public.pembiasaan_harian FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = siswa_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'guru'));

CREATE POLICY "Siswa dapat update jurnal harian sendiri" 
    ON public.pembiasaan_harian FOR UPDATE TO authenticated 
    USING (auth.uid() = siswa_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'guru'));

-- Policy Pembiasaan Mingguan
CREATE POLICY "Semua user login dapat membaca pembiasaan mingguan" 
    ON public.pembiasaan_mingguan FOR SELECT TO authenticated USING (true);

CREATE POLICY "User authenticated dapat insert pembiasaan mingguan" 
    ON public.pembiasaan_mingguan FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = siswa_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('guru', 'orang_tua')));

CREATE POLICY "User authenticated dapat update pembiasaan mingguan" 
    ON public.pembiasaan_mingguan FOR UPDATE TO authenticated 
    USING (auth.uid() = siswa_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('guru', 'orang_tua')));

-- Policy Poin Log
CREATE POLICY "Semua user login dapat membaca riwayat poin" 
    ON public.poin_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Guru dapat menambahkan catatan poin" 
    ON public.poin_log FOR INSERT TO authenticated 
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'guru') OR auth.uid() IS NOT NULL);

-- Policy Master Kode Poin
CREATE POLICY "Master kode poin dapat dibaca publik login" 
    ON public.master_kode_poin FOR SELECT TO authenticated USING (true);

-- Policy Notifikasi
CREATE POLICY "User dapat membaca notifikasi miliknya" 
    ON public.notifikasi FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "User dapat update status notifikasi miliknya" 
    ON public.notifikasi FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Sistem/Guru dapat mengirim notifikasi" 
    ON public.notifikasi FOR INSERT TO authenticated WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER SIGNUP AUTH.USERS -> PROFILES
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, kelas, rayon, avatar_url, total_poin)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'role', 'siswa'),
        new.raw_user_meta_data->>'kelas',
        new.raw_user_meta_data->>'rayon',
        new.raw_user_meta_data->>'avatar_url',
        COALESCE((new.raw_user_meta_data->>'total_poin')::int, 1000)
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        kelas = EXCLUDED.kelas,
        rayon = EXCLUDED.rayon;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- TRIGGER AUTO-UPDATE TOTAL POIN SISWA SAAT POIN_LOG DITAMBAHKAN
CREATE OR REPLACE FUNCTION public.update_student_total_poin()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.tipe = 'apresiasi') THEN
        UPDATE public.profiles
        SET total_poin = total_poin + NEW.poin
        WHERE id = NEW.siswa_id;
    ELSIF (NEW.tipe = 'konsekuensi') THEN
        UPDATE public.profiles
        SET total_poin = total_poin - ABS(NEW.poin)
        WHERE id = NEW.siswa_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_poin_log_inserted ON public.poin_log;
CREATE TRIGGER on_poin_log_inserted
    AFTER INSERT ON public.poin_log
    FOR EACH ROW EXECUTE PROCEDURE public.update_student_total_poin();

-- ═══════════════════════════════════════════════════════════════════
-- STORAGE BUCKET 'ttd' (Tanda Tangan Digital)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public) 
VALUES ('ttd', 'ttd', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public & Auth Read TTD Images" 
    ON storage.objects FOR SELECT USING (bucket_id = 'ttd');

CREATE POLICY "Authenticated Users Upload TTD" 
    ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ttd');

-- ═══════════════════════════════════════════════════════════════════
-- SEED DATA: MASTER KODE APRESIASI & KONSEKUENSI LENGKAP
-- Sesuai Buku Kejar Prestasi (BKP) SMK Thibbil Qulub Assimbani
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO public.master_kode_poin (kode, tipe, kategori, deskripsi, poin) VALUES
-- APRESIASI & PRESTASI
('A1.1', 'apresiasi', 'Ibadah', 'Sholat berjamaah tepat waktu 5 waktu berturut-turut di masjid', 200),
('A1.2', 'apresiasi', 'Ibadah', 'Rutin sholat dhuha & qiyamul lail / tahajjud', 150),
('A1.3', 'apresiasi', 'Ibadah', 'Dzikir pagi-petang (Al-Ma''tsurat) & membaca Al-Waqiah/Al-Mulk', 100),
('A2.1', 'apresiasi', 'Prestasi Lomba', 'Juara 1 Lomba Tingkat Nasional / Provinsi / Kabupaten', 1000),
('A2.2', 'apresiasi', 'Prestasi Lomba', 'Juara 2 atau 3 Lomba Tingkat Provinsi / Kabupaten', 500),
('A2.3', 'apresiasi', 'Prestasi Lomba', 'Peserta aktif mewakili sekolah dalam kejuaraan / olimpiade', 250),
('A3.1', 'apresiasi', 'Tahfidz & Quran', 'Setoran hafalan Al-Quran 1 Juz mutqin lancar', 500),
('A3.2', 'apresiasi', 'Tahfidz & Quran', 'Setoran surat pilihan / hafalan Hadits Arba''in Nawawiyah', 250),
('A3.10', 'apresiasi', 'Kedisiplinan', 'Hafalan Al-Quran & pembiasaan harian teratur selama 1 pekan penuh', 300),
('A4.1', 'apresiasi', 'Organisasi & Karakter', 'Pengurus OSIS / MPK / Ketua Rayon yang berdedikasi tinggi', 350),
('A4.2', 'apresiasi', 'Organisasi & Karakter', 'Panitia aktif kegiatan PHBI / kegiatan sosial / bakti asrama', 200),
('A5.1', 'apresiasi', 'Karakter & Lingkungan', 'Santri teladan kedisiplinan, kerapian grooming & adab santun', 300),
('A5.2', 'apresiasi', 'Peduli Lingkungan', 'Membawa bahan daur ulang terbanyak / inisiator bank sampah', 150),
('A5.3', 'apresiasi', 'Sosial & Infaq', 'Rutin berinfak Jumat & santunan teman yang membutuhkan', 150),

-- KONSEKUENSI & PELANGGARAN
('K1.1', 'konsekuensi', 'Ibadah', 'Terlambat sholat berjamaah / bangun kesiangan', 50),
('K1.2', 'konsekuensi', 'Ibadah', 'Masbuk atau tidak sholat berjamaah di masjid tanpa udzur', 75),
('K1.3', 'konsekuensi', 'Ibadah', 'Tidak mengikuti Sholat Jumat (putra) / Keputrian (putri)', 150),
('K2.1', 'konsekuensi', 'Kesehatan & Disiplin', 'Tidur lewat pukul 22.00 WIB / begadang tanpa izin wali asrama', 50),
('K2.2', 'konsekuensi', 'Kesehatan & Disiplin', 'Tidak memenuhi target minum air putih 1,5 - 2 Liter sehari', 25),
('K2.3', 'konsekuensi', 'Kerapian & Grooming', 'Tidak keramas min 2x / kuku panjang / rambut tidak rapi', 50),
('K3.1', 'konsekuensi', 'Rayon & Lingkungan', 'Tidak melaksanakan piket rayon / kamar dan lemari berantakan', 100),
('K3.2', 'konsekuensi', 'Rayon & Lingkungan', 'Tidak membawa bahan daur ulang pekanan yang ditentukan', 50),
('K3.3', 'konsekuensi', 'Rayon & Lingkungan', 'Tidak menghadiri kumpul rayon / evaluasi asrama tanpa izin', 100),
('K4.18', 'konsekuensi', 'Kedisiplinan Sekolah', 'Atribut seragam tidak lengkap / kopyah / jilbab tidak rapi saat apel', 150),
('K4.2', 'konsekuensi', 'Kegiatan Sekolah', 'Membolos kegiatan ekstrakurikuler atau seni budaya wajib', 100),
('K1.31', 'konsekuensi', 'Pelanggaran Berat', 'Pelanggaran kedisiplinan asrama berat / meninggalkan buku BKP', 300)
ON CONFLICT (kode) DO UPDATE SET
    tipe = EXCLUDED.tipe,
    kategori = EXCLUDED.kategori,
    deskripsi = EXCLUDED.deskripsi,
    poin = EXCLUDED.poin;

-- ═══════════════════════════════════════════════════════════════════
-- SEED DATA: DUMMY USERS DI AUTH.USERS & PROFILES
-- Catatan: Password terenkripsi dengan crypt('rahasia123', gen_salt('bf'))
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
    uid_siswa1 UUID := 'a1111111-1111-1111-1111-111111111111';
    uid_siswa2 UUID := 'a2222222-2222-2222-2222-222222222222';
    uid_ortu1  UUID := 'b1111111-1111-1111-1111-111111111111';
    uid_guru1  UUID := 'c1111111-1111-1111-1111-111111111111';
BEGIN
    -- 1. SISWA 1
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        uid_siswa1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'siswa1@test.com', crypt('rahasia123', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name":"Muhammad Faiz Assimbani","role":"siswa","kelas":"X Farmasi A","rayon":"Assimbani 1","total_poin":1200}',
        now(), now()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, full_name, role, kelas, rayon, total_poin)
    VALUES (uid_siswa1, 'Muhammad Faiz Assimbani', 'siswa', 'X Farmasi A', 'Assimbani 1', 1200)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, total_poin = 1200;

    -- 2. SISWA 2
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        uid_siswa2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'siswa2@test.com', crypt('rahasia123', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name":"Aisyah Nurul Qulub","role":"siswa","kelas":"XI Keperawatan B","rayon":"Siti Khadijah 2","total_poin":950}',
        now(), now()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, full_name, role, kelas, rayon, total_poin)
    VALUES (uid_siswa2, 'Aisyah Nurul Qulub', 'siswa', 'XI Keperawatan B', 'Siti Khadijah 2', 950)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, total_poin = 950;

    -- 3. ORANG TUA 1 (Wali dari Muhammad Faiz)
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        uid_ortu1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'ortu1@test.com', crypt('rahasia123', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name":"Bapak Ahmad Rifa''i (Wali Faiz)","role":"orang_tua","anak_id":"a1111111-1111-1111-1111-111111111111"}',
        now(), now()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, full_name, role, anak_id)
    VALUES (uid_ortu1, 'Bapak Ahmad Rifa''i (Wali Faiz)', 'orang_tua', uid_siswa1)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, anak_id = uid_siswa1;

    -- 4. GURU / BK 1
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        uid_guru1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'guru1@test.com', crypt('rahasia123', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name":"Ustadz Hendra Gunawan, S.Pd.I (BK/Kesiswaan)","role":"guru"}',
        now(), now()
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, full_name, role)
    VALUES (uid_guru1, 'Ustadz Hendra Gunawan, S.Pd.I (BK/Kesiswaan)', 'guru')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

    -- DUMMY PEMBIASAAN HARIAN SISWA 1 (Hari ini)
    INSERT INTO public.pembiasaan_harian (
        siswa_id, tanggal, subuh, dzuhur, ashar, maghrib, isya, mengaji, bangun_subuh, grooming, catatan
    ) VALUES (
        uid_siswa1, CURRENT_DATE, true, true, true, false, false, true, true, true, 'Sholat tepat waktu di Masjid Assimbani'
    ) ON CONFLICT (siswa_id, tanggal) DO NOTHING;

    -- DUMMY POIN LOG SISWA 1 & 2
    INSERT INTO public.poin_log (siswa_id, tipe, kode, deskripsi, poin, dicatat_oleh) VALUES
    (uid_siswa1, 'apresiasi', 'A1.1', 'Sholat berjamaah tepat waktu 5 waktu berturut-turut', 200, uid_guru1),
    (uid_siswa1, 'konsekuensi', 'K4.18', 'Atribut kopyah tertinggal di asrama saat apel', 150, uid_guru1),
    (uid_siswa2, 'apresiasi', 'A3.10', 'Hafalan Surat Al-Waqiah lancar', 300, uid_guru1),
    (uid_siswa2, 'konsekuensi', 'K1.1', 'Terlambat masuk halaqoh Subuh 10 menit', 50, uid_guru1)
    ON CONFLICT DO NOTHING;

    -- DUMMY NOTIFIKASI
    INSERT INTO public.notifikasi (user_id, judul, pesan, tipe) VALUES
    (uid_siswa1, 'Poin Apresiasi Ditambahkan', 'Selamat! Anda memperoleh +200 poin atas sholat berjamaah tepat waktu.', 'reward'),
    (uid_ortu1, 'Laporan Pembiasaan Minggu Ini', 'Muhammad Faiz telah menyelesaikan 92% target ibadah pekan ini. Mohon berikan tanda tangan digital.', 'info'),
    (uid_guru1, 'Selamat Datang di BKP Digital', 'Sistem siap digunakan untuk input poin dan monitoring pembiasaan karakter santri SMK.', 'info')
    ON CONFLICT DO NOTHING;

END $$;
