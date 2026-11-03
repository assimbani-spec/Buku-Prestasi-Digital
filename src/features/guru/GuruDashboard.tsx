/**
 * Dashboard peran ini dipisahkan dari App. Seluruh state dan aksi berasal dari
 * satu model aplikasi supaya tidak ada salinan logika di tiap modul.
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import Header from '../../components/Header';
import BottomNav, { NavTab } from '../../components/BottomNav';
import TambahSiswaModal from '../../components/TambahSiswaModal';
import DetailSiswaModal from '../../components/DetailSiswaModal';
import SignatureCanvas from 'react-signature-canvas';
import type { UserProfile, StudentRecord, PrestasiRecord } from '../../lib/tipe';
import {
  isLocalBackend,
  resetLocalData,
  signInWithEmail,
  signOutUser,
  watchAuthUser,
  type AppUser,
} from '../../lib/auth';
import { LOCAL_SEED_PASSWORD, siapkanDataAwal } from '../../lib/data/seed';
import {
  db,
  doc,
  getDoc,
  setDoc,
  addDoc,
  increment,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  collection,
  writeBatch,
  onSnapshot
} from '../../lib/data';
import {
  AppRoute,
  Role,
  routeForRole,
  roleLabel,
  isStaffRole,
  canVerifyPrestasi,
  canCreateStudent,
  canSeeAllStudents,
  profileStudentId,
  profileChildIds,
  profileRayonId
} from '../../lib/rbac';
import { logAuditSafe, newAuditRef, buildAuditPayload } from '../../lib/audit';
import { ajukanPrestasi, putuskanPrestasi } from '../../features/prestasi/prestasi';
import { MemuatPanel, ModulBelumTersedia } from '../../components/StatusPanel';
import { initials, isoWeekNumber } from '../../lib/format';

// Panel admin dan laporan (membawa recharts) hanya dimuat saat dibutuhkan,
// supaya siswa dan guru tidak mengunduh kode yang tidak mereka pakai.
const AdminPanel = lazy(() => import('../../components/AdminPanel'));
const LaporanBulananOrtu = lazy(() => import('../../components/LaporanBulananOrtu'));
import KalenderMenstruasi from '../../components/KalenderMenstruasi';
import JadwalPelajaranView from '../../components/JadwalPelajaranView';
import {
  BookOpen,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
  CheckSquare,
  Square,
  Save,
  Award,
  AlertTriangle,
  Sparkles,
  Sun,
  Moon,
  PenTool,
  RotateCcw,
  Check,
  ShieldAlert,
  Users,
  PlusCircle,
  LogOut,
  LayoutDashboard,
  Search,
  FileText,
  UserCheck,
  Smartphone,
  Monitor,
  HeartPulse,
  Activity,
  Stethoscope,
  Smile,
  Clock,
  Droplets,
  BedDouble,
  ShieldCheck,
  CheckCheck,
  Info,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import type { AppModel } from '../../app/useAppModel';

export default function GuruDashboard({ app }: { app: AppModel }) {
  const {
    email,
    guruTab,
    setGuruTab,
    guruTahunFilter,
    setGuruTahunFilter,
    guruStatusFilter,
    setGuruStatusFilter,
    selectedClassForJadwal,
    setSelectedClassForJadwal,
    jurnal,
    prestasiList,
    verifyPoin,
    setVerifyPoin,
    verifyCatatan,
    setVerifyCatatan,
    verifyingId,
    selectedStudentId,
    setSelectedStudentId,
    selectedKode,
    setSelectedKode,
    guruDeskripsi,
    setGuruDeskripsi,
    guruSuccess,
    studentSearch,
    setStudentSearch,
    staffKelasFilter,
    setStaffKelasFilter,
    students,
    showTambahSiswa,
    setShowTambahSiswa,
    sessionUser,
    profile,
    role,
    myRayonId,
    handleLogout,
    daftarKelasSemua,
    effectiveKodes,
    pendingPrestasi,
    apresiasiHariIni,
    konsekuensiMingguIni,
    handleGuruSubmit,
    handleVerifyPrestasi
  } = app;

  return (
    <div className="flex-1 flex flex-col md:flex-row">

      {/* SIDEBAR HIJAU KIRI (#1B5E20) */}
      <aside className="w-full md:w-64 bg-[#1B5E20] text-white p-5 flex flex-col justify-between shrink-0 shadow-lg">
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-green-800">
            <div className="w-10 h-10 rounded-xl bg-green-800 border border-green-500/40 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-green-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">Panel {roleLabel(role)}</h2>
              <span className="text-xs text-green-300">SMK Thibbil Qulub</span>
              {role === 'pembimbing_rayon' && (
                <span className="block text-xs text-green-400 mt-0.5">
                  Rayon: {myRayonId || 'belum diatur'}
                </span>
              )}
            </div>
          </div>

          <nav className="space-y-1.5 text-xs font-medium">
            <button
              onClick={() => setGuruTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                guruTab === 'dashboard' ? 'bg-[#2E7D32] text-white font-bold shadow-sm' : 'text-green-200 hover:bg-green-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard Guru</span>
            </button>

            <button
              onClick={() => setGuruTab('input_poin')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                guruTab === 'input_poin' ? 'bg-[#2E7D32] text-white font-bold shadow-sm' : 'text-green-200 hover:bg-green-800'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Input Poin & Prestasi</span>
            </button>

            <button
              onClick={() => setGuruTab('verifikasi')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                guruTab === 'verifikasi' ? 'bg-[#2E7D32] text-white font-bold shadow-sm' : 'text-green-200 hover:bg-green-800'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Verifikasi Prestasi</span>
              {pendingPrestasi.length > 0 && (
                <span className="ml-auto bg-amber-400 text-amber-950 text-xs font-black px-1.5 py-0.5 rounded-full">
                  {pendingPrestasi.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setGuruTab('jadwal')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                guruTab === 'jadwal' ? 'bg-[#2E7D32] text-white font-bold shadow-sm' : 'text-green-200 hover:bg-green-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Jadwal Pelajaran</span>
            </button>

            <button
              onClick={() => setGuruTab('kesehatan')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                guruTab === 'kesehatan' ? 'bg-[#2E7D32] text-white font-bold shadow-sm' : 'text-green-200 hover:bg-green-800'
              }`}
            >
              <HeartPulse className="w-4 h-4" />
              <span>Borang Kesehatan / UKS</span>
            </button>

            <button
              onClick={() => setGuruTab('siswa')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                guruTab === 'siswa' ? 'bg-[#2E7D32] text-white font-bold shadow-sm' : 'text-green-200 hover:bg-green-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Daftar Santri ({students.length})</span>
            </button>
          </nav>
        </div>

        <div className="pt-6 border-t border-green-800/80">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-green-800 flex items-center justify-center font-bold text-xs text-green-200 border border-green-600">
              UH
            </div>
            <div>
              <span className="text-xs font-bold block">{profile?.fullName || roleLabel(role)}</span>
              <span className="text-xs text-green-300">{roleLabel(role)}</span>
              <span className="block text-xs text-green-400 truncate max-w-[150px]">
                {profile?.email}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2 px-3 bg-red-900/60 hover:bg-red-800 text-red-200 text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT GURU */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">

        {/* 1. GURU DASHBOARD */}
        {guruTab === 'dashboard' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Ringkasan Karakter Santri BKP</h1>
              <p className="text-xs text-gray-500">Pemantauan jurnal harian, kedisiplinan, dan kesehatan siswa</p>
            </div>

            {/* 3 STATS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-green-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-gray-500">Total Santri Aktif</span>
                  <div className="text-2xl font-bold text-[#1B5E20] mt-1">{students.length} Siswa</div>
                  <span className="text-xs text-green-600 font-semibold">
                    {myRayonId ? `Rayon ${myRayonId}` : 'Seluruh rayon'}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-[#2E7D32]">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-green-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-gray-500">Poin Apresiasi Hari Ini</span>
                  <div className="text-2xl font-bold text-[#2E7D32] mt-1">+{apresiasiHariIni} Pts</div>
                  <span className="text-xs text-emerald-600 font-semibold">Dari catatan poin terbaru</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Sparkles className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-green-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-gray-500">Konsekuensi 7 Hari Terakhir</span>
                  <div className="text-2xl font-bold text-red-600 mt-1">{konsekuensiMingguIni} Catatan</div>
                  <span className="text-xs text-red-500 font-semibold">Dari riwayat poin</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
                  <ShieldAlert className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* TABEL 10 SISWA TERBARU */}
            <div className="bg-white rounded-2xl shadow-sm border border-green-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">Daftar santri dan total poin karakter</h3>
                <span className="text-xs text-gray-500">
                  {students.length} santri terdaftar
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold">
                    <tr>
                      <th className="p-3">Nama Santri</th>
                      <th className="p-3">Kelas</th>
                      <th className="p-3">Rayon</th>
                      <th className="p-3">Total Poin</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-xs text-muted">
                          Belum ada santri pada lingkup akun ini. Admin dapat menambah data
                          santri dari panel admin atau menu Tambah Santri.
                        </td>
                      </tr>
                    )}
                    {students.map((st) => (
                      <tr key={st.id} className="hover:bg-gray-50">
                        <td className="p-3 font-bold text-gray-900">{st.name}</td>
                        <td className="p-3 text-gray-600">{st.kelas}</td>
                        <td className="p-3 text-gray-600">{st.rayon}</td>
                        <td className="p-3 font-bold text-[#1B5E20]">{st.points} Pts</td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              st.points >= 1000
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {st.points >= 1000 ? 'Sangat Baik' : 'Cukup Baik'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedStudentId(st.id);
                              setGuruTab('input_poin');
                            }}
                            className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 font-semibold rounded-lg border border-green-200 text-xs"
                          >
                            + Poin
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. GURU: INPUT POIN & KONSEKUENSI */}
        {guruTab === 'input_poin' && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Form Pencatatan Poin Karakter</h1>
              <p className="text-xs text-gray-500">Input kode tindakan terpuji (A1-A6) atau konsekuensi (K1-K6)</p>
            </div>

            {guruSuccess && (
              <div className="p-3.5 bg-green-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Poin berhasil dicatat dan diakumulasikan ke buku santri!</span>
              </div>
            )}

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-100">
              <form onSubmit={handleGuruSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1.5">Pilih Santri Target</label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                  >
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.kelas} - {st.rayon}) • Total Saat Ini: {st.points} Pts
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1.5">Pilih Kode Tindakan BKP</label>
                  <select
                    value={selectedKode}
                    onChange={(e) => {
                      setSelectedKode(e.target.value);
                      const m = effectiveKodes.find((item) => item.kode === e.target.value);
                      if (m) setGuruDeskripsi(m.deskripsi);
                    }}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                  >
                    <optgroup label="Tindakan Terpuji (Apresiasi)">
                      {effectiveKodes
                        .filter((m) => m.tipe === 'apresiasi')
                        .map((m) => (
                          <option key={m.kode} value={m.kode}>
                            [{m.kode}] {m.deskripsi} (+{m.poin} Poin)
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Tindakan Kurang Terpuji (Konsekuensi)">
                      {effectiveKodes
                        .filter((m) => m.tipe === 'konsekuensi')
                        .map((m) => (
                          <option key={m.kode} value={m.kode}>
                            [{m.kode}] {m.deskripsi} (-{m.poin} Poin)
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1.5">Deskripsi / Catatan Pembinaan</label>
                  <textarea
                    rows={3}
                    value={guruDeskripsi}
                    onChange={(e) => setGuruDeskripsi(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan & Mutasikan Poin</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 2b. GURU: VERIFIKASI PRESTASI */}
        {guruTab === 'verifikasi' && (
          <div className="space-y-5 max-w-3xl mx-auto">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Verifikasi Prestasi Santri</h1>
              <p className="text-xs text-gray-500">
                Setujui dengan menentukan poin, atau tolak dengan catatan. Setiap keputusan
                tercatat di audit log dan tidak bisa dihapus.
              </p>
            </div>

            {/* Filter Tahun Pelajaran & Status */}
            <div className="bg-white rounded-2xl p-4 border border-green-100 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-gray-600">Tahun Pelajaran:</span>
                <select
                  value={guruTahunFilter}
                  onChange={(e) => setGuruTahunFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 outline-none focus:border-[#2E7D32]"
                >
                  <option value="Semua">Semua Tahun</option>
                  <option value="2024/2025">2024/2025</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
                </select>

                <span className="font-semibold text-gray-600 ml-2">Status:</span>
                <select
                  value={guruStatusFilter}
                  onChange={(e) => setGuruStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 outline-none focus:border-[#2E7D32]"
                >
                  <option value="Semua">Semua Status</option>
                  <option value="pending">Menunggu Verifikasi (Pending)</option>
                  <option value="verified">Disetujui (Verified)</option>
                  <option value="rejected">Ditolak (Rejected)</option>
                </select>
              </div>
              <div className="text-xs text-gray-500 font-semibold">
                Ditemukan: {
                  prestasiList.filter((p) => {
                    const matchT = guruTahunFilter === 'Semua' || p.tahunPelajaran === guruTahunFilter;
                    const matchS = guruStatusFilter === 'Semua' || p.status === guruStatusFilter;
                    return matchT && matchS;
                  }).length
                } data
              </div>
            </div>

            {/* Daftar Pending Pengajuan */}
            {(guruStatusFilter === 'Semua' || guruStatusFilter === 'pending') && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-800 px-1 flex items-center justify-between">
                  <span>Pengajuan Menunggu Verifikasi</span>
                  <span className="text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                    {
                      prestasiList.filter((p) => {
                        const matchT = guruTahunFilter === 'Semua' || p.tahunPelajaran === guruTahunFilter;
                        return p.status === 'pending' && matchT;
                      }).length
                    } Menunggu
                  </span>
                </h2>

                {prestasiList.filter((p) => {
                  const matchT = guruTahunFilter === 'Semua' || p.tahunPelajaran === guruTahunFilter;
                  return p.status === 'pending' && matchT;
                }).length === 0 && (
                  <div className="bg-white rounded-2xl border border-green-100 p-4 text-xs text-gray-500">
                    Tidak ada pengajuan yang menunggu verifikasi untuk filter ini.
                  </div>
                )}

                {prestasiList
                  .filter((p) => {
                    const matchT = guruTahunFilter === 'Semua' || p.tahunPelajaran === guruTahunFilter;
                    return p.status === 'pending' && matchT;
                  })
                  .map((pres) => {
                    const santri = students.find((s) => s.id === pres.siswa_id);
                    return (
                      <div
                        key={pres.id}
                        className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 space-y-3 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#1B5E20] font-bold border border-emerald-200 text-xs">
                                TP {pres.tahunPelajaran || '2025/2026'} • Sem {pres.semester || 'Genap'}
                              </span>
                              <span className="text-gray-400">•</span>
                              <span className="text-gray-500 font-medium">{pres.tanggal}</span>
                            </div>
                            <span className="font-bold text-gray-900 text-sm block">{pres.judul}</span>
                            <span className="text-gray-600 block mt-0.5">
                              Santri: <strong className="text-gray-800">{pres.nama_siswa || santri?.name || pres.siswa_id}</strong> ({pres.kelas || santri?.kelas || '-'}) • Rayon {pres.rayon || santri?.rayon || '-'}
                            </span>
                            <span className="text-gray-500 block mt-0.5">
                              {pres.kategori} • {pres.tingkat} • {pres.capaian}
                            </span>
                            {pres.deskripsi && (
                              <p className="text-gray-600 mt-1 bg-amber-50/50 p-2 rounded-lg border border-amber-100">{pres.deskripsi}</p>
                            )}
                          </div>
                          <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md shrink-0">
                            PENDING
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] gap-2 pt-1 border-t border-gray-100">
                          <div>
                            <label className="block font-semibold text-gray-700 mb-1">Poin disetujui</label>
                            <input
                              type="number"
                              min={0}
                              max={5000}
                              value={verifyPoin[pres.id] ?? 100}
                              onChange={(e) =>
                                setVerifyPoin({ ...verifyPoin, [pres.id]: Number(e.target.value) })
                              }
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-gray-700 mb-1">Catatan verifikasi</label>
                            <input
                              type="text"
                              value={verifyCatatan[pres.id] ?? ''}
                              onChange={(e) =>
                                setVerifyCatatan({ ...verifyCatatan, [pres.id]: e.target.value })
                              }
                              placeholder="Opsional, mis. sertifikat terlampir dan sah"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={verifyingId === pres.id}
                            onClick={() => handleVerifyPrestasi(pres, 'verified')}
                            className="flex-1 min-w-[160px] py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {verifyingId === pres.id ? 'Memproses…' : 'Verifikasi & Beri Poin'}
                          </button>
                          <button
                            type="button"
                            disabled={verifyingId === pres.id}
                            onClick={() => handleVerifyPrestasi(pres, 'rejected')}
                            className="px-4 py-2.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 font-bold rounded-xl border border-red-200 flex items-center justify-center gap-1.5"
                          >
                            <AlertTriangle className="w-4 h-4" /> Tolak
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Riwayat Keputusan Verifikasi */}
            {(guruStatusFilter === 'Semua' || guruStatusFilter !== 'pending') && (
              <div className="space-y-2 pt-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1">
                  Riwayat keputusan ({
                    prestasiList.filter((p) => {
                      const matchT = guruTahunFilter === 'Semua' || p.tahunPelajaran === guruTahunFilter;
                      const matchS = guruStatusFilter === 'Semua' ? p.status !== 'pending' : p.status === guruStatusFilter;
                      return matchT && matchS;
                    }).length
                  })
                </h2>
                {prestasiList
                  .filter((p) => {
                    const matchT = guruTahunFilter === 'Semua' || p.tahunPelajaran === guruTahunFilter;
                    const matchS = guruStatusFilter === 'Semua' ? p.status !== 'pending' : p.status === guruStatusFilter;
                    return matchT && matchS;
                  })
                  .map((pres) => {
                    const santri = students.find((s) => s.id === pres.siswa_id);
                    return (
                      <div
                        key={pres.id}
                        className="bg-white rounded-xl border border-gray-200 p-3 text-xs flex items-start justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 text-[10px] font-semibold">
                              TP {pres.tahunPelajaran || '2025/2026'} • {pres.semester || 'Genap'}
                            </span>
                            <span className="font-semibold text-gray-900">{pres.judul}</span>
                          </div>
                          <span className="text-gray-500 block">
                            {pres.nama_siswa || santri?.name || pres.siswa_id} ({pres.kelas || santri?.kelas || '-'}) • {pres.tanggal}
                          </span>
                          {pres.catatan_verifikasi && (
                            <p className="text-gray-600 mt-1 italic text-[11px]">
                              Catatan: "{pres.catatan_verifikasi}"
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                            pres.status === 'verified'
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : 'bg-red-100 text-red-700 border border-red-200'
                          }`}
                        >
                          {pres.status === 'verified' ? `+${pres.poin} Pts` : 'Ditolak'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* 2c. GURU: JADWAL PELAJARAN (SENIN S.D. JUMAT) */}
        {guruTab === 'jadwal' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <JadwalPelajaranView
              currentClass={selectedClassForJadwal || students[0]?.kelas || 'X TKJ 1'}
              userRole={role}
              user={sessionUser}
              daftarKelas={daftarKelasSemua}
              onChangeClass={(cls) => setSelectedClassForJadwal(cls)}
            />
          </div>
        )}

        {/* 3. GURU: BORANG KESEHATAN / UKS */}
        {guruTab === 'kesehatan' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Pemantauan Skrining Kesehatan Santri</h1>
                <p className="text-xs text-gray-500">Evaluasi pengukuran fisik, gigi, riwayat kesehatan & catatan UKS</p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-gray-600">Pilih Siswa:</span>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="p-2 bg-white border border-green-200 rounded-xl font-bold text-gray-800 shadow-xs"
                >
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.kelas})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ModulBelumTersedia judul="Borang kesehatan dan buku UKS" />
          </div>
        )}

        {/* 4. GURU: SISWA */}
        {guruTab === 'siswa' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-bold text-gray-900">Direktori Santri Rayon Assimbani</h1>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Cari siswa / rombel / NISN..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="p-2 text-xs bg-white border border-gray-200 rounded-xl w-52 outline-none focus:border-[#2E7D32]"
                />
                <select
                  value={staffKelasFilter}
                  onChange={(e) => setStaffKelasFilter(e.target.value)}
                  className="p-2 text-xs bg-white border border-gray-200 rounded-xl outline-none font-medium focus:border-[#2E7D32]"
                >
                  <option value="semua">Semua Kelas ({students.length})</option>
                  {Array.from(new Set(students.map((s) => s.kelas)))
                    .filter(Boolean)
                    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                    .map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                </select>
                {canCreateStudent(role) && (
                  <button
                    type="button"
                    onClick={() => setShowTambahSiswa(true)}
                    className="px-3 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Tambah Santri</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {students
                .filter((s) => {
                  const matchSearch =
                    !studentSearch ||
                    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                    s.nisn.toLowerCase().includes(studentSearch.toLowerCase()) ||
                    s.kelas.toLowerCase().includes(studentSearch.toLowerCase());
                  const matchKelas =
                    staffKelasFilter === 'semua' || s.kelas === staffKelasFilter;
                  return matchSearch && matchKelas;
                })
                .map((s) => (
                  <div key={s.id} className="bg-white p-4 rounded-2xl border border-green-100 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="font-bold text-gray-900 block">{s.name}</span>
                      <span className="text-gray-500 block">
                        <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-800 font-semibold border border-green-200 mr-1.5">
                          {s.kelas}
                        </span>
                        Rayon {s.rayon}
                      </span>
                      <span className="font-bold text-[#1B5E20] block mt-1">{s.points} Poin Karakter</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedStudentId(s.id);
                        setGuruTab('kesehatan');
                      }}
                      className="px-3 py-1.5 bg-green-50 text-green-800 font-bold rounded-xl border border-green-200 text-xs flex items-center gap-1 hover:bg-green-100"
                    >
                      <HeartPulse className="w-3.5 h-3.5" />
                      <span>Kesehatan</span>
                    </button>
                  </div>
                ))}
              {students.length === 0 && (
                <div className="col-span-2 p-6 text-center text-gray-400 bg-white rounded-2xl border border-green-100">
                  Belum ada data santri pada lingkup akun ini.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <TambahSiswaModal
        isOpen={showTambahSiswa}
        onClose={() => setShowTambahSiswa(false)}
        onStudentAdded={() => setShowTambahSiswa(false)}
        actorRole={role ?? undefined}
        actor={sessionUser ? { uid: sessionUser.uid, email: sessionUser.email } : null}
      />
    </div>
  );
}
