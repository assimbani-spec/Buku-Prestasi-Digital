/**
 * Module data santri.
 *
 * Panel admin dan dashboard guru memakai satu jalur tambah santri ini supaya
 * validasi, pengecekan NISN ganda, dan audit log tidak ditulis dua kali dengan
 * aturan yang bisa berbeda. Penulisan master santri dan entri audit berada di
 * batch yang sama: santri tidak pernah tersimpan tanpa jejak pembuatnya.
 */

import {
  collection,
  db,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from '../../lib/data';
import { buildAuditPayload, newAuditRef } from '../../lib/audit';
import type { Aktor } from '../../lib/aktor';
import type { StudentRecord } from '../../lib/tipe';

export interface TambahSiswaInput {
  name: string;
  nisn: string;
  kelas: string;
  rayon: string;
  points?: number;
  waliName?: string;
  waliPhone?: string;
  waliEmail?: string;
  studentEmail?: string;
}

const NISN_PATTERN = /^\d{4,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const POIN_AWAL_DEFAULT = 1000;
export const POIN_AWAL_MAKS = 100_000;

function butuhAktor(aktor: Aktor): void {
  if (!aktor?.uid) throw new Error('Sesi berakhir. Silakan masuk kembali.');
}

function rapikan(value?: string): string {
  return value?.trim() ?? '';
}

function emailValid(value: string): boolean {
  return !value || EMAIL_PATTERN.test(value);
}

function buatId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sis-${crypto.randomUUID()}`;
  }
  return `sis-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Menambah satu santri. Menolak NISN yang sudah dipakai agar satu santri tidak
 * punya dua master dengan riwayat poin terpisah.
 */
export async function tambahSiswa(
  input: TambahSiswaInput,
  aktor: Aktor
): Promise<StudentRecord> {
  butuhAktor(aktor);

  const name = rapikan(input.name);
  const nisn = rapikan(input.nisn);
  const kelas = rapikan(input.kelas);
  const rayon = rapikan(input.rayon);
  const waliEmail = rapikan(input.waliEmail).toLowerCase();
  const studentEmail = rapikan(input.studentEmail).toLowerCase();
  const poin = Number(input.points ?? POIN_AWAL_DEFAULT);

  if (name.length < 2) throw new Error('Nama lengkap santri wajib diisi.');
  if (!nisn) throw new Error('NISN santri wajib diisi.');
  if (!NISN_PATTERN.test(nisn)) throw new Error('NISN harus berupa 4 sampai 20 angka.');
  if (!kelas) throw new Error('Kelas santri wajib dipilih.');
  if (!rayon) throw new Error('Rayon santri wajib dipilih.');
  if (!Number.isFinite(poin) || poin < 0 || poin > POIN_AWAL_MAKS) {
    throw new Error(`Poin awal harus antara 0 dan ${POIN_AWAL_MAKS}.`);
  }
  if (!emailValid(waliEmail)) throw new Error('Format email wali belum benar.');
  if (!emailValid(studentEmail)) throw new Error('Format email santri belum benar.');

  const existing = await getDocs(
    query(collection(db, 'students'), where('nisn', '==', nisn))
  );
  if (!existing.empty) {
    throw new Error('NISN itu sudah terdaftar. Periksa data santri yang ada.');
  }

  const id = buatId();
  const student: StudentRecord = {
    id,
    name,
    nisn,
    kelas,
    rayon,
    points: Math.round(poin),
    waliName: rapikan(input.waliName) || undefined,
    waliPhone: rapikan(input.waliPhone) || undefined,
    waliEmail: waliEmail || undefined,
    studentEmail: studentEmail || undefined,
    createdAt: new Date().toISOString(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'students', id), {
    ...student,
    dibuat_oleh: aktor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(
    newAuditRef(),
    buildAuditPayload({
      actor: aktor,
      action: 'student_create',
      collectionName: 'students',
      docId: id,
      siswaId: id,
      rayon,
      after: { nama: name, nisn, kelas, rayon, poin: Math.round(poin) },
    })
  );
  await batch.commit();

  return student;
}

export interface UpdateSiswaInput {
  name: string;
  nisn: string;
  kelas: string;
  rayon: string;
  points?: number;
  waliName?: string;
  waliPhone?: string;
  waliEmail?: string;
  studentEmail?: string;
}

/**
 * Memperbarui data santri yang sudah ada (hanya guru atau admin).
 */
export async function updateSiswa(
  studentId: string,
  input: UpdateSiswaInput,
  aktor: Aktor
): Promise<void> {
  butuhAktor(aktor);
  if (!studentId?.trim()) throw new Error('ID santri wajib diisi.');

  const name = rapikan(input.name);
  const nisn = rapikan(input.nisn);
  const kelas = rapikan(input.kelas);
  const rayon = rapikan(input.rayon);
  const waliEmail = rapikan(input.waliEmail).toLowerCase();
  const studentEmail = rapikan(input.studentEmail).toLowerCase();

  if (name.length < 2) throw new Error('Nama lengkap santri wajib diisi.');
  if (!nisn) throw new Error('NISN santri wajib diisi.');
  if (!NISN_PATTERN.test(nisn)) throw new Error('NISN harus berupa 4 sampai 20 angka.');
  if (!kelas) throw new Error('Kelas santri wajib dipilih.');
  if (!rayon) throw new Error('Rayon santri wajib dipilih.');
  if (!emailValid(waliEmail)) throw new Error('Format email wali belum benar.');
  if (!emailValid(studentEmail)) throw new Error('Format email santri belum benar.');

  // Cek NISN tidak bentrok dengan santri lain
  const existing = await getDocs(
    query(collection(db, 'students'), where('nisn', '==', nisn))
  );
  const duplicate = existing.docs.find((d) => d.id !== studentId);
  if (duplicate) {
    throw new Error('NISN itu sudah dipakai oleh santri lain.');
  }

  const payload: Record<string, unknown> = {
    name,
    nisn,
    kelas,
    rayon,
    waliName: rapikan(input.waliName) || null,
    waliPhone: rapikan(input.waliPhone) || null,
    waliEmail: waliEmail || null,
    studentEmail: studentEmail || null,
    updatedAt: serverTimestamp(),
  };

  if (input.points !== undefined && Number.isFinite(input.points)) {
    const poin = Math.round(input.points);
    if (poin >= 0 && poin <= POIN_AWAL_MAKS) {
      payload.points = poin;
    }
  }

  const batch = writeBatch(db);
  batch.set(doc(db, 'students', studentId), payload, { merge: true });
  batch.set(
    newAuditRef(),
    buildAuditPayload({
      actor: aktor,
      action: 'student_update',
      collectionName: 'students',
      docId: studentId,
      siswaId: studentId,
      rayon,
      after: { nama: name, nisn, kelas, rayon },
    })
  );
  await batch.commit();
}

/**
 * Menghapus santri dari database (hanya admin).
 */
export async function hapusSiswa(
  studentId: string,
  studentName: string,
  aktor: Aktor
): Promise<void> {
  butuhAktor(aktor);
  if (!studentId?.trim()) throw new Error('ID santri wajib diisi.');

  const batch = writeBatch(db);
  batch.delete(doc(db, 'students', studentId));
  batch.set(
    newAuditRef(),
    buildAuditPayload({
      actor: aktor,
      action: 'student_delete',
      collectionName: 'students',
      docId: studentId,
      siswaId: studentId,
      before: { nama: studentName },
    })
  );
  await batch.commit();
}
