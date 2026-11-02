/**
 * Pemilihan backend data.
 *
 * `VITE_DATA_BACKEND=local` (default) memakai localStorage di peramban.
 * `VITE_DATA_BACKEND=firestore` memakai Firestore seperti sebelumnya.
 *
 * Tambahkan variabel ini di `.env.local` (jangan di-commit) bila ingin
 * berpindah backend. Lihat `docs/data-backend.md`.
 */

export type DataBackend = 'local' | 'firestore';

const raw = String((import.meta as any)?.env?.VITE_DATA_BACKEND ?? '').trim();

/**
 * Nilai yang tidak dikenal tidak boleh jatuh diam-diam ke localStorage pada
 * build produksi: data sekolah akan tersimpan di peramban tanpa terlihat.
 */
if (raw && raw !== 'local' && raw !== 'firestore') {
  console.warn(
    `VITE_DATA_BACKEND="${raw}" tidak dikenal. Nilai yang dipakai: local. ` +
      'Pilihan yang tersedia: local, firestore.'
  );
}

export const DATA_BACKEND: DataBackend =
  raw === 'firestore' ? 'firestore' : raw === 'local' ? 'local' : 'local';

export const isLocalBackend = DATA_BACKEND === 'local';
