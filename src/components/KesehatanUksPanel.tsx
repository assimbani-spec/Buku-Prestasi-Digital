import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Droplets,
  HeartPulse,
  Moon,
  Pill,
  Save,
  Stethoscope,
} from 'lucide-react';
import {
  collection,
  db,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from '../lib/data';
import { canSeeAllStudents, isStaffRole, type Role } from '../lib/rbac';
import { buildAuditPayload, newAuditRef } from '../lib/audit';
import type { MenstruasiRecord, StudentRecord } from '../lib/tipe';
import type { PoinLogRow } from '../features/rekap/poinHistory';

interface KesehatanUksPanelProps {
  student: StudentRecord | null;
  userRole: Role | null;
  userUid?: string;
  userEmail?: string | null;
  myRayonId?: string;
  myChildIds?: string[];
  poinLogs?: PoinLogRow[];
}

interface HarianHealthRow {
  tanggal: string;
  air_putih: boolean;
  mandi_2x: boolean;
  tidur_awal: boolean;
  bangun_subuh: boolean;
  grooming: boolean;
  sedang_menstruasi: boolean;
}

export const KesehatanUksPanel: React.FC<KesehatanUksPanelProps> = ({
  student,
  userRole,
  userUid,
  userEmail,
  myRayonId = '',
  myChildIds = [],
  poinLogs = [],
}) => {
  const [harianRows, setHarianRows] = useState<HarianHealthRow[]>([]);
  const [menstruasiRows, setMenstruasiRows] = useState<MenstruasiRecord[]>([]);
  const [uksLogs, setUksLogs] = useState<PoinLogRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Form catatan pemeriksaan UKS (untuk Guru / Pembimbing / Admin)
  const [uksKategori, setUksKategori] = useState<'skrining' | 'keluhan' | 'apresiasi'>('skrining');
  const [uksCatatan, setUksCatatan] = useState('');
  const [uksPoinDelta, setUksPoinDelta] = useState<number>(0);
  const [savingUks, setSavingUks] = useState(false);
  const [uksFeedback, setUksFeedback] = useState<string | null>(null);
  const [uksError, setUksError] = useState<string | null>(null);

  const canEdit = isStaffRole(userRole);

  useEffect(() => {
    if (!student?.id || !userRole) {
      setHarianRows([]);
      setMenstruasiRows([]);
      setUksLogs([]);
      return;
    }

    let cancelled = false;
    const loadHealthData = async () => {
      setLoading(true);
      try {
        const isAll = canSeeAllStudents(userRole);
        const isPembimbing = userRole === 'pembimbing_rayon' && Boolean(myRayonId);
        const isOrtu = userRole === 'orang_tua' && myChildIds.length > 0;

        if (!isAll && !isPembimbing && !isOrtu) {
          setHarianRows([]);
          setMenstruasiRows([]);
          setUksLogs([]);
          return;
        }

        const qHarian = isAll
          ? query(collection(db, 'pembiasaan_harian'), where('student_id', '==', student.id))
          : isPembimbing
            ? query(collection(db, 'pembiasaan_harian'), where('rayon', '==', myRayonId))
            : query(
                collection(db, 'pembiasaan_harian'),
                where('student_id', 'in', myChildIds.slice(0, 10))
              );

        const qMens = isAll
          ? query(collection(db, 'catatan_menstruasi'), where('siswa_id', '==', student.id))
          : isPembimbing
            ? query(collection(db, 'catatan_menstruasi'), where('rayon', '==', myRayonId))
            : query(
                collection(db, 'catatan_menstruasi'),
                where('siswa_id', 'in', myChildIds.slice(0, 10))
              );

        const qPoin = isAll
          ? query(collection(db, 'poin_log'), where('siswa_id', '==', student.id))
          : isPembimbing
            ? query(collection(db, 'poin_log'), where('rayon', '==', myRayonId))
            : query(collection(db, 'poin_log'), where('siswa_id', 'in', myChildIds.slice(0, 10)));

        const [harianSnap, mensSnap, poinSnap] = await Promise.all([
          getDocs(qHarian).catch(() => null),
          getDocs(qMens).catch(() => null),
          getDocs(qPoin).catch(() => null),
        ]);

        if (cancelled) return;

        if (harianSnap) {
          const rows = harianSnap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .filter((d) => d.student_id === student.id)
            .map((d) => ({
              tanggal: String(d.tanggal || ''),
              air_putih: Boolean(d.air_putih),
              mandi_2x: Boolean(d.mandi_2x),
              tidur_awal: Boolean(d.tidur_awal),
              bangun_subuh: Boolean(d.bangun_subuh),
              grooming: Boolean(d.grooming),
              sedang_menstruasi: Boolean(d.sedang_menstruasi),
            }))
            .sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1))
            .slice(0, 30);
          setHarianRows(rows);
        }

        if (mensSnap) {
          const rows = mensSnap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }) as MenstruasiRecord)
            .filter((m) => m.siswa_id === student.id)
            .sort((a, b) => ((a.tanggal_mulai || '') < (b.tanggal_mulai || '') ? 1 : -1));
          setMenstruasiRows(rows);
        }

        if (poinSnap) {
          const rows: PoinLogRow[] = poinSnap.docs
            .map((d) => {
              const data = d.data() as any;
              const createdMs = data.createdAt?.toMillis ? data.createdAt.toMillis() : 0;
              return {
                id: d.id,
                studentId: data.siswa_id ?? '',
                kode: data.kode ?? '',
                tipe: data.tipe ?? 'apresiasi',
                deskripsi: data.deskripsi ?? '',
                poin: Number(data.poin) || 0,
                createdMs,
                time: createdMs ? new Date(createdMs).toLocaleString('id-ID') : 'Baru saja',
              };
            })
            .filter(
              (r) =>
                r.studentId === student.id &&
                (r.kode === 'UKS' ||
                  r.kode === 'K 4.4' ||
                  r.kode === 'K 5.9' ||
                  r.kode.startsWith('A 4.'))
            )
            .sort((a, b) => b.createdMs - a.createdMs);
          setUksLogs(rows);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadHealthData();
    return () => {
      cancelled = true;
    };
  }, [student?.id, userRole, myRayonId, myChildIds.join('|'), poinLogs.length]);

  const metrics = useMemo(() => {
    const total = harianRows.length;
    if (total === 0) {
      return { total: 0, airPct: 0, mandiPct: 0, tidurPct: 0, groomingPct: 0 };
    }
    const pct = (count: number) => Math.round((count / total) * 100);
    return {
      total,
      airPct: pct(harianRows.filter((r) => r.air_putih).length),
      mandiPct: pct(harianRows.filter((r) => r.mandi_2x).length),
      tidurPct: pct(harianRows.filter((r) => r.tidur_awal).length),
      groomingPct: pct(harianRows.filter((r) => r.grooming).length),
    };
  }, [harianRows]);

  const handleSaveUks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student?.id || !userUid || !canEdit) return;
    const text = uksCatatan.trim();
    if (!text) {
      setUksError('Tuliskan hasil pemeriksaan / catatan UKS terlebih dahulu.');
      return;
    }

    setSavingUks(true);
    setUksError(null);
    setUksFeedback(null);

    try {
      const labelJenis =
        uksKategori === 'skrining'
          ? 'Skrining UKS'
          : uksKategori === 'keluhan'
            ? 'Keluhan / Rawat UKS'
            : 'Apresiasi Kebiasaan Sehat';
      const poinAbs = Math.abs(Number(uksPoinDelta) || 0);
      const tipe = Number(uksPoinDelta) < 0 ? 'konsekuensi' : 'apresiasi';
      const delta = Number(uksPoinDelta) || 0;
      const deskripsi = `${student.name} [${labelJenis}]: ${text}`;

      const batch = writeBatch(db);
      const logRef = doc(collection(db, 'poin_log'));

      batch.set(logRef, {
        siswa_id: student.id,
        rayon: student.rayon,
        kode: 'UKS',
        tipe,
        deskripsi,
        poin: poinAbs,
        dicatat_oleh: userUid,
        createdAt: serverTimestamp(),
      });

      if (delta !== 0) {
        batch.update(doc(db, 'students', student.id), {
          points: increment(delta),
          updatedAt: serverTimestamp(),
        });
      }

      batch.set(
        newAuditRef(),
        buildAuditPayload({
          actor: { uid: userUid, email: userEmail ?? null, role: userRole },
          action: 'uks_catat',
          collectionName: 'poin_log',
          docId: logRef.id,
          siswaId: student.id,
          rayon: student.rayon,
          after: { kode: 'UKS', kategori: uksKategori, poin: poinAbs, delta, deskripsi },
        })
      );

      await batch.commit();

      setUksLogs((prev) => [
        {
          id: logRef.id,
          studentId: student.id,
          kode: 'UKS',
          tipe,
          deskripsi,
          poin: poinAbs,
          createdMs: Date.now(),
          time: new Date().toLocaleString('id-ID'),
        },
        ...prev,
      ]);
      setUksCatatan('');
      setUksPoinDelta(0);
      setUksFeedback('Catatan kesehatan / UKS berhasil disimpan.');
      setTimeout(() => setUksFeedback(null), 3000);
    } catch (err) {
      setUksError('Gagal menyimpan catatan UKS: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingUks(false);
    }
  };

  if (!student || !student.id) {
    return (
      <div className="bg-white rounded-2xl border border-green-100 p-6 text-center text-xs text-gray-500">
        Pilih santri terlebih dahulu untuk melihat borang kesehatan & catatan UKS.
      </div>
    );
  }

  const activeHaid = menstruasiRows.find((m) => m.status === 'haid_aktif');

  return (
    <div className="space-y-4">
      {/* Header Santri */}
      <div className="bg-white rounded-2xl p-4 border border-green-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#1B5E20]">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{student.name}</h3>
            <p className="text-xs text-gray-500">
              {student.kelas} • Rayon {student.rayon}
            </p>
          </div>
        </div>
        {loading && <span className="text-xs text-emerald-700 font-medium">Memuat data kesehatan…</span>}
      </div>

      {/* Ringkasan Kebiasaan Fisik dari Jejak Harian */}
      <div className="bg-white rounded-2xl p-4 border border-green-100 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-[#2E7D32]" />
            <span>Kebiasaan Hidup Sehat ({metrics.total} Hari Terakhir)</span>
          </h4>
        </div>

        {metrics.total === 0 ? (
          <p className="text-xs text-gray-500">
            Belum ada data kebiasaan fisik dari pengisian Jejak Harian santri.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-100">
              <span className="text-[11px] text-sky-700 font-semibold flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5" /> Air Putih 1.5–2L
              </span>
              <p className="text-lg font-black text-sky-900 mt-1">{metrics.airPct}%</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <span className="text-[11px] text-emerald-700 font-semibold">Mandi 2x Sehari</span>
              <p className="text-lg font-black text-emerald-900 mt-1">{metrics.mandiPct}%</p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
              <span className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1">
                <Moon className="w-3.5 h-3.5" /> Tidur &lt; 22.00
              </span>
              <p className="text-lg font-black text-indigo-900 mt-1">{metrics.tidurPct}%</p>
            </div>
            <div className="p-3 rounded-xl bg-teal-50 border border-teal-100">
              <span className="text-[11px] text-teal-700 font-semibold">Grooming & Rapi</span>
              <p className="text-lg font-black text-teal-900 mt-1">{metrics.groomingPct}%</p>
            </div>
          </div>
        )}
      </div>

      {/* Catatan Menstruasi & Tablet Tambah Darah (jika ada / siswi putri) */}
      {(student.gender === 'P' || menstruasiRows.length > 0) && (
        <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
              <Pill className="w-4 h-4 text-rose-600" />
              <span>Pantauan Siklus Menstruasi & Tablet Tambah Darah (TTD)</span>
            </h4>
            {activeHaid && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                Sedang Udzur Syar’i sejak {activeHaid.tanggal_mulai}
              </span>
            )}
          </div>

          {menstruasiRows.length === 0 ? (
            <p className="text-xs text-gray-500">Belum ada catatan siklus menstruasi atau konsumsi TTD.</p>
          ) : (
            <div className="divide-y divide-rose-50 text-xs">
              {menstruasiRows.slice(0, 5).map((m) => (
                <div key={m.id} className="py-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {m.tanggal_mulai} {m.tanggal_selesai ? `s.d. ${m.tanggal_selesai}` : '(Aktif)'}
                    </p>
                    {Array.isArray(m.keluhan) && m.keluhan.length > 0 && (
                      <p className="text-[11px] text-rose-700 mt-0.5">Keluhan: {m.keluhan.join(', ')}</p>
                    )}
                    {m.catatan && <p className="text-[11px] text-gray-500 mt-0.5">{m.catatan}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        m.status === 'haid_aktif'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {m.status === 'haid_aktif' ? 'Haid Aktif' : 'Selesai Suci'}
                    </span>
                    {m.minum_ttd && (
                      <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                        Minum TTD
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form Input Catatan Pemeriksaan UKS (Khusus Guru / BK / Pembimbing / Admin) */}
      {canEdit && (
        <form
          onSubmit={handleSaveUks}
          className="bg-white rounded-2xl p-4 border border-green-100 shadow-xs space-y-3 text-xs"
        >
          <h4 className="font-bold text-gray-800 flex items-center gap-1.5">
            <Stethoscope className="w-4 h-4 text-[#2E7D32]" />
            <span>Catat Pemeriksaan / Layanan UKS untuk {student.name}</span>
          </h4>

          {uksFeedback && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{uksFeedback}</span>
            </div>
          )}
          {uksError && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold">
              {uksError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Jenis Catatan</label>
              <select
                value={uksKategori}
                onChange={(e) => setUksKategori(e.target.value as any)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
              >
                <option value="skrining">Skrining Kesehatan Berkala (BB/TB/Tensi/Gigi)</option>
                <option value="keluhan">Kunjungan UKS / Keluhan Sakit</option>
                <option value="apresiasi">Apresiasi Kebersihan & Kesehatan</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Penyesuaian Poin (Opsional)</label>
              <select
                value={uksPoinDelta}
                onChange={(e) => setUksPoinDelta(Number(e.target.value))}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
              >
                <option value={0}>Catatan Rekam UKS Saja (0 Poin)</option>
                <option value={10}>Apresiasi Kesehatan (+10 Poin)</option>
                <option value={50}>Tuntas Skrining Kesehatan (+50 Poin)</option>
                <option value={-50}>Tidak Bawa Botol Minum / Abai Kesehatan (-50 Poin)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Hasil Pemeriksaan / Keterangan UKS *</label>
            <textarea
              rows={2}
              value={uksCatatan}
              onChange={(e) => setUksCatatan(e.target.value)}
              placeholder="Misal: TB 162 cm, BB 52 kg, TD 110/70 mmHg, kondisi sehat / diberi vitamin..."
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
            />
          </div>

          <button
            type="submit"
            disabled={savingUks}
            className="px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white font-bold rounded-xl flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{savingUks ? 'Menyimpan…' : 'Simpan Catatan Kesehatan / UKS'}</span>
          </button>
        </form>
      )}

      {/* Riwayat Catatan UKS & Kesehatan */}
      <div className="bg-white rounded-2xl p-4 border border-green-100 shadow-xs space-y-2.5 text-xs">
        <h4 className="font-bold uppercase tracking-wider text-gray-700">
          Riwayat Catatan UKS & Kesehatan ({uksLogs.length})
        </h4>
        {uksLogs.length === 0 ? (
          <p className="text-gray-500">Belum ada catatan pemeriksaan UKS atau kesehatan untuk santri ini.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {uksLogs.map((log) => (
              <li key={log.id} className="py-2.5 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 text-[10px]">
                      {log.kode}
                    </span>
                    <span className="text-gray-400">{log.time}</span>
                  </div>
                  <p className="font-medium text-gray-800 mt-1">{log.deskripsi}</p>
                </div>
                {log.poin > 0 && (
                  <span
                    className={`font-bold shrink-0 ${
                      log.tipe === 'apresiasi' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {log.tipe === 'apresiasi' ? `+${log.poin}` : `-${log.poin}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default KesehatanUksPanel;
