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
    prestasiList,
    prestasiForm,
    setPrestasiForm,
    prestasiSubmitting,
    prestasiMsg,
    showFormPrestasi,
    setShowFormPrestasi,
    poinLogs,
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
    handleSubmitPrestasi
  } = app;

  return (
    <div className="flex-1 flex justify-center">
      <div className="w-full max-w-3xl bg-paper flex flex-col min-h-screen relative pb-24">

        <Header
          fullName={currentStudent.name}
          subtitle={`Kelas: ${currentStudent.kelas} • Rayon: ${currentStudent.rayon}`}
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
                  Harian
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
                  Pekanan
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
                  <span>Alhamdulillah, Jurnal Pembiasaan berhasil disimpan (+{calculateDailyPoints()} Poin)!</span>
                </div>
              )}

              {/* SUB-VIEW 1: JURNAL HARIAN LENGKAP */}
              {jurnalView === 'harian' && (
                <div className="space-y-4">
                  {/* Tanggal & Estimasi Poin */}
                  <div className="bg-white rounded-2xl p-3 shadow-sm border border-green-100 flex items-center justify-between">
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
                    <div className="text-right">
                      <span className="text-xs text-gray-400 block">Potensi Harian:</span>
                      <span className="text-xs font-black text-[#1B5E20] bg-green-100 px-2 py-0.5 rounded-full">
                        +{calculateDailyPoints()} Poin
                      </span>
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

                  {/* 1. SHOLAT TAHAJUD & SHOLAT DHUHA (Sesuai Hal 15 Dokumen BKP) */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-3">
                    <h3 className="text-sm font-bold text-[#1B5E20] pb-2 border-b border-gray-100 flex items-center gap-2">
                      <Moon className="w-4 h-4 text-indigo-600" />
                      Sholat Sunnah Tahajud & Dhuha
                    </h3>

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

                  {/* 3. TILAWAH, ZIKIR PAGI & SORE */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-2">
                    <h3 className="text-sm font-bold text-[#1B5E20] pb-2 border-b border-gray-100 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-green-700" />
                      Tilawah & Dzikir Harian
                    </h3>

                    {[
                      { key: 'mengaji', label: 'Mengaji / Menghafal Alquran (+1 Poin)', icon: BookOpen },
                      { key: 'zikir_pagi', label: 'Membaca Dzikir Pagi (+1 Poin)', icon: Sun },
                      { key: 'zikir_sore', label: 'Membaca Dzikir Sore (+1 Poin)', icon: Moon },
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
                              className={`h-4 w-4 ${isChecked ? 'text-brand-700' : 'text-muted'}`}
                              aria-hidden="true"
                            />
                            <span className={`text-xs ${isChecked ? 'font-semibold' : 'font-medium'}`}>
                              {item.label}
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
                        : `Simpan Jurnal Harian (+${calculateDailyPoints()} Pts)`}
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
                      { key: 'input_kejar_id', label: '13. Input Rekap BKP ke Kejar.id (+100 Poin)' },
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
                          <span className="text-xs bg-green-200 text-green-900 font-bold px-1.5 py-0.2 rounded">BKP Hal. 20</span>
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

                  {/* Notifikasi Simpan Berhasil */}
                  {nonRutinSaveSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-fade-in shadow-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Isian kegiatan non-rutin pekan ini tersimpan.</span>
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
                  <button
                    type="button"
                    onClick={saveNonRutin}
                    disabled={nonRutinSaving}
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
                    ) : (
                      <>
                        <Save className="h-4 w-4" aria-hidden="true" />
                        Simpan isian pekan ini
                      </>
                    )}
                  </button>
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
                    Buka Jurnal &rarr;
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
                <p className="text-xs text-gray-500">Standar minimal kelulusan karakter: 1000 Poin</p>
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

              {/* Riwayat Mutasi Poin Karakter */}
              {(poinTabFilter === 'semua' || poinTabFilter === 'apresiasi' || poinTabFilter === 'konsekuensi') && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider px-1">
                    Catatan Apresiasi & Konsekuensi Harian
                  </h4>
                  {poinLogs
                    .filter((p) => {
                      if (poinTabFilter === 'apresiasi') return p.tipe === 'apresiasi';
                      if (poinTabFilter === 'konsekuensi') return p.tipe === 'konsekuensi';
                      return true;
                    })
                    .map((log) => (
                      <div
                        key={log.id}
                        className={`bg-white rounded-2xl p-3.5 shadow-sm border flex items-start justify-between gap-2 ${
                          log.tipe === 'apresiasi' ? 'border-green-100' : 'border-red-100'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
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
              )}
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
