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

export default function OrtuDashboard({ app }: { app: AppModel }) {
  const {
    ortuTab,
    setOrtuTab,
    sigCanvasRef,
    ttdSavedUrl,
    ttdSuccess,
    ttdLoading,
    poinLogs,
    notifikasiList,
    sessionUser,
    profile,
    role,
    accountEmail,
    handleLogout,
    currentStudent,
    currentWeek,
    targetPoin,
    progressPct,
    studentPoinLogs,
    lastKonsekuensi,
    clearSig,
    saveSig
  } = app;

  return (
    <div className="flex-1 flex justify-center">
      <div className="w-full max-w-3xl bg-paper flex flex-col min-h-screen relative pb-24">

        <Header
          greeting="Assalamu’alaikum, Bapak/Ibu"
          fullName={profile?.fullName || "Bapak/Ibu Wali"}
          subtitle={`Wali dari: ${currentStudent.name} (${currentStudent.kelas})`}
          poin={currentStudent.points}
          onLogout={handleLogout}
        />

        <div className="px-4 py-4 space-y-4 flex-1">

          {/* TAB ORTU: HOME */}
          {ortuTab === 'home' && (
            <div className="space-y-4">
              {/* Saldo poin anak, satu-satunya angka besar di layar ini. */}
              <section className="rounded-card border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Poin karakter ananda
                    </h2>
                    <p className="mt-1 text-3xl font-bold tabular text-brand-800">
                      {currentStudent.points}
                      <span className="ml-1 text-sm font-medium text-muted">poin</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {currentStudent.name} · {currentStudent.kelas} · Rayon {currentStudent.rayon}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-control border border-line bg-paper px-2.5 py-1 text-xs font-semibold text-brand-800">
                    Pekan ke-{currentWeek}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Target kelulusan karakter</span>
                    <span className="tabular">{targetPoin} poin</span>
                  </div>
                  <div
                    className="mt-1 h-2 w-full overflow-hidden rounded-full bg-paper"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={targetPoin}
                    aria-valuenow={Math.max(0, currentStudent.points)}
                    aria-label="Capaian poin terhadap target kelulusan"
                  >
                    <div
                      className="h-full rounded-full bg-brand-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted tabular">{progressPct}% dari target</p>
                </div>
              </section>

              {/* Pengesahan pekan ini. Status hanya diklaim setelah tersimpan. */}
              <section className="rounded-card border border-line bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-ink">Pengesahan pekan ke-{currentWeek}</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      {ttdSavedUrl
                        ? 'Tanda tangan tersimpan pada sesi ini.'
                        : 'Buku BKP pekan ini belum ditandatangani.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOrtuTab('ttd')}
                    className="shrink-0 rounded-control bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800"
                  >
                    {ttdSavedUrl ? 'Lihat lembar' : 'Tanda tangani'}
                  </button>
                </div>
              </section>

              {/* Riwayat poin terbaru, diambil dari koleksi poin_log. */}
              <section className="rounded-card border border-line bg-surface">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <h2 className="text-sm font-semibold text-ink">Catatan poin terbaru</h2>
                  <button
                    type="button"
                    onClick={() => setOrtuTab('laporan')}
                    className="text-xs font-semibold text-brand-700 hover:underline"
                  >
                    Lihat laporan
                  </button>
                </div>

                {studentPoinLogs.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-muted">
                    Belum ada catatan poin dari guru atau pembimbing rayon.
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {studentPoinLogs.slice(0, 4).map((log) => (
                      <li key={log.id} className="flex items-start justify-between gap-3 px-4 py-3">
                        <div>
                          <p className="text-xs font-semibold text-ink">
                            <span className="mr-1.5 rounded bg-paper px-1.5 py-0.5 text-xs font-bold text-muted">
                              {log.kode}
                            </span>
                            {log.deskripsi}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">{log.time}</p>
                        </div>
                        <span
                          className={`shrink-0 text-xs font-bold tabular ${
                            log.tipe === 'apresiasi' ? 'text-brand-700' : 'text-danger'
                          }`}
                        >
                          {log.tipe === 'apresiasi' ? `+${log.poin}` : `-${log.poin}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {lastKonsekuensi && (
                <section className="rounded-card border border-danger/25 bg-danger-50 p-4">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-danger">
                    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                    Konsekuensi terakhir
                  </h2>
                  <p className="mt-1 text-xs text-ink">
                    {lastKonsekuensi.deskripsi}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {lastKonsekuensi.kode} · {lastKonsekuensi.time} ·{' '}
                    <span className="font-semibold text-danger tabular">-{lastKonsekuensi.poin} poin</span>
                  </p>
                </section>
              )}

              {/* Jadwal Pelajaran Mingguan Ananda (Senin - Jumat) */}
              <section className="rounded-card border border-line bg-surface p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#1B5E20]" />
                      <span>Jadwal Pelajaran Ananda ({currentStudent.kelas})</span>
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">
                      Jadwal belajar mengajar hari Senin sampai dengan Jumat di kelas.
                    </p>
                  </div>
                </div>
                <JadwalPelajaranView
                  currentClass={currentStudent.kelas}
                  userRole={role}
                  user={sessionUser}
                />
              </section>
            </div>
          )}

          {/* TAB ORTU: LAPORAN BULANAN (RECHARTS) */}
          {ortuTab === 'laporan' && (
            <Suspense fallback={<MemuatPanel label="laporan" />}>
              <LaporanBulananOrtu
                studentName={currentStudent.name}
                studentKelas={currentStudent.kelas}
                studentRayon={currentStudent.rayon}
                currentPoints={currentStudent.points}
                poinLogs={studentPoinLogs}
              />
            </Suspense>
          )}

          {/* TAB ORTU: BORANG KESEHATAN */}
          {ortuTab === 'kesehatan' && (
            <ModulBelumTersedia judul="Borang kesehatan ananda" />
          )}

          {/* TAB ORTU: TTD DIGITAL */}
          {ortuTab === 'ttd' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                <h3 className="text-sm font-bold text-[#1B5E20] mb-1">Pengesahan Buku BKP Pekanan</h3>
                <p className="text-xs text-gray-600">
                  Goreskan tanda tangan digital di bawah sebagai persetujuan dan pengawasan buku pembiasaan ananda.
                </p>
              </div>

              {ttdSuccess && (
                <div className="p-3 bg-green-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tanda tangan tersimpan untuk pekan ini.</span>
                </div>
              )}

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Area Kanvas:</span>
                  <button
                    onClick={clearSig}
                    className="text-xs text-gray-500 hover:text-red-600 font-semibold flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>

                <div className="w-full border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 overflow-hidden flex items-center justify-center relative">
                  <SignatureCanvas
                    ref={sigCanvasRef}
                    penColor="#1B5E20"
                    canvasProps={{
                      width: 340,
                      height: 180,
                      className: 'cursor-crosshair w-full h-[180px]',
                    }}
                  />
                  <span className="absolute bottom-1 text-xs text-gray-400 pointer-events-none">
                    (Tanda tangani menggunakan jari atau kursor)
                  </span>
                </div>

                <button
                  onClick={saveSig}
                  disabled={ttdLoading}
                  className="w-full py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {ttdLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Simpan TTD & Sahkan Pekan Ini</span>
                    </>
                  )}
                </button>
              </div>

              {ttdSavedUrl && (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 text-center">
                  <h4 className="text-xs font-bold text-gray-700 mb-2">Pratinjau Tanda Tangan Tersimpan:</h4>
                  <img src={ttdSavedUrl} alt="TTD Ortu" className="mx-auto max-h-24 border rounded-xl bg-gray-50 p-2" />
                  <span className="inline-block mt-2 text-xs text-green-700 font-bold bg-green-50 px-3 py-1 rounded-full">
                    Status: Sah & Tercatat di Server BKP
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TAB ORTU: NOTIFIKASI */}
          {ortuTab === 'notifikasi' && (
            <div className="space-y-3">
              <section className="rounded-card border border-line bg-surface p-4">
                <h2 className="text-sm font-semibold text-ink">Pemberitahuan sekolah</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Pesan resmi dari pembimbing rayon dan BK untuk akun ini.
                </p>
              </section>

              {notifikasiList.length === 0 ? (
                <p className="rounded-card border border-line bg-surface px-4 py-5 text-xs text-muted">
                  Belum ada pemberitahuan.
                </p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                  {notifikasiList.map((n) => (
                    <li key={n.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-xs font-semibold text-ink">{n.judul}</h3>
                        <span className="shrink-0 text-xs text-muted">{n.time}</span>
                      </div>
                      {n.isi && <p className="mt-1 text-xs leading-relaxed text-ink/90">{n.isi}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* TAB ORTU: PROFIL */}
          {ortuTab === 'profil' && (
            <div className="space-y-4">
              <section className="rounded-card border border-line bg-surface p-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-brand-50 text-base font-bold text-brand-800"
                  >
                    {initials(profile?.fullName || 'Wali Santri')}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-ink">
                      {profile?.fullName || 'Wali Santri'}
                    </h2>
                    <p className="text-xs text-muted">Orang tua / wali santri</p>
                    {accountEmail && (
                      <p className="truncate text-xs text-muted">{accountEmail}</p>
                    )}
                  </div>
                </div>

                <dl className="mt-4 divide-y divide-line border-t border-line text-xs">
                  <div className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-muted">Santri terhubung</dt>
                    <dd className="text-right font-semibold text-ink">
                      {currentStudent.name} ({currentStudent.kelas})
                    </dd>
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

        {/* Mobile Bottom Nav Ortu */}
        <BottomNav
          role="orang_tua"
          activeTab={ortuTab}
          onChangeTab={(t) => setOrtuTab(t)}
        />
      </div>
    </div>
  );
}
