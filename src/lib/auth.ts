/**
 * Lapisan autentikasi.
 *
 * Dua backend, satu antarmuka:
 *  - Mode lokal (`VITE_DATA_BACKEND=local`): akun dan hash kata sandi disimpan
 *    di koleksi `profiles` pada localStorage. Admin membuat akun dari panel
 *    admin, lalu pengguna masuk dengan email dan kata sandi.
 *  - Mode Firestore: Firebase Authentication menangani sesi, profil tetap
 *    dibaca dari koleksi `profiles`.
 *
 * Saat pindah ke Supabase atau Cloudflare D1, cukup sediakan `watchAuthUser`,
 * `signInWithEmail`, dan `signOutUser` dengan bentuk yang sama.
 */

import { DATA_BACKEND, doc, getDoc, isLocalBackend } from './data';
import { pastikanAdminAwal } from './data/seed';
import { findLocalProfileByEmail, normalizeEmail, verifyPassword } from './localAuth';
import {
  catatBerhasil,
  catatGagal,
  pesanTerkunci,
  resetPenjaga,
  statusMasuk,
} from './loginGuard';

const SESSION_KEY = 'bkp.localsession.v4';
const LEGACY_SESSION_KEYS = ['bkp.localsession', 'bkp.localsession.v3'];

/**
 * Sesi lokal berakhir setelah 12 jam. Tanpa ini, peramban yang ditinggal
 * terbuka tetap memberi akses admin tanpa batas waktu.
 */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

type Listener = (user: AppUser | null) => void;
const listeners = new Set<Listener>();

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readLocalSession(): AppUser | null {
  const store = safeStorage();
  if (!store) return null;
  LEGACY_SESSION_KEYS.forEach((key) => {
    try {
      store.removeItem(key);
    } catch {
      /* penyimpanan menolak, tidak ada yang bisa dibersihkan */
    }
  });
  try {
    const raw = store.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppUser> & { expiresAt?: number };
    if (!parsed?.uid) return null;
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      store.removeItem(SESSION_KEY);
      return null;
    }
    return {
      uid: String(parsed.uid),
      email: parsed.email ?? null,
      displayName: parsed.displayName ?? null,
    };
  } catch {
    return null;
  }
}

function writeLocalSession(user: AppUser | null): void {
  const store = safeStorage();
  if (!store) throw new Error('Peramban menolak menyimpan sesi (mode privat?).');
  if (!user) {
    store.removeItem(SESSION_KEY);
    return;
  }
  store.setItem(
    SESSION_KEY,
    JSON.stringify({ ...user, expiresAt: Date.now() + SESSION_TTL_MS })
  );
}

function emit(user: AppUser | null): void {
  listeners.forEach((listener) => {
    try {
      listener(user);
    } catch {
      /* pendengar yang gagal tidak menghentikan yang lain */
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === SESSION_KEY || LEGACY_SESSION_KEYS.includes(event.key ?? '')) {
      emit(readLocalSession());
    }
  });
}

/** Memantau sesi. Mengembalikan fungsi berhenti memantau. */
export function watchAuthUser(callback: Listener): () => void {
  if (isLocalBackend) {
    listeners.add(callback);
    callback(readLocalSession());
    return () => listeners.delete(callback);
  }

  let stopped = false;
  let unsubscribe: (() => void) | null = null;

  import('./firebaseAuthBridge').then((bridge) => {
    if (stopped) return;
    unsubscribe = bridge.watchFirebaseUser((user) => {
      callback(
        user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null
      );
    });
  });

  return () => {
    stopped = true;
    unsubscribe?.();
    listeners.delete(callback);
  };
}

/**
 * Masuk dengan email dan kata sandi.
 *
 * Di mode lokal kredensial diperiksa terhadap hash di `profiles`. Pesan galat
 * sengaja tidak membedakan email tidak dikenal dan kata sandi salah.
 */
export async function signInWithEmail(email: string, password: string): Promise<void> {
  if (!isLocalBackend) {
    const bridge = await import('./firebaseAuthBridge');
    await bridge.signInFirebase(email, password);
    return;
  }

  const normalized = normalizeEmail(email);
  if (!normalized || !password) throw new Error('Email dan kata sandi wajib diisi.');

  const batas = statusMasuk(normalized);
  if (!batas.boleh) throw new Error(pesanTerkunci(batas.sisaDetik));

  await pastikanAdminAwal();
  const found = await findLocalProfileByEmail(normalized);
  if (!found) {
    catatGagal(normalized);
    throw new Error('Email atau kata sandi salah.');
  }
  if (found.data.active === false) {
    throw new Error('Akun ini dinonaktifkan. Hubungi admin sekolah.');
  }
  if (!found.data.passwordHash) {
    throw new Error('Akun ini belum punya kata sandi. Minta admin mengatur ulang.');
  }

  const ok = await verifyPassword(password, found.data);
  if (!ok) {
    const setelah = catatGagal(normalized);
    if (!setelah.boleh) throw new Error(pesanTerkunci(setelah.sisaDetik));
    throw new Error('Email atau kata sandi salah.');
  }

  catatBerhasil(normalized);

  const user: AppUser = {
    uid: found.uid,
    email: found.data.email ?? normalized,
    displayName: found.data.fullName ?? null,
  };
  writeLocalSession(user);
  emit(user);
}

/**
 * Menyegarkan sesi lokal setelah admin mengubah profil sendiri (misalnya nama).
 * Tidak melakukan apa pun di mode Firestore.
 */
export async function refreshLocalSessionUser(uid: string): Promise<void> {
  if (!isLocalBackend) return;
  const snap = await getDoc(doc(null as unknown as never, 'profiles', uid));
  if (!snap.exists()) {
    writeLocalSession(null);
    emit(null);
    return;
  }
  const data = snap.data() as Record<string, any>;
  const user: AppUser = {
    uid,
    email: data.email ?? null,
    displayName: data.fullName ?? null,
  };
  writeLocalSession(user);
  emit(user);
}

export async function signOutUser(): Promise<void> {
  if (isLocalBackend) {
    try {
      writeLocalSession(null);
    } catch {
      /* tidak ada sesi tersimpan */
    }
    emit(null);
    return;
  }
  const bridge = await import('./firebaseAuthBridge');
  await bridge.signOutFirebase();
}

/** Menghapus sesi dan seluruh data mode lokal. */
export async function resetLocalData(): Promise<void> {
  if (!isLocalBackend) throw new Error('Reset data lokal hanya tersedia di mode lokal.');
  const store = safeStorage();
  store?.removeItem(SESSION_KEY);
  LEGACY_SESSION_KEYS.forEach((key) => store?.removeItem(key));
  const { clearLocalDatabase } = await import('./data');
  clearLocalDatabase();
  resetPenjaga();
  emit(null);
}

export { DATA_BACKEND, isLocalBackend };
