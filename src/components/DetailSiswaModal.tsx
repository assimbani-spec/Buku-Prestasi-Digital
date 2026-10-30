import React, { useEffect, useRef } from 'react';
import { X, Award, Phone, Mail, AlertTriangle } from 'lucide-react';
import { StudentRecord } from '../lib/firebase';

interface DetailSiswaModalProps {
  student: StudentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onInputPoin: (studentId: string) => void;
}

const tidakAda = <span className="font-normal text-muted">Belum diisi admin</span>;

export const DetailSiswaModal: React.FC<DetailSiswaModalProps> = ({
  student,
  isOpen,
  onClose,
  onInputPoin,
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !student) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-brand-950/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-siswa-judul"
        className="my-8 w-full max-w-lg overflow-hidden rounded-card border border-line bg-surface text-ink"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line bg-brand-800 px-5 py-4 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-white/20 bg-brand-950/40 text-base font-bold"
            >
              {student.name.charAt(0)}
            </span>
            <div className="min-w-0">
              <h2 id="detail-siswa-judul" className="truncate text-base font-semibold leading-tight">
                {student.name}
              </h2>
              <p className="mt-0.5 text-xs text-brand-100">
                NISN {student.nisn || 'belum diisi'} · {student.kelas} · Rayon {student.rayon}
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup detail santri"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-brand-100 hover:bg-brand-950/40 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-5 text-xs">
          <div className="flex items-center justify-between rounded-control border border-line bg-paper px-4 py-3">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted">
                Total poin karakter
              </span>
              <span className="text-2xl font-bold text-brand-800 tabular">{student.points}</span>
            </div>
            <span className="rounded-control border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
              Target 1000
            </span>
          </div>

          <div className="rounded-control border border-line p-3.5">
            <h3 className="border-b border-line pb-1.5 text-xs font-semibold text-ink">
              Kontak orang tua / wali
            </h3>
            <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted">Nama wali</dt>
                <dd className="font-semibold">{student.waliName || tidakAda}</dd>
              </div>
              <div>
                <dt className="text-muted">WhatsApp / HP</dt>
                <dd className="flex items-center gap-1 font-semibold">
                  {student.waliPhone ? (
                    <>
                      <Phone className="h-3 w-3 text-brand-700" aria-hidden="true" />
                      {student.waliPhone}
                    </>
                  ) : (
                    tidakAda
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted">Email terdaftar</dt>
                <dd className="flex items-center gap-1 font-semibold">
                  {student.waliEmail ? (
                    <>
                      <Mail className="h-3 w-3 text-muted" aria-hidden="true" />
                      {student.waliEmail}
                    </>
                  ) : (
                    tidakAda
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <p className="flex items-start gap-2 rounded-control border border-alert/25 bg-alert-50 px-3 py-2.5 text-xs leading-relaxed text-alert">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Catatan: jumlah hari pengisian jurnal belum dihitung di aplikasi, jadi tidak
            ditampilkan di sini.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onClose();
                onInputPoin(student.id);
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-control bg-brand-700 py-2.5 text-xs font-semibold text-white hover:bg-brand-800"
            >
              <Award className="h-4 w-4" aria-hidden="true" />
              Input poin karakter
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-control border border-line px-4 py-2.5 text-xs font-semibold text-ink hover:bg-paper"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailSiswaModal;
