/**
 * RBAC untuk BKP Digital.
 *
 * Satu sumber kebenaran untuk 5 peran, dipakai bersama oleh routing klien,
 * filter query Firestore, dan tampilan menu. Aturan yang SAMA juga
 * ditegakkan di firestore.rules - klien hanya lapisan kenyamanan, bukan
 * penjaga keamanan.
 */

export type Role = 'siswa' | 'orang_tua' | 'guru' | 'pembimbing_rayon' | 'admin';

export type AppRoute = 'login' | 'siswa' | 'ortu' | 'guru' | 'admin';

export const STAFF_ROLES: Role[] = ['guru', 'pembimbing_rayon', 'admin'];
const STAFF_ROLE_SET = new Set<string>(STAFF_ROLES);

export function isRole(value: unknown): value is Role {
  return (
    value === 'siswa' ||
    value === 'orang_tua' ||
    value === 'guru' ||
    value === 'pembimbing_rayon' ||
    value === 'admin'
  );
}

export function isStaffRole(role?: string | null): boolean {
  return !!role && STAFF_ROLE_SET.has(role);
}

export function isAdminRole(role?: string | null): boolean {
  return role === 'admin';
}

/** Guru, pembimbing rayon, dan admin boleh memverifikasi prestasi. */
export function canVerifyPrestasi(role?: string | null): boolean {
  return isStaffRole(role);
}

/** Hanya admin yang boleh mengelola master data (kelas, rayon, kategori poin). */
export function canManageMasterData(role?: string | null): boolean {
  return isAdminRole(role);
}

/** Hanya guru & admin yang boleh menambah/menghapus master santri. */
export function canCreateStudent(role?: string | null): boolean {
  return role === 'guru' || role === 'admin';
}

/** Guru & admin melihat semua santri; pembimbing rayon terbatas rayonnya. */
export function canSeeAllStudents(role?: string | null): boolean {
  return role === 'guru' || role === 'admin';
}

export function routeForRole(role?: string | null): AppRoute {
  if (role === 'admin') return 'admin';
  if (role === 'guru' || role === 'pembimbing_rayon') return 'guru';
  if (role === 'orang_tua') return 'ortu';
  return 'siswa';
}

export function roleLabel(role?: string | null): string {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'guru':
      return 'Guru / BK';
    case 'pembimbing_rayon':
      return 'Pembimbing Rayon';
    case 'orang_tua':
      return 'Orang Tua / Wali';
    case 'siswa':
      return 'Santri';
    default:
      return 'Pengguna';
  }
}

/** Bentuk minimal profil yang dibutuhkan helper di bawah. */
export interface ProfileLike {
  role?: string;
  studentId?: string;
  rayonId?: string;
  childIds?: string[];
  /** Warisan skema lama (sebelum RBAC 5 peran). */
  anak_id?: string;
  rayon?: string;
}

/** ID dokumen `students` milik akun siswa. Mendukung field lama `anak_id`. */
export function profileStudentId(profile?: ProfileLike | null): string {
  if (!profile) return '';
  return profile.studentId || profile.anak_id || '';
}

/** Daftar ID anak untuk akun orang tua. Mendukung field lama `anak_id`. */
export function profileChildIds(profile?: ProfileLike | null): string[] {
  if (!profile) return [];
  if (Array.isArray(profile.childIds) && profile.childIds.length > 0) {
    return profile.childIds.filter(Boolean);
  }
  return profile.anak_id ? [profile.anak_id] : [];
}

/** Nama rayon yang menjadi batas kewenangan pembimbing rayon. */
export function profileRayonId(profile?: ProfileLike | null): string {
  if (!profile) return '';
  return profile.rayonId || profile.rayon || '';
}

/**
 * Batas maksimum nilai untuk operator `in` Firestore.
 * Query `where(..., 'in', [...])` menolak lebih dari 30 nilai.
 */
export function chunkIn(values: string[], size = 10): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < values.length; i += size) {
    out.push(values.slice(i, i + size));
  }
  return out;
}
