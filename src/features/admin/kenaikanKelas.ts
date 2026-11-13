/**
 * Fitur Kenaikan Kelas & Tutup Tahun Ajaran.
 *
 * Merencanakan dan mengeksekusi proses akhir tahun ajaran secara terukur:
 *  - Pemetaan kelas otomatis (mis. X -> XI -> XII -> Lulus / Alumni, VII -> VIII -> IX -> Lulus)
 *    yang bisa ditinjau dan diubah admin sebelum dijalankan.
 *  - Pengecualian santri perorangan (tinggal kelas).
 *  - Reset poin awal tahun ajaran baru (atau pertahankan saldo) tanpa menghapus
 *    riwayat lama (`poin_log`, `prestasi`, `pembiasaan_harian`, `pembiasaan_mingguan`, `audit_log`).
 *  - Pembuatan snapshot arsip (`arsip_tahun_ajaran` & `arsip_santri_tahunan`) secara
 *    terpecah (chunked batch <= 500 operasi Firestore) agar aman untuk 1.000–2.000+ santri.
 */

import * as XLSX from 'xlsx';
import {
  collection,
  db,
  doc,
  serverTimestamp,
  writeBatch,
} from '../../lib/data';
import { buildAuditPayload, newAuditRef } from '../../lib/audit';
import type { Aktor } from '../../lib/aktor';
import type {
  ArsipSantriTahunanRecord,
  ArsipTahunAjaranRecord,
  StudentRecord,
} from '../../lib/tipe';
import { POIN_AWAL_DEFAULT } from '../siswa/siswa';

export type AksiKenaikanKelas = 'naik_kelas' | 'lulus' | 'tetap';

export interface RencanaPerKelas {
  kelasAsal: string;
  aksi: AksiKenaikanKelas;
  kelasTujuan: string;
}

export interface ItemRencanaSantri {
  student: StudentRecord;
  aksi: AksiKenaikanKelas;
  kelasLama: string;
  kelasBaru: string;
  poinAkhir: number;
  poinBaru: number;
  diKecualikanTinggalKelas: boolean;
}

export interface RingkasanRencana {
  totalDiproses: number;
  naikKelas: number;
  lulus: number;
  tetap: number;
  kelasBaruBelumDiMaster: string[];
  items: ItemRencanaSantri[];
}

export interface OpsiTutupTahunAjaran {
  tahunAjaranLama: string;
  tahunAjaranBaru: string;
  modeResetPoin: 'reset_default' | 'pertahankan';
  poinDefaultBaru: number;
  buatMasterKelasOtomatis: boolean;
  nonaktifkanAkunLulus: boolean;
  catatan?: string;
}

export interface LinkedProfileLite {
  id: string;
  role: string;
  studentId?: string;
  active?: boolean;
}

const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function cariKecocokanMaster(kandidat: string, masterKelas: string[]): string {
  const norm = kandidat.trim().toLowerCase().replace(/\s+/g, ' ');
  const found = masterKelas.find((m) => m.trim().toLowerCase().replace(/\s+/g, ' ') === norm);
  return found ?? kandidat.trim();
}

/**
 * Memberikan saran kenaikan kelas otomatis berdasarkan pola tingkat kelas di Indonesia
 * (SD 1-6, SMP VII-IX / 7-9, SMA/SMK X-XII / 10-12).
 */
export function sarankanKelasBerikutnya(
  kelasSaatIni: string,
  masterKelas: string[] = []
): RencanaPerKelas {
  const trimmed = kelasSaatIni.trim();
  if (!trimmed || trimmed === '-') {
    return { kelasAsal: kelasSaatIni, aksi: 'tetap', kelasTujuan: trimmed || '-' };
  }

  // Cocokkan awalan romawi (urutan dari yang terpanjang agar XII tidak cocok sebagai X/XI)
  const romawiMatch = trimmed.match(/^(XII|XI|X|VIII|VII|IX)([\s.\-_/]+.*)?$/i);
  if (romawiMatch) {
    const tingkat = romawiMatch[1].toUpperCase();
    const sisa = romawiMatch[2] ?? '';
    if (tingkat === 'XII' || tingkat === 'IX') {
      return { kelasAsal: kelasSaatIni, aksi: 'lulus', kelasTujuan: 'Lulus / Alumni' };
    }
    const nextMap: Record<string, string> = {
      X: 'XI',
      XI: 'XII',
      VII: 'VIII',
      VIII: 'IX',
    };
    const nextTingkat = nextMap[tingkat];
    if (nextTingkat) {
      return {
        kelasAsal: kelasSaatIni,
        aksi: 'naik_kelas',
        kelasTujuan: cariKecocokanMaster(`${nextTingkat}${sisa}`, masterKelas),
      };
    }
  }

  // Cocokkan awalan angka (mis. 10 TKJ 1, 11 A, 12 IPA, 7A, 9B, 6C)
  const angkaMatch = trimmed.match(/^(12|11|10|[1-9])([\s.\-_/]+.*|[A-Za-z]+.*)?$/);
  if (angkaMatch) {
    const num = Number(angkaMatch[1]);
    const sisa = angkaMatch[2] ?? '';
    if (num === 12 || num === 9 || num === 6) {
      return { kelasAsal: kelasSaatIni, aksi: 'lulus', kelasTujuan: 'Lulus / Alumni' };
    }
    if ((num >= 1 && num <= 5) || (num >= 7 && num <= 8) || (num >= 10 && num <= 11)) {
      return {
        kelasAsal: kelasSaatIni,
        aksi: 'naik_kelas',
        kelasTujuan: cariKecocokanMaster(`${num + 1}${sisa}`, masterKelas),
      };
    }
  }

  return { kelasAsal: kelasSaatIni, aksi: 'tetap', kelasTujuan: trimmed };
}

/**
 * Menghitung tahun ajaran berikutnya dari format seperti '2025/2026' -> '2026/2027'.
 */
export function sarankanTahunAjaranBerikutnya(tahunAjaranLama: string): string {
  const m = tahunAjaranLama.trim().match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (m) {
    const y1 = Number(m[1]) + 1;
    const y2 = Number(m[2]) + 1;
    return `${y1}/${y2}`;
  }
  const yearNow = new Date().getFullYear();
  return `${yearNow}/${yearNow + 1}`;
}

export function isSantriAktif(s: Pick<StudentRecord, 'statusSiswa'>): boolean {
  return s.statusSiswa !== 'lulus' && s.statusSiswa !== 'arsip';
}

/**
 * Menghitung pratinjau penuh rencana kenaikan kelas & reset poin sebelum disimpan.
 */
export function hitungRencanaKenaikan(
  allStudents: StudentRecord[],
  rencanaKelasMap: Record<string, RencanaPerKelas>,
  tinggalKelasIds: Set<string>,
  masterKelas: string[],
  opsi: Pick<OpsiTutupTahunAjaran, 'modeResetPoin' | 'poinDefaultBaru'>
): RingkasanRencana {
  const aktifStudents = allStudents.filter(isSantriAktif);
  const masterSet = new Set(masterKelas.map((k) => k.trim().toLowerCase()));
  const missingMasterSet = new Set<string>();

  const poinBaruAktif = Math.max(0, Math.round(Number(opsi.poinDefaultBaru) || 0));

  let naikKelas = 0;
  let lulus = 0;
  let tetap = 0;

  const items: ItemRencanaSantri[] = aktifStudents.map((student) => {
    const kelasLama = student.kelas || '-';
    const isTinggal = tinggalKelasIds.has(student.id);
    const plan = rencanaKelasMap[kelasLama] ?? sarankanKelasBerikutnya(kelasLama, masterKelas);

    const aksi: AksiKenaikanKelas = isTinggal ? 'tetap' : plan.aksi;
    const kelasBaru =
      aksi === 'lulus'
        ? 'Lulus / Alumni'
        : aksi === 'tetap'
          ? kelasLama
          : plan.kelasTujuan.trim() || kelasLama;

    const poinAkhir = Number(student.points) || 0;
    // Santri lulus mempertahankan poin akhir sebagai arsip; santri aktif mengikuti opsi reset/pertahankan.
    const poinBaru =
      aksi === 'lulus'
        ? poinAkhir
        : opsi.modeResetPoin === 'reset_default'
          ? poinBaruAktif
          : poinAkhir;

    if (aksi === 'naik_kelas') {
      naikKelas += 1;
      if (kelasBaru && !masterSet.has(kelasBaru.toLowerCase())) {
        missingMasterSet.add(kelasBaru);
      }
    } else if (aksi === 'lulus') {
      lulus += 1;
    } else {
      tetap += 1;
    }

    return {
      student,
      aksi,
      kelasLama,
      kelasBaru,
      poinAkhir,
      poinBaru,
      diKecualikanTinggalKelas: isTinggal,
    };
  });

  return {
    totalDiproses: items.length,
    naikKelas,
    lulus,
    tetap,
    kelasBaruBelumDiMaster: Array.from(missingMasterSet).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    ),
    items,
  };
}

/**
 * Mengeksekusi Tutup Tahun Ajaran & Kenaikan Kelas dalam batch terpecah
 * sehingga aman untuk ratusan hingga ribuan santri sekaligus.
 */
export async function prosesTutupTahunAjaran(params: {
  rencana: RingkasanRencana;
  opsi: OpsiTutupTahunAjaran;
  aktor: Aktor;
  profiles?: LinkedProfileLite[];
  onProgress?: (done: number, total: number) => void;
}): Promise<{ arsipId: string; totalDiproses: number }> {
  const { rencana, opsi, aktor, profiles = [], onProgress } = params;

  if (!aktor?.uid) {
    throw new Error('Sesi administrator tidak valid. Silakan masuk kembali.');
  }
  const tahunLama = opsi.tahunAjaranLama.trim();
  const tahunBaru = opsi.tahunAjaranBaru.trim();
  if (!tahunLama || !tahunBaru) {
    throw new Error('Tahun ajaran lama dan tahun ajaran baru wajib diisi.');
  }
  if (tahunLama === tahunBaru) {
    throw new Error('Tahun ajaran baru tidak boleh sama dengan tahun ajaran yang ditutup.');
  }
  if (rencana.items.length === 0) {
    throw new Error('Tidak ada santri berstatus aktif yang perlu diproses.');
  }

  const arsipId = `arsip-${slug(tahunLama)}-${Date.now().toString(36)}`;
  const poinDefaultBaru = Math.max(
    0,
    Math.round(Number(opsi.poinDefaultBaru ?? POIN_AWAL_DEFAULT) || 0)
  );

  // Petakan studentId -> profile UID aktif agar santri lulus dapat dinonaktifkan akun loginnya jika dipilih
  const profileByStudentId = new Map<string, LinkedProfileLite>();
  profiles.forEach((p) => {
    if (p.role === 'siswa' && p.studentId && p.active !== false) {
      profileByStudentId.set(p.studentId, p);
    }
  });

  // Maks. 120 santri per batch (maks 3 operasi/santri = 360 op < batas 500 Firestore)
  const CHUNK_SIZE = 120;
  let processed = 0;

  for (let i = 0; i < rencana.items.length; i += CHUNK_SIZE) {
    const chunk = rencana.items.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const s = item.student;
      const studentUpdate: Record<string, unknown> = {
        statusSiswa: item.aksi === 'lulus' ? 'lulus' : 'aktif',
        tahunAjaran: item.aksi === 'lulus' ? tahunLama : tahunBaru,
        points: item.poinBaru,
        updatedAt: serverTimestamp(),
      };
      if (item.aksi === 'naik_kelas') {
        studentUpdate.kelas = item.kelasBaru;
      }
      if (item.aksi === 'lulus') {
        studentUpdate.tahunLulus = tahunLama;
      }

      batch.update(doc(db, 'students', s.id), studentUpdate);

      // Snapshot arsip tahunan per santri (tidak menghapus log lama)
      const arsipDetailId = `${arsipId}_${s.id}`;
      batch.set(doc(db, 'arsip_santri_tahunan', arsipDetailId), {
        arsipId,
        tahunAjaran: tahunLama,
        studentId: s.id,
        nisn: s.nisn || '-',
        name: s.name || '-',
        kelasLama: item.kelasLama,
        kelasBaru: item.kelasBaru,
        rayon: s.rayon || '-',
        statusAkhir: item.aksi,
        poinAkhir: item.poinAkhir,
        poinBaru: item.poinBaru,
        createdAt: serverTimestamp(),
      });

      if (item.aksi === 'lulus' && opsi.nonaktifkanAkunLulus) {
        const linkedProf = profileByStudentId.get(s.id);
        if (linkedProf) {
          batch.update(doc(db, 'profiles', linkedProf.id), {
            active: false,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    await batch.commit();
    processed += chunk.length;
    onProgress?.(processed, rencana.items.length);
  }

  // Batch penutup: master kelas baru (opsional), ringkasan arsip, & audit log
  const closingBatch = writeBatch(db);

  if (opsi.buatMasterKelasOtomatis && rencana.kelasBaruBelumDiMaster.length > 0) {
    for (const kelasNama of rencana.kelasBaruBelumDiMaster) {
      const kelasId = slug(kelasNama);
      if (!kelasId) continue;
      closingBatch.set(
        doc(db, 'master_kelas', kelasId),
        {
          nama: kelasNama,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  const ringkasan = {
    totalDiproses: rencana.totalDiproses,
    naikKelas: rencana.naikKelas,
    lulus: rencana.lulus,
    tetap: rencana.tetap,
  };

  closingBatch.set(doc(db, 'arsip_tahun_ajaran', arsipId), {
    tahunAjaranLama: tahunLama,
    tahunAjaranBaru: tahunBaru,
    modeResetPoin: opsi.modeResetPoin,
    poinDefaultBaru,
    catatan: (opsi.catatan ?? '').trim().slice(0, 500),
    ringkasan,
    dibuatOlehUid: aktor.uid,
    dibuatOlehEmail: aktor.email ?? '',
    createdAt: serverTimestamp(),
  });

  closingBatch.set(
    newAuditRef(),
    buildAuditPayload({
      actor: aktor,
      action: 'tutup_tahun_ajaran',
      collectionName: 'arsip_tahun_ajaran',
      docId: arsipId,
      after: {
        tahunAjaranLama: tahunLama,
        tahunAjaranBaru: tahunBaru,
        modeResetPoin: opsi.modeResetPoin,
        poinDefaultBaru,
        ...ringkasan,
      },
    })
  );

  await closingBatch.commit();

  return { arsipId, totalDiproses: processed };
}

/**
 * Mengaktifkan kembali santri berstatus lulus/arsip menjadi aktif (jika ada koreksi).
 */
export async function aktifkanKembaliSantri(params: {
  studentId: string;
  studentName: string;
  tahunAjaranAktif: string;
  aktor: Aktor;
}): Promise<void> {
  const { studentId, studentName, tahunAjaranAktif, aktor } = params;
  if (!aktor?.uid) throw new Error('Sesi berakhir.');

  const batch = writeBatch(db);
  batch.update(doc(db, 'students', studentId), {
    statusSiswa: 'aktif',
    tahunAjaran: tahunAjaranAktif,
    updatedAt: serverTimestamp(),
  });
  batch.set(
    newAuditRef(),
    buildAuditPayload({
      actor: aktor,
      action: 'siswa_aktifkan_kembali',
      collectionName: 'students',
      docId: studentId,
      siswaId: studentId,
      after: { nama: studentName, statusSiswa: 'aktif', tahunAjaran: tahunAjaranAktif },
    })
  );
  await batch.commit();
}

/**
 * Mengekspor snapshot arsip tahun ajaran ke file Excel (.xlsx).
 */
export function exportArsipTahunAjaranExcel(
  arsip: ArsipTahunAjaranRecord,
  details: ArsipSantriTahunanRecord[]
): void {
  const labelStatus = (s: ArsipSantriTahunanRecord['statusAkhir']) =>
    s === 'lulus' ? 'Lulus / Alumni' : s === 'naik_kelas' ? 'Naik Kelas' : 'Tetap di Kelas';

  const rows = details.map((d, idx) => ({
    No: idx + 1,
    NISN: d.nisn,
    'Nama Santri': d.name,
    'Rayon / Asrama': d.rayon,
    'Kelas Asal': d.kelasLama,
    'Status Akhir': labelStatus(d.statusAkhir),
    'Kelas Tujuan': d.kelasBaru,
    [`Poin Akhir (${arsip.tahunAjaranLama})`]: d.poinAkhir,
    [`Poin Awal (${arsip.tahunAjaranBaru})`]: d.poinBaru,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 5 },
    { wch: 15 },
    { wch: 28 },
    { wch: 20 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
    { wch: 22 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Arsip Kenaikan');
  const safeTahun = arsip.tahunAjaranLama.replace(/[^0-9a-zA-Z]+/g, '-');
  XLSX.writeFile(wb, `Arsip_Tahun_Ajaran_${safeTahun}_Jejak_Digital.xlsx`);
}
