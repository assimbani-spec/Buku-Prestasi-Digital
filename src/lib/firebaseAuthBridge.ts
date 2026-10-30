/**
 * Jembatan ke Firebase Authentication.
 *
 * Modul ini sengaja dipisah dan dimuat dengan `import()` dinamis dari
 * `src/lib/auth.ts`, supaya peramban tidak pernah menyentuh Firebase saat
 * aplikasi berjalan di mode lokal.
 */

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { firebaseAuth } from './firebase';

export type { User };

export function watchFirebaseUser(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(firebaseAuth(), callback);
}

export async function signInFirebase(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(firebaseAuth(), email, password);
}

export async function signOutFirebase(): Promise<void> {
  await signOut(firebaseAuth());
}
