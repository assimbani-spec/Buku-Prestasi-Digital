/**
 * Data contoh untuk mode lokal.
 *
 * Data ini hanya ditulis bila backend aktif adalah localStorage dan belum
 * pernah di-seed. Tujuannya agar aplikasi bisa langsung dicoba tanpa Firebase
 * Console. Semua entri adalah contoh: nama santri fiktif, bukan data nyata.
 * Kelima akun awal memakai kata sandi yang sama dan bisa diganti admin dari
 * panel admin. Hapus seluruh data dengan `clearLocalDatabase()` atau tombol
 * "Hapus data lokal" di halaman login.
 */

import { addDoc, collection, doc, getDoc, isLocalBackend, setDoc, LocalTimestamp } from './index';
import type { UserRole } from '../firebase';
import { hashPassword } from '../localAuth';

const dbToken = null as unknown as never;

export interface LocalAccount {
  uid: string;
  label: string;
  description: string;
  role: UserRole;
  email: string;
  fullName: string;
  studentId?: string;
  childIds?: string[];
  rayonId?: string;
}

/** Kata sandi awal untuk kelima akun contoh mode lokal. */
export const LOCAL_SEED_PASSWORD = 'bkp12345';

/** Versi data contoh. Naikkan bila struktur seed berubah agar bisa migrasi. */
const SEED_VERSION = 3;

export const LOCAL_ACCOUNTS: LocalAccount[] = [
  {
    uid: 'lokal-admin',
    label: 'Admin sekolah',
    description: 'Master data dan audit log',
    role: 'admin',
    email: 'admin@lokal.test',
    fullName: 'Admin BKP',
  },
  {
    uid: 'lokal-guru',
    label: 'Guru / BK',
    description: 'Semua santri, input poin, verifikasi',
    role: 'guru',
    email: 'guru@lokal.test',
    fullName: 'Ust. Guru BK',
  },
  {
    uid: 'lokal-pembimbing',
    label: 'Pembimbing rayon',
    description: 'Rayon Assimbani 1',
    role: 'pembimbing_rayon',
    email: 'pembimbing@lokal.test',
    fullName: 'Ust. Pembimbing Rayon',
    rayonId: 'Rayon Assimbani 1',
  },
  {
    uid: 'lokal-siswa',
    label: 'Santri',
    description: 'Faiz, X TKJ 1',
    role: 'siswa',
    email: 'faiz@lokal.test',
    fullName: 'Muhammad Faiz',
    studentId: 'siswa-1',
  },
  {
    uid: 'lokal-ortu',
    label: 'Wali santri',
    description: 'Wali dari Faiz',
    role: 'orang_tua',
    email: 'wali@lokal.test',
    fullName: 'Bapak Wali Faiz',
    childIds: ['siswa-1'],
  },
];

const STUDENTS = [
  {
    id: 'siswa-1',
    name: 'Muhammad Faiz',
    nisn: '0072618291',
    kelas: 'X TKJ 1',
    rayon: 'Rayon Assimbani 1',
    points: 132,
    studentEmail: 'faiz@lokal.test',
    waliEmail: 'wali@lokal.test',
    waliName: 'Bapak Wali Faiz',
    waliPhone: '',
  },
  {
    id: 'siswa-2',
    name: 'Aisyah Nurul Qulub',
    nisn: '0072618302',
    kelas: 'XI Keperawatan B',
    rayon: 'Rayon Assimbani 2',
    points: 348,
    waliName: '',
  },
  {
    id: 'siswa-3',
    name: 'Rizky Ramadhan',
    nisn: '0072618315',
    kelas: 'X TKJ 2',
    rayon: 'Rayon Simbang 2',
    points: 76,
  },
  {
    id: 'siswa-4',
    name: 'Nabila Zahra',
    nisn: '0072618327',
    kelas: 'XI Farmasi A',
    rayon: 'Rayon Assimbani 1',
    points: 521,
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Mengisi kata sandi untuk akun contoh yang belum punya, misalnya data yang
 * dibuat sebelum mode lokal memakai login email dan kata sandi.
 */
async function upgradeSeed(version: number): Promise<void> {
  const credential = await hashPassword(LOCAL_SEED_PASSWORD);
  for (const account of LOCAL_ACCOUNTS) {
    const ref = doc(dbToken, 'profiles', account.uid);
    const existing = await getDoc(ref);
    if (!existing.exists()) continue;
    const data = existing.data() as Record<string, any>;
    if (data.passwordHash) continue;
    await setDoc(
      ref,
      { ...credential, active: data.active !== false, updatedAt: new LocalTimestamp(Date.now()) },
      { merge: true }
    );
  }
  await setDoc(
    doc(dbToken, 'meta', 'seed'),
    { version: SEED_VERSION, upgradedFrom: version, upgradedAt: new LocalTimestamp(Date.now()) },
    { merge: true }
  );
}

async function createSeed(): Promise<void> {
  const credential = await hashPassword(LOCAL_SEED_PASSWORD);

  for (const account of LOCAL_ACCOUNTS) {
    await setDoc(doc(dbToken, 'profiles', account.uid), {
      uid: account.uid,
      email: account.email,
      fullName: account.fullName,
      role: account.role,
      active: true,
      ...credential,
      total_poin: 1000,
      ...(account.studentId ? { studentId: account.studentId } : {}),
      ...(account.childIds ? { childIds: account.childIds } : {}),
      ...(account.rayonId ? { rayonId: account.rayonId } : {}),
      createdAt: new LocalTimestamp(Date.now()),
    });
  }

  for (const student of STUDENTS) {
    await setDoc(doc(dbToken, 'students', student.id), {
      ...student,
      lastJournalDate: '',
      createdAt: new LocalTimestamp(Date.now() - 30 * DAY_MS),
      updatedAt: new LocalTimestamp(Date.now()),
    });
  }

  const poinSeed: Array<{
    siswa_id: string;
    rayon: string;
    kode: string;
    tipe: 'apresiasi' | 'konsekuensi';
    deskripsi: string;
    poin: number;
    daysAgo: number;
  }> = [
    { siswa_id: 'siswa-1', rayon: 'Rayon Assimbani 1', kode: 'A 1.3', tipe: 'apresiasi', deskripsi: 'Muhammad Faiz: Melaksanakan sholat Tahajud 4 rakaat', poin: 6, daysAgo: 1 },
    { siswa_id: 'siswa-1', rayon: 'Rayon Assimbani 1', kode: 'A 3.4', tipe: 'apresiasi', deskripsi: 'Muhammad Faiz: Aktif dalam kelompok belajar', poin: 4, daysAgo: 2 },
    { siswa_id: 'siswa-1', rayon: 'Rayon Assimbani 1', kode: 'K 4.3', tipe: 'konsekuensi', deskripsi: 'Muhammad Faiz: Tidak membawa buku kejar prestasi', poin: 100, daysAgo: 5 },
    { siswa_id: 'siswa-4', rayon: 'Rayon Assimbani 1', kode: 'A 1.7', tipe: 'apresiasi', deskripsi: 'Nabila Zahra: Menjadi petugas upacara', poin: 1000, daysAgo: 8 },
  ];

  for (const entry of poinSeed) {
    await addDoc(collection(dbToken, 'poin_log'), {
      siswa_id: entry.siswa_id,
      rayon: entry.rayon,
      kode: entry.kode,
      tipe: entry.tipe,
      deskripsi: entry.deskripsi,
      poin: entry.poin,
      dicatat_oleh: 'lokal-guru',
      createdAt: new LocalTimestamp(Date.now() - entry.daysAgo * DAY_MS),
    });
  }

  await setDoc(doc(dbToken, 'prestasi', 'prestasi-1'), {
    siswa_id: 'siswa-1',
    rayon: 'Rayon Assimbani 1',
    judul: 'Juara 2 Lomba Tahfidz 5 Juz',
    kategori: 'Keagamaan',
    tingkat: 'Kabupaten',
    capaian: 'Juara 2',
    tanggal: new Date(Date.now() - 6 * DAY_MS).toISOString().slice(0, 10),
    deskripsi: 'Contoh pengajuan yang menunggu verifikasi guru.',
    status: 'pending',
    poin: 0,
    createdBy: 'lokal-siswa',
    createdAt: new LocalTimestamp(Date.now() - 6 * DAY_MS),
  });

  for (const notif of [
    {
      id: 'notif-1',
      user_id: 'lokal-ortu',
      judul: 'Contoh pemberitahuan',
      isi: 'Ini contoh pemberitahuan mode lokal. Guru dapat mengirim pesan resmi ke akun wali santri.',
    },
    {
      id: 'notif-2',
      user_id: 'lokal-siswa',
      judul: 'Contoh pengumuman',
      isi: 'Isi jurnal pembiasaan setiap hari, termasuk saat kegiatan non-rutin pekan ini.',
    },
  ]) {
    await setDoc(doc(dbToken, 'notifikasi', notif.id), {
      user_id: notif.user_id,
      judul: notif.judul,
      isi: notif.isi,
      createdAt: new LocalTimestamp(Date.now() - 2 * DAY_MS),
    });
  }

  for (const master of [
    { collection: 'master_kelas', id: 'x-tkj-1', data: { nama: 'X TKJ 1' } },
    { collection: 'master_kelas', id: 'xi-keperawatan-b', data: { nama: 'XI Keperawatan B' } },
    { collection: 'master_rayon', id: 'assimbani-1', data: { nama: 'Rayon Assimbani 1' } },
    { collection: 'master_rayon', id: 'assimbani-2', data: { nama: 'Rayon Assimbani 2' } },
  ]) {
    await setDoc(doc(dbToken, master.collection, master.id), {
      ...master.data,
      createdAt: new LocalTimestamp(Date.now()),
    });
  }

  await setDoc(doc(dbToken, 'meta', 'seed'), {
    version: SEED_VERSION,
    seededAt: new LocalTimestamp(Date.now()),
    note: 'Data contoh mode lokal. Aman dihapus.',
  });
}

export async function ensureLocalSeed(): Promise<void> {
  if (!isLocalBackend) return;

  const marker = await getDoc(doc(dbToken, 'meta', 'seed'));
  if (!marker.exists()) {
    await createSeed();
    return;
  }

  const version = Number((marker.data() as Record<string, any>)?.version ?? 0);
  if (version >= SEED_VERSION) return;
  await upgradeSeed(version);
}
