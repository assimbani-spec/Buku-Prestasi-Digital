/**
 * Tes penyatuan riwayat poin (Jejak Harian, Prestasi Terverifikasi, dan Poin Guru/BK).
 *
 * Jalankan: npx tsx tests/poin-history.test.ts
 */

import assert from 'node:assert/strict';
import {
  buildRingkasanJejakHarian,
  filterRiwayatBulan,
  gabungkanRiwayatPoin,
  hitungRingkasanBulan,
  mapJejakDoc,
  parseTanggalLocalMs,
} from '../src/features/rekap/poinHistory';

let passed = 0;
let failed = 0;
async function test(name: string, run: () => Promise<void> | void) {
  try {
    await run();
    passed += 1;
    console.log('  ok  ' + name);
  } catch (error) {
    failed += 1;
    console.error('  FAIL ' + name);
    console.error('       ' + (error instanceof Error ? error.message : String(error)));
  }
}

await test('parseTanggalLocalMs menjaga tanggal awal dan akhir bulan di zona waktu mana pun', () => {
  const start = parseTanggalLocalMs('2026-11-01');
  const end = parseTanggalLocalMs('2026-11-30');
  const dStart = new Date(start);
  const dEnd = new Date(end);

  assert.equal(dStart.getFullYear(), 2026);
  assert.equal(dStart.getMonth(), 10); // November = 10
  assert.equal(dStart.getDate(), 1);
  assert.equal(dEnd.getFullYear(), 2026);
  assert.equal(dEnd.getMonth(), 10);
  assert.equal(dEnd.getDate(), 30);
  assert.equal(parseTanggalLocalMs(''), 0);
  assert.equal(parseTanggalLocalMs('invalid'), 0);
});

await test('gabungkanRiwayatPoin menggabungkan Jejak Harian, Prestasi verified, dan poin_log', () => {
  const harian = [
    mapJejakDoc('u1_2026-11-05', {
      student_id: 'sis-1',
      rayon: 'Rayon A',
      tanggal: '2026-11-05',
      poin_harian: 48,
      subuh: 'berjamaah',
      dzuhur: 'berjamaah',
      tahajud: '4_rakaat',
      dzikir_thoriqoh: true,
      catatan: 'Dzikir 5000x',
    }),
    mapJejakDoc('u1_2026-11-06', {
      student_id: 'sis-1',
      rayon: 'Rayon A',
      tanggal: '2026-11-06',
      poin_harian: 0,
      sedang_menstruasi: true,
    }),
    mapJejakDoc('u2_2026-11-05', {
      student_id: 'sis-2',
      rayon: 'Rayon A',
      tanggal: '2026-11-05',
      poin_harian: 30,
    }),
  ];

  const prestasiList = [
    {
      id: 'pres-1',
      siswa_id: 'sis-1',
      rayon: 'Rayon A',
      judul: 'Juara 1 Tahfidz',
      kategori: 'Keagamaan',
      tingkat: 'Kabupaten',
      capaian: 'Juara 1',
      tanggal: '2026-11-10',
      status: 'verified' as const,
      poin: 250,
      createdBy: 'u1',
      verifiedAtMs: parseTanggalLocalMs('2026-11-12'),
    },
    {
      id: 'pres-2',
      siswa_id: 'sis-1',
      rayon: 'Rayon A',
      judul: 'Prestasi Pending',
      kategori: 'Akademik',
      tingkat: 'Sekolah',
      capaian: 'Finalis',
      tanggal: '2026-11-11',
      status: 'pending' as const,
      poin: 0,
      createdBy: 'u1',
    },
  ];

  const poinLogs = [
    {
      id: 'log-1',
      studentId: 'sis-1',
      kode: 'A 1.1',
      tipe: 'apresiasi',
      deskripsi: 'Memungut sampah',
      poin: 200,
      createdMs: parseTanggalLocalMs('2026-11-08'),
      time: '08/11/2026',
    },
    {
      id: 'log-2',
      studentId: 'sis-1',
      kode: 'K 4.1',
      tipe: 'konsekuensi',
      deskripsi: 'Terlambat apel',
      poin: 50,
      createdMs: parseTanggalLocalMs('2026-11-09'),
      time: '09/11/2026',
    },
    {
      id: 'log-old',
      studentId: 'sis-1',
      kode: 'A 1.2',
      tipe: 'apresiasi',
      deskripsi: 'Bulan lalu',
      poin: 300,
      createdMs: parseTanggalLocalMs('2026-10-20'),
      time: '20/10/2026',
    },
  ];

  const gabunganSis1 = gabungkanRiwayatPoin({
    poinLogs,
    harianLogs: harian,
    prestasiList,
    studentId: 'sis-1',
  });

  // sis-1 harus punya: 1 jejak (48 pts; 0 pts diabaikan), 1 prestasi verified (pending diabaikan), 3 poinLogs
  assert.equal(gabunganSis1.length, 5);

  const novRows = filterRiwayatBulan(gabunganSis1, 10, 2026);
  assert.equal(novRows.length, 4);

  const totals = hitungRingkasanBulan(novRows);
  assert.equal(totals.jejakHarian, 48);
  assert.equal(totals.prestasi, 250);
  assert.equal(totals.guruApresiasi, 200);
  assert.equal(totals.apresiasi, 498);
  assert.equal(totals.konsekuensi, 50);
  assert.equal(totals.net, 448);
  assert.equal(totals.jumlah, 4);
});

await test('buildRingkasanJejakHarian merangkum ibadah & catatan', () => {
  const text = buildRingkasanJejakHarian({
    subuh: 'berjamaah',
    dzuhur: 'berjamaah',
    ashar: 'masbuk',
    maghrib: 'berjamaah',
    isya: 'berjamaah',
    tahajud: '4_rakaat',
    sholat_taubat: true,
    sholat_tasbih: true,
    dzikir_thoriqoh: true,
    grooming: true,
    catatan: 'Allah Allah 5000x',
  });

  assert.match(text, /Sholat Fardhu 5\/5/);
  assert.match(text, /Tahajud 4R/);
  assert.match(text, /2 Sholat Sunnah/);
  assert.match(text, /Dzikir Thoriqoh/);
  assert.match(text, /Allah Allah 5000x/);
});

console.log('');
console.log(`${passed}/${passed + failed} lulus`);
if (failed > 0) process.exit(1);
