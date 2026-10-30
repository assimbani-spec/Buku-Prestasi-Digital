/**
 * Titik masuk tunggal untuk lapisan data.
 *
 * Semua layar mengimpor `doc`, `collection`, `getDoc`, `onSnapshot`, dan
 * kawan-kawan dari sini, bukan langsung dari `firebase/firestore`. Dengan
 * begitu backend bisa diganti tanpa menyentuh komponen:
 *
 *   VITE_DATA_BACKEND=local      -> localStorage (default, tanpa server)
 *   VITE_DATA_BACKEND=firestore  -> Firebase Firestore (rules tetap berlaku)
 *
 * Adapter berikutnya (Supabase, Cloudflare D1) cukup membuat modul dengan
 * ekspor yang sama, lalu didaftarkan di sini. Panduan lengkap ada di
 * `docs/data-backend.md`.
 */

import { DATA_BACKEND, isLocalBackend } from './config';
import * as firestoreDriver from './firestoreDriver';
import * as localDriver from './localDriver';
import type { LocalRef } from './localDriver';

const driver: typeof localDriver = (DATA_BACKEND === 'firestore'
  ? (firestoreDriver as unknown as typeof localDriver)
  : localDriver);

export { DATA_BACKEND, isLocalBackend };
export type DocumentReference = LocalRef;

/**
 * Pegangan database.
 *
 * Pada backend lokal nilainya `null` karena driver localStorage tidak butuh
 * koneksi. Pemanggilan `doc(db, 'x', 'y')` tetap berjalan seperti biasa.
 */
export const db: any = DATA_BACKEND === 'firestore' ? firestoreDriver.getDb() : null;

export const doc = driver.doc;
export const collection = driver.collection;
export const query = driver.query;
export const where = driver.where;
export const orderBy = driver.orderBy;
export const limit = driver.limit;
export const getDoc = driver.getDoc;
export const getDocFromServer = driver.getDocFromServer;
export const getDocs = driver.getDocs;
export const onSnapshot = driver.onSnapshot;
export const setDoc = driver.setDoc;
export const addDoc = driver.addDoc;
export const updateDoc = driver.updateDoc;
export const deleteDoc = driver.deleteDoc;
export const writeBatch = driver.writeBatch;
export const increment = driver.increment;
export const serverTimestamp = driver.serverTimestamp;

export const Timestamp = (firestoreDriver.Timestamp ?? localDriver.Timestamp) as typeof localDriver.Timestamp;
export const LocalTimestamp = localDriver.LocalTimestamp;

/** Hanya berarti pada backend lokal. */
export const clearLocalDatabase = localDriver.clearLocalDatabase;
export const localDatabaseExists = localDriver.localDatabaseExists;
