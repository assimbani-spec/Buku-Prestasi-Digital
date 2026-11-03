/**
 * Tipe domain BKP Digital.
 *
 * Tipe di sini tidak bergantung pada Firebase maupun driver data mana pun,
 * sehingga module fitur bisa memakainya tanpa mengimpor konfigurasi backend.
 * Bentuk field mengikuti dokumen di `firestore.rules`.
 */

// User Profile Types - 5 peran (lihat src/lib/rbac.ts)
export type UserRole = 'siswa' | 'orang_tua' | 'guru' | 'pembimbing_rayon' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  /** siswa: ID dokumen `students` miliknya. */
  studentId?: string;
  /** pembimbing_rayon: nama rayon yang menjadi batas kewenangannya. */
  rayonId?: string;
  /** orang_tua: daftar ID dokumen `students` milik anak-anaknya. */
  childIds?: string[];
  kelas?: string;
  nisn?: string;
  /** @deprecated gunakan `rayonId` */
  rayon?: string;
  /** @deprecated gunakan `studentId` */
  anak_id?: string;
  /** @deprecated gunakan `childIds` */
  anak_nama?: string;
  total_poin?: number;
  phone?: string;
  emailVerified?: boolean;
  gender?: 'L' | 'P';
  createdAt?: any;
  updatedAt?: any;
}

// Student Data Interface for Guru Management
export interface StudentRecord {
  id: string;
  name: string;
  nisn: string;
  kelas: string;
  rayon: string;
  points: number;
  /** Jenis Kelamin: L = Laki-laki, P = Perempuan */
  gender?: 'L' | 'P';
  /** UID Firebase Authentication jika akun santri sudah ditautkan. */
  uid?: string;
  waliName?: string;
  waliPhone?: string;
  waliEmail?: string;
  studentEmail?: string;
  lastJournalDate?: string;
  createdAt?: string;
}

// Pengajuan prestasi: siswa mengajukan (pending), staf memverifikasi.
export type PrestasiStatus = 'pending' | 'verified' | 'rejected';

export interface PrestasiRecord {
  id: string;
  siswa_id: string;
  rayon: string;
  judul: string;
  kategori: string;
  tingkat: string;
  capaian: string;
  tanggal: string;
  /** Tahun pelajaran, misal: '2024/2025', '2025/2026' */
  tahunPelajaran?: string;
  /** Semester prestasi */
  semester?: 'Ganjil' | 'Genap';
  /** Nama santri (cache untuk kemudahan tampilan di tabel verifikasi guru) */
  nama_siswa?: string;
  /** Kelas santri saat mengajukan */
  kelas?: string;
  deskripsi?: string;
  status: PrestasiStatus;
  /** 0 selama pending; diisi staf saat verifikasi. */
  poin: number;
  createdBy: string;
  verifiedBy?: string;
  verifiedAt?: any;
  catatan_verifikasi?: string;
  createdAt?: any;
}

// Kalender & catatan siklus menstruasi untuk siswi perempuan
export interface MenstruasiRecord {
  id: string;
  siswa_id: string;
  nama_siswi?: string;
  kelas?: string;
  rayon?: string;
  tanggal_mulai: string;
  tanggal_selesai?: string | null;
  status: 'haid_aktif' | 'selesai_suci';
  minum_ttd?: boolean;
  keluhan?: string[];
  catatan?: string;
  dicatat_oleh?: string;
  createdAt?: any;
  updatedAt?: any;
}

// Jadwal Pelajaran (Senin s.d. Jumat)
export type HariSekolah = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat';

export interface JadwalPelajaranRecord {
  id: string;
  kelas: string;
  hari: HariSekolah;
  jam_mulai: string;
  jam_selesai: string;
  mata_pelajaran: string;
  guru_pengampu: string;
  ruang?: string;
  urutan?: number;
  catatan?: string;
}

// Entri audit log (append-only).
export interface AuditLogRecord {
  id: string;
  actorId: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  collection: string;
  docId: string;
  siswa_id?: string | null;
  rayon?: string | null;
  createdAt?: any;
}

