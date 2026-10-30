/**
 * Driver Firestore: meneruskan API yang sama dengan `localDriver` ke
 * `firebase/firestore`, sehingga layar tidak perlu tahu backend mana yang aktif.
 */

export {
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  increment,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

export type { DocumentReference } from 'firebase/firestore';

import { firebaseDb } from '../firebase';

/** Instance Firestore, dibuat hanya saat backend Firestore dipilih. */
export function getDb() {
  return firebaseDb();
}
