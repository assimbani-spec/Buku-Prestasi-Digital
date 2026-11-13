import type { PrestasiRecord } from '../../lib/tipe';

export type SumberPoin = 'guru_bk' | 'jejak_harian' | 'prestasi';

export interface PoinLogRow {
  id: string;
  studentId: string;
  kode: string;
  tipe: string;
  deskripsi: string;
  poin: number;
  createdMs: number;
  time: string;
}

export interface JejakHarianRow {
  id: string;
  studentId: string;
  rayon: string;
  tanggal: string; // YYYY-MM-DD
  poinHarian: number;
  ringkasan: string;
  catatan?: string;
}

export interface UnifiedPoinRow {
  id: string;
  studentId: string;
  sumber: SumberPoin;
  sumberLabel: string;
  kode: string;
  tipe: 'apresiasi' | 'konsekuensi';
  deskripsi: string;
  poin: number;
  createdMs: number;
  time: string;
}

export interface RingkasanMutasiBulan {
  jejakHarian: number;
  prestasi: number;
  guruApresiasi: number;
  apresiasi: number;
  konsekuensi: number;
  net: number;
  jumlah: number;
}

/**
 * Mengurai string tanggal `YYYY-MM-DD` menjadi epoch ms pada pukul 12:00 waktu
 * lokal agar tidak bergeser hari/bulan di zona waktu mana pun.
 */
export function parseTanggalLocalMs(tanggal?: string): number {
  if (!tanggal || typeof tanggal !== 'string') return 0;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(tanggal.trim());
  if (!match) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return 0;
  return new Date(year, month - 1, day, 12, 0, 0).getTime();
}

export function formatTanggalIndonesia(ms: number): string {
  if (!ms) return '-';
  return new Date(ms).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const SUNNAH_KEYS = [
  'sholat_taubat',
  'sholat_rawatib',
  'sholat_awwabin',
  'sholat_lihifdhil_iman',
  'sholat_birrul_walidain',
  'sholat_hajat',
  'sholat_istikharah',
  'sholat_liridhoillah',
  'sholat_syukur',
  'sujud_syukur',
  'sholat_tasbih',
] as const;

/**
 * Membangun ringkasan aktivitas pembiasaan harian dari dokumen `pembiasaan_harian`.
 */
export function buildRingkasanJejakHarian(data: Record<string, any>): string {
  const bagian: string[] = [];

  const fardhu = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'].filter((k) => {
    const val = data[k];
    return val === 'berjamaah' || val === 'masbuk' || val === 'munfarid';
  }).length;
  if (fardhu > 0) bagian.push(`Sholat Fardhu ${fardhu}/5`);
  else if (data.sedang_menstruasi) bagian.push('Udzur Syar’i (Menstruasi)');

  if (data.tahajud === '4_rakaat' || data.tahajud === '2_rakaat') {
    bagian.push(`Tahajud ${data.tahajud === '4_rakaat' ? '4R' : '2R'}`);
  }
  if (data.dhuha === '4_rakaat' || data.dhuha === '2_rakaat') {
    bagian.push(`Dhuha ${data.dhuha === '4_rakaat' ? '4R' : '2R'}`);
  }

  const sunnahCount = SUNNAH_KEYS.filter((k) => Boolean(data[k])).length;
  if (sunnahCount > 0) bagian.push(`${sunnahCount} Sholat Sunnah`);

  if (data.dzikir_thoriqoh) bagian.push('Dzikir Thoriqoh');
  if (data.mengaji || data.surat_yasin || data.surat_waqiah || data.surat_al_mulk) {
    bagian.push('Tilawah Al-Qur’an');
  }
  if (data.grooming) bagian.push('Grooming & Adab');
  if (data.kelompok_belajar) bagian.push('Kelompok Belajar');

  const ringkas = bagian.length > 0 ? bagian.join(', ') : 'Pembiasaan Harian Jejak';
  const catatan = typeof data.catatan === 'string' ? data.catatan.trim() : '';
  return catatan ? `${ringkas} — "${catatan.slice(0, 90)}"` : ringkas;
}

export function mapJejakDoc(id: string, data: Record<string, any>): JejakHarianRow {
  return {
    id,
    studentId: data.student_id ?? '',
    rayon: data.rayon ?? '',
    tanggal: data.tanggal ?? '',
    poinHarian: Number(data.poin_harian) || 0,
    ringkasan: buildRingkasanJejakHarian(data),
    catatan: typeof data.catatan === 'string' ? data.catatan : undefined,
  };
}

export function mapPoinLogDoc(id: string, data: Record<string, any>): PoinLogRow {
  const createdMs: number = data.createdAt?.toMillis ? data.createdAt.toMillis() : 0;
  return {
    id,
    studentId: data.siswa_id ?? '',
    kode: data.kode ?? '',
    tipe: data.tipe ?? 'apresiasi',
    deskripsi: data.deskripsi ?? '',
    poin: Number(data.poin) || 0,
    createdMs,
    time: createdMs ? new Date(createdMs).toLocaleString('id-ID') : 'Baru saja',
  };
}

export function gabungkanRiwayatPoin(params: {
  poinLogs?: PoinLogRow[];
  harianLogs?: JejakHarianRow[];
  prestasiList?: Array<PrestasiRecord & { createdAtMs?: number; verifiedAtMs?: number }>;
  studentId?: string;
}): UnifiedPoinRow[] {
  const { poinLogs = [], harianLogs = [], prestasiList = [], studentId } = params;
  const rows: UnifiedPoinRow[] = [];

  for (const log of poinLogs) {
    if (studentId && log.studentId !== studentId) continue;
    rows.push({
      id: `log_${log.id}`,
      studentId: log.studentId,
      sumber: 'guru_bk',
      sumberLabel: 'Guru / BK',
      kode: log.kode || (log.tipe === 'konsekuensi' ? 'K' : 'A'),
      tipe: log.tipe === 'konsekuensi' ? 'konsekuensi' : 'apresiasi',
      deskripsi: log.deskripsi,
      poin: Number(log.poin) || 0,
      createdMs: log.createdMs || 0,
      time: log.time || '-',
    });
  }

  for (const h of harianLogs) {
    if (studentId && h.studentId !== studentId) continue;
    if (!h.poinHarian || h.poinHarian <= 0) continue;
    const ms = parseTanggalLocalMs(h.tanggal);
    rows.push({
      id: `jejak_${h.id}`,
      studentId: h.studentId,
      sumber: 'jejak_harian',
      sumberLabel: 'Jejak Harian',
      kode: 'JEJAK',
      tipe: 'apresiasi',
      deskripsi: `Jejak Harian (${h.tanggal}): ${h.ringkasan}`,
      poin: h.poinHarian,
      createdMs: ms,
      time: formatTanggalIndonesia(ms),
    });
  }

  for (const p of prestasiList) {
    if (studentId && p.siswa_id !== studentId) continue;
    if (p.status !== 'verified' || !p.poin || p.poin <= 0) continue;
    const ms = p.verifiedAtMs || parseTanggalLocalMs(p.tanggal) || p.createdAtMs || 0;
    const detailParts = [p.tingkat, p.capaian].filter(Boolean).join(' • ');
    rows.push({
      id: `prestasi_${p.id}`,
      studentId: p.siswa_id,
      sumber: 'prestasi',
      sumberLabel: 'Prestasi',
      kode: 'PRESTASI',
      tipe: 'apresiasi',
      deskripsi: `${p.judul}${detailParts ? ` (${detailParts})` : ''}${p.tanggal ? ` — Tgl ${p.tanggal}` : ''}`,
      poin: Number(p.poin) || 0,
      createdMs: ms,
      time: ms ? formatTanggalIndonesia(ms) : p.tanggal || '-',
    });
  }

  return rows.sort((a, b) => b.createdMs - a.createdMs);
}

export function filterRiwayatBulan(
  rows: UnifiedPoinRow[],
  monthIndex0: number,
  year: number
): UnifiedPoinRow[] {
  return rows.filter((row) => {
    if (!row.createdMs) return false;
    const d = new Date(row.createdMs);
    return d.getMonth() === monthIndex0 && d.getFullYear() === year;
  });
}

export function hitungRingkasanBulan(rows: UnifiedPoinRow[]): RingkasanMutasiBulan {
  let jejakHarian = 0;
  let prestasi = 0;
  let guruApresiasi = 0;
  let konsekuensi = 0;

  for (const r of rows) {
    if (r.tipe === 'konsekuensi') {
      konsekuensi += r.poin;
    } else if (r.sumber === 'jejak_harian') {
      jejakHarian += r.poin;
    } else if (r.sumber === 'prestasi') {
      prestasi += r.poin;
    } else {
      guruApresiasi += r.poin;
    }
  }

  const apresiasi = jejakHarian + prestasi + guruApresiasi;
  return {
    jejakHarian,
    prestasi,
    guruApresiasi,
    apresiasi,
    konsekuensi,
    net: apresiasi - konsekuensi,
    jumlah: rows.length,
  };
}
