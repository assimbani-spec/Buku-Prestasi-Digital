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
  // Kunci NISN ditulis dalam batch yang sama. Aturan Firestore mensyaratkan
  // indeks ini ada, sehingga NISN ganda tetap ditolak walau dua admin
  // menambahkan santri pada saat yang hampir bersamaan.
  batch.set(doc(db, 'nisn_index', nisn), {
    nisn,
    studentId: id,
    createdAt: serverTimestamp(),
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
