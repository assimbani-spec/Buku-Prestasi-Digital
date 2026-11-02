/**
 * Penangkap galat render.
 *
 * Tanpa ini, satu galat di komponen membuat seluruh halaman menjadi layar
 * putih tanpa petunjuk. Pengguna mendapat pesan yang bisa disampaikan ke admin,
 * dan detail teknis tetap dicatat di konsol peramban, bukan ditampilkan.
 */

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('BKP Digital gagal menampilkan halaman', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4 font-sans text-ink">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-surface p-6 text-center shadow-sm">
          <h1 className="text-base font-bold text-danger">Halaman gagal dimuat</h1>
          <p className="mt-2 text-xs leading-relaxed text-gray-600">
            Terjadi kesalahan tak terduga. Muat ulang halaman. Bila masih gagal, sampaikan
            pesan di konsol peramban kepada administrator.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 min-h-11 rounded-xl bg-[#2E7D32] px-4 text-xs font-bold text-white hover:bg-[#1B5E20]"
          >
            Muat ulang
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
