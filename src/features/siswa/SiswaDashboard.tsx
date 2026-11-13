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

export default function SiswaDashboard({ app }: { app: AppModel }) {
  const {
    siswaTab,
    setSiswaTab,
    siswaDate,
    setSiswaDate,
    siswaSaveSuccess,
    jurnalSaving,
    jurnalView,
    setJurnalView,
    poinTabFilter,
    setPoinTabFilter,
    tahunPelajaranFilter,
    setTahunPelajaranFilter,
    jurnal,
    setJurnal,
    mingguan,
    setMingguan,
    nonRutinFilter,
    setNonRutinFilter,
    nonRutinSaveSuccess,
    nonRutinSaving,
    nonRutinList,
    setNonRutinList,
    nonRutinSubmissions,
    prestasiList,
    prestasiForm,
    setPrestasiForm,
    prestasiSubmitting,
    prestasiMsg,
    showFormPrestasi,
    setShowFormPrestasi,
    poinLogs,
    unifiedStudentLogs,
    sessionUser,
    role,
    accountEmail,
    handleLogout,
    currentStudent,
    isSiswiPutri,
    currentWeek,
    calculateDailyPoints,
    saveJurnal,
    saveNonRutin,
    handleSubmitPrestasi,
    schoolConfig
  } = app;

  const [showPanduanIbadah, setShowPanduanIbadah] = useState(false);
  const [panduanTab, setPanduanTab] = useState<'thoriqoh' | 'sholat' | 'quran'>('thoriqoh');

  return (
    <div className="flex-1 flex justify-center">
      <div className="w-full max-w-3xl bg-paper flex flex-col min-h-screen relative pb-24">

        <Header
          fullName={currentStudent.name}
          subtitle={`Kelas: ${currentStudent.kelas} • Rayon: ${currentStudent.rayon}`}
          schoolName={schoolConfig.sekolah}
          poin={currentStudent.points}
          onLogout={handleLogout}
        />

        <div className="px-4 py-4 space-y-4 flex-1">

          {/* TAB SISWA: JURNAL & PEMBIASAAN LENGKAP */}
          {siswaTab === 'jurnal' && (
            <div className="space-y-4">
              {/* Multi-Sub Tab Navigator */}
              <div className="bg-white p-1 rounded-2xl shadow-sm border border-green-100 flex items-center gap-1 overflow-x-auto text-xs">
                <button
                  type="button"
                  onClick={() => setJurnalView('harian')}
                  className={`flex-1 min-w-[75px] py-2 px-1 text-center font-bold rounded-xl transition-all ${
                    jurnalView === 'harian'
                      ? 'bg-[#2E7D32] text-white shadow-sm'
                      : 'text-gray-500 hover:text-green-800'
                  }`}
                >
                  Jejak Harian
                </button>
                <button
                  type="button"
                  onClick={() => setJurnalView('mingguan')}
                  className={`flex-1 min-w-[75px] py-2 px-1 text-center font-bold rounded-xl transition-all ${
                    jurnalView === 'mingguan'
                      ? 'bg-[#2E7D32] text-white shadow-sm'
                      : 'text-gray-500 hover:text-green-800'
                  }`}
                >
                  Jejak Pekanan
                </button>
                <button
                  type="button"
                  onClick={() => setJurnalView('non_rutin')}
                  className={`flex-1 min-w-[85px] py-2 px-1 text-center font-bold rounded-xl transition-all ${
                    jurnalView === 'non_rutin'
                      ? 'bg-[#2E7D32] text-white shadow-sm'
                      : 'text-gray-500 hover:text-green-800'
                  }`}
                >
                  Non Rutin
                </button>
                <button
                  type="button"
                  onClick={() => setJurnalView('jadwal')}
                  className={`flex-1 min-w-[85px] py-2 px-1 text-center font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                    jurnalView === 'jadwal'
                      ? 'bg-[#2E7D32] text-white shadow-sm'
                      : 'text-gray-500 hover:text-green-800'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Jadwal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setJurnalView('kesehatan')}
                  className={`flex-1 min-w-[95px] py-2 px-1 text-center font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                    jurnalView === 'kesehatan'
                      ? 'bg-[#2E7D32] text-white shadow-sm'
                      : 'text-gray-500 hover:text-green-800'
                  }`}
                >
                  {isSiswiPutri ? (
                    <>
                      <Droplets className="w-3.5 h-3.5 text-rose-300" />
                      <span>Haid & Sehat</span>
                    </>
                  ) : (
                    <>
                      <HeartPulse className="w-3.5 h-3.5" />
                      <span>Kesehatan</span>
                    </>
                  )}
                </button>
              </div>

              {siswaSaveSuccess && (
                <div className="p-3 bg-green-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Alhamdulillah, Jejak Harian berhasil disimpan (+{calculateDailyPoints()} Poin)!</span>
                </div>
              )}

              {/* SUB-VIEW 1: JEJAK HARIAN LENGKAP */}
              {jurnalView === 'harian' && (
                <div className="space-y-4">
                  {/* Tanggal & Estimasi Poin */}
                  <div className="bg-white rounded-2xl p-3 shadow-sm border border-green-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                      <Calendar className="w-4 h-4 text-[#2E7D32]" />
                      <span>Tanggal:</span>
                      <input
                        type="date"
                        value={siswaDate}
                        onChange={(e) => setSiswaDate(e.target.value)}
                        className="text-xs font-semibold bg-green-50 text-green-900 px-2 py-1 rounded-lg border border-green-200 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPanduanIbadah(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-xl font-bold text-xs transition-all shadow-xs"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Panduan Wirid & Niat</span>
                      </button>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 block leading-tight">Potensi:</span>
                        <span className="text-xs font-black text-[#1B5E20] bg-green-100 px-2 py-0.5 rounded-full inline-block">
                          +{calculateDailyPoints()} Poin
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dispensasi Menstruasi Bar - Khusus Siswi Putri */}
                  {isSiswiPutri && (
                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                        <div>
                          <span className="text-xs font-bold text-rose-950 block">Dispensasi Syar'i (Menstruasi)</span>
                          <span className="text-[11px] text-rose-700">Untuk siswi yang sedang berhalangan haid</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setJurnalView('kesehatan')}
                          className="text-xs font-semibold text-rose-800 hover:text-rose-950 underline px-2 py-1"
                        >
                          Buka Kalender &rarr;
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !jurnal.sedang_menstruasi;
                            setJurnal({
                              ...jurnal,
                              sedang_menstruasi: next,
                              tahajud: next ? 'menstruasi' : '4_rakaat',
                              dhuha: next ? 'menstruasi' : '4_rakaat',
                              subuh: next ? 'menstruasi' : 'berjamaah',
                              dzuhur: next ? 'menstruasi' : 'berjamaah',
                              ashar: next ? 'menstruasi' : 'berjamaah',
                              maghrib: next ? 'menstruasi' : 'berjamaah',
                              isya: next ? 'menstruasi' : 'berjamaah',
                            });
                          }}
                          className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all shadow-2xs ${
                            jurnal.sedang_menstruasi
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-white text-rose-700 border border-rose-300 hover:bg-rose-100'
                          }`}
                        >
                          {jurnal.sedang_menstruasi ? 'Sedang Haid (Udzur)' : 'Status: Suci'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 1. SHOLAT TAHAJUD, DHUHA & SHOLAT SUNNAH LENGKAP */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <h3 className="text-sm font-bold text-[#1B5E20] flex items-center gap-2">
                        <Moon className="w-4 h-4 text-indigo-600" />
                        Sholat Sunnah Harian
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setPanduanTab('sholat');
                          setShowPanduanIbadah(true);
                        }}
                        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
                      >
                        Niat & Fadilah &rarr;
                      </button>
                    </div>

                    {/* Sholat Tahajud */}
                    <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                          <span>Sholat Tahajud</span>
                          <span className="text-xs font-normal text-indigo-700">(Qiyamul Lail)</span>
                        </span>
                        <span className="text-xs font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                          {jurnal.tahajud === '4_rakaat' ? '+6 Poin' : jurnal.tahajud === '2_rakaat' ? '+3 Poin' : jurnal.tahajud === 'menstruasi' ? 'Dispensasi (M)' : '0 Poin'}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-xs">
                        {[
                          { id: '4_rakaat', label: '4 Rakaat', pts: '6' },
                          { id: '2_rakaat', label: '2 Rakaat', pts: '3' },
                          { id: 'tidak', label: 'Tidak', pts: '0' },
                          { id: 'menstruasi', label: 'Haid (M)', pts: 'M' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setJurnal({ ...jurnal, tahajud: opt.id as any })}
                            className={`py-1.5 px-1 rounded-lg font-bold text-center transition-all ${
                              jurnal.tahajud === opt.id
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-indigo-50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sholat Dhuha */}
                    <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <span>Sholat Dhuha</span>
                          <span className="text-xs font-normal text-amber-700">(Pagi Hari)</span>
                        </span>
                        <span className="text-xs font-bold text-amber-700 bg-white px-2 py-0.5 rounded-full border border-amber-200">
                          {jurnal.dhuha === '4_rakaat' ? '+4 Poin' : jurnal.dhuha === '2_rakaat' ? '+2 Poin' : jurnal.dhuha === 'menstruasi' ? 'Dispensasi (M)' : '0 Poin'}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-xs">
                        {[
                          { id: '4_rakaat', label: '4 Rakaat', pts: '4' },
                          { id: '2_rakaat', label: '2 Rakaat', pts: '2' },
                          { id: 'tidak', label: 'Tidak', pts: '0' },
                          { id: 'menstruasi', label: 'Haid (M)', pts: 'M' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setJurnal({ ...jurnal, dhuha: opt.id as any })}
                            className={`py-1.5 px-1 rounded-lg font-bold text-center transition-all ${
                              jurnal.dhuha === opt.id
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-amber-50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sholat Sunnah Tambahan Sesuai Permintaan */}
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                        Sholat Sunnah Tambahan & Pengiring
                      </span>
                      {[
                        { key: 'sholat_taubat', label: 'Sholat Sunnah Taubat (+3 Poin)', desc: '2 rakaat memohon ampunan, taubat nasuha & tazkiyatun nafs' },
                        { key: 'sholat_hajat', label: 'Sholat Li Qodho\'il Hajati (+3 Poin)', desc: '2 rakaat memohon kelapangan dan terkabulnya hajat/keinginan baik' },
                        { key: 'sholat_istikharah', label: 'Sholat Sunnah Istikhoroh (+3 Poin)', desc: '2 rakaat memohon ketetapan petunjuk pilihan terbaik dari Allah SWT' },
                        { key: 'sholat_liridhoillah', label: 'Sholat Sunnah Li Ridhollah (+3 Poin)', desc: '2 rakaat semata-mata mengharap ridho dan mahabbah Allah Ta\'ala' },
                        { key: 'sholat_syukur', label: 'Sholat Sunnah Syukur (+3 Poin)', desc: '2 rakaat sholat wujud terima kasih atas segala nikmat Allah SWT' },
                        { key: 'sujud_syukur', label: 'Sujud Syukur (+2 Poin)', desc: 'Sujud spontan saat meraih nikmat/prestasi atau terhindar dari musibah' },
                        { key: 'sholat_tasbih', label: 'Sholat Sunnah Tasbih (+4 Poin)', desc: '4 rakaat dengan 300 tasbih mensucikan jiwa dan memohon ampunan dosa' },
                        { key: 'sholat_rawatib', label: 'Sholat Sunnah Rawatib (+4 Poin)', desc: 'Qobliyah & Ba\'diyah pengiring sholat fardhu 5 waktu' },
                        { key: 'sholat_awwabin', label: 'Sholat Sunnah Awwabin (+3 Poin)', desc: '2 s.d. 6 rakaat antara sholat Maghrib dan Isya' },
                        { key: 'sholat_lihifdhil_iman', label: 'Sholat Sunnah Li Hifdhil Iman (+3 Poin)', desc: '2 rakaat ba\'da Maghrib memohon pemeliharaan & ketetapan iman' },
                        { key: 'sholat_birrul_walidain', label: 'Sholat Sunnah Birrul Walidain (+3 Poin)', desc: '2 rakaat berbakti mendoakan keselamatan & ampunan orang tua' },
                      ].map((item) => {
                        const isChecked = Boolean(jurnal[item.key as keyof typeof jurnal]);
                        return (
                          <button
                            key={item.key}
                            type="button"
                            aria-pressed={isChecked}
                            onClick={() => setJurnal({ ...jurnal, [item.key]: !isChecked })}
                            className={`block min-h-[44px] w-full rounded-control border px-2.5 py-2 text-left transition-colors ${
                              isChecked
                                ? 'border-brand-700/40 bg-brand-50 text-brand-900'
                                : 'border-line bg-paper/50 text-muted hover:border-brand-700/30'
                            }`}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className={`text-xs ${isChecked ? 'font-semibold' : 'font-medium'}`}>
                                {item.label}
                              </span>
                              {isChecked ? (
                                <CheckSquare className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                              ) : (
                                <Square className="h-4 w-4 shrink-0 text-muted/60" aria-hidden="true" />
                              )}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted">{item.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. SHOLAT FARDHU 5 WAKTU BERJAMAAH */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <h3 className="text-sm font-bold text-[#1B5E20] flex items-center gap-2">
                        <Sun className="w-4 h-4 text-emerald-600" />
                        Sholat Fardhu 5 Waktu
                      </h3>
                      <span className="text-xs text-gray-400">Tepat Waktu (+4) • Masbuk (+3)</span>
                    </div>

                    <div className="space-y-2">
                      {[
                        { key: 'subuh', label: 'Subuh' },
                        { key: 'dzuhur', label: 'Dzuhur' },
                        { key: 'ashar', label: 'Ashar' },
                        { key: 'maghrib', label: 'Maghrib' },
                        { key: 'isya', label: 'Isya' },
                      ].map((item) => {
                        const val = jurnal[item.key as keyof typeof jurnal] as string;
                        return (
                          <div key={item.key} className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-200 flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-gray-800 w-16">
                              {item.label}
                            </span>
                            <div className="flex-1 grid grid-cols-4 gap-1 text-xs">
                              {[
                                { id: 'berjamaah', label: 'Tepat Waktu (+4)' },
                                { id: 'masbuk', label: 'Masbuk (+3)' },
                                { id: 'munfarid', label: 'Munfarid (+1)' },
                                { id: 'menstruasi', label: 'Haid (M)' },
                              ].map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => setJurnal({ ...jurnal, [item.key]: opt.id })}
                                  className={`py-1 rounded font-semibold text-center transition-all ${
                                    val === opt.id
                                      ? 'bg-green-700 text-white shadow-xs font-bold'
                                      : 'bg-white text-gray-600 border border-gray-200'
                                  }`}
                                >
                                  {opt.label.split(' ')[0]}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. TILAWAH & SURAT-SURAT PILIHAN AL-QUR'AN */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <h3 className="text-sm font-bold text-[#1B5E20] flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-green-700" />
                        Tilawah & Surat Pilihan Al-Qur'an
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setPanduanTab('quran');
                          setShowPanduanIbadah(true);
                        }}
                        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
                      >
                        Fadilah Surat &rarr;
                      </button>
                    </div>

                    {[
                      { key: 'mengaji', label: 'Mengaji / Menghafal Al-Qur\'an (+1 Poin)', desc: 'Disiplin tilawah, tadarrus, atau setoran hafalan harian', icon: BookOpen },
                      { key: 'surat_yasin', label: 'Membaca Surat Yasin (+2 Poin)', desc: 'QS. Yasin (36: 1-83) - Jantung Al-Qur\'an, kelapangan hati', icon: BookOpen },
                      { key: 'surat_waqiah', label: 'Membaca Surat Al-Waqi\'ah (+2 Poin)', desc: 'QS. Al-Waqi\'ah (56: 1-96) - Pembuka rezeki & berkah hidup', icon: BookOpen },
                      { key: 'surat_al_mulk', label: 'Membaca Surat Al-Mulk (+2 Poin)', desc: 'QS. Al-Mulk (67: 1-30) Tabarak - Penyelamat dari siksa kubur', icon: BookOpen },
                    ].map((item) => {
                      const isChecked = Boolean(jurnal[item.key as keyof typeof jurnal]);
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          aria-pressed={isChecked}
                          onClick={() => setJurnal({ ...jurnal, [item.key]: !isChecked })}
                          className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-control border px-2.5 py-2 text-left transition-colors ${
                            isChecked
                              ? 'border-brand-700/40 bg-brand-50 text-brand-900'
                              : 'border-line bg-paper/50 text-muted hover:border-brand-700/30'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Icon
                              className={`h-4 w-4 shrink-0 ${isChecked ? 'text-brand-700' : 'text-muted'}`}
                              aria-hidden="true"
                            />
                            <span>
                              <span className={`text-xs block ${isChecked ? 'font-semibold' : 'font-medium'}`}>
                                {item.label}
                              </span>
                              <span className="text-[11px] text-gray-500 block">{item.desc}</span>
                            </span>
                          </span>
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                          ) : (
                            <Square className="h-4 w-4 shrink-0 text-muted/60" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* 4. DZIKIR HARIAN & DZIKIR THORIQOH */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <h3 className="text-sm font-bold text-[#1B5E20] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        Dzikir Harian & Dzikir Thoriqoh
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setPanduanTab('thoriqoh');
                          setShowPanduanIbadah(true);
                        }}
                        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
                      >
                        Panduan Wirid &rarr;
                      </button>
                    </div>

                    {/* Dzikir Pagi & Sore */}
                    <div className="space-y-2">
                      {[
                        { key: 'zikir_pagi', label: 'Membaca Dzikir Pagi (+1 Poin)', desc: 'Al-Ma\'tsurat / wirid pagi menjaga keberkahan hari', icon: Sun },
                        { key: 'zikir_sore', label: 'Membaca Dzikir Sore (+1 Poin)', desc: 'Al-Ma\'tsurat / wirid sore perlindungan malam hari', icon: Moon },
                      ].map((item) => {
                        const isChecked = Boolean(jurnal[item.key as keyof typeof jurnal]);
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            aria-pressed={isChecked}
                            onClick={() => setJurnal({ ...jurnal, [item.key]: !isChecked })}
                            className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-control border px-2.5 py-2 text-left transition-colors ${
                              isChecked
                                ? 'border-brand-700/40 bg-brand-50 text-brand-900'
                                : 'border-line bg-paper/50 text-muted hover:border-brand-700/30'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Icon
                                className={`h-4 w-4 shrink-0 ${isChecked ? 'text-brand-700' : 'text-muted'}`}
                                aria-hidden="true"
                              />
                              <span>
                                <span className={`text-xs block ${isChecked ? 'font-semibold' : 'font-medium'}`}>
                                  {item.label}
                                </span>
                                <span className="text-[11px] text-gray-500 block">{item.desc}</span>
                              </span>
                            </span>
                            {isChecked ? (
                              <CheckSquare className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                            ) : (
                              <Square className="h-4 w-4 shrink-0 text-muted/60" aria-hidden="true" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Dzikir Thoriqoh Card Khusus */}
                    <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-100/50 p-3.5 rounded-2xl border border-emerald-300 shadow-xs">
                      <button
                        type="button"
                        onClick={() => setJurnal({ ...jurnal, dzikir_thoriqoh: !jurnal.dzikir_thoriqoh })}
                        className="w-full text-left flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`p-2.5 rounded-xl mt-0.5 transition-colors ${
                              jurnal.dzikir_thoriqoh
                                ? 'bg-[#1B5E20] text-white shadow-xs'
                                : 'bg-white text-gray-400 border border-emerald-200'
                            }`}
                          >
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-xs font-bold ${
                                  jurnal.dzikir_thoriqoh ? 'text-[#1B5E20]' : 'text-gray-700'
                                }`}
                              >
                                Bacaan Wirid Dzikir Thoriqoh (+4 Poin)
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  jurnal.dzikir_thoriqoh
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-200 text-gray-700'
                                }`}
                              >
                                {jurnal.dzikir_thoriqoh ? 'Sudah Dibaca ✓' : 'Belum Dibaca'}
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-900 mt-1 leading-relaxed">
                              Istighfar 100x • Sholawat 100x • Tahlil (165x/300x) • <strong>Dzikir "Allah, Allah" (5.000x)</strong>.
                            </p>
                          </div>
                        </div>
                        {jurnal.dzikir_thoriqoh ? (
                          <CheckSquare className="h-5 w-5 shrink-0 text-[#1B5E20] mt-0.5" />
                        ) : (
                          <Square className="h-5 w-5 shrink-0 text-gray-400 mt-0.5" />
                        )}
                      </button>

                      <div className="mt-3 pt-2.5 border-t border-emerald-200 flex items-center justify-between">
                        <span className="text-[10px] text-emerald-800 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          Wirid Rutin Harian Santri
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setPanduanTab('thoriqoh');
                            setShowPanduanIbadah(true);
                          }}
                          className="text-[11px] font-bold text-emerald-800 hover:text-[#1B5E20] underline flex items-center gap-1"
                        >
                          Buka Teks & Panduan Dzikir &rarr;
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 4. ASPEK KESEHATAN, GROOMING & DISIPLIN (Sesuai Hal 16 Dokumen BKP) */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <h3 className="text-sm font-bold text-[#1B5E20] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        Kesehatan, Kebersihan & Kedisiplinan
                      </h3>
                    </div>

                    {[
                      { key: 'grooming', label: 'Grooming Diri (+8 Poin)', desc: 'Bersih, wangi, deodoran, ganti kaos kaki & dalaman kerudung' },
                      { key: 'bangun_subuh', label: 'Bangun Sebelum Pukul 05.00 (+1 Poin)', desc: 'Disiplin qiyam dan persiapan sholat subuh' },
                      { key: 'tidur_awal', label: 'Tidur Sebelum Pukul 22.00 (+1 Poin)', desc: 'Tidak begadang tanpa udzur (Jika lewat -2 Poin)' },
                      { key: 'air_putih', label: 'Minum Air Putih 1,5 - 2 Liter (+1 Poin)', desc: 'Menjaga hidrasi dan kesehatan ginjal' },
                      { key: 'mandi_2x', label: 'Mandi 2 Kali Setiap Hari (+1 Poin)', desc: 'Kebersihan tubuh sebelum & sesudah kegiatan' },
                      { key: 'kelompok_belajar', label: 'Aktif dalam Kelompok Belajar (+4 Poin)', desc: 'Aspek kewargaan & kolaborasi akademik' },
                    ].map((item) => {
                      const isChecked = Boolean(jurnal[item.key as keyof typeof jurnal]);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          aria-pressed={isChecked}
                          onClick={() => setJurnal({ ...jurnal, [item.key]: !isChecked })}
                          className={`block min-h-[44px] w-full rounded-control border px-2.5 py-2 text-left transition-colors ${
                            isChecked
                              ? 'border-brand-700/40 bg-brand-50 text-brand-900'
                              : 'border-line bg-paper/50 text-muted hover:border-brand-700/30'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className={`text-xs ${isChecked ? 'font-semibold' : 'font-medium'}`}>
                              {item.label}
                            </span>
                            {isChecked ? (
                              <CheckSquare className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                            ) : (
                              <Square className="h-4 w-4 shrink-0 text-muted/60" aria-hidden="true" />
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted">{item.desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Catatan Jurnal */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Catatan Tambahan / Refleksi Diri:</label>
                    <textarea
                      value={jurnal.catatan}
                      onChange={(e) => setJurnal({ ...jurnal, catatan: e.target.value })}
                      rows={2}
                      placeholder="Tuliskan ayat yang dihafal, materi pengajian, atau catatan ibadah..."
                      className="w-full p-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-green-600"
                    />
                  </div>

                  <button
                    onClick={saveJurnal}
                    disabled={jurnalSaving}
                    className="w-full py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {jurnalSaving
                        ? 'Menyimpan...'
                        : `Simpan Jejak Harian (+${calculateDailyPoints()} Pts)`}
                    </span>
                  </button>
                </div>
              )}

              {/* SUB-VIEW 2: PEMBIASAAN MINGGUAN (12 ITEM) */}
              {jurnalView === 'mingguan' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#1B5E20]">12 Indikator Pembiasaan Mingguan</h3>
                      <p className="text-xs text-gray-500">Evaluasi pekanan menuju Tanda Tangan Orang Tua</p>
                    </div>
                    <span className="text-xs font-bold text-green-800 bg-green-100 px-3 py-1 rounded-full">
                      Pekan ke-{currentWeek}
                    </span>
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-2">
                    {[
                      { key: 'sholat_jumat_keputrian', label: '1. Sholat Jumat / Keputrian (+50 Poin)' },
                      { key: 'puasa_sunnah', label: '2. Puasa Sunnah Senin-Kamis (+80/+40 Poin)' },
                      { key: 'berinfak', label: '3. Berinfak / Sedekah (+40 Poin)' },
                      { key: 'tablet_tambah_darah', label: '4. Tablet Tambah Darah / Vit. (+30 Poin)' },
                      { key: 'olahraga', label: '5. Olahraga Minimal 15 Menit (+60 Poin)' },
                      { key: 'keramas_2x', label: '6. Keramas min. 2x Seminggu (+50 Poin)' },
                      { key: 'kebersihan_diri', label: '7. Kuku, Telinga, dan Bercukur (+50 Poin)' },
                      { key: 'piket_rayon', label: '8. Piket Rayon Asrama (+50 Poin)' },
                      { key: 'daur_ulang', label: '9. Bawa Bahan Daur Ulang P5 (+50 Poin)' },
                      { key: 'ekstrakurikuler', label: '10. Hadir Ekstrakurikuler (+50 Poin)' },
                      { key: 'seni_budaya', label: '11. Hadir Seni Budaya (+50 Poin)' },
                      { key: 'kumpul_rayon', label: '12. Hadir Kumpul Rayon (+50 Poin)' },
                      { key: 'input_kejar_id', label: '13. Input Rekap Jejak ke Kejar.id (+100 Poin)' },
                    ].map((item) => {
                      const isChecked = Boolean(mingguan[item.key as keyof typeof mingguan]);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          aria-pressed={isChecked}
                          onClick={() => setMingguan({ ...mingguan, [item.key]: !isChecked })}
                          className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-control border px-3 py-2.5 text-left transition-colors ${
                            isChecked
                              ? 'border-brand-700/40 bg-brand-50 text-brand-900'
                              : 'border-line bg-paper/50 text-muted hover:border-brand-700/30'
                          }`}
                        >
                          <span className={`text-xs ${isChecked ? 'font-semibold' : 'font-medium'}`}>
                            {item.label}
                          </span>
                          {isChecked ? (
                            <CheckSquare className="h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
                          ) : (
                            <Square className="h-5 w-5 shrink-0 text-muted/60" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={saveJurnal}
                    disabled={jurnalSaving}
                    className="w-full py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />
                    <span>{jurnalSaving ? 'Menyimpan...' : 'Simpan Pembiasaan Pekanan'}</span>
                  </button>
                </div>
              )}

              {/* SUB-VIEW 3: KEGIATAN NON-RUTIN (INTERAKTIF SISWA) */}
              {jurnalView === 'non_rutin' && (
                <div className="space-y-3">
                  {/* Banner Penjelasan Resmi BKP */}
                  <div className="rounded-card border border-line bg-surface p-3.5">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#1B5E20] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-[#1B5E20]">Panduan Pengisian Kegiatan Non-Rutin</h3>
                          <span className="text-xs bg-green-200 text-green-900 font-bold px-1.5 py-0.2 rounded">Jejak Hal. 20</span>
                        </div>
                        <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                          <strong>Kegiatan ini diisi mandiri oleh Siswa</strong> pada periode terkait (3-Mingguan, 9-Mingguan, atau Semester), kemudian disetujui / ditandatangani Orang Tua & Guru/Wali Rayon.
                        </p>
                        <p className="text-xs text-emerald-800 mt-1 bg-white/70 p-1.5 rounded-lg border border-green-100">
                          <strong>Status kegiatan</strong> (seperti <em>&quot;Mengikuti dgn khidmat&quot;</em> atau <em>&quot;Memenuhi target hafalan&quot;</em>) adalah pilihan kriteria resmi yang dapat dipilih siswa di bawah ini sesuai kenyataan di lapangan.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Filter Kategori & Ringkasan Poin */}
                  <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-700">Filter Periode:</span>
                      <span className="text-xs font-semibold text-[#1B5E20] bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                        Total Poin Periode: +{nonRutinList.reduce((acc, item) => acc + (item.poin > 0 ? item.poin : 0), 0)} Pts
                      </span>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                      {(['Semua', '3 Mingguan', '9 Mingguan', 'Semester'] as const).map((kat) => (
                        <button
                          key={kat}
                          type="button"
                          onClick={() => setNonRutinFilter(kat)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                            nonRutinFilter === kat
                              ? 'bg-[#1B5E20] text-white shadow-sm font-semibold'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {kat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status Verifikasi Non-Rutin Pekan Ini */}
                  {(() => {
                    const currentPeriode = `${new Date().getFullYear()}_P${currentWeek}`;
                    const currentNr = nonRutinSubmissions.find((s) => s.periode === currentPeriode);
                    if (!currentNr) return null;
                    return (
                      <div
                        className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-2 ${
                          currentNr.status === 'verified'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : currentNr.status === 'rejected'
                              ? 'bg-rose-50 border-rose-200 text-rose-900'
                              : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div>
                          <span className="font-bold block">
                            {currentNr.status === 'verified'
                              ? `Terverifikasi Guru/Pembimbing (${(currentNr.poin_disetujui ?? currentNr.net_poin) >= 0 ? '+' : ''}${currentNr.poin_disetujui ?? currentNr.net_poin} Poin)`
                              : currentNr.status === 'rejected'
                                ? 'Perlu Revisi / Ditolak Pembimbing'
                                : 'Menunggu Verifikasi Guru / Pembimbing Rayon'}
                          </span>
                          {currentNr.catatan_verifikasi && (
                            <span className="text-[11px] block mt-0.5 opacity-90">
                              Catatan: "{currentNr.catatan_verifikasi}"
                            </span>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] uppercase bg-white/80 border border-current/20 shrink-0">
                          {currentNr.status === 'verified'
                            ? 'Disetujui'
                            : currentNr.status === 'rejected'
                              ? 'Revisi'
                              : 'Pending'}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Notifikasi Simpan Berhasil */}
                  {nonRutinSaveSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-fade-in shadow-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Isian kegiatan non-rutin pekan ini tersimpan & menunggu verifikasi pembimbing.</span>
                    </div>
                  )}

                  {/* List Kegiatan Non-Rutin yang Bisa Diisi Siswa */}
                  <div className="space-y-2.5">
                    {nonRutinList
                      .filter((item) => nonRutinFilter === 'Semua' || item.kategori === nonRutinFilter)
                      .map((nr) => (
                        <div key={nr.id} className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm space-y-2.5 hover:border-green-200 transition-all">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="bg-green-100 text-[#1B5E20] font-bold text-xs px-2 py-0.5 rounded-full">
                                  {nr.kategori}
                                </span>
                                <span className="bg-gray-100 text-gray-600 font-medium text-xs px-1.5 py-0.5 rounded">
                                  Mapel: {nr.mapel}
                                </span>
                              </div>
                              <h4 className="text-xs font-bold text-gray-800 mt-1">{nr.nama}</h4>
                            </div>
                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg shrink-0 ${
                              nr.poin > 0
                                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                                : nr.poin < 0
                                  ? 'text-red-700 bg-red-50 border border-red-200'
                                  : 'text-gray-600 bg-gray-50 border border-gray-200'
                            }`}>
                              {nr.poin > 0 ? `+${nr.poin}` : nr.poin} Pts
                            </span>
                          </div>

                          {/* Pilihan Kriteria / Status Pelaksanaan oleh Siswa */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                              Pilih Status Capaian:
                            </label>
                            <select
                              value={nr.status}
                              onChange={(e) => {
                                const selectedOpt = nr.options?.find(opt => opt.status === e.target.value);
                                setNonRutinList(prev => prev.map(item => {
                                  if (item.id === nr.id) {
                                    return {
                                      ...item,
                                      status: e.target.value,
                                      poin: selectedOpt ? selectedOpt.poin : item.poin
                                    };
                                  }
                                  return item;
                                }));
                              }}
                              className="w-full text-xs p-2 rounded-xl border border-gray-200 bg-gray-50/50 font-medium text-gray-800 focus:bg-white focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] outline-none transition-all cursor-pointer"
                            >
                              <option value="">Belum diisi</option>
                              {nr.options?.map((opt, idx) => (
                                <option key={idx} value={opt.status}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Field Khusus Jika Setoran Target Hafalan (nr-9) */}
                          {nr.id === 'nr-9' && (
                            <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/80 space-y-1.5">
                              <label className="block text-xs font-bold text-amber-900 uppercase tracking-wide">
                                Target Surah / Hadits / Juz yang Disetorkan:
                              </label>
                              <input
                                type="text"
                                value={nr.detail || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setNonRutinList(prev => prev.map(item => item.id === nr.id ? { ...item, detail: val } : item));
                                }}
                                placeholder="Contoh: Surah Al-Mulk s.d. Al-Qalam (Juz 29)"
                                className="w-full text-xs p-2 rounded-lg border border-amber-300 bg-white text-gray-800 placeholder-gray-400 outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                          )}

                          {/* Input Nama Saksi / Guru Penilai */}
                          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                            <span className="text-xs text-gray-500 shrink-0 font-medium">Saksi/Guru:</span>
                            <input
                              type="text"
                              value={nr.saksi}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNonRutinList(prev => prev.map(item => item.id === nr.id ? { ...item, saksi: val } : item));
                              }}
                              placeholder="Nama Guru Pengampu / Wali Rayon"
                              className="w-full text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 outline-none focus:border-green-600"
                            />
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Tombol Simpan Form Non-Rutin */}
                  {(() => {
                    const currentPeriode = `${new Date().getFullYear()}_P${currentWeek}`;
                    const currentNr = nonRutinSubmissions.find((s) => s.periode === currentPeriode);
                    const isVerified = currentNr?.status === 'verified';
                    return (
                      <button
                        type="button"
                        onClick={saveNonRutin}
                        disabled={nonRutinSaving || isVerified}
                        className="flex w-full items-center justify-center gap-2 rounded-control bg-brand-700 py-3 text-xs font-semibold text-white transition-colors hover:bg-brand-800 disabled:bg-brand-700/50"
                      >
                        {nonRutinSaving ? (
                          <>
                            <span
                              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                              aria-hidden="true"
                            />
                            Menyimpan
                          </>
                        ) : isVerified ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            Sudah Diverifikasi Pekan Ini
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" aria-hidden="true" />
                            Simpan isian pekan ini
                          </>
                        )}
                      </button>
                    );
                  })()}
                </div>
              )}

              {/* SUB-VIEW 4: JADWAL PELAJARAN (SENIN - JUMAT) */}
              {jurnalView === 'jadwal' && (
                <JadwalPelajaranView
                  currentClass={currentStudent.kelas}
                  userRole={role}
                  user={sessionUser}
                />
              )}

              {/* SUB-VIEW 5: KALENDER MENSTRUASI / KESEHATAN */}
              {jurnalView === 'kesehatan' && (
                isSiswiPutri ? (
                  <KalenderMenstruasi
                    student={currentStudent}
                    user={sessionUser}
                    onStatusChange={(isHaid) => {
                      setJurnal((prev) => ({
                        ...prev,
                        sedang_menstruasi: isHaid,
                        subuh: isHaid ? 'menstruasi' : (prev.subuh === 'menstruasi' ? 'berjamaah' : prev.subuh),
                        dzuhur: isHaid ? 'menstruasi' : (prev.dzuhur === 'menstruasi' ? 'berjamaah' : prev.dzuhur),
                        ashar: isHaid ? 'menstruasi' : (prev.ashar === 'menstruasi' ? 'berjamaah' : prev.ashar),
                        maghrib: isHaid ? 'menstruasi' : (prev.maghrib === 'menstruasi' ? 'berjamaah' : prev.maghrib),
                        isya: isHaid ? 'menstruasi' : (prev.isya === 'menstruasi' ? 'berjamaah' : prev.isya),
                        tahajud: isHaid ? 'menstruasi' : (prev.tahajud === 'menstruasi' ? '4_rakaat' : prev.tahajud),
                        dhuha: isHaid ? 'menstruasi' : (prev.dhuha === 'menstruasi' ? '4_rakaat' : prev.dhuha),
                      }));
                    }}
                  />
                ) : (
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-100 space-y-3 text-xs">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold">
                      <HeartPulse className="w-5 h-5 text-emerald-600" />
                      <h3 className="text-sm">Borang Kebugaran & Kesehatan Santri Putra</h3>
                    </div>
                    <p className="text-gray-600 leading-relaxed">
                      Pemantauan kebiasaan fisik harian: pola tidur sehat (sebelum 22.00), bangun sebelum subuh, minum air putih 1,5 - 2 liter, dan olahraga rutin di asrama.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                        <span className="font-bold text-emerald-900 block">Minum Air Putih</span>
                        <span className="text-gray-600">8 Gelas (2 Liter) / Hari</span>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                        <span className="font-bold text-blue-900 block">Olahraga Pekanan</span>
                        <span className="text-gray-600">Minimal 15 menit / pekan</span>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* TAB SISWA: BORANG KESEHATAN (DARI BOTTOM NAV) */}
          {siswaTab === 'kesehatan' && (
            isSiswiPutri ? (
              <KalenderMenstruasi
                student={currentStudent}
                user={sessionUser}
                onStatusChange={(isHaid) => {
                  setJurnal((prev) => ({
                    ...prev,
                    sedang_menstruasi: isHaid,
                  }));
                }}
              />
            ) : (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-100 space-y-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <HeartPulse className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm">Borang Kebugaran & Kesehatan Santri Putra</h3>
                </div>
                <p className="text-gray-600 leading-relaxed">
                  Pemantauan kebiasaan fisik harian: pola tidur sehat (sebelum 22.00), bangun sebelum subuh, minum air putih 1,5 - 2 liter, dan olahraga rutin di asrama.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <span className="font-bold text-emerald-900 block">Minum Air Putih</span>
                    <span className="text-gray-600">8 Gelas (2 Liter) / Hari</span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                    <span className="font-bold text-blue-900 block">Olahraga Pekanan</span>
                    <span className="text-gray-600">Minimal 15 menit / pekan</span>
                  </div>
                </div>
              </div>
            )
          )}

          {/* TAB SISWA: HOME */}
          {siswaTab === 'home' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status Kejar Prestasi</h3>
                <div className="text-2xl font-black text-[#1B5E20]">{currentStudent.points} Poin</div>
                <p className="text-xs text-gray-600 mt-1">Target minimal kelulusan karakter: 1000 Poin</p>
              </div>

              {/* Ringkasan Pembiasaan Hari Ini */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Ibadah & Karakter Hari Ini</span>
                  </h3>
                  <button onClick={() => setSiswaTab('jurnal')} className="text-xs text-[#2E7D32] font-semibold hover:underline">
                    Buka Jejak &rarr;
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-green-50 p-2.5 rounded-xl border border-green-100">
                    <span className="text-xs text-gray-500 block">Tahajud:</span>
                    <span className="font-bold text-green-900">{jurnal.tahajud === '4_rakaat' ? '4 Rakaat (+6)' : jurnal.tahajud === '2_rakaat' ? '2 Rakaat (+3)' : 'Belum'}</span>
                  </div>
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                    <span className="text-xs text-gray-500 block">Dhuha:</span>
                    <span className="font-bold text-amber-900">{jurnal.dhuha === '4_rakaat' ? '4 Rakaat (+4)' : jurnal.dhuha === '2_rakaat' ? '2 Rakaat (+2)' : 'Belum'}</span>
                  </div>
                </div>
              </div>

              {/* Ringkasan Prestasi Unggulan */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-yellow-500" />
                    <span>Prestasi Unggulan Santri</span>
                  </h3>
                  <button onClick={() => setSiswaTab('poin')} className="text-xs text-[#2E7D32] font-semibold hover:underline">
                    Lihat Semua
                  </button>
                </div>
                {prestasiList[0] ? (
                  <div className="p-3 bg-yellow-50/70 border border-yellow-200 rounded-xl">
                    <span className="text-xs font-bold text-yellow-900 block">{prestasiList[0].judul}</span>
                    <span className="text-xs text-yellow-700 block mt-0.5">
                      {prestasiList[0].kategori} •{' '}
                      {prestasiList[0].status === 'verified'
                        ? `+${prestasiList[0].poin} Poin`
                        : prestasiList[0].status === 'pending'
                          ? 'Menunggu verifikasi'
                          : 'Ditolak'}
                    </span>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50/70 border border-yellow-200 rounded-xl text-xs text-yellow-800">
                    Belum ada prestasi tercatat. Ajukan dari tab Poin.
                  </div>
                )}
                {/* Kartu Jadwal Pelajaran */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span>Jadwal Pelajaran ({currentStudent.kelas})</span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Senin s.d. Jumat sesuai kurikulum sekolah</p>
                  </div>
                  <button
                    onClick={() => {
                      setSiswaTab('jurnal');
                      setJurnalView('jadwal');
                    }}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#1B5E20] font-bold rounded-xl border border-emerald-200 text-xs transition-colors"
                  >
                    Buka Jadwal &rarr;
                  </button>
                </div>

                {/* Kartu Khusus Siswi Putri: Kalender Menstruasi */}
                {isSiswiPutri && (
                  <div className="bg-linear-to-r from-rose-50 to-pink-50 rounded-2xl p-4 border border-rose-200 shadow-xs flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        <h4 className="text-xs font-bold text-rose-900">Kalender Menstruasi & Udzur Syar'i</h4>
                      </div>
                      <p className="text-xs text-rose-700">
                        Catat siklus bulanan, konsumsi tablet tambah darah (TTD), & dispensasi sholat.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSiswaTab('kesehatan');
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shrink-0 shadow-xs transition-colors"
                    >
                      Buka Siklus
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB SISWA: POIN & PRESTASI LENGKAP */}
          {siswaTab === 'poin' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-gray-800">Buku Rekap Poin & Prestasi</h3>
                  <span className="text-xs font-black text-[#1B5E20] bg-green-100 px-3 py-1 rounded-full">
                    {currentStudent.points} Pts
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Standar minimal kelulusan karakter: 1.000 poin (saldo awal 1.000 + Jejak Harian + Prestasi terverifikasi + Apresiasi/Konsekuensi Guru BK).
                </p>
              </div>

              {/* Filter Poin & Prestasi */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                {(['semua', 'prestasi', 'apresiasi', 'konsekuensi'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPoinTabFilter(tab)}
                    className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                      poinTabFilter === tab
                        ? 'bg-[#1B5E20] text-white shadow-xs'
                        : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Pengajuan & Daftar Prestasi Santri */}
              {(poinTabFilter === 'semua' || poinTabFilter === 'prestasi') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Prestasi Santri
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowFormPrestasi((v) => !v)}
                      className="text-xs font-bold text-[#2E7D32] bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-100"
                    >
                      {showFormPrestasi ? 'Tutup Form' : '+ Ajukan Prestasi'}
                    </button>
                  </div>

                  {prestasiMsg && (
                    <div className="p-2.5 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800">
                      {prestasiMsg}
                    </div>
                  )}

                  {showFormPrestasi && (
                    <form
                      onSubmit={handleSubmitPrestasi}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-2.5 text-xs"
                    >
                      <p className="text-xs text-gray-500">
                        Pengajuan dikirim sebagai <b>pending</b>. Poin ditentukan oleh guru / pembimbing rayon saat verifikasi.
                      </p>
                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">Nama Prestasi *</label>
                        <input
                          type="text"
                          required
                          value={prestasiForm.judul}
                          onChange={(e) => setPrestasiForm({ ...prestasiForm, judul: e.target.value })}
                          placeholder="Contoh: Juara 1 Lomba Tahfidz 5 Juz"
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#2E7D32] outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">Kategori</label>
                          <select
                            value={prestasiForm.kategori}
                            onChange={(e) => setPrestasiForm({ ...prestasiForm, kategori: e.target.value })}
                            className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                          >
                            {['Prestasi Kejuaraan', 'Duta Karakter', 'Peduli Lingkungan', 'Akademik', 'Keagamaan', 'Lainnya'].map((k) => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">Tingkat</label>
                          <select
                            value={prestasiForm.tingkat}
                            onChange={(e) => setPrestasiForm({ ...prestasiForm, tingkat: e.target.value })}
                            className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                          >
                            {['Sekolah', 'Kecamatan', 'Kabupaten', 'Provinsi', 'Nasional', 'Internasional'].map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">Capaian *</label>
                          <input
                            type="text"
                            required
                            value={prestasiForm.capaian}
                            onChange={(e) => setPrestasiForm({ ...prestasiForm, capaian: e.target.value })}
                            placeholder="Contoh: Juara 1"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">Tanggal</label>
                          <input
                            type="date"
                            value={prestasiForm.tanggal}
                            onChange={(e) => setPrestasiForm({ ...prestasiForm, tanggal: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">Tahun Pelajaran *</label>
                          <select
                            value={prestasiForm.tahunPelajaran}
                            onChange={(e) => setPrestasiForm({ ...prestasiForm, tahunPelajaran: e.target.value })}
                            className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold text-green-900"
                          >
                            {['2023/2024', '2024/2025', '2025/2026', '2026/2027'].map((tp) => (
                              <option key={tp} value={tp}>{tp}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">Semester</label>
                          <select
                            value={prestasiForm.semester}
                            onChange={(e) => setPrestasiForm({ ...prestasiForm, semester: e.target.value as any })}
                            className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                          >
                            <option value="Ganjil">Semester Ganjil</option>
                            <option value="Genap">Semester Genap</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">Keterangan</label>
                        <textarea
                          rows={2}
                          value={prestasiForm.deskripsi}
                          onChange={(e) => setPrestasiForm({ ...prestasiForm, deskripsi: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={prestasiSubmitting}
                        className="w-full py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white font-bold rounded-xl flex items-center justify-center gap-1.5"
                      >
                        <Save className="w-4 h-4" />
                        {prestasiSubmitting ? 'Mengirim…' : 'Kirim Pengajuan'}
                      </button>
                    </form>
                  )}

                  {/* Filter Tahun Pelajaran */}
                  <div className="flex items-center justify-between px-1 py-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-gray-500">Tahun Pelajaran:</span>
                      <select
                        value={tahunPelajaranFilter}
                        onChange={(e) => setTahunPelajaranFilter(e.target.value)}
                        className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 font-bold text-gray-800 outline-none"
                      >
                        <option value="Semua">Semua Tahun Pelajaran</option>
                        <option value="2025/2026">TP 2025/2026</option>
                        <option value="2024/2025">TP 2024/2025</option>
                        <option value="2023/2024">TP 2023/2024</option>
                      </select>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {prestasiList.filter((p) => tahunPelajaranFilter === 'Semua' || (p.tahunPelajaran || '2025/2026') === tahunPelajaranFilter).length} Prestasi
                    </span>
                  </div>

                  {prestasiList.filter((p) => tahunPelajaranFilter === 'Semua' || (p.tahunPelajaran || '2025/2026') === tahunPelajaranFilter).length === 0 && (
                    <p className="text-xs text-gray-500 px-1 py-2 bg-white rounded-xl text-center border border-gray-100">
                      Belum ada prestasi tercatat untuk tahun pelajaran ini.
                    </p>
                  )}

                  {prestasiList
                    .filter((p) => tahunPelajaranFilter === 'Semua' || (p.tahunPelajaran || '2025/2026') === tahunPelajaranFilter)
                    .map((pres) => (
                    <div key={pres.id} className="rounded-card border border-line bg-surface p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-gray-900 block">{pres.judul}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              TP {pres.tahunPelajaran || '2025/2026'} • {pres.semester || 'Genap'}
                            </span>
                          </div>
                          <p className="text-xs text-yellow-800 mt-0.5">
                            Tingkat: {pres.tingkat} • Capaian: {pres.capaian}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                pres.status === 'verified'
                                  ? 'bg-green-100 text-green-800'
                                  : pres.status === 'rejected'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {pres.status === 'verified'
                                ? 'Terverifikasi'
                                : pres.status === 'rejected'
                                  ? 'Ditolak'
                                  : 'Menunggu verifikasi'}
                            </span>
                            <span className="text-xs text-gray-400">{pres.tanggal}</span>
                          </div>
                          {pres.catatan_verifikasi && (
                            <p className="text-xs text-gray-500 mt-1 italic">Catatan: {pres.catatan_verifikasi}</p>
                          )}
                        </div>
                        <span className="text-xs font-black text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full shrink-0">
                          {pres.status === 'verified' ? `+${pres.poin} Pts` : '0 Pts'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Riwayat Mutasi Poin Karakter (Jejak Harian + Guru/BK) */}
              {(poinTabFilter === 'semua' || poinTabFilter === 'apresiasi' || poinTabFilter === 'konsekuensi') && (() => {
                const mutasiRows = unifiedStudentLogs
                  .filter((l) => l.sumber !== 'prestasi')
                  .filter((p) => {
                    if (poinTabFilter === 'apresiasi') return p.tipe === 'apresiasi';
                    if (poinTabFilter === 'konsekuensi') return p.tipe === 'konsekuensi';
                    return true;
                  });
                return (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider px-1">
                      Riwayat Jejak Harian & Catatan Guru/BK ({mutasiRows.length})
                    </h4>
                    {mutasiRows.length === 0 && (
                      <p className="text-xs text-gray-500 px-3 py-3 bg-white rounded-xl text-center border border-gray-100">
                        Belum ada catatan Jejak Harian atau poin Guru/BK untuk filter ini.
                      </p>
                    )}
                    {mutasiRows.map((log) => (
                      <div
                        key={log.id}
                        className={`bg-white rounded-2xl p-3.5 shadow-sm border flex items-start justify-between gap-2 ${
                          log.tipe === 'apresiasi' ? 'border-green-100' : 'border-red-100'
                        }`}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                log.sumber === 'jejak_harian'
                                  ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {log.sumberLabel}
                            </span>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                log.tipe === 'apresiasi' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {log.kode}
                            </span>
                            <span className="text-xs text-gray-400">{log.time}</span>
                          </div>
                          <p className="text-xs font-medium text-gray-800">{log.deskripsi}</p>
                        </div>
                        <span
                          className={`text-xs font-black px-2 py-0.5 rounded-full shrink-0 ${
                            log.tipe === 'apresiasi' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {log.tipe === 'apresiasi' ? `+${log.poin}` : `-${log.poin}`}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB SISWA: PROFIL */}
          {siswaTab === 'profil' && (
            <div className="space-y-4">
              <section className="rounded-card border border-line bg-surface p-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-brand-50 text-base font-bold text-brand-800"
                  >
                    {initials(currentStudent.name)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-ink">{currentStudent.name}</h2>
                    <p className="text-xs text-muted">
                      {currentStudent.kelas} · Rayon {currentStudent.rayon}
                    </p>
                    {accountEmail && (
                      <p className="truncate text-xs text-muted">{accountEmail}</p>
                    )}
                  </div>
                </div>

                <dl className="mt-4 divide-y divide-line border-t border-line text-xs">
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-muted">NISN</dt>
                    <dd className="font-semibold text-ink tabular">
                      {currentStudent.nisn && currentStudent.nisn !== '-'
                        ? currentStudent.nisn
                        : 'Belum diisi admin'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-muted">Total poin karakter</dt>
                    <dd className="font-semibold text-brand-800 tabular">{currentStudent.points}</dd>
                  </div>
                </dl>
              </section>

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-control border border-danger/25 bg-danger-50 py-3 text-xs font-semibold text-danger hover:bg-danger/10"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Keluar dari akun
              </button>
            </div>
          )}
        </div>

        {/* Modal Panduan Wirid Thoriqoh, Niat Sholat Sunnah & Fadilah Al-Qur'an */}
        {showPanduanIbadah && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-green-100 overflow-hidden my-6 animate-in fade-in duration-200 flex flex-col max-h-[90vh]">
              {/* Header Modal */}
              <div className="bg-[#1B5E20] text-white px-5 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-green-800 rounded-2xl">
                    <BookOpen className="w-5 h-5 text-green-200" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">Panduan Ibadah & Wirid Santri</h2>
                    <p className="text-xs text-green-200">
                      Rujukan niat sholat sunnah, wirid thoriqoh, & fadilah surat pilihan
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPanduanIbadah(false)}
                  className="p-1.5 rounded-xl hover:bg-green-800 text-green-200 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tab Selector */}
              <div className="bg-gray-50 border-b border-gray-200 px-4 pt-3 flex gap-2 shrink-0">
                {[
                  { id: 'thoriqoh', label: 'Wirid Thoriqoh' },
                  { id: 'sholat', label: 'Sholat Sunnah' },
                  { id: 'quran', label: 'Surat Pilihan' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPanduanTab(t.id as any)}
                    className={`py-2 px-3 text-xs font-bold rounded-t-xl transition-all ${
                      panduanTab === t.id
                        ? 'bg-white text-[#1B5E20] border-t-2 border-t-[#2E7D32] shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Content Body Scrollable */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
                {/* TAB 1: DZIKIR THORIQOH */}
                {panduanTab === 'thoriqoh' && (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5">
                      <span className="text-xs font-bold text-emerald-950 block">
                        Adab & Urutan Wirid Dzikir Thoriqoh Harian
                      </span>
                      <p className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
                        Dibaca secara istiqomah setiap hari dengan duduk khusyuk menghadap kiblat, merenungi keagungan Allah SWT dan menghadirkan bimbingan guru mursyid.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {/* 1. Istighfar */}
                      <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900 text-xs">1. Membaca Istighfar (100x)</span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            100 Hitungan
                          </span>
                        </div>
                        <p className="text-right font-serif text-base text-gray-900 leading-loose py-1">
                          أَسْتَغْفِرُ اللهَ الْعَظِيْمَ الَّذِيْ لَا إِلٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّوْمُ وَأَتُوْبُ إِلَيْهِ
                        </p>
                        <p className="text-gray-700 italic text-[11px]">
                          Astaghfirullaahal 'Adzhiim alladzii laa ilaaha illaa huwal hayyul qayyuumu wa atuubu ilaih.
                        </p>
                        <p className="text-gray-500 text-[11px]">
                          Artinya: "Aku memohon ampunan kepada Allah Yang Maha Agung, tiada Tuhan selain Dia Yang Maha Hidup lagi Berdiri Sendiri, dan aku bertaubat kepada-Nya."
                        </p>
                      </div>

                      {/* 2. Sholawat */}
                      <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900 text-xs">2. Membaca Sholawat Nabi (100x)</span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            100 Hitungan
                          </span>
                        </div>
                        <p className="text-right font-serif text-base text-gray-900 leading-loose py-1">
                          اللّٰهُمَّ صَلِّ عَلٰى سَيِّدِنَا مُحَمَّدٍ وَعَلٰى آلِ سَيِّدِنَا مُحَمَّدٍ
                        </p>
                        <p className="text-gray-700 italic text-[11px]">
                          Allaahumma shalli 'alaa sayyidinaa Muhammadin wa 'alaa aali sayyidinaa Muhammad.
                        </p>
                        <p className="text-gray-500 text-[11px]">
                          Artinya: "Ya Allah, limpahkanlah rahmat kepada junjungan kami Nabi Muhammad beserta seluruh keluarga beliau."
                        </p>
                      </div>

                      {/* 3. Tahlil */}
                      <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900 text-xs">
                            3. Dzikir Nafi Isbat / Tahlil (165x / 300x)
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            165x atau 300x
                          </span>
                        </div>
                        <p className="text-right font-serif text-base text-gray-900 leading-loose py-1">
                          لَا إِلٰهَ إِلَّا اللهُ
                        </p>
                        <p className="text-gray-700 italic text-[11px]">
                          Laa ilaaha illallaah.
                        </p>
                        <p className="text-gray-500 text-[11px]">
                          Dihayati dengan menafikan segala sesembahan dan hawa nafsu batin, lalu menetapkan wujud dan keesaan Allah semata di dalam kalbu.
                        </p>
                      </div>

                      {/* 4. Dzikir Ismu Dzat "Allah, Allah" (5.000x) */}
                      <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-4 border border-emerald-300 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-950 text-xs">
                            4. Dzikir Ismu Dzat "Allah, Allah" (5.000x)
                          </span>
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                            5.000 Hitungan
                          </span>
                        </div>
                        <p className="text-right font-serif text-2xl text-emerald-950 font-bold tracking-widest py-1">
                          اللهُ ... اللهُ
                        </p>
                        <p className="text-emerald-900 italic text-[11px] font-semibold">
                          Allaah, Allaah (Dzikir Ismu Dzat / Dzikir Qolbi 5.000x)
                        </p>
                        <p className="text-emerald-800 text-[11px] leading-relaxed">
                          Dizikirkan di dalam kalbu (Dzikir Sirri / Lathaif) sebanyak 5.000 kali. Duduk khusyuk, mata terpejam, lidah dilekatkan ke langit-langit mulut, dan arahkan ingatan menghujam ke lathifah hati sanubari (dua jari di bawah puting susu kiri) dengan merasakan keagungan dan kehadiran Dzat Allah Ta'ala semata.
                        </p>

                        {/* Keterangan Dzikir 5.000 */}
                        <div className="bg-white/90 backdrop-blur-xs p-3.5 rounded-2xl border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between">
                          <span className="font-semibold text-[11px] text-emerald-900">Target Harian: 5.000 kali Ismu Dzat</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            +5 Poin Jejak
                          </span>
                        </div>
                      </div>

                      {/* 5. Munajat */}
                      <div className="bg-emerald-50/80 rounded-2xl p-3.5 border border-emerald-200 space-y-2">
                        <span className="font-bold text-emerald-950 text-xs block">
                          5. Doa Munajat & Penutup Dzikir Thoriqoh
                        </span>
                        <p className="text-right font-serif text-base text-emerald-950 leading-loose py-1">
                          إِلٰهِيْ أَنْتَ مَقْصُوْدِيْ وَرِضَاكَ مَطْلُوْبِيْ أَعْطِنِيْ مَحَبَّتَكَ وَمَعْرِفَتَكَ
                        </p>
                        <p className="text-emerald-900 italic text-[11px]">
                          Ilaahii Anta maqshuudii wa ridhaaka mathluubii, a'thinii mahabbataka wa ma'rifataka.
                        </p>
                        <p className="text-emerald-800 text-[11px]">
                          "Duhai Tuhanku, hanya Engkaulah tujuanku dan keridhaan-Mu lah yang kucari. Anugerahilah daku rasa cinta kepada-Mu serta ma'rifat sejati kepada-Mu."
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: SHOLAT SUNNAH */}
                {panduanTab === 'sholat' && (
                  <div className="space-y-3">
                    {/* Sholat Taubat */}
                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">1. Sholat Sunnah Taubat (2 Rakaat)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          +3 Poin Jejak
                        </span>
                      </div>
                      <p className="text-gray-700 italic text-[11px]">
                        Niat: "Ushallii sunnatat taubati rak'ataini lillaahi ta'aalaa"
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        Dilaksanakan 2 rakaat disusul istighfar dan penyesalan tulus. Menghapus kekhilafan dan menyucikan hati santri.
                      </p>
                    </div>

                    {/* Sholat Hajat */}
                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">2. Sholat Sunnah Li Qodho'il Hajati (2 Rakaat)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                          +3 Poin Jejak
                        </span>
                      </div>
                      <p className="text-gray-700 italic text-[11px]">
                        Niat: "Ushallii sunnatal haajati rak'ataini lillaahi ta'aalaa"
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        Dilaksanakan ketika memiliki hajat, cita-cita, atau kesulitan hidup. Memohon pertolongan dan ijabah dari Allah SWT.
                      </p>
                    </div>

                    {/* Sholat Istikhoroh */}
                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">3. Sholat Sunnah Istikhoroh (2 Rakaat)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                          +3 Poin Jejak
                        </span>
                      </div>
                      <p className="text-gray-700 italic text-[11px]">
                        Niat: "Ushallii sunnatal istikhaarati rak'ataini lillaahi ta'aalaa"
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        Dilaksanakan 2 rakaat untuk memohon kemantapan hati dan petunjuk terbaik dari Allah saat dihadapkan pada pilihan atau keputusan penting.
                      </p>
                    </div>

                    {/* Sholat Li Ridhollah */}
                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">4. Sholat Sunnah Li Ridhollah (2 Rakaat)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          +3 Poin Jejak
                        </span>
                      </div>
                      <p className="text-gray-700 italic text-[11px]">
                        Niat: "Ushallii sunnatan liridhallahi ta'aala rak'ataini lillaahi ta'aalaa"
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        Sholat sunnah dengan niat murni mencari ridha Allah semata, membersihkan niat ibadah dari pamrih keduniaan.
                      </p>
                    </div>

                    {/* Sholat Syukur */}
                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">5. Sholat Sunnah Syukur (2 Rakaat)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          +3 Poin Jejak
                        </span>
                      </div>
                      <p className="text-gray-700 italic text-[11px]">
                        Niat: "Ushallii sunnatasy syukri rak'ataini lillaahi ta'aalaa"
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        Wujud syukur mendalam atas limpahan nikmat, kesehatan, ilmu bermanfaat, dan keselamatan yang dianugerahkan Allah Ta'ala.
                      </p>
                    </div>

                    {/* Sujud Syukur */}
                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">6. Sujud Syukur (1 Kali Sujud di Luar Sholat)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                          +2 Poin Jejak
                        </span>
                      </div>
                      <p className="text-gray-700 italic text-[11px]">
                        Niat: "Nawaitu sujuudasy syukri lillaahi ta'aalaa"
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        Dilakukan satu kali sujud menghadap kiblat saat menerima kabar gembira atau terhindar dari marabahaya, membaca tasbih dan tahmid.
                      </p>
                    </div>

                    {/* Sholat Tasbih */}
                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">7. Sholat Sunnah Tasbih (4 Rakaat, 300x Tasbih)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                          +4 Poin Jejak
                        </span>
                      </div>
                      <p className="text-gray-700 italic text-[11px]">
                        Niat: "Ushallii sunnatat tasbiihi arba'a raka'aatin lillaahi ta'aalaa"
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        4 rakaat dengan membaca 75 kali tasbih (Subhaanallaahi walhamdu lillaahi wa laa ilaaha illallaahu wallaahu akbar) di setiap rakaat. Pelebur dosa besar dan penenang jiwa.
                      </p>
                    </div>

                    {/* Sholat Rawatib */}
                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">8. Sholat Rawatib Qobliyah & Ba'diyah</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          +4 Poin Jejak
                        </span>
                      </div>
                      <p className="text-gray-700 italic text-[11px]">
                        Niat: "Ushallii sunnatal [Dzuhri/Ashri/Maghribi/Isya'i/Fajri] rak'ataini [qabliyyatan/ba'diyyatan] lillaahi ta'aalaa"
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        Sholat pengiring sholat fardhu yang menjadi penyempurna pahala dan tameng dari api neraka.
                      </p>
                    </div>

                    {/* Sholat Awwabin */}
                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">9. Sholat Sunnah Awwabin (2 s.d. 6 Rakaat)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                          +3 Poin Jejak
                        </span>
                      </div>
                      <p className="text-gray-700 italic text-[11px]">
                        Niat: "Ushallii sunnatal awwaabiina rak'ataini lillaahi ta'aalaa"
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        Dilaksanakan antara waktu Maghrib dan Isya. Merupakan amalan orang-orang yang senantiasa bertaubat kembali kepada Allah.
                      </p>
                    </div>

                    {/* Sholat Li Hifdhil Iman */}
                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">10. Sholat Sunnah Li Hifdhil Iman (2 Rakaat)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          +3 Poin Jejak
                        </span>
                      </div>
                      <p className="text-gray-700 italic text-[11px]">
                        Niat: "Ushallii sunnatal lihifdhil iimaani rak'ataini lillaahi ta'aalaa"
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        Rutin ba'da Maghrib. Diniatkan memohon ketetapan iman dan Islam agar terlindung dari keraguan dan wafat dalam keadaan husnul khotimah.
                      </p>
                    </div>

                    {/* Sholat Birrul Walidain */}
                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">11. Sholat Sunnah Birrul Walidain (2 Rakaat)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                          +3 Poin Jejak
                        </span>
                      </div>
                      <p className="text-gray-700 italic text-[11px]">
                        Niat: "Ushallii sunnatan libirril waalidaini rak'ataini lillaahi ta'aalaa"
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        Wujud bakti santri kepada kedua orang tua. Di dalam sujud dan ba'da sholat dipanjatkan doa kebaikan, ampunan, serta kesehatan untuk ayah dan ibu.
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB 3: SURAT PILIHAN */}
                {panduanTab === 'quran' && (
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">1. Surat Yasin (QS. 36: 1-83)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                          +2 Poin Jejak
                        </span>
                      </div>
                      <p className="text-gray-500 text-[11px] leading-relaxed">
                        Rasulullah SAW menyebutnya sebagai jantung Al-Qur'an (Qolbul Qur'an). Membacanya di pagi atau malam hari melapangkan dada, menghadirkan ampunan Allah, dan mempermudah segala hajat urusan.
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">2. Surat Al-Waqi'ah (QS. 56: 1-96)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                          +2 Poin Jejak
                        </span>
                      </div>
                      <p className="text-gray-500 text-[11px] leading-relaxed">
                        Surat pembuka pintu kelapangan rezeki dan keberkahan hidup. Santri yang istiqomah membacanya dilindungi dari kesempitan dunia dan dianugerahi ketenangan jiwa.
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs">3. Surat Al-Mulk (QS. 67: 1-30)</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                          +2 Poin Jejak
                        </span>
                      </div>
                      <p className="text-gray-500 text-[11px] leading-relaxed">
                        Surat Tabarak / Al-Munfadzah (Penyelamat). 30 ayat yang senantiasa membela pembacanya di alam kubur hingga diampuni dan dibebaskan dari siksa kubur (HR. Abu Dawud & At-Tirmidzi).
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPanduanIbadah(false)}
                  className="px-5 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  Tutup Panduan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Bottom Nav */}
        <BottomNav
          role="siswa"
          activeTab={siswaTab}
          onChangeTab={(t) => setSiswaTab(t)}
        />
      </div>
    </div>
  );
}
