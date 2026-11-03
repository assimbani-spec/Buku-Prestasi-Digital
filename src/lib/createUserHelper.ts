/**
 * Helper untuk pembuatan akun pengguna (Siswa, Orang Tua, Guru, Rayon, Admin)
 * langsung dari aplikasi tanpa keluar dari sesi Admin yang sedang aktif.
 */
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import configBawaan from '../../firebase-applet-config.json';
import { isLocalBackend } from './data/config';
import { hashPassword, normalizeEmail, MIN_PASSWORD_LENGTH } from './localAuth';

export interface CreateAccountResult {
  uid: string;
  email: string;
  passwordHash?: string;
  passwordSalt?: string;
}

export async function createAccountThroughApp(
  emailInput: string,
  passwordInput: string
): Promise<CreateAccountResult> {
  const email = normalizeEmail(emailInput);
  if (!email) throw new Error('Email wajib diisi.');
  if (passwordInput.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
  }

  if (isLocalBackend) {
    const credential = await hashPassword(passwordInput);
    const uid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `u-${crypto.randomUUID()}`
        : `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    return {
      uid,
      email,
      ...credential,
    };
  }

  // Mode Firebase Authentication: buat akun melalui instance sekunder terpisah
  // agar sesi login admin yang sedang aktif tidak terputus atau terganti.
  const tempAppName = `user-creator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tempApp = initializeApp(configBawaan, tempAppName);
  try {
    const tempAuth = getAuth(tempApp);
    const userCredential = await createUserWithEmailAndPassword(tempAuth, email, passwordInput);
    const uid = userCredential.user.uid;
    await signOut(tempAuth);
    return { uid, email };
  } catch (err: any) {
    const code = String(err?.code ?? '');
    if (code.includes('email-already-in-use')) {
      throw new Error(`Email "${email}" sudah terdaftar di Firebase Authentication.`);
    } else if (code.includes('weak-password')) {
      throw new Error(`Kata sandi terlalu lemah. Gunakan minimal ${MIN_PASSWORD_LENGTH} karakter.`);
    } else if (code.includes('invalid-email')) {
      throw new Error('Format email tidak valid.');
    } else if (code.includes('operation-not-allowed')) {
      throw new Error('Penyedia Email/Password belum diaktifkan di Firebase Console.');
    }
    throw new Error(err?.message || 'Gagal membuat akun di Firebase Authentication.');
  } finally {
    try {
      await deleteApp(tempApp);
    } catch {
      // Abaikan bila penghapusan instance temporary gagal
    }
  }
}

export async function sendPasswordResetThroughApp(email: string): Promise<void> {
  if (isLocalBackend) return;
  const { firebaseAuth } = await import('./firebase');
  await sendPasswordResetEmail(firebaseAuth(), email);
}
