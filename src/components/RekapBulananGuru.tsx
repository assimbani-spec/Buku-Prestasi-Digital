import React, { useEffect, useMemo, useState } from 'react';
import {
  Printer,
  FileSpreadsheet,
  Users,
  User,
  Calendar,
  BookOpen,
  Filter,
  Search,
  Loader2,
  Info,
  Settings,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { PrestasiRecord, StudentRecord } from '../lib/tipe';
import { exportRekapSiswaExcel, exportRekapKelasExcel } from '../lib/excelHelper';
import { collection, db, getDocs, query, Timestamp, where } from '../lib/data';
import { canManageMasterData, canSeeAllStudents, type Role } from '../lib/rbac';
import { isoWeekNumber } from '../lib/format';
import {
  loadLocalSchoolConfig,
  saveLocalSchoolConfig,
  saveSchoolConfigToServer,
  subscribeSchoolConfig,
  type SchoolConfig,
} from '../lib/schoolConfig';
import {
  filterRiwayatBulan,
  gabungkanRiwayatPoin,
  hitungRingkasanBulan,
  mapJejakDoc,
  mapPoinLogDoc,
  type JejakHarianRow,
  type PoinLogRow,
  type UnifiedPoinRow,
} from '../features/rekap/poinHistory';

export type { PoinLogRow };

interface RekapBulananGuruProps {
  students: StudentRecord[];
  poinLogs: PoinLogRow[];
  prestasiList?: Array<PrestasiRecord & { createdAtMs?: number; verifiedAtMs?: number }>;
  userRole?: Role | null;
  myRayonId?: string;
  initialStudentId?: string;
  initialKelas?: string;
}

const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const getPredikatKarakter = (points: number) => {
  if (points >= 1000) return { label: 'Sangat Baik (Mumtaz)', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  if (points >= 900) return { label: 'Baik Sekali (Jayyid Jiddan)', badge: 'bg-green-100 text-green-800 border-green-300' };
  if (points >= 750) return { label: 'Baik (Jayyid)', badge: 'bg-teal-100 text-teal-800 border-teal-300' };
  if (points >= 500) return { label: 'Cukup (Perhatian Wali)', badge: 'bg-amber-100 text-amber-800 border-amber-300' };
  return { label: 'Perlu Bimbingan Khusus BK', badge: 'bg-rose-100 text-rose-800 border-rose-300' };
};

const getSumberBadgeClass = (sumber: UnifiedPoinRow['sumber']) => {
  if (sumber === 'jejak_harian') return 'bg-sky-50 text-sky-800 border border-sky-200';
  if (sumber === 'prestasi') return 'bg-amber-50 text-amber-800 border border-amber-200';
  return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
};

export const RekapBulananGuru: React.FC<RekapBulananGuruProps> = ({
  students,
  poinLogs,
  prestasiList = [],
  userRole = null,
  myRayonId = '',
  initialStudentId,
  initialKelas,
}) => {
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();

  const [mode, setMode] = useState<'individual' | 'kolektif'>('individual');
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthIdx);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Filter Individual
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || (students[0]?.id ?? '')
  );
  const [searchStudent, setSearchStudent] = useState<string>('');

  // Filter Kolektif
  const daftarKelas = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.kelas).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [students]);

  const [selectedKelas, setSelectedKelas] = useState<string>(
    initialKelas || daftarKelas[0] || 'Semua Kelas'
  );

  // Sinkronisasi apabila initialStudentId berubah dari tombol "Cetak Rekap" di daftar santri
  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
      setMode('individual');
    } else if (!selectedStudentId && students.length > 0) {
      setSelectedStudentId(students[0].id);
    }
  }, [initialStudentId, students, selectedStudentId]);

  useEffect(() => {
    if (initialKelas) {
      setSelectedKelas(initialKelas);
    } else if ((!selectedKelas || selectedKelas === 'Semua Kelas') && daftarKelas.length > 0 && !initialKelas) {
      // Biarkan pilihan user tetap, hanya isi bila kosong
      if (!selectedKelas) setSelectedKelas(daftarKelas[0]);
    }
  }, [initialKelas, daftarKelas, selectedKelas]);

  const filteredStudentOptions = useMemo(() => {
    const q = searchStudent.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.nisn || '').toLowerCase().includes(q) ||
        s.kelas.toLowerCase().includes(q)
    );
  }, [students, searchStudent]);

  // Jika hasil pencarian tidak memuat student yang sedang terpilih, pilih hasil pertama agar tidak kosong
  useEffect(() => {
    if (
      searchStudent.trim() &&
      filteredStudentOptions.length > 0 &&
      !filteredStudentOptions.some((s) => s.id === selectedStudentId)
    ) {
      setSelectedStudentId(filteredStudentOptions[0].id);
    }
  }, [searchStudent, filteredStudentOptions, selectedStudentId]);

  const monthLabel = `${NAMA_BULAN[selectedMonth]} ${selectedYear}`;

  // Santri terpilih untuk mode individual
  const activeStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || students[0] || null;
  }, [students, selectedStudentId]);

  // State data lengkap dari Firestore (tanpa terpotong limit(50) dan termasuk Jejak Harian)
  const [fetchedPoinLogs, setFetchedPoinLogs] = useState<PoinLogRow[]>([]);
  const [fetchedHarianLogs, setFetchedHarianLogs] = useState<JejakHarianRow[]>([]);
  const [loadingRekap, setLoadingRekap] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [ttdOrtuStatus, setTtdOrtuStatus] = useState<{ signed: boolean; ttdUrl?: string; mingguKe: number } | null>(null);

  const [kopConfig, setKopConfig] = useState<SchoolConfig>(loadLocalSchoolConfig);
  const [showKopEditor, setShowKopEditor] = useState<boolean>(false);
  const [savingKopServer, setSavingKopServer] = useState<boolean>(false);
  const [kopSaveNote, setKopSaveNote] = useState<string | null>(null);
  const isAdmin = canManageMasterData(userRole);

  useEffect(() => {
    return subscribeSchoolConfig(setKopConfig);
  }, []);

  const updateKopField = (field: keyof SchoolConfig, value: string) => {
    setKopSaveNote(null);
    setKopConfig((prev) => {
      const next = { ...prev, [field]: value };
      saveLocalSchoolConfig(next);
      return next;
    });
  };

  const handleSaveKopToServer = async () => {
    if (!isAdmin) return;
    setSavingKopServer(true);
    setKopSaveNote(null);
    try {
      await saveSchoolConfigToServer(kopConfig);
      setKopSaveNote('Tersimpan permanen ke server untuk semua akun.');
    } catch (err) {
      setKopSaveNote(
        'Gagal menyimpan ke server: ' + (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setSavingKopServer(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const isAllScope = canSeeAllStudents(userRole);
    const isRayonScope = userRole === 'pembimbing_rayon' && Boolean(myRayonId);

    if (!isAllScope && !isRayonScope) {
      setFetchedPoinLogs([]);
      setFetchedHarianLogs([]);
      return;
    }
    if (mode === 'individual' && !activeStudent?.id) {
      setFetchedPoinLogs([]);
      setFetchedHarianLogs([]);
      return;
    }

    const loadMonthlyData = async () => {
      setLoadingRekap(true);
      setFetchError(null);
      try {
        const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        const startTs = Timestamp.fromDate(new Date(selectedYear, selectedMonth, 1, 0, 0, 0));
        const endTs = Timestamp.fromDate(
          new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)
        );

        let poinQuery;
        let harianQuery;

        if (mode === 'individual' && activeStudent?.id) {
          if (isAllScope) {
            poinQuery = query(collection(db, 'poin_log'), where('siswa_id', '==', activeStudent.id));
            harianQuery = query(
              collection(db, 'pembiasaan_harian'),
              where('student_id', '==', activeStudent.id)
            );
          } else {
            poinQuery = query(collection(db, 'poin_log'), where('rayon', '==', myRayonId));
            harianQuery = query(
              collection(db, 'pembiasaan_harian'),
              where('rayon', '==', myRayonId)
            );
          }
        } else {
          if (isAllScope) {
            poinQuery = query(
              collection(db, 'poin_log'),
              where('createdAt', '>=', startTs),
              where('createdAt', '<=', endTs)
            );
            harianQuery = query(
              collection(db, 'pembiasaan_harian'),
              where('tanggal', '>=', `${monthPrefix}-01`),
              where('tanggal', '<=', `${monthPrefix}-31`)
            );
          } else {
            poinQuery = query(collection(db, 'poin_log'), where('rayon', '==', myRayonId));
            harianQuery = query(
              collection(db, 'pembiasaan_harian'),
              where('rayon', '==', myRayonId)
            );
          }
        }

        const [poinSnap, harianSnap] = await Promise.all([
          getDocs(poinQuery),
          getDocs(harianQuery),
        ]);

        if (cancelled) return;

        let loadedPoin = poinSnap.docs.map((d) => mapPoinLogDoc(d.id, d.data() as Record<string, any>));
        let loadedHarian = harianSnap.docs.map((d) =>
          mapJejakDoc(d.id, d.data() as Record<string, any>)
        );

        if (mode === 'individual' && activeStudent?.id) {
          loadedPoin = loadedPoin.filter((p) => p.studentId === activeStudent.id);
          loadedHarian = loadedHarian.filter((h) => h.studentId === activeStudent.id);
        }

        setFetchedPoinLogs(loadedPoin);
        setFetchedHarianLogs(loadedHarian);

        // Cek status TTD Orang Tua pekan ini pada mode individual
        if (mode === 'individual' && activeStudent?.id) {
          const targetWeek = isoWeekNumber(new Date());
          const mingguanQ = isAllScope
            ? query(collection(db, 'pembiasaan_mingguan'), where('siswa_id', '==', activeStudent.id))
            : query(collection(db, 'pembiasaan_mingguan'), where('rayon', '==', myRayonId));
          const mingguanSnap = await getDocs(mingguanQ).catch(() => null);
          if (!cancelled && mingguanSnap) {
            const match = mingguanSnap.docs
              .map((d) => d.data() as any)
              .find(
                (m) =>
                  m.siswa_id === activeStudent.id &&
                  Number(m.minggu_ke) === targetWeek &&
                  Number(m.tahun) === now.getFullYear()
              );
            setTtdOrtuStatus({
              signed: Boolean(match?.ttd_ortu),
              ttdUrl: typeof match?.ttd_url === 'string' ? match.ttd_url : undefined,
              mingguKe: targetWeek,
            });
          }
        } else if (!cancelled) {
          setTtdOrtuStatus(null);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(
            'Sebagian riwayat tidak dapat dimuat dari server: ' +
              (err instanceof Error ? err.message : String(err))
          );
        }
      } finally {
        if (!cancelled) setLoadingRekap(false);
      }
    };

    loadMonthlyData();
    return () => {
      cancelled = true;
    };
  }, [mode, activeStudent?.id, selectedMonth, selectedYear, userRole, myRayonId]);

  // Gabungkan poin_log realtime + hasil fetch lengkap (deduplikasi by ID)
  const mergedPoinLogs = useMemo(() => {
    const byId = new Map<string, PoinLogRow>();
    poinLogs.forEach((l) => byId.set(l.id, l));
    fetchedPoinLogs.forEach((l) => byId.set(l.id, l));
    return Array.from(byId.values());
  }, [poinLogs, fetchedPoinLogs]);

  // Riwayat terpadu milik santri terpilih pada bulan terpilih (Guru/BK + Jejak Harian + Prestasi)
  const studentLogsInMonth = useMemo(() => {
    if (!activeStudent) return [];
    const unified = gabungkanRiwayatPoin({
      poinLogs: mergedPoinLogs,
      harianLogs: fetchedHarianLogs,
      prestasiList,
      studentId: activeStudent.id,
    });
    return filterRiwayatBulan(unified, selectedMonth, selectedYear);
  }, [activeStudent, mergedPoinLogs, fetchedHarianLogs, prestasiList, selectedMonth, selectedYear]);

  // Ringkasan per sumber poin bulan ini (individual)
  const individualTotals = useMemo(
    () => hitungRingkasanBulan(studentLogsInMonth),
    [studentLogsInMonth]
  );

  // Data santri per kelas untuk mode kolektif
  const kelasStudents = useMemo(() => {
    if (selectedKelas === 'Semua Kelas') return students;
    return students.filter((s) => s.kelas === selectedKelas);
  }, [students, selectedKelas]);

  // Gabungan semua mutasi bulan terpilih untuk efisiensi agregasi kolektif
  const allMonthLogsByStudent = useMemo(() => {
    const unifiedAll = gabungkanRiwayatPoin({
      poinLogs: mergedPoinLogs,
      harianLogs: fetchedHarianLogs,
      prestasiList,
    });
    const monthOnly = filterRiwayatBulan(unifiedAll, selectedMonth, selectedYear);
    const map = new Map<string, UnifiedPoinRow[]>();
    monthOnly.forEach((row) => {
      const list = map.get(row.studentId) ?? [];
      list.push(row);
      map.set(row.studentId, list);
    });
    return map;
  }, [mergedPoinLogs, fetchedHarianLogs, prestasiList, selectedMonth, selectedYear]);

  // Rekapitulasi per santri dalam kelas untuk bulan terpilih
  const kolektifRows = useMemo(() => {
    return kelasStudents.map((s, idx) => {
      const logs = allMonthLogsByStudent.get(s.id) ?? [];
      const sum = hitungRingkasanBulan(logs);
      const predikat = getPredikatKarakter(s.points).label;

      return {
        no: idx + 1,
        id: s.id,
        nisn: s.nisn || '-',
        name: s.name,
        kelas: s.kelas,
        rayon: s.rayon,
        totalPoints: s.points,
        jejakBulanIni: sum.jejakHarian,
        prestasiBulanIni: sum.prestasi,
        guruApresiasiBulanIni: sum.guruApresiasi,
        apresiasiBulanIni: sum.apresiasi,
        konsekuensiBulanIni: sum.konsekuensi,
        netBulanIni: sum.net,
        predikat,
      };
    });
  }, [kelasStudents, allMonthLogsByStudent]);

  // Handler cetak
  const handlePrint = () => {
    window.print();
  };

  // Handler Excel Individual
  const handleExportIndividualExcel = () => {
    if (!activeStudent) return;
    exportRekapSiswaExcel(
      {
        name: activeStudent.name,
        nisn: activeStudent.nisn,
        kelas: activeStudent.kelas,
        rayon: activeStudent.rayon,
        points: activeStudent.points,
        waliName: activeStudent.waliName,
      },
      studentLogsInMonth.map((l) => ({
        kode: l.kode,
        tipe: l.tipe,
        deskripsi: l.deskripsi,
        poin: l.poin,
        time: l.time,
        sumber: l.sumber,
        sumberLabel: l.sumberLabel,
      })),
      monthLabel,
      {
        jejakHarian: individualTotals.jejakHarian,
        prestasi: individualTotals.prestasi,
        guruApresiasi: individualTotals.guruApresiasi,
        konsekuensi: individualTotals.konsekuensi,
      },
      kopConfig.sekolah
    );
  };

  // Handler Excel Kolektif
  const handleExportKolektifExcel = () => {
    exportRekapKelasExcel(selectedKelas, monthLabel, kolektifRows, kopConfig.sekolah);
  };

  return (
    <div className="space-y-6">
      {/* ── KONTROL & FILTER (DISEMBUNYIKAN SAAT CETAK / PDF) ── */}
      <section className="print-hide bg-white rounded-2xl p-5 border border-green-100 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-[#1B5E20]" />
              <span>Rekap & Cetak Bulanan Jejak</span>
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Menggabungkan riwayat Jejak Harian, Prestasi terverifikasi, dan catatan Guru/BK dalam format siap cetak (PDF) & Excel (.xlsx).
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('individual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                mode === 'individual'
                  ? 'bg-white text-[#1B5E20] font-bold shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Laporan Per Santri</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('kolektif')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                mode === 'kolektif'
                  ? 'bg-white text-[#1B5E20] font-bold shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Rekap Kolektif Kelas</span>
            </button>
          </div>
        </div>

        {/* Baris Filter & Tombol Ekspor */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs items-center">
          {/* Pilihan Bulan & Tahun */}
          <div className="md:col-span-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:border-[#2E7D32] flex-1"
            >
              {NAMA_BULAN.map((m, idx) => (
                <option key={m} value={idx}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:border-[#2E7D32] w-20"
            >
              <option value={currentYear}>{currentYear}</option>
              <option value={currentYear - 1}>{currentYear - 1}</option>
            </select>
          </div>

          {/* Filter Santri atau Kelas sesuai Mode */}
          {mode === 'individual' ? (
            <div className="md:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  placeholder="Cari nama / NISN / kelas..."
                  className="pl-8 pr-2.5 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32] w-full"
                />
              </div>
              <select
                value={activeStudent?.id ?? selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:border-[#2E7D32] w-full"
              >
                {filteredStudentOptions.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.kelas} - {st.points} Pts)
                  </option>
                ))}
                {filteredStudentOptions.length === 0 && (
                  <option value="">Santri tidak ditemukan</option>
                )}
              </select>
            </div>
          ) : (
            <div className="md:col-span-5 flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
                className="p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:border-[#2E7D32] w-full"
              >
                <option value="Semua Kelas">Semua Rombel ({students.length} Santri)</option>
                {daftarKelas.map((k) => (
                  <option key={k} value={k}>
                    Kelas {k}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tombol Aksi: Cetak / PDF & Excel */}
          <div className="md:col-span-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all text-xs"
              title="Cetak langsung ke printer atau Simpan sebagai PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF</span>
            </button>

            <button
              type="button"
              onClick={mode === 'individual' ? handleExportIndividualExcel : handleExportKolektifExcel}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#1B5E20] border border-emerald-300 font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all text-xs"
              title="Unduh data dalam format spreadsheet Microsoft Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Unduh Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowKopEditor((v) => !v)}
            className="text-xs font-semibold text-gray-600 hover:text-[#1B5E20] flex items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{showKopEditor ? 'Tutup Pengaturan Kop Sekolah' : 'Sesuaikan Kop Sekolah & Penandatangan'}</span>
          </button>
          {mode === 'kolektif' && selectedKelas === 'Semua Kelas' && kolektifRows.length > 200 && (
            <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Jumlah data &gt;200 santri: disarankan filter per kelas sebelum cetak PDF agar dokumen lebih ringan.</span>
            </span>
          )}
        </div>

        {showKopEditor && (
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Nama Yayasan / Lembaga</label>
                <input
                  type="text"
                  value={kopConfig.yayasan}
                  onChange={(e) => updateKopField('yayasan', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#2E7D32]"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Nama Sekolah / Pondok</label>
                <input
                  type="text"
                  value={kopConfig.sekolah}
                  onChange={(e) => updateKopField('sekolah', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#2E7D32]"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Subjudul / NPSN / Program</label>
                <input
                  type="text"
                  value={kopConfig.subjudul}
                  onChange={(e) => updateKopField('subjudul', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#2E7D32]"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Alamat & Kontak Kop</label>
                <input
                  type="text"
                  value={kopConfig.alamat}
                  onChange={(e) => updateKopField('alamat', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#2E7D32]"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Kota Tanda Tangan</label>
                <input
                  type="text"
                  value={kopConfig.kota}
                  onChange={(e) => updateKopField('kota', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#2E7D32]"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Jabatan Penandatangan</label>
                <input
                  type="text"
                  value={kopConfig.jabatanPenandatangan}
                  onChange={(e) => updateKopField('jabatanPenandatangan', e.target.value)}
                  placeholder="Waka Kesiswaan / Kepala Sekolah"
                  className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#2E7D32]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-gray-600 mb-1">
                  Nama Waka Kesiswaan / Kepala Sekolah (Tampil di Kolom Pengesahan)
                </label>
                <input
                  type="text"
                  value={kopConfig.kepalaSekolah}
                  onChange={(e) => updateKopField('kepalaSekolah', e.target.value)}
                  placeholder="Ketik nama & gelar penandatangan (kosongkan jika ingin diisi manual setelah cetak)"
                  className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#2E7D32]"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-200">
              <span className="text-[11px] text-gray-500">
                {isAdmin
                  ? 'Perubahan otomatis diterapkan ke pratinjau cetak. Klik tombol di samping untuk menyimpan permanen ke server.'
                  : 'Perubahan otomatis tersimpan di perangkat ini. Pengaturan permanen sekolah dikelola oleh Admin di Panel Admin → Master Data.'}
              </span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleSaveKopToServer}
                  disabled={savingKopServer}
                  className="px-3 py-1.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold rounded-lg text-[11px] disabled:bg-gray-300"
                >
                  {savingKopServer ? 'Menyimpan...' : 'Simpan Permanen ke Server'}
                </button>
              )}
            </div>
            {kopSaveNote && (
              <p className="text-[11px] font-semibold text-emerald-700">{kopSaveNote}</p>
            )}
          </div>
        )}

        {loadingRekap && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Mengambil riwayat lengkap Jejak Harian, Prestasi, dan Poin Guru/BK bulan {monthLabel}...</span>
          </div>
        )}

        {fetchError && (
          <div className="text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
            {fetchError}
          </div>
        )}
      </section>

      {/* ── AREA LEMBAR LAPORAN (PRINTABLE SHEET DENGAN KOP RESMI) ── */}
      <div className="print-area bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
        {/* KOP SURAT RESMI SEKOLAH */}
        <div className="border-b-2 border-gray-800 pb-3 text-center relative">
          <div className="flex items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#1B5E20] text-white flex items-center justify-center font-bold text-xl border-2 border-emerald-600 shrink-0">
              <BookOpen className="w-7 h-7 text-emerald-200" />
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                {kopConfig.yayasan}
              </p>
              <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight leading-tight">
                {kopConfig.sekolah}
              </h2>
              <p className="text-[11px] text-gray-600 font-medium">
                {kopConfig.subjudul}
              </p>
              <p className="text-[10px] text-gray-500">
                {kopConfig.alamat}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-gray-300 text-center">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-gray-800">
              {mode === 'individual'
                ? `LEMBAR REKAPITULASI JEJAK KARAKTER & POIN PEMBIASAAN (JEJAK)`
                : `REKAPITULASI KOLEKTIF JEJAK KARAKTER SANTRI - KELAS ${selectedKelas.toUpperCase()}`}
            </h3>
            <p className="text-xs font-semibold text-gray-600 mt-0.5">
              PERIODE BULAN: {monthLabel.toUpperCase()}
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            TAMPILAN MODE 1: LAPORAN PER SANTRI (INDIVIDUAL)
            ══════════════════════════════════════════════════════════════ */}
        {mode === 'individual' && activeStudent && (
          <div className="space-y-6">
            {/* Kartu Identitas Santri & Ringkasan Poin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Kolom 1: Data Santri */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-1.5">
                <span className="font-bold text-gray-900 text-xs uppercase tracking-wider block border-b border-gray-200 pb-1 mb-2">
                  Identitas Santri
                </span>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-gray-500 font-medium">Nama Lengkap</span>
                  <span className="col-span-2 font-bold text-gray-900">: {activeStudent.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-gray-500 font-medium">NISN</span>
                  <span className="col-span-2 font-bold text-gray-800">: {activeStudent.nisn || '-'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-gray-500 font-medium">Kelas / Rombel</span>
                  <span className="col-span-2 font-semibold text-gray-800">: {activeStudent.kelas}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-gray-500 font-medium">Rayon Asrama</span>
                  <span className="col-span-2 font-semibold text-gray-800">: Rayon {activeStudent.rayon}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-gray-500 font-medium">Nama Wali</span>
                  <span className="col-span-2 font-semibold text-gray-800">: {activeStudent.waliName || '-'}</span>
                </div>
                {ttdOrtuStatus && (
                  <div className="grid grid-cols-3 gap-1 pt-1 border-t border-gray-200">
                    <span className="text-gray-500 font-medium">TTD Wali Pekan {ttdOrtuStatus.mingguKe}</span>
                    <span className="col-span-2 font-bold">
                      :{' '}
                      {ttdOrtuStatus.signed ? (
                        <span className="text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Sudah Ditandatangani
                        </span>
                      ) : (
                        <span className="text-amber-700">Belum Ditandatangani</span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Kolom 2: Akumulasi Poin Bulan Ini & Sumber Perolehan */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-1.5">
                <span className="font-bold text-gray-900 text-xs uppercase tracking-wider block border-b border-gray-200 pb-1 mb-2">
                  Status & Sumber Poin {monthLabel}
                </span>
                <div className="grid grid-cols-2 gap-2 pb-2">
                  <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                    <span className="text-[10px] text-gray-500 block uppercase font-bold">Total Poin Saat Ini</span>
                    <span className="text-xl font-black text-[#1B5E20]">{activeStudent.points} Pts</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                    <span className="text-[10px] text-gray-500 block uppercase font-bold">Predikat Karakter</span>
                    <span className="text-xs font-bold text-gray-800 mt-1 block">
                      {getPredikatKarakter(activeStudent.points).label}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 pt-1 border-t border-gray-200">
                  <span className="text-gray-600">Jejak Harian</span>
                  <span className="col-span-2 font-bold text-sky-700">: +{individualTotals.jejakHarian} Pts</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-gray-600">Prestasi Terverifikasi</span>
                  <span className="col-span-2 font-bold text-amber-700">: +{individualTotals.prestasi} Pts</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-gray-600">Apresiasi Guru / BK</span>
                  <span className="col-span-2 font-bold text-emerald-700">: +{individualTotals.guruApresiasi} Pts</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-gray-600">Konsekuensi</span>
                  <span className="col-span-2 font-bold text-rose-700">: -{individualTotals.konsekuensi} Pts</span>
                </div>
                <div className="grid grid-cols-3 gap-1 pt-1 border-t border-gray-200">
                  <span className="text-gray-800 font-semibold">Mutasi Bersih Bulan Ini</span>
                  <span className="col-span-2 font-black text-gray-900">
                    : {individualTotals.net >= 0 ? `+${individualTotals.net}` : `${individualTotals.net}`} Pts
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-[11px] text-emerald-950">
              <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                <strong>Asal Perolehan Poin:</strong> Saldo awal santri baru adalah <strong>1.000 poin</strong>, kemudian bertambah/berkurang otomatis dari pengisian <strong>Jejak Harian</strong>, pengajuan <strong>Prestasi yang diverifikasi Guru/BK</strong>, serta catatan <strong>Apresiasi/Konsekuensi</strong> oleh Guru/Pembimbing Rayon.
              </span>
            </div>

            {/* Tabel Rincian Catatan Perilaku & Poin */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Rincian Riwayat Mutasi Poin ({studentLogsInMonth.length} Catatan)
              </h4>
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold">
                      <th className="p-2.5 text-center w-10">No</th>
                      <th className="p-2.5 w-32">Tanggal / Waktu</th>
                      <th className="p-2.5 w-28">Sumber Poin</th>
                      <th className="p-2.5 w-20">Kode</th>
                      <th className="p-2.5">Deskripsi Jejak / Prestasi / Catatan Guru</th>
                      <th className="p-2.5 text-center w-24">Jenis</th>
                      <th className="p-2.5 text-right w-20">Poin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {studentLogsInMonth.map((log, idx) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="p-2.5 text-center text-gray-500 font-medium">{idx + 1}</td>
                        <td className="p-2.5 text-gray-600 whitespace-nowrap">{log.time}</td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${getSumberBadgeClass(log.sumber)}`}>
                            {log.sumberLabel}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold font-mono text-gray-700">{log.kode}</td>
                        <td className="p-2.5 text-gray-800">{log.deskripsi}</td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.tipe === 'apresiasi'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {log.tipe === 'apresiasi' ? 'Apresiasi' : 'Konsekuensi'}
                          </span>
                        </td>
                        <td
                          className={`p-2.5 text-right font-black tabular ${
                            log.tipe === 'apresiasi' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {log.tipe === 'apresiasi' ? `+${log.poin}` : `-${log.poin}`}
                        </td>
                      </tr>
                    ))}
                    {studentLogsInMonth.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-gray-400 italic">
                          Tidak ada catatan Jejak Harian, Prestasi terverifikasi, maupun poin Guru/BK pada bulan {monthLabel}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Catatan Bimbingan Karakter */}
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1">
              <span className="font-bold text-gray-800 block">Catatan Bimbingan & Arahan Pembimbing / Guru BK:</span>
              <p className="text-gray-600 italic">
                {activeStudent.points >= 1000
                  ? 'Alhamdulillah, ananda menunjukkan integritas dan pembiasaan karakter yang sangat terpuji. Pertahankan istiqomah dalam ibadah dan teladan bagi santri lainnya.'
                  : activeStudent.points >= 800
                  ? 'Ananda telah berusaha dengan baik. Diharapkan senantiasa menjaga kedisiplinan sholat berjamaah, dzikir, serta tertib aturan asrama.'
                  : 'Ananda memerlukan pembinaan intensif dan motivasi lebih dalam memperbaiki kedisiplinan serta mengejar ketertinggalan poin karakter target 1.000.'}
              </p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAMPILAN MODE 2: REKAPITULASI KOLEKTIF KELAS
            ══════════════════════════════════════════════════════════════ */}
        {mode === 'kolektif' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-200">
              <span>
                Jumlah Santri: <strong>{kolektifRows.length} Orang</strong> • Kelas:{' '}
                <strong>{selectedKelas}</strong>
              </span>
              <span>
                Jejak:{' '}
                <strong className="text-sky-700">
                  +{kolektifRows.reduce((acc, r) => acc + r.jejakBulanIni, 0)}
                </strong>{' '}
                • Prestasi:{' '}
                <strong className="text-amber-700">
                  +{kolektifRows.reduce((acc, r) => acc + r.prestasiBulanIni, 0)}
                </strong>{' '}
                • Guru:{' '}
                <strong className="text-emerald-700">
                  +{kolektifRows.reduce((acc, r) => acc + r.guruApresiasiBulanIni, 0)}
                </strong>{' '}
                • Konsekuensi:{' '}
                <strong className="text-rose-700">
                  -{kolektifRows.reduce((acc, r) => acc + r.konsekuensiBulanIni, 0)}
                </strong>
              </span>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold">
                    <th className="p-2.5 text-center w-10">No</th>
                    <th className="p-2.5 w-24">NISN</th>
                    <th className="p-2.5">Nama Santri</th>
                    <th className="p-2.5 w-20">Kelas</th>
                    <th className="p-2.5 w-28">Rayon</th>
                    <th className="p-2.5 text-right w-20">Total Poin</th>
                    <th className="p-2.5 text-right w-16">Jejak</th>
                    <th className="p-2.5 text-right w-16">Prestasi</th>
                    <th className="p-2.5 text-right w-16">Guru (+)</th>
                    <th className="p-2.5 text-right w-18">Konsek (-)</th>
                    <th className="p-2.5 text-right w-20">Bersih</th>
                    <th className="p-2.5 w-36">Predikat Karakter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {kolektifRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="p-2.5 text-center text-gray-500 font-medium">{row.no}</td>
                      <td className="p-2.5 font-mono text-gray-600">{row.nisn}</td>
                      <td className="p-2.5 font-bold text-gray-900">{row.name}</td>
                      <td className="p-2.5 text-gray-700">{row.kelas}</td>
                      <td className="p-2.5 text-gray-600">{row.rayon}</td>
                      <td className="p-2.5 text-right font-black text-[#1B5E20] tabular">{row.totalPoints}</td>
                      <td className="p-2.5 text-right font-semibold text-sky-700 tabular">
                        +{row.jejakBulanIni}
                      </td>
                      <td className="p-2.5 text-right font-semibold text-amber-700 tabular">
                        +{row.prestasiBulanIni}
                      </td>
                      <td className="p-2.5 text-right font-semibold text-emerald-700 tabular">
                        +{row.guruApresiasiBulanIni}
                      </td>
                      <td className="p-2.5 text-right font-semibold text-rose-700 tabular">
                        -{row.konsekuensiBulanIni}
                      </td>
                      <td
                        className={`p-2.5 text-right font-black tabular ${
                          row.netBulanIni >= 0 ? 'text-emerald-800' : 'text-rose-800'
                        }`}
                      >
                        {row.netBulanIni >= 0 ? `+${row.netBulanIni}` : row.netBulanIni}
                      </td>
                      <td className="p-2.5 text-gray-700 font-medium">{row.predikat}</td>
                    </tr>
                  ))}
                  {kolektifRows.length === 0 && (
                    <tr>
                      <td colSpan={12} className="p-6 text-center text-gray-400 italic">
                        Belum ada data santri pada kelas ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── LEMBAR PENGESAHAN RESMI (TANDA TANGAN) ── */}
        <div className="pt-6 border-t border-gray-300 grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <p className="text-gray-600">Mengetahui,</p>
            <p className="font-bold text-gray-900 mt-0.5">Orang Tua / Wali Santri</p>
            <div className="h-16 flex items-end justify-center">
              {mode === 'individual' && ttdOrtuStatus?.ttdUrl ? (
                <img src={ttdOrtuStatus.ttdUrl} alt="TTD Wali" className="max-h-14 object-contain" />
              ) : (
                <span className="text-[10px] text-gray-400 italic">(Tanda Tangan)</span>
              )}
            </div>
            <p className="font-semibold text-gray-900 border-t border-gray-400 pt-1 mx-4">
              {mode === 'individual' && activeStudent?.waliName
                ? activeStudent.waliName
                : '( ........................................ )'}
            </p>
          </div>

          <div>
            <p className="text-gray-600">Diperiksa Oleh,</p>
            <p className="font-bold text-gray-900 mt-0.5">Guru BK / Pembimbing Rayon</p>
            <div className="h-16 flex items-end justify-center">
              <span className="text-[10px] text-gray-400 italic">(Tanda Tangan)</span>
            </div>
            <p className="font-semibold text-gray-900 border-t border-gray-400 pt-1 mx-4">
              ( ........................................ )
            </p>
          </div>

          <div>
            <p className="text-gray-600">
              {kopConfig.kota || 'Pasuruan'}, {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}
            </p>
            <p className="font-bold text-gray-900 mt-0.5">
              {kopConfig.jabatanPenandatangan || 'Waka Kesiswaan / Kepala Sekolah'}
            </p>
            <div className="h-16 flex items-end justify-center">
              <span className="text-[10px] text-gray-400 italic">(Stempel & TTD)</span>
            </div>
            <p className="font-semibold text-gray-900 border-t border-gray-400 pt-1 mx-4">
              {kopConfig.kepalaSekolah.trim() || '( ........................................ )'}
            </p>
            <button
              type="button"
              onClick={() => {
                setShowKopEditor(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="print-hide mt-1.5 text-[11px] font-semibold text-[#1B5E20] hover:underline"
            >
              ✎ Isi / Ubah Nama Penandatangan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RekapBulananGuru;
