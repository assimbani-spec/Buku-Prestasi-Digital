import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  GraduationCap,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import {
  collection,
  db,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from '../lib/data';
import type {
  ArsipSantriTahunanRecord,
  ArsipTahunAjaranRecord,
  StudentRecord,
  UserProfile,
} from '../lib/tipe';
import { saveSchoolConfigToServer, type SchoolConfig } from '../lib/schoolConfig';
import { POIN_AWAL_DEFAULT } from '../features/siswa/siswa';
import {
  exportArsipTahunAjaranExcel,
  hitungRencanaKenaikan,
  isSantriAktif,
  prosesTutupTahunAjaran,
  sarankanKelasBerikutnya,
  sarankanTahunAjaranBerikutnya,
  type AksiKenaikanKelas,
  type LinkedProfileLite,
  type RencanaPerKelas,
} from '../features/admin/kenaikanKelas';

interface TutupTahunAjaranPanelProps {
  profile: UserProfile | null;
  isAdmin: boolean;
  students: StudentRecord[];
  masterKelas: string[];
  profiles: LinkedProfileLite[];
  schoolConfig: SchoolConfig;
  onSuccessNotice: (msg: string) => void;
  onErrorNotice: (msg: string) => void;
}

export const TutupTahunAjaranPanel: React.FC<TutupTahunAjaranPanelProps> = ({
  profile,
  isAdmin,
  students,
  masterKelas,
  profiles,
  schoolConfig,
  onSuccessNotice,
  onErrorNotice,
}) => {
  const defaultTahunLama = schoolConfig.tahunAjaranAktif || '2025/2026';
  const [tahunLama, setTahunLama] = useState(defaultTahunLama);
  const [tahunBaru, setTahunBaru] = useState(() => sarankanTahunAjaranBerikutnya(defaultTahunLama));
  const [modeResetPoin, setModeResetPoin] = useState<'reset_default' | 'pertahankan'>('reset_default');
  const [poinDefaultBaru, setPoinDefaultBaru] = useState<number>(POIN_AWAL_DEFAULT);
  const [buatMasterKelasOtomatis, setBuatMasterKelasOtomatis] = useState(true);
  const [nonaktifkanAkunLulus, setNonaktifkanAkunLulus] = useState(true);
  const [catatan, setCatatan] = useState('');

  const [rencanaKelasMap, setRencanaKelasMap] = useState<Record<string, RencanaPerKelas>>({});
  const [tinggalKelasIds, setTinggalKelasIds] = useState<Set<string>>(new Set());
  const [expandedExceptionKelas, setExpandedExceptionKelas] = useState<string | null>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Arsip tersimpan
  const [arsipList, setArsipList] = useState<ArsipTahunAjaranRecord[]>([]);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [previewArsip, setPreviewArsip] = useState<{
    arsip: ArsipTahunAjaranRecord;
    details: ArsipSantriTahunanRecord[];
  } | null>(null);

  useEffect(() => {
    const activeYear = schoolConfig.tahunAjaranAktif || '2025/2026';
    setTahunLama(activeYear);
    setTahunBaru(sarankanTahunAjaranBerikutnya(activeYear));
  }, [schoolConfig.tahunAjaranAktif]);

  const activeStudents = useMemo(() => students.filter(isSantriAktif), [students]);

  // Daftar kelas unik dari santri aktif
  const kelasGroups = useMemo(() => {
    const map = new Map<string, StudentRecord[]>();
    activeStudents.forEach((s) => {
      const k = s.kelas || '-';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([kelasNama, list]) => ({
        kelasNama,
        students: list.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [activeStudents]);

  // Inisialisasi rencana otomatis bila muncul kelas baru
  useEffect(() => {
    setRencanaKelasMap((prev) => {
      const next = { ...prev };
      let changed = false;
      kelasGroups.forEach(({ kelasNama }) => {
        if (!next[kelasNama]) {
          next[kelasNama] = sarankanKelasBerikutnya(kelasNama, masterKelas);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [kelasGroups, masterKelas]);

  // Dengarkan daftar arsip tahun ajaran
  useEffect(() => {
    if (!profile) return;
    const unsub = onSnapshot(
      query(collection(db, 'arsip_tahun_ajaran'), orderBy('createdAt', 'desc')),
      (snap) => {
        setArsipList(
          snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              tahunAjaranLama: data.tahunAjaranLama ?? '-',
              tahunAjaranBaru: data.tahunAjaranBaru ?? '-',
              modeResetPoin: data.modeResetPoin === 'pertahankan' ? 'pertahankan' : 'reset_default',
              poinDefaultBaru: Number(data.poinDefaultBaru ?? POIN_AWAL_DEFAULT),
              catatan: data.catatan ?? '',
              ringkasan: data.ringkasan ?? {
                totalDiproses: 0,
                naikKelas: 0,
                lulus: 0,
                tetap: 0,
              },
              dibuatOlehUid: data.dibuatOlehUid ?? '',
              dibuatOlehEmail: data.dibuatOlehEmail ?? '',
              createdAt: data.createdAt,
            } as ArsipTahunAjaranRecord;
          })
        );
      },
      () => {
        // Jika belum ada indeks / koleksi kosong, tetap aman
      }
    );
    return () => unsub();
  }, [profile]);

  const resetSaranOtomatis = () => {
    const fresh: Record<string, RencanaPerKelas> = {};
    kelasGroups.forEach(({ kelasNama }) => {
      fresh[kelasNama] = sarankanKelasBerikutnya(kelasNama, masterKelas);
    });
    setRencanaKelasMap(fresh);
    setTinggalKelasIds(new Set());
  };

  const updateRencanaKelas = (kelasAsal: string, patch: Partial<RencanaPerKelas>) => {
    setRencanaKelasMap((prev) => {
      const cur = prev[kelasAsal] ?? sarankanKelasBerikutnya(kelasAsal, masterKelas);
      const updated: RencanaPerKelas = { ...cur, ...patch };
      if (patch.aksi === 'lulus') {
        updated.kelasTujuan = 'Lulus / Alumni';
      } else if (patch.aksi === 'tetap') {
        updated.kelasTujuan = kelasAsal;
      } else if (patch.aksi === 'naik_kelas' && (updated.kelasTujuan === 'Lulus / Alumni' || updated.kelasTujuan === kelasAsal)) {
        const saran = sarankanKelasBerikutnya(kelasAsal, masterKelas);
        updated.kelasTujuan = saran.aksi === 'naik_kelas' ? saran.kelasTujuan : kelasAsal;
      }
      return { ...prev, [kelasAsal]: updated };
    });
  };

  const toggleTinggalKelas = (studentId: string) => {
    setTinggalKelasIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const rencana = useMemo(
    () =>
      hitungRencanaKenaikan(students, rencanaKelasMap, tinggalKelasIds, masterKelas, {
        modeResetPoin,
        poinDefaultBaru,
      }),
    [students, rencanaKelasMap, tinggalKelasIds, masterKelas, modeResetPoin, poinDefaultBaru]
  );

  const opsi: {
    tahunAjaranLama: string;
    tahunAjaranBaru: string;
    modeResetPoin: 'reset_default' | 'pertahankan';
    poinDefaultBaru: number;
    buatMasterKelasOtomatis: boolean;
    nonaktifkanAkunLulus: boolean;
    catatan: string;
  } = {
    tahunAjaranLama: tahunLama,
    tahunAjaranBaru: tahunBaru,
    modeResetPoin,
    poinDefaultBaru,
    buatMasterKelasOtomatis,
    nonaktifkanAkunLulus,
    catatan,
  };

  const handleExecuteTutupTahun = async () => {
    if (!profile || !isAdmin) return;
    setProcessing(true);
    setProgress({ done: 0, total: rencana.totalDiproses });
    onErrorNotice('');
    try {
      const res = await prosesTutupTahunAjaran({
        rencana,
        opsi,
        aktor: { uid: profile.uid, email: profile.email, role: profile.role },
        profiles,
        onProgress: (done, total) => setProgress({ done, total }),
      });

      // Perbarui profil sekolah ke Tahun Ajaran Baru (semester Ganjil)
      await saveSchoolConfigToServer(
        {
          ...schoolConfig,
          tahunAjaranAktif: tahunBaru.trim(),
          semesterAktif: 'Ganjil',
        },
        profile.uid
      );

      setShowConfirmModal(false);
      setTinggalKelasIds(new Set());
      setCatatan('');
      onSuccessNotice(
        `Tutup Tahun Ajaran ${tahunLama} → ${tahunBaru} berhasil (${res.totalDiproses} santri diproses: ${rencana.naikKelas} naik kelas, ${rencana.lulus} lulus/alumni, ${rencana.tetap} tetap). Riwayat lama tetap aman di arsip.`
      );
    } catch (err) {
      onErrorNotice(
        'Gagal memproses tutup tahun ajaran: ' + (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  };

  const fetchArsipDetails = async (arsipId: string): Promise<ArsipSantriTahunanRecord[]> => {
    const snap = await getDocs(
      query(collection(db, 'arsip_santri_tahunan'), where('arsipId', '==', arsipId))
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }) as ArsipSantriTahunanRecord)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const handlePreviewArsip = async (arsip: ArsipTahunAjaranRecord) => {
    setLoadingDetailId(arsip.id);
    try {
      const details = await fetchArsipDetails(arsip.id);
      setPreviewArsip({ arsip, details });
    } catch (err) {
      onErrorNotice('Gagal memuat detail arsip: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoadingDetailId(null);
    }
  };

  const handleDownloadArsipExcel = async (arsip: ArsipTahunAjaranRecord) => {
    setLoadingDetailId(arsip.id);
    try {
      const details = await fetchArsipDetails(arsip.id);
      exportArsipTahunAjaranExcel(arsip, details);
    } catch (err) {
      onErrorNotice('Gagal mengunduh Excel arsip: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoadingDetailId(null);
    }
  };

  const targetKelasDatalistId = 'kenaikan-master-kelas-list';

  return (
    <div className="space-y-5">
      {/* Header Penjelasan */}
      <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2 text-gray-900">
              <CalendarClock className="w-4 h-4 text-[#2E7D32]" />
              Kenaikan Kelas & Tutup Tahun Ajaran
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Naikkan seluruh santri secara otomatis per rombel, arsipkan santri tingkat akhir sebagai{' '}
              <strong>Lulus / Alumni</strong>, dan atur ulang poin awal tahun ajaran baru{' '}
              <strong>tanpa menghapus riwayat jurnal, prestasi, maupun poin tahun sebelumnya</strong>.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900">
            Aktif: {schoolConfig.tahunAjaranAktif || '2025/2026'} ({schoolConfig.semesterAktif || 'Genap'})
          </span>
        </div>
      </section>

      {/* Langkah 1: Konfigurasi Tahun Ajaran & Poin */}
      <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#2E7D32] text-white inline-flex items-center justify-center text-[11px] font-bold">
              1
            </span>
            Pengaturan Tahun Ajaran Baru & Kebijakan Poin
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Tahun Ajaran yang Ditutup</label>
            <input
              type="text"
              value={tahunLama}
              onChange={(e) => setTahunLama(e.target.value)}
              placeholder="Contoh: 2025/2026"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-[#2E7D32]"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Tahun Ajaran Baru</label>
            <input
              type="text"
              value={tahunBaru}
              onChange={(e) => setTahunBaru(e.target.value)}
              placeholder="Contoh: 2026/2027"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-[#2E7D32]"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Kebijakan Saldo Poin Awal</label>
            <select
              value={modeResetPoin}
              onChange={(e) => setModeResetPoin(e.target.value as 'reset_default' | 'pertahankan')}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-[#2E7D32] font-medium"
            >
              <option value="reset_default">Reset Poin Santri Aktif ke Poin Awal Baru</option>
              <option value="pertahankan">Pertahankan Poin Lama (Lanjutkan Saldo)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          {modeResetPoin === 'reset_default' && (
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
              <label className="block font-semibold text-emerald-900">
                Poin Awal Tahun Ajaran {tahunBaru} (Santri Naik / Tetap)
              </label>
              <input
                type="number"
                min={0}
                max={100000}
                value={poinDefaultBaru}
                onChange={(e) => setPoinDefaultBaru(Number(e.target.value))}
                className="w-44 px-3 py-1.5 bg-white border border-emerald-300 rounded-lg font-bold text-emerald-900 outline-none focus:border-[#2E7D32]"
              />
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Poin akhir tahun {tahunLama} tetap tersimpan di Arsip Tahunan & catatan harian/prestasi
                lama tidak dihapus. Santri lulus tetap menyimpan poin akhirnya.
              </p>
            </div>
          )}

          <div className={`space-y-2 ${modeResetPoin === 'pertahankan' ? 'md:col-span-2' : ''}`}>
            <label className="flex items-start gap-2 cursor-pointer p-2.5 rounded-xl bg-gray-50 border border-gray-200">
              <input
                type="checkbox"
                checked={buatMasterKelasOtomatis}
                onChange={(e) => setBuatMasterKelasOtomatis(e.target.checked)}
                className="mt-0.5 accent-[#2E7D32]"
              />
              <span>
                <strong className="text-gray-800">Tambahkan kelas tujuan baru ke Master Kelas otomatis</strong>
                <span className="block text-[11px] text-gray-500">
                  Jika kelas tujuan (mis. XII A) belum ada di Master Data, sistem menambahkannya otomatis.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer p-2.5 rounded-xl bg-gray-50 border border-gray-200">
              <input
                type="checkbox"
                checked={nonaktifkanAkunLulus}
                onChange={(e) => setNonaktifkanAkunLulus(e.target.checked)}
                className="mt-0.5 accent-[#2E7D32]"
              />
              <span>
                <strong className="text-gray-800">Nonaktifkan akun login siswa yang Lulus / Alumni</strong>
                <span className="block text-[11px] text-gray-500">
                  Alumni tidak lagi mengisi jurnal harian, sementara arsip nilainya tetap tersimpan untuk sekolah.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div>
          <label className="block font-semibold text-gray-700 mb-1">Catatan Tutup Tahun (Opsional)</label>
          <input
            type="text"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Misal: Kenaikan kelas hasil rapat pleno dewan guru Juni 2026"
            maxLength={300}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-[#2E7D32]"
          />
        </div>
      </section>

      {/* Langkah 2: Pemetaan Kenaikan Per Kelas */}
      <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#2E7D32] text-white inline-flex items-center justify-center text-[11px] font-bold">
                2
              </span>
              Pemetaan Kenaikan Per Kelas ({activeStudents.length} Santri Aktif)
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Sistem otomatis menyarankan kenaikan (X → XI → XII → Lulus, VII → VIII → IX → Lulus). Anda dapat menyesuaikan sebelum diproses.
            </p>
          </div>
          <button
            type="button"
            onClick={resetSaranOtomatis}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Terapkan Saran Otomatis</span>
          </button>
        </div>

        <datalist id={targetKelasDatalistId}>
          {masterKelas.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>

        {kelasGroups.length === 0 ? (
          <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
            Tidak ada santri berstatus aktif saat ini. Tambahkan data santri terlebih dahulu atau aktifkan kembali santri di tab Data Santri.
          </div>
        ) : (
          <div className="space-y-2.5">
            {kelasGroups.map(({ kelasNama, students: groupStudents }) => {
              const plan =
                rencanaKelasMap[kelasNama] ?? sarankanKelasBerikutnya(kelasNama, masterKelas);
              const tinggalCount = groupStudents.filter((s) => tinggalKelasIds.has(s.id)).length;
              const isExpanded = expandedExceptionKelas === kelasNama;

              return (
                <div
                  key={kelasNama}
                  className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden"
                >
                  <div className="p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-green-100 text-green-900 font-bold">
                          {kelasNama}
                        </span>
                        <span className="font-semibold text-gray-700">
                          {groupStudents.length} santri
                        </span>
                      </div>
                      {tinggalCount > 0 && (
                        <span className="inline-block mt-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {tinggalCount} santri dikecualikan (tetap di kelas)
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
                      <select
                        value={plan.aksi}
                        onChange={(e) =>
                          updateRencanaKelas(kelasNama, {
                            aksi: e.target.value as AksiKenaikanKelas,
                          })
                        }
                        className="px-2.5 py-2 bg-white border border-gray-200 rounded-xl font-semibold outline-none focus:border-[#2E7D32]"
                      >
                        <option value="naik_kelas">Naik ke Kelas</option>
                        <option value="lulus">Lulus / Arsip Alumni</option>
                        <option value="tetap">Tetap di Kelas Ini</option>
                      </select>

                      {plan.aksi === 'naik_kelas' && (
                        <>
                          <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                          <input
                            type="text"
                            list={targetKelasDatalistId}
                            value={plan.kelasTujuan}
                            onChange={(e) =>
                              updateRencanaKelas(kelasNama, { kelasTujuan: e.target.value })
                            }
                            placeholder="Nama kelas tujuan"
                            className="px-3 py-2 bg-white border border-emerald-300 rounded-xl font-bold text-emerald-900 w-44 outline-none focus:border-[#2E7D32]"
                          />
                        </>
                      )}

                      {plan.aksi === 'lulus' && (
                        <span className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5" />
                          Lulus / Arsip Alumni ({tahunLama})
                        </span>
                      )}

                      {plan.aksi !== 'tetap' && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedExceptionKelas(isExpanded ? null : kelasNama)
                          }
                          className="px-2.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-1"
                          title="Pilih santri yang tidak naik / tinggal kelas"
                        >
                          <span>Pengecualian</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-white p-3 space-y-2">
                      <p className="text-[11px] text-gray-600 font-medium">
                        Centang santri di bawah ini apabila <strong>tidak naik kelas / tetap di {kelasNama}</strong>:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                        {groupStudents.map((s) => {
                          const checked = tinggalKelasIds.has(s.id);
                          return (
                            <label
                              key={s.id}
                              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-[11px] ${
                                checked
                                  ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                                  : 'bg-gray-50 border-gray-100 text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleTinggalKelas(s.id)}
                                className="accent-amber-600"
                              />
                              <span className="truncate">
                                {s.name} <span className="text-gray-400 font-mono">({s.nisn})</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Langkah 3: Ringkasan & Tombol Eksekusi */}
      <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 space-y-3 text-xs">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#2E7D32] text-white inline-flex items-center justify-center text-[11px] font-bold">
            3
          </span>
          Ringkasan Dampak & Eksekusi
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
            <span className="text-[11px] text-gray-500 block">Total Santri Aktif</span>
            <strong className="text-lg text-gray-900">{rencana.totalDiproses}</strong>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-[11px] text-emerald-700 block">Naik Kelas</span>
            <strong className="text-lg text-emerald-900">{rencana.naikKelas}</strong>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-[11px] text-amber-800 block">Lulus / Alumni</span>
            <strong className="text-lg text-amber-900">{rencana.lulus}</strong>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <span className="text-[11px] text-blue-700 block">Tetap di Kelas</span>
            <strong className="text-lg text-blue-900">{rencana.tetap}</strong>
          </div>
        </div>

        {rencana.kelasBaruBelumDiMaster.length > 0 && (
          <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-[11px]">
            <strong>Kelas tujuan baru:</strong> {rencana.kelasBaruBelumDiMaster.join(', ')}.{' '}
            {buatMasterKelasOtomatis
              ? 'Akan ditambahkan otomatis ke Master Kelas.'
              : 'Belum ada di Master Kelas (centang opsi otomatis di atas bila ingin ditambahkan).'}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Snapshot akhir tahun <strong>{tahunLama}</strong> akan disimpan permanen sebelum data tahun baru diterapkan.
            </span>
          </p>
          <button
            type="button"
            disabled={!isAdmin || processing || rencana.totalDiproses === 0}
            onClick={() => setShowConfirmModal(true)}
            className="px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white font-bold flex items-center gap-2 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>Proses Tutup Tahun Ajaran</span>
          </button>
        </div>
      </section>

      {/* Riwayat Arsip Tahun Ajaran */}
      <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Archive className="w-4 h-4 text-[#2E7D32]" />
            Riwayat Arsip Tahun Ajaran ({arsipList.length})
          </h3>
        </div>

        {arsipList.length === 0 ? (
          <p className="text-gray-400 py-3">
            Belum ada arsip tutup tahun ajaran. Setelah proses di atas dijalankan, snapshot poin akhir santri akan tampil di sini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="p-2.5">Periode Tutup → Baru</th>
                  <th className="p-2.5">Kebijakan Poin</th>
                  <th className="p-2.5">Ringkasan Santri</th>
                  <th className="p-2.5">Catatan</th>
                  <th className="p-2.5 text-right">Arsip Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {arsipList.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/70">
                    <td className="p-2.5 font-bold text-gray-900">
                      {a.tahunAjaranLama} → {a.tahunAjaranBaru}
                    </td>
                    <td className="p-2.5">
                      {a.modeResetPoin === 'reset_default'
                        ? `Reset ke ${a.poinDefaultBaru}`
                        : 'Pertahankan saldo'}
                    </td>
                    <td className="p-2.5 text-gray-700">
                      <span className="font-semibold">{a.ringkasan.totalDiproses}</span> diproses ·{' '}
                      <span className="text-emerald-700">{a.ringkasan.naikKelas} naik</span> ·{' '}
                      <span className="text-amber-700">{a.ringkasan.lulus} lulus</span>
                      {a.ringkasan.tetap > 0 && ` · ${a.ringkasan.tetap} tetap`}
                    </td>
                    <td className="p-2.5 text-gray-500 max-w-xs truncate">{a.catatan || '-'}</td>
                    <td className="p-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={loadingDetailId === a.id}
                          onClick={() => handlePreviewArsip(a)}
                          className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Lihat</span>
                        </button>
                        <button
                          type="button"
                          disabled={loadingDetailId === a.id}
                          onClick={() => handleDownloadArsipExcel(a)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold inline-flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Excel</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal Konfirmasi Eksekusi */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-amber-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900">
                  Konfirmasi Tutup Tahun Ajaran {tahunLama}
                </h3>
                <span className="text-xs text-gray-500">
                  Berlanjut ke Tahun Ajaran {tahunBaru}
                </span>
              </div>
            </div>

            <div className="text-xs text-gray-700 space-y-1.5 bg-gray-50 p-3 rounded-xl border border-gray-200">
              <p>
                • <strong>{rencana.naikKelas}</strong> santri akan naik ke kelas tujuan baru.
              </p>
              <p>
                • <strong>{rencana.lulus}</strong> santri akan ditandai <strong>Lulus / Alumni</strong>.
              </p>
              <p>
                • <strong>{rencana.tetap}</strong> santri tetap di kelas saat ini.
              </p>
              <p>
                • Kebijakan Poin:{' '}
                <strong>
                  {modeResetPoin === 'reset_default'
                    ? `Reset santri aktif ke ${poinDefaultBaru} poin`
                    : 'Pertahankan saldo poin lama'}
                </strong>
                .
              </p>
              <p className="text-emerald-800 font-medium pt-1">
                ✓ Snapshot akhir & seluruh log riwayat lama tetap disimpan di arsip.
              </p>
            </div>

            {progress && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-semibold text-emerald-800">
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Memproses arsip & kenaikan...
                  </span>
                  <span>
                    {progress.done} / {progress.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2E7D32] transition-all"
                    style={{
                      width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                disabled={processing}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleExecuteTutupTahun}
                className="px-4 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{processing ? 'Memproses...' : 'Ya, Jalankan Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pratinjau Detail Arsip */}
      {previewArsip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-green-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-gray-900">
                  Arsip Tahun Ajaran {previewArsip.arsip.tahunAjaranLama} →{' '}
                  {previewArsip.arsip.tahunAjaranBaru}
                </h3>
                <p className="text-xs text-gray-500">
                  {previewArsip.details.length} catatan santri tersimpan
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportArsipTahunAjaranExcel(previewArsip.arsip, previewArsip.details)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewArsip(null)}
                  className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="p-2">Nama Santri</th>
                    <th className="p-2">NISN</th>
                    <th className="p-2">Kelas Asal</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Tujuan</th>
                    <th className="p-2 text-right">Poin Akhir</th>
                    <th className="p-2 text-right">Poin Baru</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewArsip.details.map((d) => (
                    <tr key={d.id}>
                      <td className="p-2 font-semibold text-gray-900">{d.name}</td>
                      <td className="p-2 font-mono text-gray-600">{d.nisn}</td>
                      <td className="p-2">{d.kelasLama}</td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.statusAkhir === 'lulus'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : d.statusAkhir === 'naik_kelas'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {d.statusAkhir === 'lulus'
                            ? 'Lulus / Alumni'
                            : d.statusAkhir === 'naik_kelas'
                              ? 'Naik Kelas'
                              : 'Tetap'}
                        </span>
                      </td>
                      <td className="p-2">{d.kelasBaru}</td>
                      <td className="p-2 text-right font-bold">{d.poinAkhir}</td>
                      <td className="p-2 text-right text-gray-600">{d.poinBaru}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutupTahunAjaranPanel;
