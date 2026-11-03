import React, { useState } from 'react';
import { AlertCircle, BookOpen, Eye, EyeOff, KeyRound, CheckCircle2, Mail, Loader2 } from 'lucide-react';
import { LOCAL_SEED_PASSWORD } from '../../lib/data/seed';

export interface LoginPageProps {
  email: string;
  password: string;
  showPassword: boolean;
  loginLoading: boolean;
  errorMsg: string | null;
  isLocalBackend: boolean;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: () => void;
  onResetLocal: () => void;
  onSendPasswordReset?: (email?: string) => Promise<void>;
  resetSentEmail?: string | null;
  resetLoading?: boolean;
  onLoginGoogle?: () => Promise<void>;
  googleLoading?: boolean;
}

export default function LoginPage({
  email,
  password,
  showPassword,
  loginLoading,
  errorMsg,
  isLocalBackend,
  onChangeEmail,
  onChangePassword,
  onTogglePassword,
  onSubmit,
  onResetLocal,
  onSendPasswordReset,
  resetSentEmail,
  resetLoading = false,
  onLoginGoogle,
  googleLoading = false,
}: LoginPageProps) {
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  const handleTriggerForgot = () => {
    const target = email.trim() || 'admassimbani@gmail.com';
    setForgotEmail(target);
    setShowForgotModal(true);
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSendPasswordReset) return;
    await onSendPasswordReset(forgotEmail || email);
    setShowForgotModal(false);
  };

  const isAdmassimbani = email.toLowerCase().includes('admassimbani');

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="overflow-hidden rounded-card border border-line bg-surface shadow-md">
          <div className="bg-brand-800 px-6 py-6 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-white/20 bg-brand-950/40 shadow-xs">
                <BookOpen className="h-5 w-5 text-brand-100" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-lg font-semibold leading-tight">BKP Digital</h1>
                <p className="text-xs text-brand-100">Buku Kejar Prestasi</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-brand-100">
              SMK Thibbil Qulub Assimbani. Jurnal pembiasaan, poin karakter, dan pengesahan wali santri.
            </p>
          </div>

          <div className="px-6 py-6">
            {isLocalBackend ? (
              <div className="mb-4 rounded-control border border-line bg-paper/60 px-3 py-2.5">
                <p className="text-xs font-semibold text-ink">Mode lokal</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Data tersimpan di peramban ini, bukan di server.{' '}
                  {import.meta.env.DEV ? (
                    <>
                      Akun awal administrator:{' '}
                      <span className="font-semibold text-ink">admin@lokal.test</span> dengan kata sandi{' '}
                      <span className="font-semibold text-ink">{LOCAL_SEED_PASSWORD}</span>.
                    </>
                  ) : (
                    <>Hubungi pengelola sistem untuk kata sandi akun administrator awal.</>
                  )}
                </p>
              </div>
            ) : (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-[#1B5E20]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Firebase Cloud Aktif</span>
                  </div>
                  <span className="text-[10px] bg-emerald-100/80 text-emerald-800 font-semibold px-2 py-0.5 rounded-md border border-emerald-300">
                    Produksi
                  </span>
                </div>
                <p className="mt-1 text-emerald-800 text-[11px] leading-relaxed">
                  Akun Super Admin: <strong className="font-mono">admassimbani@gmail.com</strong>
                </p>
              </div>
            )}

            {/* Sukses kirim link reset sandi */}
            {resetSentEmail && (
              <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-start gap-2 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Tautan reset kata sandi telah dikirim!</p>
                  <p className="text-[11px] leading-relaxed text-emerald-800">
                    Kami telah mengirimkan tautan ke <span className="font-mono font-bold">{resetSentEmail}</span>. Silakan periksa inbox atau folder Spam email Anda untuk membuat kata sandi baru.
                  </p>
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
              className="space-y-3.5"
              noValidate
            >
              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl border border-danger/30 bg-danger-50 p-3 text-xs text-danger space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="leading-relaxed">{errorMsg}</span>
                  </div>

                  {!isLocalBackend && onSendPasswordReset && (
                    <button
                      type="button"
                      onClick={() => onSendPasswordReset(email.trim() || 'admassimbani@gmail.com')}
                      disabled={resetLoading}
                      className="w-full mt-1.5 py-1.5 px-2.5 bg-white text-danger border border-danger/40 hover:bg-danger-100/40 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>
                        {resetLoading ? 'Mengirim tautan...' : `Kirim Tautan Reset ke ${(email.trim() || 'admassimbani@gmail.com')}`}
                      </span>
                    </button>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="login-email" className="text-xs font-semibold text-ink">
                    Email Masuk
                  </label>
                  {!isLocalBackend && !email && (
                    <button
                      type="button"
                      onClick={() => onChangeEmail('admassimbani@gmail.com')}
                      className="text-[11px] font-medium text-[#2E7D32] hover:underline"
                    >
                      + admassimbani@gmail.com
                    </button>
                  )}
                </div>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => onChangeEmail(e.target.value)}
                  placeholder="nama@sekolah.id / admassimbani@gmail.com"
                  className="w-full rounded-control border border-line bg-paper/60 px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:bg-white focus:border-brand-700 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="login-password" className="text-xs font-semibold text-ink">
                    Kata Sandi
                  </label>
                  {!isLocalBackend && onSendPasswordReset && (
                    <button
                      type="button"
                      onClick={handleTriggerForgot}
                      className="text-[11px] font-medium text-brand-700 hover:text-brand-900 hover:underline"
                    >
                      Lupa kata sandi?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => onChangePassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="w-full rounded-control border border-line bg-paper/60 py-2.5 pl-3 pr-11 text-sm text-ink focus:bg-white focus:border-brand-700 outline-none"
                  />
                  <button
                    type="button"
                    onClick={onTogglePassword}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-brand-800"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="flex w-full items-center justify-center gap-2 rounded-control bg-brand-700 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:bg-brand-700/50 shadow-sm"
              >
                {loginLoading ? (
                  <>
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      aria-hidden="true"
                    />
                    <span>Memeriksa Akun...</span>
                  </>
                ) : (
                  'Masuk'
                )}
              </button>

              {/* Opsi Masuk dengan Google */}
              {!isLocalBackend && onLoginGoogle && (
                <>
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-gray-200" />
                    <span className="flex-shrink mx-2 text-[11px] text-gray-400 uppercase tracking-wider">
                      atau
                    </span>
                    <div className="flex-grow border-t border-gray-200" />
                  </div>

                  <button
                    type="button"
                    onClick={onLoginGoogle}
                    disabled={googleLoading || loginLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-control border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors shadow-2xs disabled:opacity-50"
                  >
                    {googleLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    )}
                    <span>{googleLoading ? 'Menghubungkan...' : 'Masuk dengan Akun Google'}</span>
                  </button>
                </>
              )}
            </form>
          </div>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          {isLocalBackend
            ? 'Lupa kata sandi? Minta admin sekolah mengatur ulang dari menu Pengguna.'
            : 'Akun dibuat oleh admin sekolah atau didaftarkan melalui Firebase.'}
        </p>

        {isLocalBackend && (
          <button
            type="button"
            onClick={onResetLocal}
            disabled={loginLoading}
            className="mx-auto mt-3 block min-h-11 rounded-control px-3 text-xs font-semibold text-muted hover:text-danger disabled:opacity-60"
          >
            Hapus data lokal dan mulai ulang
          </button>
        )}
      </div>

      {/* Modal Lupa Kata Sandi */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-green-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0 text-[#2E7D32]">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900">Setel Ulang Kata Sandi</h3>
                <span className="text-xs text-gray-500">Firebase Authentication</span>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Ketikkan email akun Anda. Kami akan mengirimkan tautan resmi dari Firebase untuk membuat kata sandi baru.
            </p>

            <form onSubmit={handleConfirmReset} className="space-y-3">
              <input
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#2E7D32]"
              />

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  disabled={resetLoading}
                  className="px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetLoading || !forgotEmail.trim()}
                  className="px-4 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors disabled:bg-gray-300"
                >
                  {resetLoading ? 'Mengirim...' : 'Kirim Tautan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
