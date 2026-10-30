/**
 * Tes driver data localStorage.
 *
 * Jalankan: npx tsx tests/local-driver.test.ts
 * Tidak butuh emulator atau kredensial: seluruh data hidup di shim localStorage.
 */

import assert from 'node:assert/strict';
import {
  clearLocalDatabase,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  LocalTimestamp,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  setStorageForTests,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  addDoc,
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
    return [...this.map.keys()][index] ?? null;
  }
}

setStorageForTests(new MemoryStorage() as unknown as Storage);

const db = null as unknown as never;
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL ${name}`);
    console.error(err);
  }
}

async function run(): Promise<void> {
  await test('setDoc + getDoc menyimpan dan membaca dokumen', async () => {
    clearLocalDatabase();
    await setDoc(doc(db, 'students', 's1'), { name: 'Faiz', points: 10 });
    const snap = await getDoc(doc(db, 'students', 's1'));
    assert.equal(snap.exists(), true);
    assert.equal(snap.data()?.name, 'Faiz');
    assert.equal(snap.get('points'), 10);
  });

  await test('getDoc dokumen tak ada mengembalikan exists() false', async () => {
    const snap = await getDoc(doc(db, 'students', 'tidak-ada'));
    assert.equal(snap.exists(), false);
    assert.equal(snap.data(), undefined);
  });

  await test('setDoc merge mempertahankan field lama', async () => {
    await setDoc(doc(db, 'students', 's1'), { kelas: 'X TKJ 1' }, { merge: true });
    const data = (await getDoc(doc(db, 'students', 's1'))).data();
    assert.equal(data?.name, 'Faiz');
    assert.equal(data?.kelas, 'X TKJ 1');
  });

  await test('serverTimestamp menjadi Timestamp yang bisa dibaca', async () => {
    await setDoc(doc(db, 'poin_log', 'p1'), { createdAt: serverTimestamp() });
    const createdAt = (await getDoc(doc(db, 'poin_log', 'p1'))).data()?.createdAt;
    assert.ok(createdAt instanceof LocalTimestamp);
    assert.equal(typeof createdAt.toMillis(), 'number');
  });

  await test('updateDoc + increment menambah nilai berjalan', async () => {
    await setDoc(doc(db, 'students', 's2'), { points: 100 });
    await updateDoc(doc(db, 'students', 's2'), { points: increment(25) });
    await updateDoc(doc(db, 'students', 's2'), { points: increment(5) });
    assert.equal((await getDoc(doc(db, 'students', 's2'))).data()?.points, 130);
  });

  await test('updateDoc dokumen tak ada ditolak, bukan membuat dokumen', async () => {
    await assert.rejects(() => updateDoc(doc(db, 'students', 'hantu'), { points: 1 }));
    assert.equal((await getDoc(doc(db, 'students', 'hantu'))).exists(), false);
  });

  await test('addDoc memberi id otomatis', async () => {
    const ref = await addDoc(collection(db, 'poin_log'), { siswa_id: 's1', poin: 5 });
    assert.ok(ref.id.length > 0);
    assert.equal((await getDoc(ref)).data()?.poin, 5);
  });

  await test('query where ==, where in, orderBy desc, dan limit', async () => {
    for (const [id, poin] of [['a', 10], ['b', 30], ['c', 20]] as const) {
      await setDoc(doc(db, 'riwayat', id), { siswa_id: 's1', poin });
    }
    await setDoc(doc(db, 'riwayat', 'd'), { siswa_id: 's2', poin: 99 });

    const milikS1 = await getDocsOf(query(collection(db, 'riwayat'), where('siswa_id', '==', 's1')));
    assert.equal(milikS1.length, 3);

    const duaAnak = await getDocsOf(
      query(collection(db, 'riwayat'), where('siswa_id', 'in', ['s1', 's2']))
    );
    assert.equal(duaAnak.length, 4);

    const urut = await getDocsOf(
      query(
        collection(db, 'riwayat'),
        where('siswa_id', '==', 's1'),
        orderBy('poin', 'desc'),
        limit(2)
      )
    );
    assert.deepEqual(urut.map((row) => row.poin), [30, 20]);
  });

  await test('writeBatch menulis semua perubahan sekaligus', async () => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'students', 's3'), { name: 'Nabila' });
    batch.set(doc(db, 'audit_log', 'a1'), { action: 'student_create', siswa_id: 's3' });
    await batch.commit();
    assert.equal((await getDoc(doc(db, 'students', 's3'))).data()?.name, 'Nabila');
    assert.equal((await getDoc(doc(db, 'audit_log', 'a1'))).data()?.action, 'student_create');
  });

  await test('writeBatch yang gagal tidak menulis apa pun', async () => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'students', 's4'), { name: 'Gagal' });
    batch.update(doc(db, 'students', 'tidak-ada'), { name: 'x' });
    await assert.rejects(() => batch.commit());
    assert.equal((await getDoc(doc(db, 'students', 's4'))).exists(), false);
  });

  await test('deleteDoc menghapus dokumen', async () => {
    await setDoc(doc(db, 'students', 's5'), { name: 'Hapus' });
    await deleteDoc(doc(db, 'students', 's5'));
    assert.equal((await getDoc(doc(db, 'students', 's5'))).exists(), false);
  });

  await test('onSnapshot dokumen memanggil ulang setelah perubahan', async () => {
    await setDoc(doc(db, 'notifikasi', 'n1'), { judul: 'Awal' });
    const seen: string[] = [];
    const stop = onSnapshot(doc(db, 'notifikasi', 'n1'), (snap) => {
      seen.push(String(snap.data()?.judul));
    });
    assert.deepEqual(seen, ['Awal']);

    await setDoc(doc(db, 'notifikasi', 'n1'), { judul: 'Baru' }, { merge: true });
    assert.deepEqual(seen, ['Awal', 'Baru']);

    stop();
    await setDoc(doc(db, 'notifikasi', 'n1'), { judul: 'Setelah berhenti' }, { merge: true });
    assert.deepEqual(seen, ['Awal', 'Baru']);
  });

  await test('onSnapshot koleksi ikut terpicu oleh dokumen baru', async () => {
    const counts: number[] = [];
    const stop = onSnapshot(
      query(collection(db, 'pengumuman'), orderBy('createdAt', 'desc')),
      (snap) => counts.push(snap.docs.length)
    );
    await addDoc(collection(db, 'pengumuman'), { judul: 'Satu', createdAt: Timestamp.now() });
    await addDoc(collection(db, 'pengumuman'), { judul: 'Dua', createdAt: Timestamp.now() });
    stop();
    assert.deepEqual(counts, [0, 1, 2]);
  });

  await test('data bertahan setelah dibaca ulang dari penyimpanan', async () => {
    const first = (await getDoc(doc(db, 'students', 's1'))).data();
    const second = (await getDoc(doc(db, 'students', 's1'))).data();
    assert.deepEqual(first, second);
    assert.ok(first?.createdAt === undefined || first.createdAt instanceof LocalTimestamp);
  });

  await test('seed lokal membuat 5 profil dan tidak berulang', async () => {
    clearLocalDatabase();
    const { ensureLocalSeed, LOCAL_ACCOUNTS } = await import('../src/lib/data/seed');
    await ensureLocalSeed();
    await ensureLocalSeed();

    assert.equal(LOCAL_ACCOUNTS.length, 5);
    for (const account of LOCAL_ACCOUNTS) {
      const profile = await getDoc(doc(db, 'profiles', account.uid));
      assert.equal(profile.exists(), true, `profil ${account.uid} belum ada`);
      assert.equal(profile.data()?.role, account.role);
    }

    const santri = await getDocsOf(query(collection(db, 'students'), orderBy('name')));
    assert.equal(santri.length, 4);
    const poin = await getDocsOf(query(collection(db, 'poin_log'), limit(100)));
    assert.equal(poin.length, 4, 'seed poin_log tidak boleh dobel');
  });

  console.log(`\n${passed}/${passed + failed} lulus`);
  if (failed > 0) process.exitCode = 1;
}

/** Pembungkus kecil agar tes tidak bergantung pada tipe snapshot Firestore. */
async function getDocsOf(target: any): Promise<any[]> {
  const { getDocs } = await import('../src/lib/data/localDriver');
  const snap = await getDocs(target);
  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
}

run();
