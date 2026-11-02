/**
 * Tes module prestasi.
 *
 * Jalankan: npx tsx tests/prestasi.test.ts
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

const { ajukanPrestasi, putuskanPrestasi } = await import('../src/features/prestasi/prestasi');

const GURU = { uid: 'u-guru', email: 'guru@lokal.test', role: 'guru' };
const SISWA = { uid: 'u-siswa', email: 'faiz@lokal.test', role: 'siswa' };

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
  const snap = await getDocs(query(collection(null as unknown as never, collectionName), orderBy('createdAt', 'asc')));
  return snap.docs.map((item: any) => ({ id: item.id, ...item.data() }));
}

async function siapkanSantri() {
  clearLocalDatabase();
  await setDoc(doc(null as unknown as never, 'students', 'siswa-1'), {
    name: 'Muhammad Faiz',
    kelas: 'X TKJ 1',
    rayon: 'Rayon Assimbani 1',
    points: 10,
  });
}

const pengajuan = {
  siswaId: 'siswa-1',
  rayon: 'Rayon Assimbani 1',
  judul: 'Juara 1 Lomba Tahfidz',
  kategori: 'Keagamaan',
  tingkat: 'Kabupaten',
  capaian: 'Juara 1',
  tanggal: '2026-10-20',
  deskripsi: 'Lomba antar santri',
};

await test('pengajuan tersimpan sebagai pending tanpa poin, beserta audit', async () => {
  await siapkanSantri();
  const { id } = await ajukanPrestasi(pengajuan, SISWA);

  const data = (await getDoc(doc(null as unknown as never, 'prestasi', id))).data();
  assert.equal(data?.status, 'pending');
  assert.equal(data?.poin, 0);
  assert.equal(data?.createdBy, SISWA.uid);
  assert.equal(data?.judul, 'Juara 1 Lomba Tahfidz');

  const audit = await semua('audit_log');
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'prestasi_submit');
  assert.equal(audit[0].actorId, SISWA.uid);
  assert.equal(audit[0].siswa_id, 'siswa-1');
});

await test('judul atau capaian kosong ditolak dan tidak menulis apa pun', async () => {
  await siapkanSantri();
  await assert.rejects(
    () => ajukanPrestasi({ ...pengajuan, judul: '   ' }, SISWA),
    /Judul prestasi dan capaian wajib diisi/
  );
  assert.equal((await semua('prestasi')).length, 0);
  assert.equal((await semua('audit_log')).length, 0);
});

await test('santri tanpa sesi ditolak', async () => {
  await siapkanSantri();
  await assert.rejects(
    () => ajukanPrestasi(pengajuan, { uid: '', role: 'siswa' }),
    /Sesi berakhir/
  );
});

await test('verifikasi menambah poin santri, status, dan audit', async () => {
  await siapkanSantri();
  const { id } = await ajukanPrestasi(pengajuan, SISWA);
  await putuskanPrestasi(
    { id, siswa_id: 'siswa-1', rayon: 'Rayon Assimbani 1', status: 'pending', poin: 0 },
    { status: 'verified', poin: 120, catatan: 'Sesuai bukti piagam' },
    GURU
  );

  const pres = (await getDoc(doc(null as unknown as never, 'prestasi', id))).data();
  assert.equal(pres?.status, 'verified');
  assert.equal(pres?.poin, 120);
  assert.equal(pres?.verifiedBy, GURU.uid);
  assert.equal(pres?.catatan_verifikasi, 'Sesuai bukti piagam');

  const santri = (await getDoc(doc(null as unknown as never, 'students', 'siswa-1'))).data();
  assert.equal(santri?.points, 130, 'poin santri harus bertambah 120');

  const audit = await semua('audit_log');
  const verify = audit.find((entry) => entry.action === 'prestasi_verify');
  assert.ok(verify, 'audit verifikasi wajib tercatat');
  assert.equal(verify.actorRole, 'guru');
});

await test('penolakan tidak menambah poin dan tercatat sebagai reject', async () => {
  await siapkanSantri();
  const { id } = await ajukanPrestasi(pengajuan, SISWA);
  await putuskanPrestasi(
    { id, siswa_id: 'siswa-1', rayon: 'Rayon Assimbani 1', status: 'pending', poin: 0 },
    { status: 'rejected', catatan: 'Bukti belum lengkap' },
    GURU
  );

  const pres = (await getDoc(doc(null as unknown as never, 'prestasi', id))).data();
  assert.equal(pres?.status, 'rejected');
  assert.equal(pres?.poin, 0);

  const santri = (await getDoc(doc(null as unknown as never, 'students', 'siswa-1'))).data();
  assert.equal(santri?.points, 10, 'poin santri tidak boleh berubah');

  const audit = await semua('audit_log');
  assert.ok(audit.some((entry) => entry.action === 'prestasi_reject'));
});

await test('pengajuan yang sudah diproses tidak bisa diverifikasi dua kali', async () => {
  await siapkanSantri();
  const { id } = await ajukanPrestasi(pengajuan, SISWA);
  const ringkas = { id, siswa_id: 'siswa-1', rayon: 'Rayon Assimbani 1', status: 'pending' as const, poin: 0 };
  await putuskanPrestasi(ringkas, { status: 'verified', poin: 50 }, GURU);
  await assert.rejects(
    () => putuskanPrestasi(ringkas, { status: 'verified', poin: 50 }, GURU),
    /sudah diproses/
  );

  const santri = (await getDoc(doc(null as unknown as never, 'students', 'siswa-1'))).data();
  assert.equal(santri?.points, 60, 'poin tidak boleh bertambah dua kali');
});

await test('poin di luar batas ditolak sebelum menulis', async () => {
  await siapkanSantri();
  const { id } = await ajukanPrestasi(pengajuan, SISWA);
  const ringkas = { id, siswa_id: 'siswa-1', rayon: 'Rayon Assimbani 1', status: 'pending' as const, poin: 0 };
  await assert.rejects(
    () => putuskanPrestasi(ringkas, { status: 'verified', poin: 0 }, GURU),
    /Poin verifikasi harus/
  );
  const pres = (await getDoc(doc(null as unknown as never, 'prestasi', id))).data();
  assert.equal(pres?.status, 'pending');
});

await test('peran tanpa kewenangan tidak bisa memverifikasi', async () => {
  await siapkanSantri();
  const { id } = await ajukanPrestasi(pengajuan, SISWA);
  await assert.rejects(
    () =>
      putuskanPrestasi(
        { id, siswa_id: 'siswa-1', rayon: 'Rayon Assimbani 1', status: 'pending', poin: 0 },
        { status: 'verified', poin: 10 },
        SISWA
      ),
    /Hanya guru, pembimbing rayon, atau admin/
  );
});

console.log('');
console.log(`${passed}/${passed + failed} lulus`);
if (failed > 0) process.exit(1);
