-- Skema awal BKP Digital untuk Cloudflare D1 (SQLite).
--
-- Jalankan sekali:
--   wrangler d1 execute bkp-digital --file=cloudflare/schema.sql
--
-- D1 tidak punya autentikasi atau RLS. Semua pemeriksaan peran dan kepemilikan
-- WAJIB dilakukan di Worker sebelum query dijalankan. Jangan pernah memberi
-- akses D1 langsung ke peramban.

pragma foreign_keys = on;

create table if not exists profiles (
  id            text primary key,
  email         text not null unique,
  full_name     text not null,
  role          text not null check (role in ('siswa', 'guru', 'pembimbing_rayon', 'orang_tua', 'admin')),
  active        integer not null default 1,
  password_hash text,
  password_salt text,
  password_iterations integer,
  student_id    text,
  rayon_id      text,
  child_ids     text not null default '[]',
  total_poin    integer not null default 0,
  data          text not null default '{}',
  created_at    text not null default (datetime('now')),
  updated_at    text not null default (datetime('now'))
);

create table if not exists sessions (
  id          text primary key,
  user_id     text not null references profiles(id) on delete cascade,
  token_hash  text not null unique,
  expires_at  text not null,
  created_at  text not null default (datetime('now'))
);
create index if not exists sessions_user_idx on sessions (user_id);

create table if not exists login_attempts (
  email       text primary key,
  count       integer not null default 0,
  first_at    text not null,
  locked_until text
);

create table if not exists students (
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
  last_journal_date text,
  dibuat_oleh       text,
  data              text not null default '{}',
  created_at        text not null default (datetime('now')),
  updated_at        text not null default (datetime('now'))
);
create index if not exists students_rayon_idx on students (rayon);
create index if not exists students_nisn_idx on students (nisn);

create table if not exists poin_log (
  id          text primary key,
  siswa_id    text not null references students(id) on delete cascade,
  rayon       text,
  poin        integer not null,
  kategori    text,
  deskripsi   text,
  tanggal     text,
  created_by  text,
  data        text not null default '{}',
  created_at  text not null default (datetime('now'))
);
create index if not exists poin_log_siswa_idx on poin_log (siswa_id, created_at desc);

create table if not exists pembiasaan_harian (
  id          text primary key,
  siswa_id    text not null references students(id) on delete cascade,
  rayon       text,
  tanggal     text,
  poin        integer not null default 0,
  data        text not null default '{}',
  created_at  text not null default (datetime('now')),
  updated_at  text not null default (datetime('now'))
);

create table if not exists pembiasaan_non_rutin (
  id          text primary key,
  siswa_id    text not null references students(id) on delete cascade,
  rayon       text,
  tanggal     text,
  poin        integer not null default 0,
  data        text not null default '{}',
  created_at  text not null default (datetime('now')),
  updated_at  text not null default (datetime('now'))
);

create table if not exists pembiasaan_mingguan (
  id          text primary key,
  siswa_id    text not null references students(id) on delete cascade,
  rayon       text,
  pekan       text,
  data        text not null default '{}',
  created_at  text not null default (datetime('now')),
  updated_at  text not null default (datetime('now'))
);

create table if not exists prestasi (
  id              text primary key,
  siswa_id        text not null references students(id) on delete cascade,
  rayon           text,
  judul           text not null,
  kategori        text,
  tingkat         text,
  capaian         text,
  tanggal         text,
  deskripsi       text,
  status          text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  poin            integer not null default 0,
  created_by      text,
  verified_by     text,
  verified_at     text,
  catatan_verifikasi text,
  data            text not null default '{}',
  created_at      text not null default (datetime('now')),
  updated_at      text not null default (datetime('now'))
);
create index if not exists prestasi_status_idx on prestasi (status, created_at desc);

create table if not exists notifikasi (
  id          text primary key,
  user_id     text,
  siswa_id    text,
  judul       text,
  pesan       text,
  dibaca      integer not null default 0,
  data        text not null default '{}',
  created_at  text not null default (datetime('now'))
);
create index if not exists notifikasi_user_idx on notifikasi (user_id, created_at desc);

create table if not exists audit_log (
  id          text primary key,
  actor_id    text not null,
  actor_email text,
  actor_role  text,
  action      text not null,
  collection  text,
  doc_id      text,
  siswa_id    text,
  rayon       text,
  before      text,
  after       text,
  meta        text,
  created_at  text not null default (datetime('now'))
);
create index if not exists audit_created_idx on audit_log (created_at desc);

create table if not exists master_kelas (
  id          text primary key,
  nama        text not null,
  data        text not null default '{}',
  created_at  text not null default (datetime('now')),
  updated_at  text not null default (datetime('now'))
);

create table if not exists master_rayon (
  id          text primary key,
  nama        text not null,
  data        text not null default '{}',
  created_at  text not null default (datetime('now')),
  updated_at  text not null default (datetime('now'))
);

create table if not exists master_kategori_poin (
  id          text primary key,
  kode        text not null,
  tipe        text not null check (tipe in ('apresiasi', 'konsekuensi')),
  kategori    text,
  deskripsi   text,
  poin        integer not null default 0,
  data        text not null default '{}',
  created_at  text not null default (datetime('now')),
  updated_at  text not null default (datetime('now'))
);
