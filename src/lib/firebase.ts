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
import firebaseConfig from '../../firebase-applet-config.json';

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

// Auth Helper Functions
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(firebaseAuth(), googleProvider);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(firebaseAuth());
}
