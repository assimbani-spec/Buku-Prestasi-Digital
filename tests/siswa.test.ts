/**
 * Tes module tambah santri.
 *
 * Jalankan: npx tsx tests/siswa.test.ts
 * Memakai adapter localStorage, tanpa emulator dan tanpa React.
 */

import assert from 'node:assert/strict';
import {
  clearLocalDatabase,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
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

const { tambahSiswa, updateSiswa, hapusSiswa } = await import('../src/features/siswa/siswa');

const ADMIN = { uid: 'u-admin', email: 'admin@lokal.test', role: 'admin' };
const GURU = { uid: 'u-guru', email: 'guru@lokal.test', role: 'guru' };

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

async function semua(collectionName: string): Promise<any[]> {
  const snap = await getDocs(
    query(collection(null as unknown as never, collectionName), orderBy('createdAt', 'asc'))
  );
  return snap.docs.map((item: any) => ({ id: item.id, ...item.data() }));
}

const santriBaru = {
  name: 'Muhammad Rayhan Al-Fatih',
  nisn: '0081234567',
  kelas: 'X Farmasi A',
  rayon: 'Assimbani 1',
  points: 1000,
  waliName: 'Bpk. Rahmat Hidayat',
  waliPhone: '08123456789',
  waliEmail: 'wali@example.com',
  studentEmail: 'rayhan@sekolah.test',
};

await test('santri tersimpan lengkap dengan audit pembuatan', async () => {
  clearLocalDatabase();
  const santri = await tambahSiswa(santriBaru, ADMIN);

  const tersimpan = (await getDoc(doc(null as unknown as never, 'students', santri.id))).data();
  assert.equal(tersimpan?.name, santriBaru.name);
  assert.equal(tersimpan?.nisn, santriBaru.nisn);
  assert.equal(tersimpan?.kelas, santriBaru.kelas);
  assert.equal(tersimpan?.rayon, santriBaru.rayon);
  assert.equal(tersimpan?.points, 1000);
  assert.equal(tersimpan?.dibuat_oleh, ADMIN.uid);

  const indeks = (
    await getDoc(doc(null as unknown as never, 'nisn_index', santriBaru.nisn))
  ).data();
  assert.equal(indeks?.studentId, santri.id, 'kunci NISN harus menunjuk santri ini');

  const audit = await semua('audit_log');
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'student_create');
  assert.equal(audit[0].actorRole, 'admin');
  assert.equal(audit[0].docId, santri.id);
});

await test('NISN ganda ditolak dan tidak menambah data', async () => {
  clearLocalDatabase();
  await tambahSiswa(santriBaru, ADMIN);
  await assert.rejects(
    () => tambahSiswa({ ...santriBaru, name: 'Santri Lain' }, ADMIN),
    /NISN itu sudah terdaftar/
  );

  const santri = await semua('students');
  assert.equal(santri.length, 1);
  assert.equal((await semua('audit_log')).length, 1, 'audit tidak boleh bertambah');
});

await test('nama, NISN, kelas, dan rayon wajib diisi', async () => {
  clearLocalDatabase();
  await assert.rejects(() => tambahSiswa({ ...santriBaru, name: ' ' }, ADMIN), /Nama lengkap/);
  await assert.rejects(() => tambahSiswa({ ...santriBaru, nisn: '' }, ADMIN), /NISN santri wajib/);
  await assert.rejects(() => tambahSiswa({ ...santriBaru, nisn: '12ab' }, ADMIN), /4 sampai 20 angka/);
  await assert.rejects(() => tambahSiswa({ ...santriBaru, kelas: '' }, ADMIN), /Kelas santri/);
  await assert.rejects(() => tambahSiswa({ ...santriBaru, rayon: '' }, ADMIN), /Rayon santri/);
  assert.equal((await semua('students')).length, 0);
});

await test('poin awal di luar batas dan email salah ditolak', async () => {
  clearLocalDatabase();
  await assert.rejects(
    () => tambahSiswa({ ...santriBaru, points: -1 }, ADMIN),
    /Poin awal harus/
  );
  await assert.rejects(
    () => tambahSiswa({ ...santriBaru, points: 100_001 }, ADMIN),
    /Poin awal harus/
  );
  await assert.rejects(
    () => tambahSiswa({ ...santriBaru, waliEmail: 'bukan-email' }, ADMIN),
    /Format email wali/
  );
  await assert.rejects(
    () => tambahSiswa({ ...santriBaru, studentEmail: 'salah@' }, ADMIN),
    /Format email santri/
  );
});

await test('tanpa sesi aktif, penulisan ditolak', async () => {
  clearLocalDatabase();
  await assert.rejects(
    () => tambahSiswa(santriBaru, { uid: '', role: 'admin' }),
    /Sesi berakhir/
  );
});

await test('guru juga bisa menambah santri, dengan peran tercatat di audit', async () => {
  clearLocalDatabase();
  await setDoc(doc(null as unknown as never, 'students', 'siswa-lama'), {
    name: 'Santri Lama',
    nisn: '0099999999',
    kelas: 'XI Farmasi A',
    rayon: 'Simbang 2',
    points: 500,
  });

  const santri = await tambahSiswa(santriBaru, GURU);
  const audit = await semua('audit_log');
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actorRole, 'guru');
  assert.equal(audit[0].after.nisn, santri.nisn);

  const jumlah = await semua('students');
  assert.equal(jumlah.length, 2);
});

await test('updateSiswa memperbarui kelas dan data santri beserta audit log', async () => {
  clearLocalDatabase();
  const santri = await tambahSiswa(santriBaru, ADMIN);

  await updateSiswa(
    santri.id,
    {
      ...santriBaru,
      nisn: '0087654321',
      kelas: 'XI Rekayasa Perangkat Lunak',
      rayon: 'Assimbani 2',
    },
    ADMIN
  );

  const terupdate = (await getDoc(doc(null as unknown as never, 'students', santri.id))).data();
  assert.equal(terupdate?.kelas, 'XI Rekayasa Perangkat Lunak');
  assert.equal(terupdate?.rayon, 'Assimbani 2');
  assert.equal(terupdate?.nisn, '0087654321');

  const kunciBaru = (
    await getDoc(doc(null as unknown as never, 'nisn_index', '0087654321'))
  ).data();
  assert.equal(kunciBaru?.studentId, santri.id);
  const kunciLama = (
    await getDoc(doc(null as unknown as never, 'nisn_index', santriBaru.nisn))
  ).exists();
  assert.equal(kunciLama, false, 'kunci NISN lama harus dilepas');

  const audit = await semua('audit_log');
  assert.equal(audit.length, 2);
  assert.equal(audit[1].action, 'student_update');
  assert.equal(audit[1].actorRole, 'admin');
  assert.equal(audit[1].after.kelas, 'XI Rekayasa Perangkat Lunak');
});

await test('hapusSiswa menghapus dokumen santri dan mencatat audit log', async () => {
  clearLocalDatabase();
  const santri = await tambahSiswa(santriBaru, ADMIN);

  await hapusSiswa(santri.id, santri.name, ADMIN);

  const terhapus = (await getDoc(doc(null as unknown as never, 'students', santri.id))).exists();
  assert.equal(terhapus, false);

  const kunci = (await getDoc(doc(null as unknown as never, 'nisn_index', santriBaru.nisn))).exists();
  assert.equal(kunci, false, 'kunci NISN harus dilepas saat santri dihapus');

  const audit = await semua('audit_log');
  assert.equal(audit.length, 2);
  assert.equal(audit[1].action, 'student_delete');
  assert.equal(audit[1].actorRole, 'admin');
  assert.equal(audit[1].before.nama, santri.name);
});

console.log('');
console.log(`${passed}/${passed + failed} lulus`);
if (failed > 0) process.exit(1);
