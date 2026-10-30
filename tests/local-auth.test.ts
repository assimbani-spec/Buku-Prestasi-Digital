/**
 * Tes login mode lokal: hash kata sandi, sesi, dan penolakan kredensial salah.
 *
 * Jalankan: npx tsx tests/local-auth.test.ts
 * Tidak butuh emulator atau kredensial. WebCrypto tersedia di Node 20+.
 */

import assert from 'node:assert/strict';
import { clearLocalDatabase, doc, getDoc, setDoc, setStorageForTests } from '../src/lib/data/localDriver';

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

const { hashPassword, verifyPassword, normalizeEmail, MIN_PASSWORD_LENGTH } = await import(
  '../src/lib/localAuth'
);
const { ensureLocalSeed, LOCAL_SEED_PASSWORD } = await import('../src/lib/data/seed');
const { signInWithEmail, signOutUser, watchAuthUser, resetLocalData } = await import(
  '../src/lib/auth'
);

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

/** Membaca sesi terkini lewat pemantau, seperti yang dipakai aplikasi. */
function currentUid(): Promise<string | null> {
  return new Promise((resolve) => {
    let stop: (() => void) | null = null;
    let delivered = false;
    stop = watchAuthUser((user) => {
      if (delivered) return;
      delivered = true;
      resolve(user ? user.uid : null);
      queueMicrotask(() => stop?.());
    });
  });
}

clearLocalDatabase();
storage.clear();

await test('kata sandi pendek ditolak', async () => {
  await assert.rejects(() => hashPassword('pendek'), new RegExp(String(MIN_PASSWORD_LENGTH)));
});

await test('hash tidak memuat kata sandi asli dan salt berbeda tiap kali', async () => {
  const a = await hashPassword('rahasiaSekali99');
  const b = await hashPassword('rahasiaSekali99');
  assert.ok(!a.passwordHash.includes('rahasiaSekali99'));
  assert.notEqual(a.passwordSalt, b.passwordSalt);
  assert.notEqual(a.passwordHash, b.passwordHash);
});

await test('verifyPassword menerima kata sandi benar dan menolak yang salah', async () => {
  const credential = await hashPassword('kataSandi123');
  assert.equal(await verifyPassword('kataSandi123', credential), true);
  assert.equal(await verifyPassword('kataSandi124', credential), false);
  assert.equal(await verifyPassword('', credential), false);
});

await test('profil tanpa hash tidak pernah lolos verifikasi', async () => {
  assert.equal(await verifyPassword('apa saja', {}), false);
});

await test('normalizeEmail merapikan spasi dan huruf besar', () => {
  assert.equal(normalizeEmail('  Admin@Lokal.Test '), 'admin@lokal.test');
});

await test('seed membuat akun admin yang bisa masuk dengan kata sandi awal', async () => {
  await ensureLocalSeed();
  await signInWithEmail('Admin@Lokal.test', LOCAL_SEED_PASSWORD);
  assert.equal(await currentUid(), 'lokal-admin');
});

await test('kata sandi salah ditolak dengan pesan yang tidak membocorkan akun', async () => {
  await assert.rejects(
    () => signInWithEmail('admin@lokal.test', 'salahSekali'),
    /Email atau kata sandi salah/
  );
});

await test('email tak dikenal ditolak dengan pesan yang sama', async () => {
  await assert.rejects(
    () => signInWithEmail('tidak-ada@lokal.test', LOCAL_SEED_PASSWORD),
    /Email atau kata sandi salah/
  );
});

await test('akun buatan admin bisa masuk, dan kata sandinya tidak tersimpan apa adanya', async () => {
  const credential = await hashPassword('guruBaru2026');
  const uid = 'u-guru-baru';
  await setDoc(doc(null as unknown as never, 'profiles', uid), {
    uid,
    email: 'guru.baru@lokal.test',
    fullName: 'Ust. Guru Baru',
    role: 'guru',
    active: true,
    ...credential,
  });

  const raw = storage.getItem('bkp.localdb.v2') ?? '';
  assert.ok(!raw.includes('guruBaru2026'), 'kata sandi asli tidak boleh ada di penyimpanan');
  assert.ok(raw.includes('passwordHash'), 'profil harus menyimpan hash');

  await signInWithEmail('guru.baru@lokal.test', 'guruBaru2026');
  assert.equal(await currentUid(), uid);

  const stored = await getDoc(doc(null as unknown as never, 'profiles', uid));
  assert.equal(stored.data()?.fullName, 'Ust. Guru Baru');
});

await test('akun nonaktif tidak bisa masuk walau kata sandinya benar', async () => {
  await setDoc(
    doc(null as unknown as never, 'profiles', 'u-guru-baru'),
    { active: false },
    { merge: true }
  );
  await assert.rejects(
    () => signInWithEmail('guru.baru@lokal.test', 'guruBaru2026'),
    /dinonaktifkan/
  );
});

await test('keluar menghapus sesi', async () => {
  await signInWithEmail('admin@lokal.test', LOCAL_SEED_PASSWORD);
  await signOutUser();
  assert.equal(await currentUid(), null);
});

await test('reset data lokal menghapus sesi dan seluruh data', async () => {
  await signInWithEmail('admin@lokal.test', LOCAL_SEED_PASSWORD);
  await resetLocalData();
  assert.equal(await currentUid(), null);
  assert.equal(storage.getItem('bkp.localdb.v2'), null);
});

console.log('');
console.log(`${passed}/${passed + failed} lulus`);
if (failed > 0) process.exit(1);
