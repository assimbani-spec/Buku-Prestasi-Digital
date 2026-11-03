/** Penanda saat potongan halaman sedang diunduh. */
export function MemuatPanel({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-xs text-muted">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-700"
        aria-hidden="true"
      />
      Memuat {label}
    </div>
  );
}

/**
 * Modul yang belum punya penyimpanan data. Ditampilkan apa adanya supaya
 * tidak ada formulir yang seolah menyimpan padahal tidak.
 */
export function ModulBelumTersedia({ judul }: { judul: string }) {
  return (
    <section className="rounded-card border border-line bg-surface px-4 py-8 text-center">
      <h2 className="text-sm font-semibold text-ink">{judul}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted">
        Modul ini belum tersambung ke database, sehingga isian belum bisa disimpan dan
        belum ditampilkan. Data yang Anda lihat sebelumnya adalah contoh tampilan.
      </p>
    </section>
  );
}
