-- Skema awal BKP Digital untuk Supabase (Postgres).
--
-- Jalankan di SQL Editor proyek Supabase. Skema ini adalah titik awal migrasi:
-- field inti dinormalisasi, sedangkan field tambahan dokumen disimpan di kolom
-- `data` (jsonb) agar adapter tidak kehilangan apa pun saat migrasi.
--
-- Login memakai Supabase Auth. Hubungkan profil ke auth.users lewat auth_uid.
-- RLS di bawah ini memetakan aturan utama firestore.rules; sisa aturan per
-- peran wajib diuji sebelum produksi (lihat docs/migrasi-backend.md).

create extension if not exists "pgcrypto";

-- ── Profil ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            text primary key,
  auth_uid      uuid unique references auth.users(id) on delete cascade,
  email         text not null unique,
  full_name     text not null,
  role          text not null check (role in ('siswa', 'guru', 'pembimbing_rayon', 'orang_tua', 'admin')),
  active        boolean not null default true,
  student_id    text,
  rayon_id      text,
  child_ids     text[] not null default '{}',
  total_poin    integer not null default 0,
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Santri ────────────────────────────────────────────────────────────────
create table if not exists public.students (
  id                text primary key,
  name              text not null,
  nisn              text not null unique,
  kelas             text,
  rayon             text,
  points            integer not null default 0,
  wali_name         text,
  wali_phone        text,
  wali_email        text,
  student_email     text,
  last_journal_date date,
  dibuat_oleh       text,
  data              jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── Riwayat poin ──────────────────────────────────────────────────────────
create table if not exists public.poin_log (
  id          text primary key,
  siswa_id    text not null references public.students(id) on delete cascade,
  rayon       text,
  poin        integer not null,
  kategori    text,
  deskripsi   text,
  tanggal     date,
  created_by  text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists poin_log_siswa_idx on public.poin_log (siswa_id, created_at desc);

-- ── Jurnal pembiasaan ─────────────────────────────────────────────────────
create table if not exists public.pembiasaan_harian (
  id          text primary key,
  siswa_id    text not null references public.students(id) on delete cascade,
  rayon       text,
  tanggal     date,
  poin        integer not null default 0,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.pembiasaan_non_rutin (
  id          text primary key,
  siswa_id    text not null references public.students(id) on delete cascade,
  rayon       text,
  tanggal     date,
  poin        integer not null default 0,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.pembiasaan_mingguan (
  id          text primary key,
  siswa_id    text not null references public.students(id) on delete cascade,
  rayon       text,
  pekan       text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Prestasi ──────────────────────────────────────────────────────────────
create table if not exists public.prestasi (
  id              text primary key,
  siswa_id        text not null references public.students(id) on delete cascade,
  rayon           text,
  judul           text not null,
  kategori        text,
  tingkat         text,
  capaian         text,
  tanggal         date,
  deskripsi       text,
  status          text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  poin            integer not null default 0,
  created_by      text,
  verified_by     text,
  verified_at     timestamptz,
  catatan_verifikasi text,
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists prestasi_status_idx on public.prestasi (status, created_at desc);

-- ── Notifikasi ────────────────────────────────────────────────────────────
create table if not exists public.notifikasi (
  id          text primary key,
  user_id     text,
  siswa_id    text,
  judul       text,
  pesan       text,
  dibaca      boolean not null default false,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists notifikasi_user_idx on public.notifikasi (user_id, created_at desc);

-- ── Audit log ─────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id          text primary key,
  actor_id    text not null,
  actor_email text,
  actor_role  text,
  action      text not null,
  collection  text,
  doc_id      text,
  siswa_id    text,
  rayon       text,
  before      jsonb,
  after       jsonb,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_log (created_at desc);
create index if not exists audit_actor_idx on public.audit_log (actor_id, created_at desc);

-- ── Master data ───────────────────────────────────────────────────────────
create table if not exists public.master_kelas (
  id          text primary key,
  nama        text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.master_rayon (
  id          text primary key,
  nama        text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.master_kategori_poin (
  id          text primary key,
  kode        text not null,
  tipe        text not null check (tipe in ('apresiasi', 'konsekuensi')),
  kategori    text,
  deskripsi   text,
  poin        integer not null default 0,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Helper RLS ────────────────────────────────────────────────────────────
create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where auth_uid = auth.uid() limit 1;
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where auth_uid = auth.uid() and active limit 1;
$$;

create or replace function public.is_staf()
returns boolean
language sql
stable
as $$
  select public.current_role() in ('guru', 'pembimbing_rayon', 'admin');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_role() = 'admin';
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.poin_log enable row level security;
alter table public.pembiasaan_harian enable row level security;
alter table public.pembiasaan_non_rutin enable row level security;
alter table public.pembiasaan_mingguan enable row level security;
alter table public.prestasi enable row level security;
alter table public.notifikasi enable row level security;
alter table public.audit_log enable row level security;
alter table public.master_kelas enable row level security;
alter table public.master_rayon enable row level security;
alter table public.master_kategori_poin enable row level security;

-- Profil: pemilik membaca sendiri; staf membaca semua; hanya admin menulis.
create policy profiles_baca on public.profiles
  for select using (auth_uid = auth.uid() or public.is_staf());
create policy profiles_tulis on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Santri: staf, pembimbing rayonnya, santri sendiri, dan wali anaknya.
create policy students_baca on public.students
  for select using (
    public.is_staf()
    or id = (select student_id from public.current_profile())
    or id = any ((select child_ids from public.current_profile()))
  );
create policy students_tulis on public.students
  for all using (public.is_staf()) with check (public.is_staf());

-- Riwayat dan jurnal: staf, pemilik, dan wali.
create policy poin_log_baca on public.poin_log
  for select using (
    public.is_staf()
    or siswa_id = (select student_id from public.current_profile())
    or siswa_id = any ((select child_ids from public.current_profile()))
  );
create policy poin_log_tulis on public.poin_log
  for insert with check (public.is_staf());

-- Prestasi: santri mengajukan miliknya; staf membaca dan memutuskan.
create policy prestasi_baca on public.prestasi
  for select using (
    public.is_staf()
    or siswa_id = (select student_id from public.current_profile())
    or siswa_id = any ((select child_ids from public.current_profile()))
  );
create policy prestasi_ajukan on public.prestasi
  for insert with check (
    siswa_id = (select student_id from public.current_profile())
    and status = 'pending'
    and poin = 0
  );
create policy prestasi_putuskan on public.prestasi
  for update using (public.is_staf()) with check (public.is_staf());

-- Audit: hanya dibaca admin, ditulis oleh staf (aplikasi juga menulis saat
-- santri mengajukan prestasi, karena itu izinkan insert untuk pengguna aktif).
create policy audit_baca on public.audit_log
  for select using (public.is_admin());
create policy audit_tulis on public.audit_log
  for insert with check (auth.uid() is not null);

-- Notifikasi: hanya milik sendiri.
create policy notifikasi_baca on public.notifikasi
  for select using (user_id = (select id from public.current_profile()));
create policy notifikasi_tulis on public.notifikasi
  for update using (user_id = (select id from public.current_profile()))
  with check (user_id = (select id from public.current_profile()));

-- Master data: dibaca semua pengguna aktif, ditulis admin.
create policy master_kelas_baca on public.master_kelas for select using (auth.uid() is not null);
create policy master_kelas_tulis on public.master_kelas for all using (public.is_admin()) with check (public.is_admin());
create policy master_rayon_baca on public.master_rayon for select using (auth.uid() is not null);
create policy master_rayon_tulis on public.master_rayon for all using (public.is_admin()) with check (public.is_admin());
create policy master_kategori_baca on public.master_kategori_poin for select using (auth.uid() is not null);
create policy master_kategori_tulis on public.master_kategori_poin for all using (public.is_admin()) with check (public.is_admin());
