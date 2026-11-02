/**
 * Bootstrap data mode lokal.
 *
 * Dua hal dipisah dengan sengaja:
 *
 * 1. `pastikanAdminAwal` selalu berjalan. Basis data kosong mendapat satu akun
 *    administrator, karena tanpa akun tidak ada yang bisa masuk untuk membuat
 *    akun lain.
 * 2. `siapkanDataAwal` menambahkan data contoh hanya bila `VITE_LOCAL_SEED=demo`.
 *    Data santri fiktif tidak ikut ke bundel utama karena modulnya diimpor
 *    dinamis di sini.
 *
 * Kata sandi akun awal dipakai bersama oleh seed demo dan diumumkan di halaman
 * login, jadi ganti lewat panel admin sebelum aplikasi dipakai bersama.
 */

import { collection, doc, getDoc, getDocs, isLocalBackend, setDoc, LocalTimestamp } from './index';
import { hashPassword } from '../localAuth';

export const LOCAL_SEED_PASSWORD = 'bkp12345';

/** Akun administrator yang dibuat saat basis data lokal masih kosong. */
export const ADMIN_AWAL = {
  uid: 'lokal-admin',
  email: 'admin@lokal.test',
  fullName: 'Admin BKP',
  role: 'admin' as const,
};

const ADMIN_MARKER = 'meta/admin_awal';
const dbToken = null as unknown as never;

/** Seed demo aktif hanya bila variabel lingkungannya disetel eksplisit. */
export const DEMO_SEED_ENABLED =
  ((import.meta as any)?.env?.VITE_LOCAL_SEED ?? '') === 'demo';

/**
 * Membuat akun administrator pertama bila belum ada profil sama sekali.
 * Dipanggil sebelum sesi dipulihkan dan sebelum login mode lokal.
 */
export async function pastikanAdminAwal(): Promise<void> {
  if (!isLocalBackend) return;

  const marker = await getDoc(doc(dbToken, 'meta', ADMIN_MARKER));
  if (marker.exists()) return;

  const profiles = await getDocs(collection(dbToken, 'profiles'));
  if (profiles.empty) {
    const credential = await hashPassword(LOCAL_SEED_PASSWORD);
    await setDoc(doc(dbToken, 'profiles', ADMIN_AWAL.uid), {
      uid: ADMIN_AWAL.uid,
      email: ADMIN_AWAL.email,
      fullName: ADMIN_AWAL.fullName,
      role: ADMIN_AWAL.role,
      active: true,
      ...credential,
      total_poin: 0,
      createdAt: new LocalTimestamp(Date.now()),
    });
  }

  await setDoc(
    doc(dbToken, 'meta', ADMIN_MARKER),
    { checkedAt: new LocalTimestamp(Date.now()) },
    { merge: true }
  );
}

/** Menyiapkan data awal mode lokal: admin wajib, data demo bila diminta. */
export async function siapkanDataAwal(): Promise<void> {
  if (!isLocalBackend) return;
  await pastikanAdminAwal();
  if (!DEMO_SEED_ENABLED) return;
  const modul = await import('./seedDemo');
  await modul.seedDemo();
}
