import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calendar, FileText, Printer } from 'lucide-react';

export interface LaporanPoinRow {
  id: string;
  kode: string;
  tipe: string;
  deskripsi: string;
  poin: number;
  createdMs: number;
  time: string;
}

interface LaporanBulananOrtuProps {
  studentName: string;
  studentKelas: string;
  studentRayon: string;
  currentPoints: number;
  poinLogs: LaporanPoinRow[];
}

const monthKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Laporan bulanan wali santri.
 *
 * Seluruh angka dihitung dari koleksi poin_log milik santri ini. Tidak ada
 * rata-rata kelas, predikat, atau konsistensi pembiasaan karena data itu
 * tidak tersimpan di Firestore. Bila belum ada catatan, yang tampil adalah
 * keadaan kosong, bukan angka contoh.
 */
export const LaporanBulananOrtu: React.FC<LaporanBulananOrtuProps> = ({
  studentName,
  studentKelas,
  studentRayon,
  currentPoints,
  poinLogs,
}) => {
  const months = useMemo(() => {
    const keys = Array.from(
      new Set(poinLogs.filter((l) => l.createdMs > 0).map((l) => monthKey(l.createdMs)))
    ).sort((a, b) => (a < b ? 1 : -1));
    return keys.slice(0, 6);
  }, [poinLogs]);

  const [selected, setSelected] = useState<string>('');
  const activeMonth = selected || months[0] || '';

  const rows = useMemo(
    () => (activeMonth ? poinLogs.filter((l) => l.createdMs > 0 && monthKey(l.createdMs) === activeMonth) : []),
    [poinLogs, activeMonth]
  );

  const totals = useMemo(() => {
    const apresiasi = rows
      .filter((r) => r.tipe === 'apresiasi')
      .reduce((acc, r) => acc + r.poin, 0);
    const konsekuensi = rows
      .filter((r) => r.tipe === 'konsekuensi')
      .reduce((acc, r) => acc + r.poin, 0);
    return { apresiasi, konsekuensi, net: apresiasi - konsekuensi, jumlah: rows.length };
  }, [rows]);

  // Satu batang per pekan dalam bulan terpilih, dihitung dari tanggal catatan.
  const weekly = useMemo(() => {
    const buckets = new Map<number, { week: string; apresiasi: number; konsekuensi: number }>();
    rows.forEach((r) => {
      const day = new Date(r.createdMs).getDate();
      const week = Math.min(4, Math.ceil(day / 7));
      const key = week;
      const label = `Pekan ${week}`;
      const bucket = buckets.get(key) ?? { week: label, apresiasi: 0, konsekuensi: 0 };
      if (r.tipe === 'apresiasi') bucket.apresiasi += r.poin;
      else bucket.konsekuensi += r.poin;
      buckets.set(key, bucket);
    });
    return Array.from(buckets.values()).sort((a, b) => a.week.localeCompare(b.week));
  }, [rows]);

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-ink">Laporan poin bulanan</h1>
            <p className="mt-0.5 text-xs text-muted">
              {studentName} · {studentKelas} · Rayon {studentRayon}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-control border border-line px-3 py-2 text-xs font-semibold text-ink hover:bg-paper"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Cetak
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted">Total poin sekarang</dt>
            <dd className="mt-0.5 text-lg font-bold text-brand-800 tabular">{currentPoints}</dd>
          </div>
          <div>
            <dt className="text-muted">Apresiasi bulan ini</dt>
            <dd className="mt-0.5 text-lg font-bold text-brand-700 tabular">+{totals.apresiasi}</dd>
          </div>
          <div>
            <dt className="text-muted">Konsekuensi bulan ini</dt>
            <dd className="mt-0.5 text-lg font-bold text-danger tabular">-{totals.konsekuensi}</dd>
          </div>
          <div>
            <dt className="text-muted">Catatan tercatat</dt>
            <dd className="mt-0.5 text-lg font-bold text-ink tabular">{totals.jumlah}</dd>
          </div>
        </dl>
      </section>

      {months.length === 0 ? (
        <section className="rounded-card border border-line bg-surface px-4 py-8 text-center">
          <Calendar className="mx-auto h-5 w-5 text-muted" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-ink">Belum ada catatan poin</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            Laporan terbentuk otomatis setelah guru atau pembimbing rayon mencatat apresiasi atau
            konsekuensi untuk ananda.
          </p>
        </section>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Pilih bulan laporan">
            {months.map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={m === activeMonth}
                onClick={() => setSelected(m)}
                className={`whitespace-nowrap rounded-control px-3 py-2 text-xs font-semibold transition-colors ${
                  m === activeMonth
                    ? 'bg-brand-800 text-white'
                    : 'border border-line bg-surface text-muted hover:text-brand-800'
                }`}
              >
                {monthLabel(m)}
              </button>
            ))}
          </div>

          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold text-ink">Akumulasi per pekan</h2>
            <p className="mt-0.5 text-xs text-muted">{monthLabel(activeMonth)}</p>

            {weekly.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">Tidak ada catatan pada bulan ini.</p>
            ) : (
              <div className="mt-3 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="#d9e3d3" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#51604f' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#51604f' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#d9e3d3' }}
                      formatter={(value: number, name: string) => [`${value} poin`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="apresiasi" name="Apresiasi" fill="#2E7D32" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="konsekuensi" name="Konsekuensi" fill="#A82A1F" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-card border border-line bg-surface">
            <h2 className="flex items-center gap-1.5 border-b border-line px-4 py-3 text-sm font-semibold text-ink">
              <FileText className="h-4 w-4 text-muted" aria-hidden="true" />
              Rincian catatan
            </h2>
            {rows.length === 0 ? (
              <p className="px-4 py-4 text-xs text-muted">Tidak ada catatan pada bulan ini.</p>
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink">
                        <span className="mr-1.5 rounded bg-paper px-1.5 py-0.5 text-xs font-bold text-muted">
                          {row.kode}
                        </span>
                        {row.deskripsi}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{row.time}</p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-bold tabular ${
                        row.tipe === 'apresiasi' ? 'text-brand-700' : 'text-danger'
                      }`}
                    >
                      {row.tipe === 'apresiasi' ? `+${row.poin}` : `-${row.poin}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default LaporanBulananOrtu;
