/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy } from 'react';
import { AlertCircle, AlertTriangle, BookOpen, X } from 'lucide-react';
import LoginPage from './features/auth/LoginPage';
import SiswaDashboard from './features/siswa/SiswaDashboard';
import OrtuDashboard from './features/ortu/OrtuDashboard';
import GuruDashboard from './features/guru/GuruDashboard';
import { useAppModel } from './app/useAppModel';
import { MemuatPanel } from './components/StatusPanel';

// Panel admin memuat recharts, jadi hanya diunduh saat rute admin dibuka.
const AdminPanel = lazy(() => import('./components/AdminPanel'));

export default function App() {
  const app = useAppModel();
  const {
    authReady,
    currentRoute,
    isLocalBackend,
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    loginLoading,
    errorMsg,
    setErrorMsg,
    profileWarning,
    profile,
    handleLogin,
    handleResetLocal,
    handleLogout,
    setCurrentRoute,
  } = app;

  // Tunggu Firebase Auth selesai memulihkan sesi sebelum menentukan halaman.
  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="text-center text-[#1B5E20] text-sm font-semibold">
          <div className="w-8 h-8 border-4 border-green-200 border-t-[#2E7D32] rounded-full animate-spin mx-auto mb-3" />
          Memuat BKP Digital…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper font-sans text-ink">

      {/* Notifikasi error global (gagal simpan, gagal muat, dsb) */}
      {errorMsg && currentRoute !== 'login' && (
        <div
          role="alert"
          className="fixed left-1/2 top-3 z-50 flex w-[92%] max-w-md -translate-x-1/2 items-start gap-2 rounded-control border border-danger/40 bg-surface px-4 py-3 text-xs font-medium text-danger shadow-lg"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            aria-label="Tutup pesan kesalahan"
            className="flex h-6 w-6 items-center justify-center rounded text-danger/80 hover:bg-danger-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Peringatan penautan profil (studentId/childIds/rayonId belum diisi) */}
      {profileWarning && currentRoute !== 'login' && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%] bg-amber-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{profileWarning}</span>
        </div>
      )}

      {/* TOPBAR: identitas aplikasi */}
      <div className="z-40 flex shrink-0 items-center gap-2 border-b border-brand-950 bg-brand-900 px-4 py-2 text-xs text-white">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-brand-100" aria-hidden="true" />
          <span className="font-semibold tracking-tight">BKP Digital</span>
          <span className="hidden text-brand-100 sm:inline">SMK Thibbil Qulub Assimbani</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 1. HALAMAN LOGIN                            */}
      {/* ═══════════════════════════════════════════ */}
      {currentRoute === 'login' && (
        <LoginPage
          email={email}
          password={password}
          showPassword={showPassword}
          loginLoading={loginLoading}
          errorMsg={errorMsg}
          isLocalBackend={isLocalBackend}
          onChangeEmail={setEmail}
          onChangePassword={setPassword}
          onTogglePassword={() => setShowPassword((v) => !v)}
          onSubmit={() => handleLogin()}
          onResetLocal={handleResetLocal}
        />
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 2. DASHBOARD SISWA (ROLE: siswa)            */}
      {/* ═══════════════════════════════════════════ */}
      {currentRoute === 'siswa' && (
        <SiswaDashboard app={app} />
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 3. DASHBOARD ORANG TUA (ROLE: orang_tua)    */}
      {/* ═══════════════════════════════════════════ */}
      {currentRoute === 'ortu' && (
        <OrtuDashboard app={app} />
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 4. DASHBOARD GURU / BK (ROLE: guru)         */}
      {/* ═══════════════════════════════════════════ */}
      {currentRoute === 'guru' && (
        <GuruDashboard app={app} />
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 5. PANEL ADMIN (ROLE: admin)                */}
      {/* ═══════════════════════════════════════════ */}
      {currentRoute === 'admin' && (
        <Suspense fallback={<MemuatPanel label="panel admin" />}>
          <AdminPanel
            profile={profile}
            onLogout={handleLogout}
            onOpenStaffDashboard={() => setCurrentRoute('guru')}
          />
        </Suspense>
      )}
    </div>
  );
}
