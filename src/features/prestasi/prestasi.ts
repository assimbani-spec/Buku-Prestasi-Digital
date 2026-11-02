/**
 * Module prestasi.
 *
 * Satu interface untuk dua peristiwa yang punya aturan ketat di
 * `firestore.rules`:
 *
 * - `ajukanPrestasi`: santri mengirim pengajuan, selalu `pending` dengan poin 0.
 * - `putuskanPrestasi`: staf memverifikasi atau menolak, menambah poin santri
 *   hanya saat verified.
 *
 * Keduanya menulis entri audit di batch yang sama, sehingga tidak ada pengajuan
 * atau keputusan yang lolos tanpa jejak. Komponen tidak perlu tahu urutannya.
 */

import {
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  writeBatch,
  db,
} from '../../lib/data';
import { buildAuditPayload, newAuditRef } from '../../lib/audit';
import { canVerifyPrestasi } from '../../lib/rbac';
import type { PrestasiStatus } from '../../lib/tipe';

export interface Aktor {
  uid: string;
  email?: string | null;
  role?: string | null;
}

export interface PengajuanPrestasiInput {
  siswaId: string;
  rayon: string;
  judul: string;
  kategori: string;
  tingkat: string;
  capaian: string;
  tanggal: string;
  deskripsi?: string;
}

export interface PrestasiRingkas {
  id: string;
  siswa_id: string;
  rayon: string;
  judul?: string;
  status: PrestasiStatus;
  poin: number;
}

export interface KeputusanPrestasi {
  status: Extract<PrestasiStatus, 'verified' | 'rejected'>;
  poin?: number;
  catatan?: string;
}

export const POIN_VERIFIKASI_MIN = 1;
export const POIN_VERIFIKASI_MAKS = 5000;

function butuhAktor(aktor: Aktor): void {
  if (!aktor?.uid) throw new Error('Sesi berakhir. Silakan masuk kembali.');
}

function butuhStaf(aktor: Aktor): void {
  butuhAktor(aktor);
  if (!canVerifyPrestasi(aktor.role)) {
    throw new Error('Hanya guru, pembimbing rayon, atau admin yang dapat memverifikasi.');
  }
}

/** Santri mengirim pengajuan. Status dan poin ditentukan module, bukan pemanggil. */
export async function ajukanPrestasi(
  input: PengajuanPrestasiInput,
  aktor: Aktor
): Promise<{ id: string }> {
  butuhAktor(aktor);

  const siswaId = input.siswaId?.trim();
  const judul = input.judul?.trim();
  const capaian = input.capaian?.trim();
  if (!siswaId) throw new Error('Data santri belum tertaut ke akun ini. Hubungi Guru / BK.');
  if (!judul || !capaian) throw new Error('Judul prestasi dan capaian wajib diisi.');

  const payload = {
    siswa_id: siswaId,
    rayon: input.rayon,
    judul,
    kategori: input.kategori,
    tingkat: input.tingkat,
    capaian,
    tanggal: input.tanggal,
    deskripsi: input.deskripsi?.trim() ?? '',
    status: 'pending' as const,
    poin: 0,
    createdBy: aktor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = doc(collection(db, 'prestasi'));
  const batch = writeBatch(db);
  batch.set(ref, payload);
  batch.set(
    newAuditRef(),
    buildAuditPayload({
      actor: aktor,
      action: 'prestasi_submit',
      collectionName: 'prestasi',
      docId: ref.id,
      siswaId,
      rayon: input.rayon,
      after: payload,
    })
  );
  await batch.commit();
  return { id: ref.id };
}

/**
 * Staf memutuskan pengajuan. Status dibaca ulang dari basis data agar pengajuan
 * yang sudah diproses tidak bisa diverifikasi dua kali dan poin tidak dobel.
 */
export async function putuskanPrestasi(
  prestasi: PrestasiRingkas,
  keputusan: KeputusanPrestasi,
  aktor: Aktor
): Promise<void> {
  butuhStaf(aktor);

  const snapshot = await getDoc(doc(db, 'prestasi', prestasi.id));
  if (!snapshot.exists()) throw new Error('Pengajuan prestasi tidak ditemukan.');
  const data = snapshot.data() as Record<string, any>;
  if (data.status !== 'pending') throw new Error('Pengajuan ini sudah diproses.');

  const poin = keputusan.status === 'verified' ? Number(keputusan.poin ?? 0) : 0;
  if (keputusan.status === 'verified') {
    if (!Number.isFinite(poin) || poin < POIN_VERIFIKASI_MIN || poin > POIN_VERIFIKASI_MAKS) {
      throw new Error(
        `Poin verifikasi harus berupa angka antara ${POIN_VERIFIKASI_MIN} dan ${POIN_VERIFIKASI_MAKS}.`
      );
    }
  }

  const catatan = keputusan.catatan?.trim() ?? '';
  const siswaId = data.siswa_id ?? prestasi.siswa_id;
  const rayon = data.rayon ?? prestasi.rayon ?? null;

  const batch = writeBatch(db);
  batch.update(doc(db, 'prestasi', prestasi.id), {
    status: keputusan.status,
    poin,
    verifiedBy: aktor.uid,
    verifiedAt: serverTimestamp(),
    catatan_verifikasi: catatan,
    updatedAt: serverTimestamp(),
  });

  if (keputusan.status === 'verified' && poin > 0 && siswaId) {
    batch.update(doc(db, 'students', siswaId), {
      points: increment(poin),
      updatedAt: serverTimestamp(),
    });
  }

  batch.set(
    newAuditRef(),
    buildAuditPayload({
      actor: aktor,
      action: keputusan.status === 'verified' ? 'prestasi_verify' : 'prestasi_reject',
      collectionName: 'prestasi',
      docId: prestasi.id,
      siswaId,
      rayon,
      before: { status: data.status, poin: data.poin ?? 0 },
      after: { status: keputusan.status, poin, catatan_verifikasi: catatan },
    })
  );

  await batch.commit();
}
