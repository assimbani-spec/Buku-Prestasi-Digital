/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Panel Administrator: satu-satunya tempat mengelola master data
 * (kelas, rayon, kategori poin) dan membaca audit log.
 *
 * Kewenangan ini juga dikunci di firestore.rules (`allow write: if isAdmin()`),
 * jadi membuka komponen ini tanpa role admin tidak memberi akses tulis apa pun.
 */

import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from '../lib/data';
import {
  BookOpen,
  LogOut,
  Plus,
  Trash2,
  Users,
  ScrollText,
  Layers,
  ListChecks,
  LayoutDashboard,
  ShieldCheck,
  AlertCircle,
  UserPlus,
  KeyRound,
  UserX,
  UserCheck,
} from 'lucide-react';
import { db, isLocalBackend } from '../lib/data';
import type { UserProfile, AuditLogRecord } from '../lib/firebase';
import { newAuditRef, buildAuditPayload } from '../lib/audit';
import { canManageMasterData, roleLabel, type Role } from '../lib/rbac';
import { hashPassword, normalizeEmail, MIN_PASSWORD_LENGTH } from '../lib/localAuth';

interface AdminPanelProps {
  profile: UserProfile | null;
  onLogout: () => void;
  onOpenStaffDashboard: () => void;
}

interface KelasRow {
  id: string;
  nama: string;
}
interface RayonRow {
  id: string;
  nama: string;
}
interface PenggunaRow {
  id: string;
  fullName: string;
  email: string;
  role: Role | '';
  active: boolean;
  studentId: string;
  rayonId: string;
  childIds: string[];
}
interface SantriOption {
  id: string;
  name: string;
  kelas: string;
  rayon: string;
}
interface KategoriRow {
  id: string;
  kode: string;
  tipe: 'apresiasi' | 'konsekuensi';
  kategori: string;
  deskripsi: string;
  poin: number;
}

const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const AdminPanel: React.FC<AdminPanelProps> = ({
  profile,
  onLogout,
  onOpenStaffDashboard,
}) => {
  const [tab, setTab] = useState<'master' | 'pengguna' | 'audit'>('master');
  const [kelas, setKelas] = useState<KelasRow[]>([]);
  const [rayon, setRayon] = useState<RayonRow[]>([]);
  const [kategori, setKategori] = useState<KategoriRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<(AuditLogRecord & { createdAtMs: number })[]>([]);
  const [auditFilter, setAuditFilter] = useState('semua');

  const [pengguna, setPengguna] = useState<PenggunaRow[]>([]);
  const [santri, setSantri] = useState<SantriOption[]>([]);
  const [userForm, setUserForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'guru' as Role,
  });
  const [studentLink, setStudentLink] = useState('');
  const [rayonLink, setRayonLink] = useState('');
  const [childSelection, setChildSelection] = useState<string[]>([]);
  const [passwordTarget, setPasswordTarget] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState('');

  const [newKelas, setNewKelas] = useState('');
  const [newRayon, setNewRayon] = useState('');
  const [newKategori, setNewKategori] = useState({
    kode: '',
    tipe: 'apresiasi' as 'apresiasi' | 'konsekuensi',
    kategori: '',
    deskripsi: '',
    poin: 100,
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isAdmin = canManageMasterData(profile?.role);

  useEffect(() => {
    if (!profile) return;
    const unsubs = [
      onSnapshot(collection(db, 'master_kelas'), (snap) =>
        setKelas(
          snap.docs
            .map((d) => ({ id: d.id, nama: (d.data() as any).nama ?? d.id }))
            .sort((a, b) => a.nama.localeCompare(b.nama))
        )
      ),
      onSnapshot(collection(db, 'master_rayon'), (snap) =>
        setRayon(
          snap.docs
            .map((d) => ({ id: d.id, nama: (d.data() as any).nama ?? d.id }))
            .sort((a, b) => a.nama.localeCompare(b.nama))
        )
      ),
      onSnapshot(collection(db, 'master_kategori_poin'), (snap) =>
        setKategori(
          snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              kode: data.kode ?? d.id,
              tipe: data.tipe === 'konsekuensi' ? 'konsekuensi' : 'apresiasi',
              kategori: data.kategori ?? '-',
              deskripsi: data.deskripsi ?? '',
              poin: Number(data.poin) || 0,
            } as KategoriRow;
          })
        )
      ),
      onSnapshot(collection(db, 'profiles'), (snap) =>
        setPengguna(
          snap.docs
            .map((d) => {
              const data = d.data() as any;
              return {
                id: d.id,
                fullName: data.fullName ?? '(tanpa nama)',
                email: data.email ?? '',
                role: data.role ?? '',
                active: data.active !== false,
                studentId: data.studentId ?? data.anak_id ?? '',
                rayonId: data.rayonId ?? data.rayon ?? '',
                childIds: Array.isArray(data.childIds)
                  ? data.childIds
                  : data.anak_id
                    ? [data.anak_id]
                    : [],
              } as PenggunaRow;
            })
            .sort((a, b) => a.fullName.localeCompare(b.fullName))
        )
      ),
      onSnapshot(collection(db, 'students'), (snap) =>
        setSantri(
          snap.docs
            .map((d) => {
              const data = d.data() as any;
              return {
                id: d.id,
                name: data.name ?? '(tanpa nama)',
                kelas: data.kelas ?? '-',
                rayon: data.rayon ?? '-',
              } as SantriOption;
            })
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      ),
      onSnapshot(
        query(collection(db, 'audit_log'), orderBy('createdAt', 'desc'), limit(200)),
        (snap) =>
          setAuditLogs(
            snap.docs.map((d) => {
              const data = d.data() as any;
              return {
                id: d.id,
                actorId: data.actorId ?? '',
                actorEmail: data.actorEmail ?? '',
                actorRole: data.actorRole ?? '',
                action: data.action ?? '',
                collection: data.collection ?? '',
                docId: data.docId ?? '',
                siswa_id: data.siswa_id ?? null,
                rayon: data.rayon ?? null,
                createdAtMs: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0,
              } as AuditLogRecord & { createdAtMs: number };
            })
          )
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [profile]);

  const writeWithAudit = async (
    action: 'master_create' | 'master_delete',
    collectionName: string,
    docId: string,
    payload: Record<string, unknown>,
    auditAfter: Record<string, unknown>
  ) => {
    const user = profile ? { uid: profile.uid, email: profile.email } : null;
    if (!user || !isAdmin) {
      setError('Hanya administrator yang dapat mengubah master data.');
      return;
    }
    const batch = writeBatch(db);
    if (action === 'master_delete') {
      batch.delete(doc(db, collectionName, docId));
    } else {
      batch.set(doc(db, collectionName, docId), payload, { merge: true });
    }
    batch.set(
      newAuditRef(),
      buildAuditPayload({
        actor: { uid: user.uid, email: user.email, role: profile?.role },
        action,
        collectionName,
        docId,
        after: auditAfter,
      })
    );
    await batch.commit();
  };

  const handleAddKelas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKelas.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await writeWithAudit(
        'master_create',
        'master_kelas',
        slug(newKelas),
        { nama: newKelas.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
        { nama: newKelas.trim() }
      );
      setNewKelas('');
      setNotice('Kelas ditambahkan.');
    } catch (err) {
      setError('Gagal menambah kelas: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const handleAddRayon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRayon.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await writeWithAudit(
        'master_create',
        'master_rayon',
        slug(newRayon),
        { nama: newRayon.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
        { nama: newRayon.trim() }
      );
      setNewRayon('');
      setNotice('Rayon ditambahkan.');
    } catch (err) {
      setError('Gagal menambah rayon: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const handleAddKategori = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKategori.kode.trim() || !newKategori.deskripsi.trim()) {
      setError('Kode dan deskripsi kategori wajib diisi.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = slug(newKategori.kode);
      await writeWithAudit(
        'master_create',
        'master_kategori_poin',
        id,
        {
          kode: newKategori.kode.trim(),
          tipe: newKategori.tipe,
          kategori: newKategori.kategori.trim() || '-',
          deskripsi: newKategori.deskripsi.trim(),
          poin: Number(newKategori.poin) || 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { ...newKategori }
      );
      setNewKategori({ kode: '', tipe: 'apresiasi', kategori: '', deskripsi: '', poin: 100 });
      setNotice('Kategori poin ditambahkan.');
    } catch (err) {
      setError('Gagal menambah kategori: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (collectionName: string, id: string, label: string) => {
    if (!window.confirm(`Hapus "${label}" dari master data?`)) return;
    setBusy(true);
    setError(null);
    try {
      await writeWithAudit('master_delete', collectionName, id, {}, { dihapus: label });
      setNotice(`"${label}" dihapus.`);
    } catch (err) {
      setError('Gagal menghapus: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const newUid = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `u-${crypto.randomUUID()}`
      : `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  const resetUserForm = () => {
    setUserForm({ fullName: '', email: '', password: '', role: 'guru' });
    setStudentLink('');
    setRayonLink('');
    setChildSelection([]);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !isAdmin) {
      setError('Hanya administrator yang dapat menambah akun.');
      return;
    }
    if (!isLocalBackend) {
      setError('Di mode Firestore, akun login dibuat lewat Firebase Console, bukan dari panel ini.');
      return;
    }

    const fullName = userForm.fullName.trim();
    const email = normalizeEmail(userForm.email);
    if (!fullName || !email) {
      setError('Nama lengkap dan email wajib diisi.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Format email belum benar.');
      return;
    }
    if (userForm.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      return;
    }
    if (pengguna.some((row) => row.email.toLowerCase() === email)) {
      setError('Email itu sudah dipakai akun lain. Gunakan email berbeda.');
      return;
    }
    if (userForm.role === 'siswa' && !studentLink) {
      setError('Pilih santri yang akan ditautkan ke akun siswa.');
      return;
    }
    if (userForm.role === 'orang_tua' && childSelection.length === 0) {
      setError('Pilih minimal satu anak untuk akun wali santri.');
      return;
    }
    if (userForm.role === 'pembimbing_rayon' && !rayonLink.trim()) {
      setError('Isi rayon yang menjadi kewenangan pembimbing.');
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const credential = await hashPassword(userForm.password);
      const uid = newUid();
      const linked =
        userForm.role === 'siswa'
          ? { studentId: studentLink }
          : userForm.role === 'orang_tua'
            ? { childIds: childSelection }
            : userForm.role === 'pembimbing_rayon'
              ? { rayonId: rayonLink.trim() }
              : {};
      const linkedRayon =
        userForm.role === 'pembimbing_rayon'
          ? rayonLink.trim()
          : santri.find((item) => item.id === studentLink)?.rayon ?? null;

      const batch = writeBatch(db);
      batch.set(doc(db, 'profiles', uid), {
        uid,
        email,
        fullName,
        role: userForm.role,
        active: true,
        ...credential,
        total_poin: userForm.role === 'siswa' ? 1000 : 0,
        ...linked,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (userForm.role === 'siswa' && studentLink) {
        // Simpan email akun di master santri agar penelusuran lama tetap jalan.
        batch.set(
          doc(db, 'students', studentLink),
          { studentEmail: email, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
      batch.set(
        newAuditRef(),
        buildAuditPayload({
          actor: { uid: profile.uid, email: profile.email, role: profile.role },
          action: 'user_create',
          collectionName: 'profiles',
          docId: uid,
          siswaId: studentLink || null,
          rayon: linkedRayon || null,
          after: { email, fullName, role: userForm.role, active: true, ...linked },
        })
      );
      await batch.commit();
      setNotice(`Akun ${email} dibuat. Sampaikan kata sandi awal kepada pemiliknya.`);
      resetUserForm();
    } catch (err) {
      setError('Gagal membuat akun: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (row: PenggunaRow) => {
    if (!profile || !isAdmin) return;
    if (row.id === profile.uid) {
      setError('Tidak bisa menonaktifkan akun yang sedang dipakai.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nextActive = !row.active;
      const batch = writeBatch(db);
      batch.update(doc(db, 'profiles', row.id), {
        active: nextActive,
        updatedAt: serverTimestamp(),
      });
      batch.set(
        newAuditRef(),
        buildAuditPayload({
          actor: { uid: profile.uid, email: profile.email, role: profile.role },
          action: 'user_update',
          collectionName: 'profiles',
          docId: row.id,
          after: { active: nextActive },
        })
      );
      await batch.commit();
      setNotice(nextActive ? `Akun ${row.email} diaktifkan.` : `Akun ${row.email} dinonaktifkan.`);
    } catch (err) {
      setError('Gagal mengubah status akun: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const handleSavePassword = async (row: PenggunaRow) => {
    if (!profile || !isAdmin) return;
    if (passwordValue.length < MIN_PASSWORD_LENGTH) {
      setError(`Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const credential = await hashPassword(passwordValue);
      const batch = writeBatch(db);
      batch.update(doc(db, 'profiles', row.id), {
        ...credential,
        updatedAt: serverTimestamp(),
      });
      batch.set(
        newAuditRef(),
        buildAuditPayload({
          actor: { uid: profile.uid, email: profile.email, role: profile.role },
          action: 'user_update',
          collectionName: 'profiles',
          docId: row.id,
          meta: { perubahan: 'kata sandi diatur ulang' },
        })
      );
      await batch.commit();
      setNotice(`Kata sandi ${row.email} sudah diperbarui.`);
      setPasswordTarget(null);
      setPasswordValue('');
    } catch (err) {
      setError('Gagal mengubah kata sandi: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteUser = async (row: PenggunaRow) => {
    if (!profile || !isAdmin) return;
    if (row.id === profile.uid) {
      setError('Tidak bisa menghapus akun yang sedang dipakai.');
      return;
    }
    if (!window.confirm(`Hapus akun ${row.email}? Santri dan riwayat poinnya tidak dihapus.`)) return;
    setBusy(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'profiles', row.id));
      batch.set(
        newAuditRef(),
        buildAuditPayload({
          actor: { uid: profile.uid, email: profile.email, role: profile.role },
          action: 'user_delete',
          collectionName: 'profiles',
          docId: row.id,
          before: { email: row.email, fullName: row.fullName, role: row.role },
        })
      );
      await batch.commit();
      setNotice(`Akun ${row.email} dihapus.`);
    } catch (err) {
      setError('Gagal menghapus akun: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const filteredLogs =
    auditFilter === 'semua' ? auditLogs : auditLogs.filter((l) => l.action === auditFilter);

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-screen bg-[#F1F8E9] text-gray-900">
      <aside className="w-full md:w-64 bg-[#0F3D14] text-white p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-green-900">
            <div className="w-10 h-10 rounded-xl bg-green-900 border border-green-500/40 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-green-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">Panel Admin</h2>
              <span className="text-xs text-green-300">BKP Digital</span>
            </div>
          </div>

          <nav className="space-y-1.5 text-xs font-medium">
            <button
              onClick={() => setTab('master')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                tab === 'master' ? 'bg-[#2E7D32] font-bold' : 'text-green-200 hover:bg-green-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Master Data</span>
            </button>
            <button
              onClick={() => setTab('pengguna')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                tab === 'pengguna' ? 'bg-[#2E7D32] font-bold' : 'text-green-200 hover:bg-green-900'
              }`}
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              <span>Pengguna</span>
            </button>
            <button
              onClick={() => setTab('audit')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                tab === 'audit' ? 'bg-[#2E7D32] font-bold' : 'text-green-200 hover:bg-green-900'
              }`}
            >
              <ScrollText className="w-4 h-4" />
              <span>Audit Log</span>
            </button>
            <button
              onClick={onOpenStaffDashboard}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-green-200 hover:bg-green-900 transition-all"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard Guru</span>
            </button>
          </nav>
        </div>

        <div className="pt-6 border-t border-green-900/80">
          <span className="text-xs font-bold block">{profile?.fullName || 'Administrator'}</span>
          <span className="text-xs text-green-300 block mb-3">{roleLabel(profile?.role)}</span>
          <button
            onClick={onLogout}
            className="w-full py-2 px-3 bg-red-900/60 hover:bg-red-800 text-red-200 text-xs rounded-xl flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#1B5E20]" />
            <h1 className="text-lg font-bold">
              {tab === 'master'
                ? 'Master Data BKP'
                : tab === 'pengguna'
                  ? 'Akun Pengguna'
                  : 'Jejak Audit Transaksi'}
            </h1>
          </div>

          {!isAdmin && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Akun ini bukan admin. Panel hanya bisa dibaca; semua penulisan akan ditolak rules.
            </div>
          )}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800">
              {notice}
            </div>
          )}

          {tab === 'master' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Kelas */}
              <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 space-y-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#2E7D32]" /> Kelas / Rombel
                </h2>
                <form onSubmit={handleAddKelas} className="flex gap-2">
                  <input
                    value={newKelas}
                    onChange={(e) => setNewKelas(e.target.value)}
                    placeholder="Contoh: XI Farmasi A"
                    className="flex-1 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-3 py-2 bg-[#2E7D32] text-white rounded-xl text-xs font-bold flex items-center gap-1 disabled:bg-gray-300"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah
                  </button>
                </form>
                <ul className="divide-y divide-gray-100 text-xs">
                  {kelas.map((k) => (
                    <li key={k.id} className="py-2 flex items-center justify-between">
                      <span>{k.nama}</span>
                      <button
                        onClick={() => handleDelete('master_kelas', k.id, k.nama)}
                        className="text-red-500 hover:text-red-700"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                  {kelas.length === 0 && <li className="py-2 text-gray-400">Belum ada data.</li>}
                </ul>
              </section>

              {/* Rayon */}
              <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 space-y-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#2E7D32]" /> Rayon
                </h2>
                <form onSubmit={handleAddRayon} className="flex gap-2">
                  <input
                    value={newRayon}
                    onChange={(e) => setNewRayon(e.target.value)}
                    placeholder="Contoh: Siti Aisyah 1"
                    className="flex-1 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-3 py-2 bg-[#2E7D32] text-white rounded-xl text-xs font-bold flex items-center gap-1 disabled:bg-gray-300"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah
                  </button>
                </form>
                <ul className="divide-y divide-gray-100 text-xs">
                  {rayon.map((r) => (
                    <li key={r.id} className="py-2 flex items-center justify-between">
                      <span>{r.nama}</span>
                      <button
                        onClick={() => handleDelete('master_rayon', r.id, r.nama)}
                        className="text-red-500 hover:text-red-700"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                  {rayon.length === 0 && <li className="py-2 text-gray-400">Belum ada data.</li>}
                </ul>
              </section>

              {/* Kategori poin */}
              <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 space-y-3 lg:col-span-2">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-[#2E7D32]" /> Kategori Poin
                </h2>
                <form onSubmit={handleAddKategori} className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  <input
                    value={newKategori.kode}
                    onChange={(e) => setNewKategori({ ...newKategori, kode: e.target.value })}
                    placeholder="Kode (A 1.1)"
                    className="px-2 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none"
                  />
                  <select
                    value={newKategori.tipe}
                    onChange={(e) =>
                      setNewKategori({
                        ...newKategori,
                        tipe: e.target.value as 'apresiasi' | 'konsekuensi',
                      })
                    }
                    className="px-2 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none"
                  >
                    <option value="apresiasi">Apresiasi</option>
                    <option value="konsekuensi">Konsekuensi</option>
                  </select>
                  <input
                    value={newKategori.kategori}
                    onChange={(e) => setNewKategori({ ...newKategori, kategori: e.target.value })}
                    placeholder="Pilar"
                    className="px-2 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none"
                  />
                  <input
                    value={newKategori.deskripsi}
                    onChange={(e) => setNewKategori({ ...newKategori, deskripsi: e.target.value })}
                    placeholder="Deskripsi tindakan"
                    className="col-span-2 px-2 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newKategori.poin}
                      onChange={(e) =>
                        setNewKategori({ ...newKategori, poin: Number(e.target.value) })
                      }
                      className="w-20 px-2 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-3 py-2 bg-[#2E7D32] text-white rounded-xl text-xs font-bold disabled:bg-gray-300"
                    >
                      +
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="p-2">Kode</th>
                        <th className="p-2">Tipe</th>
                        <th className="p-2">Pilar</th>
                        <th className="p-2">Deskripsi</th>
                        <th className="p-2">Poin</th>
                        <th className="p-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {kategori.map((k) => (
                        <tr key={k.id}>
                          <td className="p-2 font-bold">{k.kode}</td>
                          <td className="p-2">{k.tipe}</td>
                          <td className="p-2">{k.kategori}</td>
                          <td className="p-2">{k.deskripsi}</td>
                          <td className="p-2 font-bold">{k.poin}</td>
                          <td className="p-2 text-right">
                            <button
                              onClick={() => handleDelete('master_kategori_poin', k.id, k.kode)}
                              className="text-red-500 hover:text-red-700"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {kategori.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-3 text-gray-400">
                            Belum ada kategori. Selama kosong, aplikasi memakai daftar kode bawaan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {tab === 'pengguna' && (
            <div className="space-y-4">
              <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-[#2E7D32]" aria-hidden="true" /> Tambah akun
                  </h2>
                  <span className="text-xs text-gray-500">{pengguna.length} akun terdaftar</span>
                </div>

                {!isLocalBackend ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
                    Di mode Firestore, akun login dibuat di Firebase Console pada menu Authentication,
                    lalu profilnya dihubungkan di sini. Form di bawah hanya aktif di mode lokal.
                  </p>
                ) : (
                  <form onSubmit={handleAddUser} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label htmlFor="user-name" className="mb-1 block text-xs font-semibold">
                        Nama lengkap
                      </label>
                      <input
                        id="user-name"
                        value={userForm.fullName}
                        onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                        placeholder="Contoh: Ust. Ahmad Fauzi"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#2E7D32]"
                      />
                    </div>
                    <div>
                      <label htmlFor="user-email" className="mb-1 block text-xs font-semibold">
                        Email masuk
                      </label>
                      <input
                        id="user-email"
                        type="email"
                        inputMode="email"
                        autoComplete="off"
                        value={userForm.email}
                        onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                        placeholder="nama@thibbilqulub.sch.id"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#2E7D32]"
                      />
                    </div>
                    <div>
                      <label htmlFor="user-password" className="mb-1 block text-xs font-semibold">
                        Kata sandi awal
                      </label>
                      <input
                        id="user-password"
                        type="password"
                        autoComplete="new-password"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#2E7D32]"
                      />
                    </div>
                    <div>
                      <label htmlFor="user-role" className="mb-1 block text-xs font-semibold">
                        Peran
                      </label>
                      <select
                        id="user-role"
                        value={userForm.role}
                        onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Role })}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#2E7D32]"
                      >
                        <option value="siswa">Santri</option>
                        <option value="orang_tua">Orang tua / wali</option>
                        <option value="guru">Guru / BK</option>
                        <option value="pembimbing_rayon">Pembimbing rayon</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>

                    {userForm.role === 'siswa' && (
                      <div className="md:col-span-2">
                        <label htmlFor="user-student" className="mb-1 block text-xs font-semibold">
                          Santri yang ditautkan
                        </label>
                        <select
                          id="user-student"
                          value={studentLink}
                          onChange={(e) => setStudentLink(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#2E7D32]"
                        >
                          <option value="">Pilih santri</option>
                          {santri.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.kelas})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {userForm.role === 'pembimbing_rayon' && (
                      <div className="md:col-span-2">
                        <label htmlFor="user-rayon" className="mb-1 block text-xs font-semibold">
                          Rayon yang menjadi kewenangan
                        </label>
                        <input
                          id="user-rayon"
                          list="daftar-rayon"
                          value={rayonLink}
                          onChange={(e) => setRayonLink(e.target.value)}
                          placeholder="Contoh: Rayon Assimbani 1"
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#2E7D32]"
                        />
                        <datalist id="daftar-rayon">
                          {rayon.map((item) => (
                            <option key={item.id} value={item.nama} />
                          ))}
                        </datalist>
                      </div>
                    )}

                    {userForm.role === 'orang_tua' && (
                      <fieldset className="md:col-span-2">
                        <legend className="mb-1 text-xs font-semibold">Anak yang ditautkan</legend>
                        <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2 sm:grid-cols-2">
                          {santri.map((item) => (
                            <label
                              key={item.id}
                              className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={childSelection.includes(item.id)}
                                onChange={(e) =>
                                  setChildSelection((prev) =>
                                    e.target.checked
                                      ? [...prev, item.id]
                                      : prev.filter((id) => id !== item.id)
                                  )
                                }
                                className="h-4 w-4 accent-[#2E7D32]"
                              />
                              <span>
                                {item.name}
                                <span className="text-gray-400"> ({item.kelas})</span>
                              </span>
                            </label>
                          ))}
                          {santri.length === 0 && (
                            <span className="px-2 py-1 text-xs text-gray-400">
                              Belum ada data santri.
                            </span>
                          )}
                        </div>
                      </fieldset>
                    )}

                    <div className="md:col-span-2">
                      <button
                        type="submit"
                        disabled={busy}
                        className="min-h-11 rounded-xl bg-[#2E7D32] px-4 text-xs font-bold text-white hover:bg-[#1B5E20] disabled:bg-gray-300"
                      >
                        Buat akun
                      </button>
                    </div>
                  </form>
                )}
              </section>

              <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 space-y-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#2E7D32]" aria-hidden="true" /> Daftar akun
                </h2>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="p-2">Nama</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Peran</th>
                        <th className="p-2">Tautan</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pengguna.map((row) => {
                        const tautan =
                          row.role === 'siswa'
                            ? santri.find((item) => item.id === row.studentId)?.name || row.studentId || 'Belum ditautkan'
                            : row.role === 'orang_tua'
                              ? row.childIds
                                  .map((id) => santri.find((item) => item.id === id)?.name || id)
                                  .join(', ') || 'Belum ditautkan'
                              : row.role === 'pembimbing_rayon'
                                ? row.rayonId || 'Belum ditautkan'
                                : '-';
                        return (
                          <tr key={row.id}>
                            <td className="p-2 font-semibold">
                              {row.fullName}
                              {row.id === profile?.uid && (
                                <span className="ml-1 text-xs font-normal text-gray-400">(Anda)</span>
                              )}
                            </td>
                            <td className="p-2">{row.email || '-'}</td>
                            <td className="p-2">{roleLabel(row.role)}</td>
                            <td className="p-2">{tautan}</td>
                            <td className="p-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  row.active
                                    ? 'bg-green-50 text-green-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {row.active ? 'Aktif' : 'Nonaktif'}
                              </span>
                            </td>
                            <td className="p-2">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => {
                                    setPasswordTarget(row.id);
                                    setPasswordValue('');
                                    setError(null);
                                  }}
                                  className="min-h-11 rounded-lg px-2 text-gray-500 hover:text-[#2E7D32]"
                                  title="Atur ulang kata sandi"
                                >
                                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                                  <span className="sr-only">Atur ulang kata sandi {row.email}</span>
                                </button>
                                <button
                                  onClick={() => handleToggleActive(row)}
                                  disabled={busy || row.id === profile?.uid}
                                  className="min-h-11 rounded-lg px-2 text-gray-500 hover:text-[#2E7D32] disabled:opacity-40"
                                  title={row.active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                                >
                                  {row.active ? (
                                    <UserX className="h-4 w-4" aria-hidden="true" />
                                  ) : (
                                    <UserCheck className="h-4 w-4" aria-hidden="true" />
                                  )}
                                  <span className="sr-only">
                                    {row.active ? 'Nonaktifkan' : 'Aktifkan'} {row.email}
                                  </span>
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(row)}
                                  disabled={busy || row.id === profile?.uid}
                                  className="min-h-11 rounded-lg px-2 text-red-500 hover:text-red-700 disabled:opacity-40"
                                  title="Hapus akun"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  <span className="sr-only">Hapus akun {row.email}</span>
                                </button>
                              </div>
                              {passwordTarget === row.id && (
                                <div className="mt-2 flex flex-col items-end gap-2">
                                  <label htmlFor={`password-${row.id}`} className="text-xs text-gray-500">
                                    Kata sandi baru untuk {row.email}
                                  </label>
                                  <input
                                    id={`password-${row.id}`}
                                    type="password"
                                    autoComplete="new-password"
                                    value={passwordValue}
                                    onChange={(e) => setPasswordValue(e.target.value)}
                                    placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
                                    className="w-56 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#2E7D32]"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleSavePassword(row)}
                                      disabled={busy}
                                      className="min-h-11 rounded-xl bg-[#2E7D32] px-3 text-xs font-bold text-white disabled:bg-gray-300"
                                    >
                                      Simpan
                                    </button>
                                    <button
                                      onClick={() => {
                                        setPasswordTarget(null);
                                        setPasswordValue('');
                                      }}
                                      className="min-h-11 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-600"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {pengguna.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-3 text-gray-400">
                            Belum ada akun terbaca.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {isLocalBackend && (
                  <p className="text-xs leading-relaxed text-gray-500">
                    Kata sandi disimpan sebagai hash di peramban ini, bukan di server. Akun yang dibuat
                    di sini hanya berlaku pada peramban dan perangkat yang sama.
                  </p>
                )}
              </section>
            </div>
          )}

          {tab === 'audit' && (
            <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-gray-500">
                  {filteredLogs.length} entri terakhir (maks. 200)
                </span>
                <select
                  value={auditFilter}
                  onChange={(e) => setAuditFilter(e.target.value)}
                  className="px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none"
                >
                  {['semua', 'prestasi_submit', 'prestasi_verify', 'prestasi_reject', 'poin_create', 'jurnal_save', 'ttd_ortu', 'student_create', 'master_create', 'master_delete'].map((a) => (
                    <option key={a} value={a}>
                      {a === 'semua' ? 'Semua aksi' : a}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="p-2">Waktu</th>
                      <th className="p-2">Aksi</th>
                      <th className="p-2">Pelaku</th>
                      <th className="p-2">Koleksi / Dokumen</th>
                      <th className="p-2">Santri</th>
                      <th className="p-2">Rayon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="p-2 whitespace-nowrap">
                          {log.createdAtMs ? new Date(log.createdAtMs).toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="p-2 font-semibold">{log.action}</td>
                        <td className="p-2">
                          <span className="block">{log.actorEmail || log.actorId}</span>
                          <span className="text-gray-400">{log.actorRole}</span>
                        </td>
                        <td className="p-2">
                          {log.collection}/{log.docId}
                        </td>
                        <td className="p-2">{log.siswa_id || '-'}</td>
                        <td className="p-2">{log.rayon || '-'}</td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-3 text-gray-400">
                          Belum ada entri audit.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
