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
import { MemuatPanel } from '../../components/StatusPanel';
import { initials, isoWeekNumber } from '../../lib/format';

// Panel admin dan laporan (membawa recharts) hanya dimuat saat dibutuhkan,
// supaya siswa dan guru tidak mengunduh kode yang tidak mereka pakai.
const AdminPanel = lazy(() => import('../../components/AdminPanel'));
const LaporanBulananOrtu = lazy(() => import('../../components/LaporanBulananOrtu'));
import KalenderMenstruasi from '../../components/KalenderMenstruasi';
import JadwalPelajaranView from '../../components/JadwalPelajaranView';
import RekapBulananGuru from '../../components/RekapBulananGuru';
import KesehatanUksPanel from '../../components/KesehatanUksPanel';
import {
  BookOpen,
  Lock,
  Mail,
  Printer,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
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
  BarChart3,
  ArrowLeft,
  Undo2
} from 'lucide-react';
import type { AppModel } from '../../app/useAppModel';

export default function GuruDashboard({ app }: { app: AppModel }) {
  const {
    email,
    setCurrentRoute,
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
    poinLogs,
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
    nonRutinSubmissions,
    pendingNonRutin,
    verifyingNonRutinId,
    koreksiLoadingId,
    apresiasiHariIni,
    konsekuensiMingguIni,
    handleGuruSubmit,
    handleVerifyPrestasi,
    handleVerifyNonRutin,
    handleKoreksiPoin,
    schoolConfig
  } = app;

  const [inputPoinKelasFilter, setInputPoinKelasFilter] = useState<string>('semua');
  const [staffRayonFilter, setStaffRayonFilter] = useState<string>('semua');
  const [staffPage, setStaffPage] = useState<number>(1);
  const [nrCatatan, setNrCatatan] = useState<Record<string, string>>({});
  const [showAllRecentPoin, setShowAllRecentPoin] = useState<boolean>(false);
  const PAGE_SIZE = 24;

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
              <span className="text-xs text-green-300">{schoolConfig.sekolah || 'SMK Thibbil Qulub'}</span>
              {role === 'pembimbing_rayon' && (
                <span className="block text-xs text-green-400 mt-0.5">
                  Rayon: {myRayonId || 'belum diatur'}
                </span>
              )}
            </div>
          </div>

          {role === 'admin' && (
            <button
              type="button"
              onClick={() => setCurrentRoute('admin')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 text-xs font-extrabold shadow-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Kembali ke Panel Admin</span>
            </button>
          )}

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
              <span>Verifikasi & Non-Rutin</span>
              {(pendingPrestasi.length + pendingNonRutin.length) > 0 && (
                <span className="ml-auto bg-amber-400 text-amber-950 text-xs font-black px-1.5 py-0.5 rounded-full">
                  {pendingPrestasi.length + pendingNonRutin.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setGuruTab('rekap')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                guruTab === 'rekap' ? 'bg-[#2E7D32] text-white font-bold shadow-sm' : 'text-green-200 hover:bg-green-800'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Rekap & Cetak Bulanan</span>
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
              <h1 className="text-xl font-bold text-gray-900">Ringkasan Karakter Santri Jejak</h1>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1.5">1. Filter Kelas</label>
                    <select
                      value={inputPoinKelasFilter}
                      onChange={(e) => {
                        const newKelas = e.target.value;
                        setInputPoinKelasFilter(newKelas);
                        const first = students.find((s) => newKelas === 'semua' || s.kelas === newKelas);
                        if (first) setSelectedStudentId(first.id);
                      }}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                    >
                      <option value="semua">Semua Rombel ({students.length})</option>
                      {Array.from(new Set(students.map((s) => s.kelas).filter(Boolean)))
                        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                        .map((k) => (
                          <option key={k} value={k}>
                            Kelas {k}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-gray-700 mb-1.5">2. Pilih Santri</label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                    >
                      {students
                        .filter((st) => inputPoinKelasFilter === 'semua' || st.kelas === inputPoinKelasFilter)
                        .map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name} ({st.kelas} - {st.rayon}) • Total: {st.points} Pts
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1.5">Pilih Kode Tindakan Jejak</label>
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

            {/* Riwayat Input Poin Terbaru & Koreksi Salah Input */}
            {(() => {
              const filteredLogs = showAllRecentPoin || !selectedStudentId
                ? poinLogs
                : poinLogs.filter((l) => l.studentId === selectedStudentId);
              const displayedLogs = filteredLogs.slice(0, 15);
              return (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-green-100 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">
                        Riwayat Input Poin Terbaru & Koreksi
                      </h2>
                      <p className="text-xs text-gray-500">
                        Jika terjadi kesalahan input poin, gunakan tombol Batalkan / Koreksi untuk membuat jurnal penyeimbang resmi (tercatat di audit log).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAllRecentPoin((v) => !v)}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700"
                    >
                      {showAllRecentPoin ? 'Filter: Santri Terpilih' : 'Tampilkan Semua Santri'}
                    </button>
                  </div>

                  {displayedLogs.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">
                      Belum ada riwayat mutasi poin dari Guru/BK pada filter ini.
                    </p>
                  ) : (
                    <div className="divide-y divide-gray-100 text-xs">
                      {displayedLogs.map((log) => {
                        const santri = students.find((s) => s.id === log.studentId);
                        const isKoreksiEntry = log.kode === 'KOREKSI' || Boolean(log.koreksiDari);
                        const alreadyCorrected = poinLogs.some((l) => l.koreksiDari === log.id);
                        return (
                          <div key={log.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-bold font-mono text-[10px]">
                                  {log.kode}
                                </span>
                                <span className="font-bold text-gray-900">
                                  {santri ? `${santri.name} (${santri.kelas})` : log.studentId}
                                </span>
                                <span className="text-gray-400">• {log.time}</span>
                              </div>
                              <p className="text-gray-700 mt-0.5">{log.deskripsi}</p>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span
                                className={`font-black tabular ${
                                  log.tipe === 'apresiasi' ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {log.tipe === 'apresiasi' ? `+${log.poin}` : `-${log.poin}`} Pts
                              </span>
                              {alreadyCorrected ? (
                                <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 font-semibold text-[11px]">
                                  Sudah Dikoreksi
                                </span>
                              ) : isKoreksiEntry ? (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-[11px]">
                                  Entri Koreksi
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={koreksiLoadingId === log.id || !santri}
                                  onClick={() => handleKoreksiPoin(log)}
                                  className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-700 font-bold text-[11px] flex items-center gap-1"
                                  title="Buat entri penyeimbang untuk membatalkan poin salah input ini"
                                >
                                  <Undo2 className="w-3.5 h-3.5" />
                                  <span>{koreksiLoadingId === log.id ? 'Memproses…' : 'Batalkan / Koreksi'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
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

            {/* Verifikasi Kegiatan Non-Rutin Santri (3 Mingguan / 9 Mingguan / Semester) */}
            <div className="space-y-3 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#1B5E20]" />
                    <span>Verifikasi Kegiatan Non-Rutin Santri</span>
                  </h2>
                  <p className="text-xs text-gray-500">
                    Validasi isian kegiatan 3 mingguan, 9 mingguan, & semester dari santri sebelum poin dimutasikan ke saldo karakter.
                  </p>
                </div>
                <span className="text-xs bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full font-bold shrink-0">
                  {pendingNonRutin.length} Menunggu
                </span>
              </div>

              {pendingNonRutin.length === 0 ? (
                <div className="bg-white rounded-2xl border border-green-100 p-4 text-xs text-gray-500">
                  Tidak ada kiriman kegiatan Non-Rutin yang menunggu verifikasi saat ini.
                </div>
              ) : (
                pendingNonRutin.map((sub) => {
                  const santri = students.find((s) => s.id === sub.siswa_id);
                  return (
                    <div
                      key={sub.id}
                      className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-4 space-y-3 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#1B5E20] font-bold border border-emerald-200 text-xs">
                              Periode {sub.periode}
                            </span>
                            <span className="text-gray-500 font-medium">
                              {sub.items.length} butir diisi
                            </span>
                          </div>
                          <span className="font-bold text-gray-900 text-sm block">
                            {sub.nama_siswa || santri?.name || sub.siswa_id}
                          </span>
                          <span className="text-gray-600 block">
                            {sub.kelas || santri?.kelas || '-'} • Rayon {sub.rayon || santri?.rayon || '-'}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-black px-2.5 py-1 rounded-lg shrink-0 ${
                            sub.net_poin >= 0
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {sub.net_poin >= 0 ? `+${sub.net_poin}` : sub.net_poin} Pts
                        </span>
                      </div>

                      <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                        {sub.items.map((item, idx) => (
                          <div key={`${sub.id}-${idx}`} className="flex items-start justify-between gap-2 pb-1.5 border-b last:border-b-0 border-gray-200/70">
                            <div>
                              <span className="font-semibold text-gray-800 block">{item.nama}</span>
                              <span className="text-[11px] text-gray-500">
                                Capaian: <strong className="text-gray-700">{item.status}</strong>
                                {item.saksi ? ` • Saksi: ${item.saksi}` : ''}
                                {item.detail ? ` • Target: ${item.detail}` : ''}
                              </span>
                            </div>
                            <span
                              className={`font-bold shrink-0 ${
                                item.poin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {item.poin >= 0 ? `+${item.poin}` : item.poin}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">Catatan Verifikasi (Opsional)</label>
                        <input
                          type="text"
                          value={nrCatatan[sub.id] ?? ''}
                          onChange={(e) => setNrCatatan({ ...nrCatatan, [sub.id]: e.target.value })}
                          placeholder="Mis. sudah dicek sesuai bukti setoran / laporan wali rayon"
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={verifyingNonRutinId === sub.id}
                          onClick={() => handleVerifyNonRutin(sub, 'verified', nrCatatan[sub.id])}
                          className="flex-1 min-w-[160px] py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{verifyingNonRutinId === sub.id ? 'Memproses…' : 'Setujui & Mutasikan Poin'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={verifyingNonRutinId === sub.id}
                          onClick={() => handleVerifyNonRutin(sub, 'rejected', nrCatatan[sub.id])}
                          className="px-4 py-2.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 font-bold rounded-xl border border-red-200 flex items-center justify-center gap-1.5"
                        >
                          <AlertTriangle className="w-4 h-4" /> Tolak
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {nonRutinSubmissions.filter((s) => s.status !== 'pending').length > 0 && (
                <div className="space-y-2 pt-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1">
                    Riwayat Non-Rutin Diproses ({nonRutinSubmissions.filter((s) => s.status !== 'pending').length})
                  </h3>
                  {nonRutinSubmissions
                    .filter((s) => s.status !== 'pending')
                    .slice(0, 10)
                    .map((sub) => {
                      const santri = students.find((s) => s.id === sub.siswa_id);
                      return (
                        <div
                          key={sub.id}
                          className="bg-white rounded-xl border border-gray-200 p-3 text-xs flex items-start justify-between gap-2"
                        >
                          <div>
                            <span className="font-semibold text-gray-900 block">
                              {sub.nama_siswa || santri?.name || sub.siswa_id} ({sub.kelas || santri?.kelas || '-'}) — Periode {sub.periode}
                            </span>
                            <span className="text-gray-500 block">
                              {sub.items.length} kegiatan
                              {sub.catatan_verifikasi ? ` • "${sub.catatan_verifikasi}"` : ''}
                            </span>
                          </div>
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                              sub.status === 'verified'
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : 'bg-red-100 text-red-700 border border-red-200'
                            }`}
                          >
                            {sub.status === 'verified'
                              ? `${(sub.poin_disetujui ?? sub.net_poin) >= 0 ? '+' : ''}${sub.poin_disetujui ?? sub.net_poin} Pts`
                              : 'Ditolak'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2c. GURU: JADWAL PELAJARAN (SENIN S.D. JUMAT) */}
        {guruTab === 'jadwal' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <JadwalPelajaranView
              currentClass={selectedClassForJadwal || daftarKelasSemua[0] || students[0]?.kelas || ''}
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

            <KesehatanUksPanel
              student={students.find((s) => s.id === selectedStudentId) || students[0] || null}
              userRole={role}
              userUid={sessionUser?.uid}
              userEmail={profile?.email}
              myRayonId={myRayonId}
              poinLogs={poinLogs}
            />
          </div>
        )}

        {/* 4. GURU: SISWA */}
        {guruTab === 'siswa' && (() => {
          const filteredStudents = students.filter((s) => {
            const matchSearch =
              !studentSearch ||
              s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
              s.nisn.toLowerCase().includes(studentSearch.toLowerCase()) ||
              s.kelas.toLowerCase().includes(studentSearch.toLowerCase()) ||
              s.rayon.toLowerCase().includes(studentSearch.toLowerCase());
            const matchKelas =
              staffKelasFilter === 'semua' || s.kelas === staffKelasFilter;
            const matchRayon =
              staffRayonFilter === 'semua' || s.rayon === staffRayonFilter;
            return matchSearch && matchKelas && matchRayon;
          });

          const totalStaffPages = Math.ceil(filteredStudents.length / PAGE_SIZE) || 1;
          const safeStaffPage = Math.min(staffPage, totalStaffPages);
          const paginatedStudents = filteredStudents.slice(
            (safeStaffPage - 1) * PAGE_SIZE,
            safeStaffPage * PAGE_SIZE
          );

          const daftarRayon = Array.from(new Set(students.map((s) => s.rayon).filter(Boolean))).sort();

          return (
            <div className="space-y-4 max-w-5xl mx-auto">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Direktori Santri Assimbani</h1>
                  <p className="text-xs text-gray-500">
                    Menampilkan {filteredStudents.length} dari {students.length} santri terdaftar
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Cari nama / NISN / kelas..."
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      setStaffPage(1);
                    }}
                    className="p-2 text-xs bg-white border border-gray-200 rounded-xl w-48 outline-none focus:border-[#2E7D32]"
                  />
                  <select
                    value={staffKelasFilter}
                    onChange={(e) => {
                      setStaffKelasFilter(e.target.value);
                      setStaffPage(1);
                    }}
                    className="p-2 text-xs bg-white border border-gray-200 rounded-xl outline-none font-medium focus:border-[#2E7D32]"
                  >
                    <option value="semua">Semua Kelas</option>
                    {Array.from(new Set(students.map((s) => s.kelas)))
                      .filter(Boolean)
                      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                      .map((k) => (
                        <option key={k} value={k}>
                          Kelas {k}
                        </option>
                      ))}
                  </select>
                  <select
                    value={staffRayonFilter}
                    onChange={(e) => {
                      setStaffRayonFilter(e.target.value);
                      setStaffPage(1);
                    }}
                    className="p-2 text-xs bg-white border border-gray-200 rounded-xl outline-none font-medium focus:border-[#2E7D32]"
                  >
                    <option value="semua">Semua Rayon</option>
                    {daftarRayon.map((r) => (
                      <option key={r} value={r}>
                        Rayon {r}
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
                {paginatedStudents.map((s) => (
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentId(s.id);
                          setGuruTab('rekap');
                        }}
                        className="px-2.5 py-1.5 bg-emerald-50 text-emerald-800 font-bold rounded-xl border border-emerald-300 text-xs flex items-center gap-1 hover:bg-emerald-100 transition-colors shadow-2xs"
                        title="Cetak rekapan bulanan santri ini"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Cetak Rekap</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentId(s.id);
                          setGuruTab('kesehatan');
                        }}
                        className="px-2.5 py-1.5 bg-green-50 text-green-800 font-bold rounded-xl border border-green-200 text-xs flex items-center gap-1 hover:bg-green-100 transition-colors"
                      >
                        <HeartPulse className="w-3.5 h-3.5" />
                        <span>Kesehatan</span>
                      </button>
                    </div>
                  </div>
                ))}
                {filteredStudents.length === 0 && (
                  <div className="col-span-2 p-6 text-center text-gray-400 bg-white rounded-2xl border border-green-100">
                    Tidak ditemukan data santri dengan kriteria pencarian / filter ini.
                  </div>
                )}
              </div>

              {/* Kontrol Paginasi untuk Kapasitas Besar (1.000 - 2.000 Santri) */}
              {filteredStudents.length > PAGE_SIZE && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200 text-xs text-gray-600 bg-white p-3.5 rounded-xl border">
                  <span>
                    Menampilkan{' '}
                    <strong>
                      {(safeStaffPage - 1) * PAGE_SIZE + 1} -{' '}
                      {Math.min(safeStaffPage * PAGE_SIZE, filteredStudents.length)}
                    </strong>{' '}
                    dari <strong>{filteredStudents.length}</strong> santri
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={safeStaffPage <= 1}
                      onClick={() => setStaffPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
                    </button>
                    <span className="font-semibold text-gray-800 px-1">
                      Halaman {safeStaffPage} dari {totalStaffPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeStaffPage >= totalStaffPages}
                      onClick={() => setStaffPage((p) => Math.min(totalStaffPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1"
                    >
                      Selanjutnya <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 5. GURU: REKAP & CETAK BULANAN */}
        {guruTab === 'rekap' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <RekapBulananGuru
              students={students}
              poinLogs={app.poinLogs}
              prestasiList={prestasiList}
              userRole={role}
              myRayonId={myRayonId}
              initialStudentId={selectedStudentId}
              initialKelas={staffKelasFilter !== 'semua' ? staffKelasFilter : undefined}
            />
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
