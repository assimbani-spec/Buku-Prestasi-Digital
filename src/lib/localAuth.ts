/**
 * Kredensial akun untuk mode lokal.
 *
 * Mode lokal tidak punya server, jadi kata sandi disimpan di peramban sebagai
 * hash PBKDF2-SHA256 dengan salt acak. Ini mencegah kata sandi terbaca apa
 * adanya di localStorage, tetapi BUKAN pengganti autentikasi server: siapa pun
 * yang menguasai peramban bisa mengubah data. Untuk data nyata, pakai mode
 * Firestore atau backend dengan server.
 *
 * Format yang disimpan di `profiles/{uid}`:
 *   passwordHash       base64 hasil PBKDF2
 *   passwordSalt       base64 salt 16 byte
 *   passwordIterations jumlah iterasi PBKDF2
 */

import { collection, db, getDocs, isLocalBackend, query, where } from './data';

const ITERATIONS = 120_000;
const KEY_BITS = 256;
const SALT_BYTES = 16;

export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordCredential {
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
}

function subtleCrypto(): SubtleCrypto {
  const webCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!webCrypto?.subtle) {
    throw new Error(
      'Peramban ini tidak mendukung penyimpanan kata sandi lokal (butuh HTTPS atau localhost).'
    );
  }
  return webCrypto.subtle;
}

function bytesToBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomSalt(): Uint8Array<ArrayBuffer> {
  const salt = new Uint8Array(SALT_BYTES);
  const webCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!webCrypto?.getRandomValues) throw new Error('Peramban tidak menyediakan sumber acak.');
  webCrypto.getRandomValues(salt);
  return salt;
}

function normalizeBase64(value: string): string {
  return value.trim().replace(/=+$/, '');
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await subtleCrypto().importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await subtleCrypto().deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    KEY_BITS
  );
  return new Uint8Array(bits);
}

/** Membuat hash baru beserta salt acak. */
export async function hashPassword(password: string): Promise<PasswordCredential> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
  }
  const salt = randomSalt();
  const hash = await derive(password, salt, ITERATIONS);
  return {
    passwordHash: bytesToBase64(hash),
    passwordSalt: bytesToBase64(salt),
    passwordIterations: ITERATIONS,
  };
}

/** Memeriksa kata sandi terhadap kredensial tersimpan. */
export async function verifyPassword(
  password: string,
  credential: Partial<PasswordCredential>
): Promise<boolean> {
  if (!credential.passwordHash || !credential.passwordSalt) return false;
  const iterations = Number(credential.passwordIterations) || ITERATIONS;
  let salt: Uint8Array<ArrayBuffer>;
  try {
    salt = base64ToBytes(credential.passwordSalt);
  } catch {
    return false;
  }
  const hash = await derive(password, salt, iterations);
  const expected = normalizeBase64(credential.passwordHash);
  const actual = normalizeBase64(bytesToBase64(hash));
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return diff === 0;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export interface FoundProfile {
  uid: string;
  data: Record<string, any>;
}

/**
 * Mencari profil berdasarkan email. Hanya untuk mode lokal: aturan Firestore
 * tidak mengizinkan pencarian profil lewat email karena alasan privasi.
 */
export async function findLocalProfileByEmail(email: string): Promise<FoundProfile | null> {
  if (!isLocalBackend) throw new Error('Pencarian profil lokal hanya tersedia di mode lokal.');
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const snap = await getDocs(query(collection(db, 'profiles'), where('email', '==', normalized)));
  const found = snap.docs[0];
  if (!found) return null;
  return { uid: found.id, data: found.data() as Record<string, any> };
}
