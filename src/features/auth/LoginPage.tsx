/**
 * Halaman masuk. Status formulir tetap dimiliki App agar sesi dan pengalihan
 * rute berada di satu tempat; komponen ini hanya menangani tampilan.
 */
import { AlertCircle, BookOpen, Eye, EyeOff } from 'lucide-react';
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
}: LoginPageProps) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="bg-brand-800 px-6 py-6 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-white/20 bg-brand-950/40">
                <BookOpen className="h-5 w-5 text-brand-100" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-lg font-semibold leading-tight">BKP Digital</h1>
                <p className="text-xs text-brand-100">Buku Kejar Prestasi</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-brand-100">
              SMK Thibbil Qulub Assimbani. Jurnal pembiasaan, poin karakter, dan pengesahan wali santri.
            </p>
          </div>

          <div className="px-6 py-6">
            {isLocalBackend && (
              <div className="mb-4 rounded-control border border-line bg-paper/60 px-3 py-2.5">
                <p className="text-xs font-semibold text-ink">Mode lokal</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Data tersimpan di peramban ini, bukan di server.{' '}
                  {import.meta.env.DEV ? (
                    <>
                      Akun awal administrator:{' '}
                      <span className="font-semibold text-ink">admin@lokal.test</span> dengan kata sandi{' '}
                      <span className="font-semibold text-ink">{LOCAL_SEED_PASSWORD}</span>. Akun lain dibuat
                      admin dari menu Pengguna.
                    </>
                  ) : (
                    <>
                      Hubungi pengelola sistem untuk kata sandi akun administrator awal. Akun lain dibuat
                      admin dari menu Pengguna.
                    </>
                  )}
                </p>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
              className="space-y-4"
              noValidate
            >
              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger-50 px-3 py-2.5 text-xs text-danger"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-ink">
                  Email sekolah
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => onChangeEmail(e.target.value)}
                  placeholder="nama@thibbilqulub.sch.id"
                  className="w-full rounded-control border border-line bg-paper/60 px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:bg-white focus:border-brand-700"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold text-ink">
                  Kata sandi
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => onChangePassword(e.target.value)}
                    className="w-full rounded-control border border-line bg-paper/60 py-2.5 pl-3 pr-11 text-sm text-ink focus:bg-white focus:border-brand-700"
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
                className="flex w-full items-center justify-center gap-2 rounded-control bg-brand-700 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:bg-brand-700/50"
              >
                {loginLoading ? (
                  <>
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      aria-hidden="true"
                    />
                    <span>Memeriksa akun</span>
                  </>
                ) : (
                  'Masuk'
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          {isLocalBackend
            ? 'Lupa kata sandi? Minta admin sekolah mengatur ulang dari menu Pengguna.'
            : 'Akun dibuat oleh admin sekolah. Bila belum punya akses, hubungi Guru BK atau pembimbing rayon.'}
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
    </main>
  );
}
