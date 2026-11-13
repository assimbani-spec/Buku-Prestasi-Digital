/**
 * Tes fitur Kenaikan Kelas & Tutup Tahun Ajaran.
 *
 * Jalankan: VITE_DATA_BACKEND=local npx tsx tests/kenaikan-kelas.test.ts
 */

import assert from 'node:assert/strict';
import {
  clearLocalDatabase,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  setStorageForTests,
} from '../src/lib/data/localDriver';

class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null;
  }
}

const storage = new MemoryStorage();
setStorageForTests(storage as unknown as Storage);
(globalThis as any).localStorage = storage;

const { tambahSiswa } = await import('../src/features/siswa/siswa');
const {
  sarankanKelasBerikutnya,
  sarankanTahunAjaranBerikutnya,
  hitungRencanaKenaikan,
  prosesTutupTahunAjaran,
  aktifkanKembaliSantri,
} = await import('../src/features/admin/kenaikanKelas');

const ADMIN = { uid: 'u-admin', email: 'admin@lokal.test', role: 'admin' };
const dbRef = null as unknown as never;

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

console.log('kenaikan-kelas.test.ts');

await test('sarankanKelasBerikutnya memetakan tingkat romawi dan angka dengan benar', () => {
  assert.deepEqual(sarankanKelasBerikutnya('X A', ['XI A']), {
    kelasAsal: 'X A',
    aksi: 'naik_kelas',
    kelasTujuan: 'XI A',
  });
  assert.deepEqual(sarankanKelasBerikutnya('XI TKJ 1'), {
    kelasAsal: 'XI TKJ 1',
    aksi: 'naik_kelas',
    kelasTujuan: 'XII TKJ 1',
  });
  assert.deepEqual(sarankanKelasBerikutnya('XII A'), {
    kelasAsal: 'XII A',
    aksi: 'lulus',
    kelasTujuan: 'Lulus / Alumni',
  });
  assert.deepEqual(sarankanKelasBerikutnya('VII B'), {
    kelasAsal: 'VII B',
    aksi: 'naik_kelas',
    kelasTujuan: 'VIII B',
  });
  assert.deepEqual(sarankanKelasBerikutnya('IX C'), {
    kelasAsal: 'IX C',
    aksi: 'lulus',
    kelasTujuan: 'Lulus / Alumni',
  });
  assert.deepEqual(sarankanKelasBerikutnya('10 IPA 1'), {
    kelasAsal: '10 IPA 1',
    aksi: 'naik_kelas',
    kelasTujuan: '11 IPA 1',
  });
  assert.deepEqual(sarankanKelasBerikutnya('12 IPS 2'), {
    kelasAsal: '12 IPS 2',
    aksi: 'lulus',
    kelasTujuan: 'Lulus / Alumni',
  });
  assert.deepEqual(sarankanKelasBerikutnya('Tahfidz Khusus'), {
    kelasAsal: 'Tahfidz Khusus',
    aksi: 'tetap',
    kelasTujuan: 'Tahfidz Khusus',
  });
});

await test('sarankanTahunAjaranBerikutnya menambah 1 tahun pelajaran', () => {
  assert.equal(sarankanTahunAjaranBerikutnya('2025/2026'), '2026/2027');
  assert.equal(sarankanTahunAjaranBerikutnya('2027 / 2028'), '2028/2029');
});

await test('prosesTutupTahunAjaran menaikkan kelas, meluluskan XII, mereset poin aktif, dan menyimpan arsip tanpa hapus riwayat lama', async () => {
  clearLocalDatabase();

  const s1 = await tambahSiswa(
    { name: 'Ahmad Santri X', nisn: '100001', kelas: 'X A', rayon: 'Rayon 1', points: 1350 },
    ADMIN
  );
  const s2 = await tambahSiswa(
    { name: 'Budi Tinggal Kelas', nisn: '100002', kelas: 'X A', rayon: 'Rayon 1', points: 650 },
    ADMIN
  );
  const s3 = await tambahSiswa(
    { name: 'Citra Santri XI', nisn: '100003', kelas: 'XI A', rayon: 'Rayon 2', points: 1120 },
    ADMIN
  );
  const s4 = await tambahSiswa(
    { name: 'Dewi Alumni XII', nisn: '100004', kelas: 'XII A', rayon: 'Rayon 2', points: 1480 },
    ADMIN
  );

  // Simulasikan riwayat poin_log lama & akun profil siswa lulus
  await setDoc(doc(dbRef, 'poin_log', 'log-lama-1'), {
    siswa_id: s1.id,
    kode: 'A 1.1',
    tipe: 'apresiasi',
    poin: 350,
    rayon: 'Rayon 1',
  });
  await setDoc(doc(dbRef, 'profiles', 'prof-dewi'), {
    uid: 'prof-dewi',
    email: 'dewi@sekolah.id',
    fullName: 'Dewi Alumni XII',
    role: 'siswa',
    studentId: s4.id,
    active: true,
  });

  const allStudents = [s1, s2, s3, s4];
  const masterKelas = ['X A', 'XI A', 'XII A'];
  const rencanaMap = {
    'X A': sarankanKelasBerikutnya('X A', masterKelas),
    'XI A': sarankanKelasBerikutnya('XI A', masterKelas),
    'XII A': sarankanKelasBerikutnya('XII A', masterKelas),
  };

  const rencana = hitungRencanaKenaikan(
    allStudents,
    rencanaMap,
    new Set([s2.id]), // Budi tetap di X A
    masterKelas,
    { modeResetPoin: 'reset_default', poinDefaultBaru: 1000 }
  );

  assert.equal(rencana.totalDiproses, 4);
  assert.equal(rencana.naikKelas, 2);
  assert.equal(rencana.lulus, 1);
  assert.equal(rencana.tetap, 1);

  const res = await prosesTutupTahunAjaran({
    rencana,
    opsi: {
      tahunAjaranLama: '2025/2026',
      tahunAjaranBaru: '2026/2027',
      modeResetPoin: 'reset_default',
      poinDefaultBaru: 1000,
      buatMasterKelasOtomatis: true,
      nonaktifkanAkunLulus: true,
      catatan: 'Uji tutup tahun',
    },
    aktor: ADMIN,
    profiles: [
      { id: 'prof-dewi', role: 'siswa', studentId: s4.id, active: true },
    ],
  });

  assert.equal(res.totalDiproses, 4);

  // Cek data santri setelah proses
  const d1 = (await getDoc(doc(dbRef, 'students', s1.id))).data() as any;
  assert.equal(d1.kelas, 'XI A');
  assert.equal(d1.points, 1000);
  assert.equal(d1.statusSiswa, 'aktif');
  assert.equal(d1.tahunAjaran, '2026/2027');

  const d2 = (await getDoc(doc(dbRef, 'students', s2.id))).data() as any;
  assert.equal(d2.kelas, 'X A');
  assert.equal(d2.points, 1000);

  const d3 = (await getDoc(doc(dbRef, 'students', s3.id))).data() as any;
  assert.equal(d3.kelas, 'XII A');
  assert.equal(d3.points, 1000);

  const d4 = (await getDoc(doc(dbRef, 'students', s4.id))).data() as any;
  assert.equal(d4.statusSiswa, 'lulus');
  assert.equal(d4.tahunLulus, '2025/2026');
  assert.equal(d4.points, 1480); // Poin akhir alumni tetap terjaga

  // Akun login alumni otomatis dinonaktifkan
  const profDewi = (await getDoc(doc(dbRef, 'profiles', 'prof-dewi'))).data() as any;
  assert.equal(profDewi.active, false);

  // Riwayat lama tidak terhapus
  const logLama = await getDoc(doc(dbRef, 'poin_log', 'log-lama-1'));
  assert.equal(logLama.exists(), true);

  // Arsip tahunan tersimpan lengkap
  const arsipSnap = await getDoc(doc(dbRef, 'arsip_tahun_ajaran', res.arsipId));
  assert.equal(arsipSnap.exists(), true);
  assert.equal((arsipSnap.data() as any).ringkasan.lulus, 1);

  const detailSnap = await getDocs(collection(dbRef, 'arsip_santri_tahunan'));
  assert.equal(detailSnap.docs.length, 4);

  // Aktifkan kembali santri lulus
  await aktifkanKembaliSantri({
    studentId: s4.id,
    studentName: s4.name,
    tahunAjaranAktif: '2026/2027',
    aktor: ADMIN,
  });
  const d4After = (await getDoc(doc(dbRef, 'students', s4.id))).data() as any;
  assert.equal(d4After.statusSiswa, 'aktif');
});

console.log(`\nHasil: ${passed} lulus, ${failed} gagal`);
if (failed > 0) process.exit(1);
