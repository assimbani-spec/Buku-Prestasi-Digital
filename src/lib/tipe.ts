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
