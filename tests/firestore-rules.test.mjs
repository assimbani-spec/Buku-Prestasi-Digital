import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, addDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';

const RULES = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

const env = await initializeTestEnvironment({
  projectId: 'demo-bkp',
  firestore: { rules: RULES, host: '127.0.0.1', port: 8080 },
});

const results = [];
const check = async (name, promise, expectOk) => {
  try {
    if (expectOk) await assertSucceeds(promise); else await assertFails(promise);
    results.push('PASS  ' + name);
  } catch (err) {
    results.push('FAIL  ' + name + ' :: ' + String(err.message).slice(0, 180));
  }
};

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'profiles', 'uidSiswa'), { role: 'siswa', email: 'siswa1@test.com', fullName: 'Siswa Satu', studentId: 's1', active: true });
  await setDoc(doc(db, 'profiles', 'uidSiswa2'), { role: 'siswa', email: 'siswa2@test.com', fullName: 'Siswa Dua', studentId: 's2', active: true });
  await setDoc(doc(db, 'profiles', 'uidOrtu'), { role: 'orang_tua', email: 'ortu1@test.com', fullName: 'Wali', childIds: ['s1'], active: true });
  await setDoc(doc(db, 'profiles', 'uidPembimbing'), { role: 'pembimbing_rayon', email: 'pemb@test.com', fullName: 'Pemb', rayonId: 'Rayon A', active: true });
  // Profil lama tanpa field active harus tetap dianggap aktif.
  await setDoc(doc(db, 'profiles', 'uidGuru'), { role: 'guru', email: 'guru1@test.com', fullName: 'Guru' });
  await setDoc(doc(db, 'profiles', 'uidAdmin'), { role: 'admin', email: 'admin@test.com', fullName: 'Admin', active: true });
  await setDoc(doc(db, 'profiles', 'uidNonaktif'), { role: 'siswa', email: 'nonaktif@test.com', fullName: 'Nonaktif', studentId: 's1', active: false });
  await setDoc(doc(db, 'students', 's1'), { name: 'Siswa Satu', nisn: '001', kelas: 'X A', rayon: 'Rayon A', points: 100, lastJournalDate: '2026-09-30', studentEmail: 'siswa1@test.com', waliEmail: 'ortu1@test.com' });
  await setDoc(doc(db, 'students', 's2'), { name: 'Siswa Dua', nisn: '002', kelas: 'X B', rayon: 'Rayon B', points: 100, studentEmail: 'siswa2@test.com', waliEmail: 'ortu2@test.com' });
  await setDoc(doc(db, 'pembiasaan_harian', 'uidSiswa_2026-10-02'), { siswa_id: 'uidSiswa', student_id: 's1', rayon: 'Rayon A', tanggal: '2026-10-02', poin_harian: 10 });
});

const siswa = env.authenticatedContext('uidSiswa', { email: 'siswa1@test.com' }).firestore();
const ortu = env.authenticatedContext('uidOrtu', { email: 'ortu1@test.com' }).firestore();
const pemb = env.authenticatedContext('uidPembimbing', { email: 'pemb@test.com' }).firestore();
const guru = env.authenticatedContext('uidGuru', { email: 'guru1@test.com' }).firestore();
const admin = env.authenticatedContext('uidAdmin', { email: 'admin@test.com' }).firestore();
const nonaktif = env.authenticatedContext('uidNonaktif', { email: 'nonaktif@test.com' }).firestore();
const akunBaru = env.authenticatedContext('uidBaru', { email: 'baru@test.com' }).firestore();

await check('siswa baca dirinya sendiri', getDoc(doc(siswa, 'students', 's1')), true);
await check('siswa baca santri lain (harus tolak)', getDoc(doc(siswa, 'students', 's2')), false);
await check('siswa list seluruh students tanpa filter (harus tolak)', getDocs(collection(siswa, 'students')), false);
await check('ortu baca anaknya', getDoc(doc(ortu, 'students', 's1')), true);
await check('ortu baca bukan anaknya (harus tolak)', getDoc(doc(ortu, 'students', 's2')), false);
await check('pembimbing baca rayonnya', getDoc(doc(pemb, 'students', 's1')), true);
await check('pembimbing baca rayon lain (harus tolak)', getDoc(doc(pemb, 'students', 's2')), false);
await check('guru baca semua santri', getDoc(doc(guru, 'students', 's2')), true);

await check('siswa naikkan poin tanpa tanggal baru (harus tolak)', updateDoc(doc(siswa, 'students', 's1'), { points: 120, updatedAt: serverTimestamp() }), false);
await check('siswa naikkan poin +20 untuk tanggal baru', updateDoc(doc(siswa, 'students', 's1'), { points: 120, lastJournalDate: '2026-10-01', updatedAt: serverTimestamp() }), true);
await check('siswa naikkan poin lagi di tanggal yang sama (harus tolak)', updateDoc(doc(siswa, 'students', 's1'), { points: 140, lastJournalDate: '2026-10-01', updatedAt: serverTimestamp() }), false);
await check('siswa naikkan poin untuk tanggal yang sudah punya jurnal (harus tolak)', updateDoc(doc(siswa, 'students', 's1'), { points: 140, lastJournalDate: '2026-10-02', updatedAt: serverTimestamp() }), false);
await check('siswa naikkan poin +500 sekali tulis (harus tolak)', updateDoc(doc(siswa, 'students', 's1'), { points: 620, lastJournalDate: '2026-10-03' }), false);
await check('siswa ubah nama santri (harus tolak)', updateDoc(doc(siswa, 'students', 's1'), { name: 'Diubah' }), false);
await check('pembimbing ubah poin rayon lain (harus tolak)', updateDoc(doc(pemb, 'students', 's2'), { points: 999 }), false);
await check('pembimbing ubah poin rayonnya', updateDoc(doc(pemb, 'students', 's1'), { points: 150, updatedAt: serverTimestamp() }), true);

// ── Keunikan NISN lewat kunci nisn_index ────────────────────────────
await check('guru tambah santri tanpa kunci NISN (harus tolak)', setDoc(doc(guru, 'students', 's3'), { name: 'Siswa Tiga', nisn: '003', kelas: 'X A', rayon: 'Rayon A', points: 100 }), false);

const batchBaru = writeBatch(guru);
batchBaru.set(doc(guru, 'students', 's3'), { name: 'Siswa Tiga', nisn: '003', kelas: 'X A', rayon: 'Rayon A', points: 100 });
batchBaru.set(doc(guru, 'nisn_index', '003'), { nisn: '003', studentId: 's3', createdAt: serverTimestamp() });
await check('guru tambah santri dengan kunci NISN', batchBaru.commit(), true);
await check('siswa baca indeks NISN (harus tolak)', getDoc(doc(siswa, 'nisn_index', '003')), false);

const batchGanda = writeBatch(guru);
batchGanda.set(doc(guru, 'students', 's4'), { name: 'Siswa Empat', nisn: '003', kelas: 'X A', rayon: 'Rayon A', points: 100 });
batchGanda.set(doc(guru, 'nisn_index', '003'), { nisn: '003', studentId: 's4', createdAt: serverTimestamp() });
await check('NISN ganda ditolak walau dicek ulang', batchGanda.commit(), false);

// ── Jurnal pembiasaan harian ────────────────────────────────────────
const jurnalSiswa = { siswa_id: 'uidSiswa', student_id: 's1', rayon: 'Rayon A', tanggal: '2026-11-01', poin_harian: 10 };
await check('siswa buat jurnal tanggal baru', setDoc(doc(siswa, 'pembiasaan_harian', 'uidSiswa_2026-11-01'), jurnalSiswa), true);
await check('siswa timpa jurnal tanggal yang sama (harus tolak)', setDoc(doc(siswa, 'pembiasaan_harian', 'uidSiswa_2026-11-01'), jurnalSiswa), false);
await check('siswa ubah poin jurnal (harus tolak)', updateDoc(doc(siswa, 'pembiasaan_harian', 'uidSiswa_2026-11-01'), { poin_harian: 60 }), false);
await check('siswa buat jurnal poin di atas 60 (harus tolak)', setDoc(doc(siswa, 'pembiasaan_harian', 'uidSiswa_2026-11-02'), { ...jurnalSiswa, tanggal: '2026-11-02', poin_harian: 61 }), false);
await check('siswa buat jurnal atas nama santri lain (harus tolak)', setDoc(doc(siswa, 'pembiasaan_harian', 'uidSiswa2_2026-11-01'), { ...jurnalSiswa, siswa_id: 'uidSiswa2', student_id: 's2' }), false);
await check('guru koreksi jurnal siswa', updateDoc(doc(guru, 'pembiasaan_harian', 'uidSiswa_2026-11-01'), { poin_harian: 20, updatedAt: serverTimestamp() }), true);

const basePrestasi = { siswa_id: 's1', rayon: 'Rayon A', judul: 'Juara 1', kategori: 'Akademik', tingkat: 'Sekolah', capaian: 'Juara 1', tanggal: '2026-10-01', deskripsi: '' };

await check('siswa buat prestasi verified langsung (harus tolak)', addDoc(collection(siswa, 'prestasi'), { ...basePrestasi, status: 'verified', poin: 500, createdBy: 'uidSiswa' }), false);
await check('siswa buat prestasi poin>0 (harus tolak)', addDoc(collection(siswa, 'prestasi'), { ...basePrestasi, status: 'pending', poin: 500, createdBy: 'uidSiswa' }), false);

let prestasiId = null;
try {
  await assertSucceeds(addDoc(collection(siswa, 'prestasi'), { ...basePrestasi, status: 'pending', poin: 0, createdBy: 'uidSiswa', createdAt: serverTimestamp() }));
  const snap = await getDocs(collection(guru, 'prestasi'));
  prestasiId = snap.docs[0]?.id ?? null;
  results.push('PASS  siswa buat pengajuan pending');
} catch (err) {
  results.push('FAIL  siswa buat pengajuan pending :: ' + String(err.message).slice(0, 180));
}

if (prestasiId) {
  await check('siswa ubah status prestasi (harus tolak)', updateDoc(doc(siswa, 'prestasi', prestasiId), { status: 'verified', poin: 500 }), false);
  await check('siswa ubah poin prestasi (harus tolak)', updateDoc(doc(siswa, 'prestasi', prestasiId), { poin: 500 }), false);
  await check('siswa sunting judul selama pending', updateDoc(doc(siswa, 'prestasi', prestasiId), { judul: 'Juara 1 (revisi)' }), true);
  await check('guru verifikasi prestasi + poin', updateDoc(doc(guru, 'prestasi', prestasiId), { status: 'verified', poin: 50, verifiedBy: 'uidGuru', verifiedAt: serverTimestamp(), catatan_verifikasi: 'ok', updatedAt: serverTimestamp() }), true);
  await check('siswa kembalikan status verified ke pending (harus tolak)', updateDoc(doc(siswa, 'prestasi', prestasiId), { status: 'pending' }), false);
}


// Prestasi milik rayon B: pembimbing Rayon A tidak boleh memverifikasi.
await assertSucceeds(addDoc(collection(guru, 'prestasi'), { ...basePrestasi, siswa_id: 's2', rayon: 'Rayon B', status: 'pending', poin: 0, createdBy: 'uidGuru', createdAt: serverTimestamp() }));
const snapB = await getDocs(collection(guru, 'prestasi'));
const presB = snapB.docs.find((d) => d.data().siswa_id === 's2').id;
await check('pembimbing verifikasi prestasi rayon lain (harus tolak)', updateDoc(doc(pemb, 'prestasi', presB), { status: 'verified', poin: 10, verifiedBy: 'uidPembimbing', verifiedAt: serverTimestamp() }), false);

// Prestasi milik rayon A: pembimbing Rayon A boleh memverifikasi.
await assertSucceeds(addDoc(collection(guru, 'prestasi'), { ...basePrestasi, status: 'pending', poin: 0, createdBy: 'uidGuru', createdAt: serverTimestamp() }));
const snapA = await getDocs(collection(guru, 'prestasi'));
const presA = snapA.docs.find((d) => d.data().siswa_id === 's1' && d.data().status === 'pending').id;
await check('pembimbing verifikasi prestasi rayonnya', updateDoc(doc(pemb, 'prestasi', presA), { status: 'verified', poin: 60, verifiedBy: 'uidPembimbing', verifiedAt: serverTimestamp() }), true);

await check('audit log waktu mundur (harus tolak)', addDoc(collection(siswa, 'audit_log'), { actorId: 'uidSiswa', action: 'jurnal_save', collection: 'x', docId: 'y', createdAt: Timestamp.fromDate(new Date('2020-01-01')) }), false);
await check('audit log memalsukan pelaku (harus tolak)', addDoc(collection(siswa, 'audit_log'), { actorId: 'uidGuru', action: 'jurnal_save', collection: 'x', docId: 'y', createdAt: serverTimestamp() }), false);
await check('audit log sah (serverTimestamp + pelaku sendiri)', addDoc(collection(siswa, 'audit_log'), { actorId: 'uidSiswa', action: 'jurnal_save', collection: 'x', docId: 'y', createdAt: serverTimestamp() }), true);
await check('siswa baca audit log (harus tolak)', getDocs(collection(siswa, 'audit_log')), false);
await check('admin baca audit log', getDocs(collection(admin, 'audit_log')), true);

await check('guru tulis master_kelas (harus tolak)', setDoc(doc(guru, 'master_kelas', 'xi-a'), { nama: 'XI A' }), false);
await check('admin tulis master_kelas', setDoc(doc(admin, 'master_kelas', 'xi-a'), { nama: 'XI A' }), true);
await check('siswa baca master_kelas', getDoc(doc(siswa, 'master_kelas', 'xi-a')), true);

// ── Kegiatan non-rutin ──────────────────────────────────────────────
const baseNonRutin = { rayon: 'Rayon A', tahun: 2026, pekan: 44, periode: '2026_P44', items: [], total_poin: 150, dicatat_oleh: 'uidSiswa', updatedAt: serverTimestamp() };

await check('siswa simpan non-rutin miliknya', setDoc(doc(siswa, 'pembiasaan_non_rutin', 's1_2026_P44'), { ...baseNonRutin, siswa_id: 's1' }), true);
await check('siswa simpan non-rutin santri lain (harus tolak)', setDoc(doc(siswa, 'pembiasaan_non_rutin', 's2_2026_P44'), { ...baseNonRutin, siswa_id: 's2' }), false);
await check('siswa mencatat atas nama orang lain (harus tolak)', setDoc(doc(siswa, 'pembiasaan_non_rutin', 's1_2026_P45'), { ...baseNonRutin, siswa_id: 's1', dicatat_oleh: 'uidGuru' }), false);
await check('ortu baca non-rutin anaknya', getDoc(doc(ortu, 'pembiasaan_non_rutin', 's1_2026_P44')), true);
await check('pembimbing baca non-rutin rayonnya', getDoc(doc(pemb, 'pembiasaan_non_rutin', 's1_2026_P44')), true);

await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'pembiasaan_non_rutin', 's2_2026_P44'), { ...baseNonRutin, siswa_id: 's2', rayon: 'Rayon B', dicatat_oleh: 'uidSiswa2' });
});
await check('ortu baca non-rutin bukan anaknya (harus tolak)', getDoc(doc(ortu, 'pembiasaan_non_rutin', 's2_2026_P44')), false);
await check('pembimbing baca non-rutin rayon lain (harus tolak)', getDoc(doc(pemb, 'pembiasaan_non_rutin', 's2_2026_P44')), false);
await check('guru baca semua non-rutin', getDoc(doc(guru, 'pembiasaan_non_rutin', 's2_2026_P44')), true);

await check('siswa naikkan role sendiri (harus tolak)', updateDoc(doc(siswa, 'profiles', 'uidSiswa'), { role: 'admin' }), false);
await check('admin ubah role pengguna lain', updateDoc(doc(admin, 'profiles', 'uidSiswa2'), { role: 'pembimbing_rayon', rayonId: 'Rayon B' }), true);
await check('siswa baca profil guru (harus tolak)', getDoc(doc(siswa, 'profiles', 'uidGuru')), false);

// ── Akun nonaktif ───────────────────────────────────────────────────
await check('akun nonaktif baca santri (harus tolak)', getDoc(doc(nonaktif, 'students', 's1')), false);
await check('akun nonaktif baca profilnya sendiri', getDoc(doc(nonaktif, 'profiles', 'uidNonaktif')), true);
await check('akun nonaktif tulis audit (harus tolak)', addDoc(collection(nonaktif, 'audit_log'), { actorId: 'uidNonaktif', action: 'jurnal_save', collection: 'x', docId: 'y', createdAt: serverTimestamp() }), false);
await check('admin aktifkan kembali akun', updateDoc(doc(admin, 'profiles', 'uidNonaktif'), { active: true }), true);
await check('akun yang diaktifkan bisa baca santri lagi', getDoc(doc(nonaktif, 'students', 's1')), true);

// ── Pembuatan profil hanya oleh admin ───────────────────────────────
await check('akun baru tidak bisa membuat profil sendiri (harus tolak)', setDoc(doc(akunBaru, 'profiles', 'uidBaru'), { uid: 'uidBaru', email: 'baru@test.com', fullName: 'Baru', role: 'siswa', active: true, total_poin: 1000 }), false);
await check('admin membuat profil akun baru', setDoc(doc(admin, 'profiles', 'uidBaru'), { uid: 'uidBaru', email: 'baru@test.com', fullName: 'Baru', role: 'guru', active: true }), true);
await check('admin membuat profil tanpa active (harus tolak)', setDoc(doc(admin, 'profiles', 'uidBaru2'), { uid: 'uidBaru2', email: 'baru2@test.com', fullName: 'Baru 2', role: 'guru' }), false);

console.log('\n' + results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' lulus');
await env.cleanup();
process.exit(failed ? 1 : 0);
