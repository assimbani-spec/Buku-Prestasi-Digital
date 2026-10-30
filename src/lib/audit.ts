/**
 * Audit log append-only.
 *
 * Setiap penulisan transaksi (pengajuan prestasi, verifikasi, pelanggaran/poin,
 * jurnal, master santri) dicatat: siapa, aksi apa, kapan, untuk siswa siapa.
 *
 * Aturan keamanan (firestore.rules) mengunci koleksi ini:
 *  - `actorId` wajib sama dengan uid pemanggil,
 *  - `createdAt` wajib sama dengan `request.time` (tidak bisa dimundurkan),
 *  - update/delete selalu ditolak.
 */

import { addDoc, collection, db, doc, serverTimestamp, type DocumentReference } from './data';
import type { Role } from './rbac';

export type AuditAction =
  | 'prestasi_submit'
  | 'prestasi_verify'
  | 'prestasi_reject'
  | 'poin_create'
  | 'jurnal_save'
  | 'non_rutin_save'
  | 'ttd_ortu'
  | 'student_create'
  | 'master_create'
  | 'master_update'
  | 'master_delete'
  | 'user_create'
  | 'user_update'
  | 'user_delete';

export interface AuditActor {
  uid: string;
  email?: string | null;
  role?: Role | string | null;
}

export interface AuditEntryInput {
  actor: AuditActor;
  action: AuditAction;
  collectionName: string;
  docId: string;
  /** ID dokumen `students` yang terdampak (bukan uid). */
  siswaId?: string | null;
  rayon?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
}

/**
 * Buang nilai yang tidak layak masuk audit log: data URL tanda tangan bisa
 * mencapai ~1 MB dan akan menghabiskan batas dokumen 1 MB.
 */
function sanitize(value: unknown, depth = 0): unknown {
  if (value == null) return null;
  if (typeof value === 'string') {
    if (value.startsWith('data:')) return '[binary-data-dihapus]';
    if (value.length > 500) return `${value.slice(0, 500)}…`;
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth > 3) return '[terlalu-dalam]';
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      if (k === 'ttd_url' || k === 'lampiranUrl') return;
      out[k] = sanitize(v, depth + 1);
    });
    return out;
  }
  return String(value);
}

export function buildAuditPayload(input: AuditEntryInput): Record<string, unknown> {
  return {
    actorId: input.actor.uid,
    actorEmail: input.actor.email ?? '',
    actorRole: input.actor.role ?? '',
    action: input.action,
    collection: input.collectionName,
    docId: input.docId,
    siswa_id: input.siswaId ?? null,
    rayon: input.rayon ?? null,
    before: input.before ? sanitize(input.before) : null,
    after: input.after ? sanitize(input.after) : null,
    meta: input.meta ? sanitize(input.meta) : null,
    createdAt: serverTimestamp(),
  };
}

/** Referensi dokumen audit baru - dipakai bersama `writeBatch` agar atomik. */
export function newAuditRef(): DocumentReference {
  return doc(collection(db, 'audit_log'));
}

/** Tulis satu entri audit secara mandiri. */
export async function logAudit(input: AuditEntryInput): Promise<void> {
  await addDoc(collection(db, 'audit_log'), buildAuditPayload(input));
}

/**
 * Versi "tidak boleh menggagalkan transaksi utama": jika audit gagal,
 * kembalikan pesan peringatan agar bisa ditampilkan, bukan exception.
 */
export async function logAuditSafe(input: AuditEntryInput): Promise<string | null> {
  try {
    await logAudit(input);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
