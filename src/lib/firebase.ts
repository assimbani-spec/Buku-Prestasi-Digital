/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  GoogleAuthProvider, 
  signInWithPopup,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  getDocFromServer,
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import configBawaan from '../../firebase-applet-config.json';
import { DATA_BACKEND } from './data/config';

/** Proyek contoh yang tidak boleh dipakai untuk data sekolah sungguhan. */
const PROYEK_CONTOH = 'triple-cinema-jnj8s';

function envFirebase(nama: string): string {
  const env = ((import.meta as any)?.env ?? {}) as Record<string, unknown>;
  return String(env[nama] ?? '').trim();
}

// Konfigurasi bisa ditimpa lewat env saat build. Nilai VITE_* memang publik
// (sama seperti konfigurasi web Firebase pada umumnya); yang melindungi data
// adalah Firebase Auth dan firestore.rules.
const dariEnv = {
  projectId: envFirebase('VITE_FIREBASE_PROJECT_ID'),
  appId: envFirebase('VITE_FIREBASE_APP_ID'),
  apiKey: envFirebase('VITE_FIREBASE_API_KEY'),
  authDomain: envFirebase('VITE_FIREBASE_AUTH_DOMAIN'),
  firestoreDatabaseId: envFirebase('VITE_FIREBASE_FIRESTORE_DATABASE_ID'),
  storageBucket: envFirebase('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: envFirebase('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  measurementId: envFirebase('VITE_FIREBASE_MEASUREMENT_ID'),
};
const envLengkap = Boolean(dariEnv.projectId && dariEnv.appId && dariEnv.apiKey);

// Bila env lengkap, pakai env sepenuhnya. Jangan mencampur dengan nilai bawaan
// karena database ID proyek contoh bisa terbawa ke proyek sekolah dan membuat
// aplikasi membaca database yang salah.
const firebaseConfig = envLengkap
  ? {
      projectId: dariEnv.projectId,
      appId: dariEnv.appId,
      apiKey: dariEnv.apiKey,
      authDomain: dariEnv.authDomain || `${dariEnv.projectId}.firebaseapp.com`,
      firestoreDatabaseId: dariEnv.firestoreDatabaseId || '(default)',
      storageBucket:
        dariEnv.storageBucket || `${dariEnv.projectId}.firebasestorage.app`,
      messagingSenderId: dariEnv.messagingSenderId || undefined,
      measurementId: dariEnv.measurementId || undefined,
    }
  : configBawaan;

// Build produksi dengan backend Firestore tidak boleh diam-diam menulis data
// sekolah ke proyek contoh. Gagalkan lebih awal agar tidak ada data nyata yang
// masuk ke proyek yang bukan milik sekolah.
if (
  DATA_BACKEND === 'firestore' &&
  Boolean((import.meta as any)?.env?.PROD) &&
  firebaseConfig.projectId === PROYEK_CONTOH &&
  !envLengkap
) {
  throw new Error(
    'Konfigurasi Firebase masih memakai proyek contoh. Isi VITE_FIREBASE_PROJECT_ID, ' +
      'VITE_FIREBASE_APP_ID, dan VITE_FIREBASE_API_KEY dengan proyek milik sekolah, ' +
      'atau ganti firebase-applet-config.json sebelum build produksi.'
  );
}

// Firebase diinisialisasi malas (lazy) supaya mode lokal tidak membuka
// koneksi apa pun. Fungsi di bawah dipanggil hanya saat backend Firestore aktif.
let cachedApp: ReturnType<typeof initializeApp> | null = null;
let cachedAuth: ReturnType<typeof getAuth> | null = null;
let cachedDb: ReturnType<typeof getFirestore> | null = null;

export function firebaseApp() {
  if (!cachedApp) {
    cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return cachedApp;
}

export function firebaseAuth() {
  if (!cachedAuth) cachedAuth = getAuth(firebaseApp());
  return cachedAuth;
}

export function firebaseDb() {
  if (!cachedDb) cachedDb = getFirestore(firebaseApp(), firebaseConfig.firestoreDatabaseId);
  return cachedDb;
}

// Test Firestore Connection as required by Firebase skill
export async function testConnection() {
  try {
    await getDocFromServer(doc(firebaseDb(), 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or waiting for network connection.');
    }
  }
}
// testConnection() sengaja tidak dipanggil otomatis: request ini selalu ditolak
// oleh firestore.rules (global deny) dan hanya menambah error di console produksi.

// Operation Types for Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: firebaseAuth().currentUser?.uid,
      email: firebaseAuth().currentUser?.email,
      emailVerified: firebaseAuth().currentUser?.emailVerified,
      isAnonymous: firebaseAuth().currentUser?.isAnonymous,
      tenantId: firebaseAuth().currentUser?.tenantId,
      providerInfo: firebaseAuth().currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Auth Helper Functions
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(firebaseAuth(), googleProvider);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(firebaseAuth());
}
