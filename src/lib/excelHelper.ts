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
      'Kelas': 'X Farmasi A',
      'Rayon': 'Rayon Siti Aisyah 1',
      'Poin Awal': 1000,
      'Nama Wali': 'H. Syamsul Hadi',
      'No HP Wali': '081234567801',
      'Email Siswa': 'siswa.0071234501@sekolah.id',
      'Email Wali': 'wali.farhan@gmail.com',
    },
    {
      'NISN': '0071234502',
      'Nama Lengkap': 'Ahmad Fauzi Rabbani',
      'Kelas': 'X Farmasi A',
      'Rayon': 'Rayon Siti Aisyah 1',
      'Poin Awal': 1000,
      'Nama Wali': 'Drs. Supriyanto',
      'No HP Wali': '081234567802',
      'Email Siswa': 'siswa.0071234502@sekolah.id',
      'Email Wali': 'supriyanto@gmail.com',
    },
    {
      'NISN': '0071234503',
      'Nama Lengkap': 'Siti Nur Aisyah',
      'Kelas': 'X Keperawatan B',
      'Rayon': 'Rayon Khadijah 2',
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
  XLSX.writeFile(wb, 'Template_Import_Siswa_BKP.xlsx');
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
