/**
 * Penjaga percobaan login.
 *
 * Autentikasi lokal berjalan di peramban, jadi tidak ada server yang bisa
 * membatasi percobaan kata sandi. Penjaga ini menyimpan hitungan percobaan
 * gagal per email di perangkat yang sama, sehingga tebak-tebakan cepat berhenti
 * setelah beberapa kali. Ini bukan pengganti rate limit di server: pada mode
 * Supabase, Firestore, atau Cloudflare, batas yang mengikat tetap ada di sisi
 * server.
 *
 * Aturan:
 *  - maksimal 5 percobaan gagal dalam 15 menit;
 *  - bila terlampaui, email itu dikunci 5 menit;
 *  - login berhasil menghapus catatan email tersebut.
 */

import { normalizeEmail } from './localAuth';

export const MAKS_PERCOBAAN = 5;
export const JENDELA_MS = 15 * 60 * 1000;
export const KUNCI_MS = 5 * 60 * 1000;

const GUARD_KEY = 'bkp.loginguard.v1';

interface Catatan {
  count: number;
  firstAt: number;
  lockedUntil: number;
}

type Buku = Record<string, Catatan>;

function toko(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function baca(): Buku {
  const store = toko();
  if (!store) return {};
  try {
    const raw = store.getItem(GUARD_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Buku) : {};
  } catch {
    return {};
  }
}

function tulis(buku: Buku): void {
  const store = toko();
  if (!store) return;
  try {
    store.setItem(GUARD_KEY, JSON.stringify(buku));
  } catch {
    /* penyimpanan menolak, batas percobaan tidak bisa dipertahankan */
  }
}

export interface StatusMasuk {
  boleh: boolean;
  sisaDetik: number;
  sisaPercobaan: number;
}

function bersihkanKedaluwarsa(catatan: Catatan | undefined, now: number): Catatan | null {
  if (!catatan) return null;
  if (catatan.lockedUntil > now) return catatan;
  if (now - catatan.firstAt > JENDELA_MS) return null;
  return catatan;
}

/** Memeriksa apakah email masih boleh mencoba masuk sekarang. */
export function statusMasuk(email: string): StatusMasuk {
  const key = normalizeEmail(email);
  const now = Date.now();
  const catatan = bersihkanKedaluwarsa(baca()[key], now);
  if (!catatan) return { boleh: true, sisaDetik: 0, sisaPercobaan: MAKS_PERCOBAAN };
  if (catatan.lockedUntil > now) {
    return {
      boleh: false,
      sisaDetik: Math.ceil((catatan.lockedUntil - now) / 1000),
      sisaPercobaan: 0,
    };
  }
  return {
    boleh: true,
    sisaDetik: 0,
    sisaPercobaan: Math.max(0, MAKS_PERCOBAAN - catatan.count),
  };
}

/** Mencatat percobaan gagal dan mengunci bila batasnya terlampaui. */
export function catatGagal(email: string): StatusMasuk {
  const key = normalizeEmail(email);
  const now = Date.now();
  const buku = baca();
  const lama = bersihkanKedaluwarsa(buku[key], now);
  const berikut: Catatan = lama
    ? { ...lama, count: lama.count + 1 }
    : { count: 1, firstAt: now, lockedUntil: 0 };

  if (berikut.count >= MAKS_PERCOBAAN) {
    berikut.lockedUntil = now + KUNCI_MS;
  }
  buku[key] = berikut;
  tulis(buku);

  return statusMasuk(key);
}

/** Menghapus catatan setelah login berhasil. */
export function catatBerhasil(email: string): void {
  const key = normalizeEmail(email);
  const buku = baca();
  if (!(key in buku)) return;
  delete buku[key];
  tulis(buku);
}

/** Menghapus seluruh catatan. Dipakai tes dan tombol reset data lokal. */
export function resetPenjaga(): void {
  const store = toko();
  try {
    store?.removeItem(GUARD_KEY);
  } catch {
    /* tidak ada yang bisa dibersihkan */
  }
}

export function pesanTerkunci(sisaDetik: number): string {
  const menit = Math.max(1, Math.ceil(sisaDetik / 60));
  return `Terlalu banyak percobaan masuk. Coba lagi dalam ${menit} menit.`;
}
