/**
 * Helper untuk unduh template Excel dan parsing data import (Siswa & Kategori Poin)
 */
import * as XLSX from 'xlsx';

export interface SiswaExcelRow {
  nisn: string;
  name: string;
  kelas: string;
  rayon: string;
  points: number;
  waliName?: string;
  waliPhone?: string;
  studentEmail?: string;
  waliEmail?: string;
  raw?: Record<string, any>;
  error?: string;
  isDuplicate?: boolean;
}

export interface KategoriExcelRow {
  kode: string;
  tipe: 'apresiasi' | 'konsekuensi';
  kategori: string;
  deskripsi: string;
  poin: number;
  raw?: Record<string, any>;
  error?: string;
}

/**
 * Unduh Template Excel untuk Data Siswa (Santri)
 */
export function downloadTemplateSiswa() {
  const sampleData = [
    {
      'NISN': '0071234501',
      'Nama Lengkap': 'Muhammad Farhan Al-Ghifari',
      'Kelas': 'X A',
      'Rayon': 'Rayon 1',
      'Poin Awal': 1000,
      'Nama Wali': 'H. Syamsul Hadi',
      'No HP Wali': '081234567801',
      'Email Siswa': 'siswa.0071234501@sekolah.id',
      'Email Wali': 'wali.farhan@gmail.com',
    },
    {
      'NISN': '0071234502',
      'Nama Lengkap': 'Ahmad Fauzi Rabbani',
      'Kelas': 'X A',
      'Rayon': 'Rayon 1',
      'Poin Awal': 1000,
      'Nama Wali': 'Drs. Supriyanto',
      'No HP Wali': '081234567802',
      'Email Siswa': 'siswa.0071234502@sekolah.id',
      'Email Wali': 'supriyanto@gmail.com',
    },
    {
      'NISN': '0071234503',
      'Nama Lengkap': 'Siti Nur Aisyah',
      'Kelas': 'X B',
      'Rayon': 'Rayon 2',
      'Poin Awal': 1000,
      'Nama Wali': 'Hj. Aminah',
      'No HP Wali': '081234567803',
      'Email Siswa': 'siswa.0071234503@sekolah.id',
      'Email Wali': 'aminah.wali@gmail.com',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  // Atur lebar kolom agar rapi
  ws['!cols'] = [
    { wch: 15 }, // NISN
    { wch: 30 }, // Nama Lengkap
    { wch: 18 }, // Kelas
    { wch: 22 }, // Rayon
    { wch: 12 }, // Poin Awal
    { wch: 22 }, // Nama Wali
    { wch: 16 }, // No HP Wali
    { wch: 28 }, // Email Siswa
    { wch: 28 }, // Email Wali
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Santri');
  XLSX.writeFile(wb, 'Template_Import_Siswa_Jejak.xlsx');
}

/**
 * Unduh Template Excel untuk Master Kategori Poin
 */
export function downloadTemplateKategori() {
  const sampleData = [
    {
      'Kode': 'A 1.1',
      'Tipe': 'apresiasi',
      'Pilar/Kategori': 'Ibadah & Spiritual',
      'Deskripsi': 'Mengikuti shalat tahajud dan subuh berjamaah tepat waktu',
      'Poin': 15,
    },
    {
      'Kode': 'A 1.2',
      'Tipe': 'apresiasi',
      'Pilar/Kategori': 'Prestasi Akademik',
      'Deskripsi': 'Meraih juara 1, 2, atau 3 lomba tingkat kabupaten/kota',
      'Poin': 50,
    },
    {
      'Kode': 'K 1.1',
      'Tipe': 'konsekuensi',
      'Pilar/Kategori': 'Kedisiplinan',
      'Deskripsi': 'Terlambat mengikuti apel pagi / masuk kelas tanpa keterangan',
      'Poin': 10,
    },
    {
      'Kode': 'K 1.2',
      'Tipe': 'konsekuensi',
      'Pilar/Kategori': 'Ketertiban Asrama',
      'Deskripsi': 'Meninggalkan asrama tanpa surat izin pembimbing rayon',
      'Poin': 30,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 12 }, // Kode
    { wch: 16 }, // Tipe (apresiasi / konsekuensi)
    { wch: 22 }, // Pilar/Kategori
    { wch: 45 }, // Deskripsi
    { wch: 10 }, // Poin
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Kategori Poin');
  XLSX.writeFile(wb, 'Template_Import_Kategori_Poin.xlsx');
}

/**
 * Helper untuk membaca file Excel/CSV di browser
 */
export async function readExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        if (!buffer) {
          resolve([]);
          return;
        }
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        if (!firstSheetName) {
          resolve([]);
          return;
        }
        const ws = wb.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });
        resolve(jsonData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Normalisasi header dari Excel agar toleran terhadap variasi penamaan kolom
 */
function findVal(row: Record<string, any>, candidateKeys: string[]): string {
  const lowerKeys = Object.keys(row).map((k) => ({
    orig: k,
    clean: k.trim().toLowerCase().replace(/[^a-z0-9]/g, ''),
  }));

  for (const c of candidateKeys) {
    const target = c.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = lowerKeys.find((k) => k.clean === target);
    if (found && row[found.orig] !== undefined && row[found.orig] !== null) {
      return String(row[found.orig]).trim();
    }
  }
  return '';
}

/**
 * Parsing & validasi data siswa dari baris Excel
 */
export function parseSiswaRows(
  rows: any[],
  existingNisns: Set<string>
): { valid: SiswaExcelRow[]; invalid: SiswaExcelRow[]; duplicates: SiswaExcelRow[] } {
  const valid: SiswaExcelRow[] = [];
  const invalid: SiswaExcelRow[] = [];
  const duplicates: SiswaExcelRow[] = [];
  const seenInFile = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const nisn = findVal(r, ['nisn', 'nomorinduk', 'noinduk', 'nis']);
    const name = findVal(r, ['namalengkap', 'nama', 'namasantri', 'namasiswa']);
    const kelas = findVal(r, ['kelas', 'rombel', 'tingkat']);
    const rayon = findVal(r, ['rayon', 'asrama', 'kamar']);
    const pointsRaw = findVal(r, ['poinawal', 'poin', 'point', 'totalpoin']);
    const waliName = findVal(r, ['namawali', 'wali', 'orangtua', 'namaortu']);
    const waliPhone = findVal(r, ['nohpwali', 'nohp', 'teleponwali', 'telepon', 'kontakwali']);
    const studentEmail = findVal(r, ['emailsiswa', 'emailsantri', 'email']);
    const waliEmail = findVal(r, ['emailwali', 'emailortu']);

    // Lewati jika seluruh baris kosong
    if (!nisn && !name && !kelas && !rayon) continue;

    const pointsNum = pointsRaw ? parseInt(pointsRaw, 10) : 1000;
    const finalPoints = isNaN(pointsNum) ? 1000 : pointsNum;

    const rowObj: SiswaExcelRow = {
      nisn,
      name,
      kelas,
      rayon,
      points: finalPoints,
      waliName: waliName || undefined,
      waliPhone: waliPhone || undefined,
      studentEmail: studentEmail || undefined,
      waliEmail: waliEmail || undefined,
      raw: r,
    };

    if (!name) {
      rowObj.error = 'Nama santri tidak boleh kosong';
      invalid.push(rowObj);
      continue;
    }
    if (!nisn) {
      rowObj.error = 'NISN tidak boleh kosong';
      invalid.push(rowObj);
      continue;
    }
    if (!kelas) {
      rowObj.error = 'Kelas tidak boleh kosong';
      invalid.push(rowObj);
      continue;
    }
    if (!rayon) {
      rowObj.error = 'Rayon tidak boleh kosong';
      invalid.push(rowObj);
      continue;
    }

    // Cek duplikasi di dalam file yang sama
    if (seenInFile.has(nisn.toLowerCase())) {
      rowObj.error = `NISN "${nisn}" ganda di dalam file Excel`;
      rowObj.isDuplicate = true;
      duplicates.push(rowObj);
      continue;
    }
    seenInFile.add(nisn.toLowerCase());

    // Cek apakah sudah terdaftar di sistem
    if (existingNisns.has(nisn.toLowerCase())) {
      rowObj.error = `NISN "${nisn}" sudah terdaftar di sistem`;
      rowObj.isDuplicate = true;
      duplicates.push(rowObj);
      continue;
    }

    valid.push(rowObj);
  }

  return { valid, invalid, duplicates };
}

/**
 * Parsing & validasi data master kategori poin dari baris Excel
 */
export function parseKategoriRows(
  rows: any[]
): { valid: KategoriExcelRow[]; invalid: KategoriExcelRow[] } {
  const valid: KategoriExcelRow[] = [];
  const invalid: KategoriExcelRow[] = [];
  const seenKode = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const kode = findVal(r, ['kode', 'kodepoin', 'id']);
    const tipeRaw = findVal(r, ['tipe', 'jenis', 'kategoriperilaku']).toLowerCase();
    const kategori = findVal(r, ['pilar', 'kategori', 'kelompok', 'aspek']);
    const deskripsi = findVal(r, ['deskripsi', 'keterangan', 'pelanggaran', 'prestasi', 'uraian']);
    const poinRaw = findVal(r, ['poin', 'bobot', 'point', 'nilai']);

    if (!kode && !tipeRaw && !kategori && !deskripsi) continue;

    const tipe: 'apresiasi' | 'konsekuensi' =
      tipeRaw.includes('apresiasi') || tipeRaw.includes('penghargaan') || tipeRaw.includes('positif')
        ? 'apresiasi'
        : 'konsekuensi';

    const poinNum = parseInt(poinRaw, 10);

    const rowObj: KategoriExcelRow = {
      kode,
      tipe,
      kategori: kategori || 'Umum',
      deskripsi,
      poin: isNaN(poinNum) ? (tipe === 'apresiasi' ? 10 : 10) : Math.abs(poinNum),
      raw: r,
    };

    if (!kode) {
      rowObj.error = 'Kode poin wajib diisi (contoh: A 1.1)';
      invalid.push(rowObj);
      continue;
    }
    if (!deskripsi) {
      rowObj.error = 'Deskripsi perilaku wajib diisi';
      invalid.push(rowObj);
      continue;
    }
    if (seenKode.has(kode.toLowerCase())) {
      rowObj.error = `Kode "${kode}" ganda di dalam file`;
      invalid.push(rowObj);
      continue;
    }
    seenKode.add(kode.toLowerCase());

    valid.push(rowObj);
  }

  return { valid, invalid };
}

/**
 * Ekspor Rekapan Poin Santri Bulanan ke format file Excel (.xlsx)
 */
export function exportRekapSiswaExcel(
  student: { name: string; nisn?: string; kelas: string; rayon: string; points: number; waliName?: string },
  logs: Array<{ kode: string; tipe: string; deskripsi: string; poin: number; time: string; sumberLabel?: string; sumber?: string }>,
  bulanLabel: string,
  breakdown?: { jejakHarian: number; prestasi: number; guruApresiasi: number; konsekuensi: number },
  sekolahNama: string = 'SMK THIBBIL QULUB ASSIMBANI'
) {
  const wb = XLSX.utils.book_new();

  const totalApresiasi = logs.filter((l) => l.tipe === 'apresiasi').reduce((acc, l) => acc + l.poin, 0);
  const totalKonsekuensi = logs.filter((l) => l.tipe === 'konsekuensi').reduce((acc, l) => acc + l.poin, 0);

  // Sheet 1: Rangkuman & Informasi Santri
  const ringkasanData = [
    { 'Informasi Dokumen': 'LEMBAR REKAPITULASI POIN JEJAK', 'Nilai': '' },
    { 'Informasi Dokumen': 'Sekolah / Pondok', 'Nilai': sekolahNama },
    { 'Informasi Dokumen': 'Periode Bulan', 'Nilai': bulanLabel },
    { 'Informasi Dokumen': 'Nama Santri', 'Nilai': student.name },
    { 'Informasi Dokumen': 'NISN', 'Nilai': student.nisn || '-' },
    { 'Informasi Dokumen': 'Kelas', 'Nilai': student.kelas },
    { 'Informasi Dokumen': 'Rayon', 'Nilai': student.rayon },
    { 'Informasi Dokumen': 'Wali Santri', 'Nilai': student.waliName || '-' },
    { 'Informasi Dokumen': 'Total Poin Karakter Saat Ini (Saldo Awal 1000 + Mutasi)', 'Nilai': student.points },
    { 'Informasi Dokumen': 'Poin Jejak Harian Bulan Ini', 'Nilai': breakdown ? `+${breakdown.jejakHarian}` : '-' },
    { 'Informasi Dokumen': 'Poin Prestasi Terverifikasi Bulan Ini', 'Nilai': breakdown ? `+${breakdown.prestasi}` : '-' },
    { 'Informasi Dokumen': 'Apresiasi Guru / BK Bulan Ini', 'Nilai': breakdown ? `+${breakdown.guruApresiasi}` : '-' },
    { 'Informasi Dokumen': 'Total Apresiasi Bulan Ini', 'Nilai': `+${totalApresiasi}` },
    { 'Informasi Dokumen': 'Total Konsekuensi Bulan Ini', 'Nilai': `-${breakdown ? breakdown.konsekuensi : totalKonsekuensi}` },
    { 'Informasi Dokumen': 'Poin Bersih (Net) Bulan Ini', 'Nilai': totalApresiasi - totalKonsekuensi },
    { 'Informasi Dokumen': 'Jumlah Catatan Transaksi', 'Nilai': logs.length },
    { 'Informasi Dokumen': 'Tanggal Dicetak/Unduh', 'Nilai': new Date().toLocaleDateString('id-ID', { dateStyle: 'long' }) },
  ];
  const wsRingkasan = XLSX.utils.json_to_sheet(ringkasanData);
  wsRingkasan['!cols'] = [{ wch: 44 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Rangkuman Santri');

  // Sheet 2: Rincian Catatan Mutasi Poin
  const rincianData = logs.map((log, idx) => ({
    'No': idx + 1,
    'Waktu / Tanggal': log.time,
    'Sumber Poin': log.sumberLabel || 'Guru / BK',
    'Kode': log.kode,
    'Jenis': log.tipe === 'apresiasi' ? 'Apresiasi (+)' : 'Konsekuensi (-)',
    'Poin': log.tipe === 'apresiasi' ? `+${log.poin}` : `-${log.poin}`,
    'Deskripsi Perilaku / Jejak / Prestasi': log.deskripsi,
  }));

  const wsRincian = XLSX.utils.json_to_sheet(
    rincianData.length > 0 ? rincianData : [{ 'No': 1, 'Keterangan': 'Tidak ada mutasi poin pada bulan ini' }]
  );
  wsRincian['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 16 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 52 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRincian, 'Rincian Poin');

  const safeName = student.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeBulan = bulanLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Rekap_Jejak_${safeName}_${safeBulan}.xlsx`);
}

/**
 * Ekspor Rekapan Kolektif Kelas ke format file Excel (.xlsx)
 */
export function exportRekapKelasExcel(
  kelas: string,
  bulanLabel: string,
  rows: Array<{
    no: number;
    nisn: string;
    name: string;
    kelas: string;
    rayon: string;
    totalPoints: number;
    jejakBulanIni?: number;
    prestasiBulanIni?: number;
    guruApresiasiBulanIni?: number;
    apresiasiBulanIni: number;
    konsekuensiBulanIni: number;
    netBulanIni: number;
    predikat: string;
  }>,
  sekolahNama: string = 'SMK THIBBIL QULUB ASSIMBANI'
) {
  const wb = XLSX.utils.book_new();

  const exportData = rows.map((r) => ({
    'No': r.no,
    'NISN': r.nisn,
    'Nama Lengkap Santri': r.name,
    'Kelas': r.kelas,
    'Rayon': r.rayon,
    'Total Poin Karakter': r.totalPoints,
    'Jejak Harian': `+${r.jejakBulanIni ?? 0}`,
    'Prestasi': `+${r.prestasiBulanIni ?? 0}`,
    'Apresiasi Guru/BK': `+${r.guruApresiasiBulanIni ?? 0}`,
    'Total Apresiasi Bulan Ini': `+${r.apresiasiBulanIni}`,
    'Konsekuensi Bulan Ini': `-${r.konsekuensiBulanIni}`,
    'Poin Bersih Bulan Ini': r.netBulanIni >= 0 ? `+${r.netBulanIni}` : `${r.netBulanIni}`,
    'Predikat / Status Karakter': r.predikat,
    'Sekolah': sekolahNama,
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 30 },
    { wch: 16 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 25 },
    { wch: 28 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, `Rekap ${kelas.slice(0, 20)}`);
  const safeKelas = kelas.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeBulan = bulanLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Rekap_Kolektif_Jejak_${safeKelas}_${safeBulan}.xlsx`);
}

