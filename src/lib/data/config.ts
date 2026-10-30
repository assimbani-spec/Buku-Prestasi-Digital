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

const raw = ((import.meta as any)?.env?.VITE_DATA_BACKEND ?? '') as string;

export const DATA_BACKEND: DataBackend =
  raw === 'firestore' ? 'firestore' : raw === 'local' ? 'local' : 'local';

export const isLocalBackend = DATA_BACKEND === 'local';
