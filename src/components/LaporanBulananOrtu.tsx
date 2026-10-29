/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  TrendingUp, 
  Award, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  Sparkles, 
  FileText, 
  Printer, 
  MessageSquare, 
  ChevronRight, 
  Send, 
  Check, 
  Heart,
  ShieldCheck,
  Zap,
  Clock,
  ArrowUpRight,
  Filter
} from 'lucide-react';

interface LaporanBulananOrtuProps {
  studentName: string;
  studentKelas: string;
  studentRayon: string;
  currentPoints: number;
}

export const LaporanBulananOrtu: React.FC<LaporanBulananOrtuProps> = ({
  studentName,
  studentKelas,
  studentRayon,
  currentPoints,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<'oktober' | 'september' | 'agustus'>('oktober');
  const [activeSubTab, setActiveSubTab] = useState<'tren' | 'pembiasaan' | 'distribusi' | 'catatan'>('tren');
  const [parentFeedback, setParentFeedback] = useState('');
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Data per bulan
  const monthlyData = {
    oktober: {
      label: 'Oktober 2026',
      totalApresiasi: 2600,
      totalKonsekuensi: 150,
      netPoin: 2450,
      targetPoin: 2000,
      indeksKonsistensi: 94,
      predikat: 'Mumtaz (Sangat Baik)',
      statusKarakter: 'Menunjukkan peningkatan kemandirian ibadah dan kedisiplinan asrama yang konsisten.',
      weeklyAccumulation: [
        { week: 'Mgg 1 (1-7)', apresiasi: 650, konsekuensi: 0, netKumulatif: 650, rataRataKelas: 540 },
        { week: 'Mgg 2 (8-14)', apresiasi: 680, konsekuensi: 0, netKumulatif: 1330, rataRataKelas: 1120 },
        { week: 'Mgg 3 (15-21)', apresiasi: 620, konsekuensi: 0, netKumulatif: 1950, rataRataKelas: 1690 },
        { week: 'Mgg 4 (22-28)', apresiasi: 650, konsekuensi: 150, netKumulatif: 2450, rataRataKelas: 2210 },
      ],
      weeklyComparison: [
        { week: 'Minggu 1', Kebaikan: 650, Pelanggaran: 0 },
        { week: 'Minggu 2', Kebaikan: 680, Pelanggaran: 0 },
        { week: 'Minggu 3', Kebaikan: 620, Pelanggaran: 0 },
        { week: 'Minggu 4', Kebaikan: 650, Pelanggaran: 150 },
      ],
      habitConsistency: [
        { habit: 'Sholat Fardhu Berjamaah', persentase: 96, label: '27/28 Hari', color: '#1B5E20' },
        { habit: 'Tahajud & Dhuha', persentase: 88, label: '25/28 Hari', color: '#2E7D32' },
        { habit: 'Tilawah & Zikir Pagi-Sore', persentase: 93, label: '26/28 Hari', color: '#388E3C' },
        { habit: 'Bangun Subuh (<05.00)', persentase: 96, label: '27/28 Hari', color: '#43A047' },
        { habit: 'Tidur Awal & Hidrasi 2L', persentase: 86, label: '24/28 Hari', color: '#059669' },
        { habit: 'Kebersihan Diri & Mandi 2x', persentase: 95, label: '27/28 Hari', color: '#0D9488' },
        { habit: 'Kegiatan Rayon & Piket', persentase: 90, label: 'Aktif Penuh', color: '#0891B2' },
      ],
      categoryDistribution: [
        { name: 'Ibadah & Spiritual', value: 980, percentage: 38, color: '#1B5E20' },
        { name: 'Kedisiplinan & Tata Tertib', value: 620, percentage: 24, color: '#2E7D32' },
        { name: 'Kesehatan & Kebersihan', value: 470, percentage: 18, color: '#10B981' },
        { name: 'Prestasi & Kejuruan', value: 310, percentage: 12, color: '#F59E0B' },
        { name: 'Sosial & Rayon', value: 220, percentage: 8, color: '#0D9488' },
      ],
      highlights: [
        {
          type: 'positive',
          title: 'Lonjakan Ibadah Sunnah',
          desc: 'Konsistensi Sholat Tahajud dan Dhuha ananda naik 14% dibandingkan bulan September. Ananda senantiasa berada di shaf awal saat sholat fardhu.',
        },
        {
          type: 'positive',
          title: 'Kebugaran & Kebiasaan Sehat',
          desc: 'Mencapai kepatuhan minum air putih 1,5 - 2 Liter dan senam pagi rutin. Pemeriksaan IMT menunjukkan kategori ideal (20.5).',
        },
        {
          type: 'attention',
          title: 'Evaluasi Kedisiplinan Pekan 4',
          desc: 'Catatan minus 150 poin akibat kopyah tertinggal saat apel pagi tanggal 27 Okt. Ananda telah menyelesaikan penugasan pembiasaan murajaah 1 juz dengan sangat baik.',
        },
      ]
    },
    september: {
      label: 'September 2026',
      totalApresiasi: 2310,
      totalKonsekuensi: 200,
      netPoin: 2110,
      targetPoin: 2000,
      indeksKonsistensi: 90,
      predikat: 'Jayyid Jiddan (Baik Sekali)',
      statusKarakter: 'Adaptasi awal semester berjalan lancar dengan catatan kehadiran 100%.',
      weeklyAccumulation: [
        { week: 'Mgg 1 (1-7)', apresiasi: 580, konsekuensi: 100, netKumulatif: 480, rataRataKelas: 500 },
        { week: 'Mgg 2 (8-14)', apresiasi: 600, konsekuensi: 0, netKumulatif: 1080, rataRataKelas: 1020 },
        { week: 'Mgg 3 (15-21)', apresiasi: 550, konsekuensi: 100, netKumulatif: 1530, rataRataKelas: 1550 },
        { week: 'Mgg 4 (22-28)', apresiasi: 580, konsekuensi: 0, netKumulatif: 2110, rataRataKelas: 2050 },
      ],
      weeklyComparison: [
        { week: 'Minggu 1', Kebaikan: 580, Pelanggaran: 100 },
        { week: 'Minggu 2', Kebaikan: 600, Pelanggaran: 0 },
        { week: 'Minggu 3', Kebaikan: 550, Pelanggaran: 100 },
        { week: 'Minggu 4', Kebaikan: 580, Pelanggaran: 0 },
      ],
      habitConsistency: [
        { habit: 'Sholat Fardhu Berjamaah', persentase: 93, label: '26/28 Hari', color: '#1B5E20' },
        { habit: 'Tahajud & Dhuha', persentase: 74, label: '21/28 Hari', color: '#2E7D32' },
        { habit: 'Tilawah & Zikir Pagi-Sore', persentase: 89, label: '25/28 Hari', color: '#388E3C' },
        { habit: 'Bangun Subuh (<05.00)', persentase: 93, label: '26/28 Hari', color: '#43A047' },
        { habit: 'Tidur Awal & Hidrasi 2L', persentase: 82, label: '23/28 Hari', color: '#059669' },
        { habit: 'Kebersihan Diri & Mandi 2x', persentase: 93, label: '26/28 Hari', color: '#0D9488' },
        { habit: 'Kegiatan Rayon & Piket', persentase: 88, label: 'Aktif', color: '#0891B2' },
      ],
      categoryDistribution: [
        { name: 'Ibadah & Spiritual', value: 890, percentage: 39, color: '#1B5E20' },
        { name: 'Kedisiplinan & Tata Tertib', value: 520, percentage: 23, color: '#2E7D32' },
        { name: 'Kesehatan & Kebersihan', value: 420, percentage: 18, color: '#10B981' },
        { name: 'Prestasi & Kejuruan', value: 280, percentage: 12, color: '#F59E0B' },
        { name: 'Sosial & Rayon', value: 200, percentage: 8, color: '#0D9488' },
      ],
      highlights: [
        {
          type: 'positive',
          title: 'Kedisiplinan Apel Pagi Terjaga',
          desc: 'Ananda disiplin mengikuti apel pagi dan senam kebugaran jasmani.',
        },
        {
          type: 'attention',
          title: 'Pengingat Waktu Istirahat',
          desc: 'Tercatat beberapa kali tidur melebihi pukul 22.00 karena menyelesaikan tugas laporan farmasi dasar.',
        },
      ]
    },
    agustus: {
      label: 'Agustus 2026',
      totalApresiasi: 2150,
      totalKonsekuensi: 100,
      netPoin: 2050,
      targetPoin: 2000,
      indeksKonsistensi: 88,
      predikat: 'Jayyid Jiddan (Baik Sekali)',
      statusKarakter: 'Awal orientasi pembiasaan BKP berjalan tertib.',
      weeklyAccumulation: [
        { week: 'Mgg 1 (1-7)', apresiasi: 500, konsekuensi: 0, netKumulatif: 500, rataRataKelas: 480 },
        { week: 'Mgg 2 (8-14)', apresiasi: 540, konsekuensi: 0, netKumulatif: 1040, rataRataKelas: 990 },
        { week: 'Mgg 3 (15-21)', apresiasi: 520, konsekuensi: 100, netKumulatif: 1460, rataRataKelas: 1480 },
        { week: 'Mgg 4 (22-28)', apresiasi: 590, konsekuensi: 0, netKumulatif: 2050, rataRataKelas: 1980 },
      ],
      weeklyComparison: [
        { week: 'Minggu 1', Kebaikan: 500, Pelanggaran: 0 },
        { week: 'Minggu 2', Kebaikan: 540, Pelanggaran: 0 },
        { week: 'Minggu 3', Kebaikan: 520, Pelanggaran: 100 },
        { week: 'Minggu 4', Kebaikan: 590, Pelanggaran: 0 },
      ],
      habitConsistency: [
        { habit: 'Sholat Fardhu Berjamaah', persentase: 90, label: '25/28 Hari', color: '#1B5E20' },
        { habit: 'Tahajud & Dhuha', persentase: 70, label: '20/28 Hari', color: '#2E7D32' },
        { habit: 'Tilawah & Zikir Pagi-Sore', persentase: 86, label: '24/28 Hari', color: '#388E3C' },
        { habit: 'Bangun Subuh (<05.00)', persentase: 90, label: '25/28 Hari', color: '#43A047' },
        { habit: 'Tidur Awal & Hidrasi 2L', persentase: 80, label: '22/28 Hari', color: '#059669' },
        { habit: 'Kebersihan Diri & Mandi 2x', persentase: 90, label: '25/28 Hari', color: '#0D9488' },
        { habit: 'Kegiatan Rayon & Piket', persentase: 85, label: 'Aktif', color: '#0891B2' },
      ],
      categoryDistribution: [
        { name: 'Ibadah & Spiritual', value: 850, percentage: 40, color: '#1B5E20' },
        { name: 'Kedisiplinan & Tata Tertib', value: 480, percentage: 22, color: '#2E7D32' },
        { name: 'Kesehatan & Kebersihan', value: 390, percentage: 18, color: '#10B981' },
        { name: 'Prestasi & Kejuruan', value: 250, percentage: 12, color: '#F59E0B' },
        { name: 'Sosial & Rayon', value: 180, percentage: 8, color: '#0D9488' },
      ],
      highlights: [
        {
          type: 'positive',
          title: 'Orientasi & Pengenalan BKP',
          desc: 'Ananda sangat cepat memahami sistem poin karakter dan aktif dalam kegiatan daur ulang pekanan.',
        },
      ]
    }
  };

  const current = monthlyData[selectedMonth];

  const handleSaveFeedback = () => {
    if (!parentFeedback.trim()) return;
    setFeedbackSaved(true);
    setTimeout(() => {
      setFeedbackSaved(false);
      setParentFeedback('');
    }, 3000);
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Header View & Filter Bulan */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-green-100 text-[#1B5E20]">
                <TrendingUp className="w-5 h-5 text-green-700" />
              </span>
              <div>
                <h2 className="text-base font-bold text-gray-800">Laporan Bulanan & Tren Karakter</h2>
                <p className="text-xs text-gray-500">
                  Evaluasi perkembangan pembiasaan BKP ananda di sekolah & asrama
                </p>
              </div>
            </div>
          </div>

          {/* Month Selector Dropdown */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-700 shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value as any)}
              className="text-xs font-semibold bg-green-50 text-[#1B5E20] border border-green-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="oktober">Oktober 2026 (Bulan Ini)</option>
              <option value="september">September 2026</option>
              <option value="agustus">Agustus 2026</option>
            </select>
          </div>
        </div>

        {/* Info Siswa & Status Predikat */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
          <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 block font-medium">Nama Siswa</span>
            <span className="font-bold text-gray-800 truncate block">{studentName}</span>
          </div>
          <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 block font-medium">Kelas / Rayon</span>
            <span className="font-bold text-gray-800 truncate block">{studentKelas} • {studentRayon}</span>
          </div>
          <div className="bg-green-50/80 p-2.5 rounded-xl border border-green-200">
            <span className="text-[10px] text-green-700 block font-medium">Predikat Karakter</span>
            <span className="font-extrabold text-[#1B5E20]">{current.predikat}</span>
          </div>
          <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
            <span className="text-[10px] text-emerald-700 block font-medium">Indeks Konsistensi</span>
            <span className="font-extrabold text-emerald-800 flex items-center gap-1">
              {current.indeksKonsistensi}% <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </span>
          </div>
        </div>
      </div>

      {/* 4 Kartu Agregasi Poin Bulan Ini */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-green-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-semibold">Net Poin Bulan Ini</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-[#1B5E20]">
            +{current.netPoin.toLocaleString()}
          </div>
          <div className="text-[10px] text-green-700 font-medium flex items-center gap-0.5 mt-1">
            <ArrowUpRight className="w-3 h-3 text-green-600" />
            Target: {current.targetPoin.toLocaleString()} (Tercapai)
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-green-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-semibold">Total Apresiasi</span>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-xl font-black text-green-700">
            +{current.totalApresiasi.toLocaleString()}
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            Dari 50+ pembiasaan
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-green-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-semibold">Konsekuensi</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl font-black text-red-600">
            -{current.totalKonsekuensi}
          </div>
          <div className="text-[10px] text-red-500 mt-1 font-medium">
            {current.totalKonsekuensi > 0 ? '1 Catatan (Selesai)' : '0 Pelanggaran'}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-green-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-semibold">Total Poin Akumulasi</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-gray-900">
            {currentPoints.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-700 mt-1 font-medium">
            Peringkat Rayon: #3
          </div>
        </div>
      </div>

      {/* Sub Tabs Selector */}
      <div className="bg-gray-100/90 p-1 rounded-xl flex items-center justify-between text-xs font-semibold text-gray-600">
        <button
          onClick={() => setActiveSubTab('tren')}
          className={`flex-1 py-2 px-2 rounded-lg transition-all text-center ${
            activeSubTab === 'tren'
              ? 'bg-white text-[#1B5E20] shadow-sm font-bold'
              : 'hover:text-gray-900'
          }`}
        >
          📈 Akumulasi Mingguan
        </button>
        <button
          onClick={() => setActiveSubTab('pembiasaan')}
          className={`flex-1 py-2 px-2 rounded-lg transition-all text-center ${
            activeSubTab === 'pembiasaan'
              ? 'bg-white text-[#1B5E20] shadow-sm font-bold'
              : 'hover:text-gray-900'
          }`}
        >
          ✅ Konsistensi Harian
        </button>
        <button
          onClick={() => setActiveSubTab('distribusi')}
          className={`flex-1 py-2 px-2 rounded-lg transition-all text-center ${
            activeSubTab === 'distribusi'
              ? 'bg-white text-[#1B5E20] shadow-sm font-bold'
              : 'hover:text-gray-900'
          }`}
        >
          🥧 Pilar Karakter
        </button>
        <button
          onClick={() => setActiveSubTab('catatan')}
          className={`flex-1 py-2 px-2 rounded-lg transition-all text-center ${
            activeSubTab === 'catatan'
              ? 'bg-white text-[#1B5E20] shadow-sm font-bold'
              : 'hover:text-gray-900'
          }`}
        >
          💬 Catatan & Ulasan
        </button>
      </div>

      {/* TAB 1: GRAFIK TREN AKUMULASI POIN MINGGUAN DENGAN RECHARTS */}
      {activeSubTab === 'tren' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
            <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-green-700" />
                  Tren Pertumbuhan Poin Mingguan ({current.label})
                </h3>
                <p className="text-[11px] text-gray-500">
                  Perbandingan akumulasi poin ananda vs target rata-rata siswa sekelas
                </p>
              </div>
            </div>

            <div className="w-full h-64 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={current.weeklyAccumulation}
                  margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1B5E20" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#2E7D32" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9CA3AF" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#D1D5DB" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis 
                    dataKey="week" 
                    tick={{ fontSize: 10, fill: '#6B7280' }} 
                    axisLine={{ stroke: '#E5E7EB' }} 
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#6B7280' }} 
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#FFFFFF', 
                      borderRadius: '12px', 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                      border: '1px solid #E5E7EB',
                      fontSize: '11px' 
                    }}
                    formatter={(val: any, name: any) => [
                      `${Number(val).toLocaleString()} Pts`, 
                      name === 'netKumulatif' ? 'Poin Ananda' : 'Rata-rata Kelas'
                    ]}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={32} 
                    iconType="circle"
                    formatter={(value) => (
                      <span className="text-xs font-semibold text-gray-700">
                        {value === 'netKumulatif' ? 'Akumulasi Poin Ananda' : 'Rata-rata Kelas'}
                      </span>
                    )}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="netKumulatif" 
                    stroke="#1B5E20" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorNet)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="rataRataKelas" 
                    stroke="#9CA3AF" 
                    strokeWidth={2} 
                    strokeDasharray="4 4" 
                    fillOpacity={0.4} 
                    fill="url(#colorAvg)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 p-3 rounded-xl bg-green-50/70 border border-green-100 flex items-start gap-2 text-xs text-green-900">
              <Sparkles className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
              <span>
                <strong>Analisis Tren:</strong> Poin ananda secara konsisten berada di atas rata-rata kelas sepanjang bulan. Pertumbuhan tertinggi tercatat di Pekan 2 dengan raihan +680 poin pembiasaan.
              </span>
            </div>
          </div>

          {/* Perbandingan Kebaikan vs Pelanggaran Mingguan */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
            <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#2E7D32]" />
              Rasio Kebaikan vs Pelanggaran per Pekan
            </h3>
            <p className="text-[11px] text-gray-500 mb-3">
              Kebaikan (Apresiasi hijau) mendominasi, dengan tingkat pelanggaran sangat minim
            </p>

            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={current.weeklyComparison}
                  margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#6B7280' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #E5E7EB' }}
                    formatter={(val: any, name: any) => [`${val} Poin`, name]}
                  />
                  <Legend verticalAlign="top" height={28} />
                  <Bar dataKey="Kebaikan" fill="#2E7D32" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Pelanggaran" fill="#EF4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TINGKAT KONSISTENSI PEMBIASAAN HARIAN */}
      {activeSubTab === 'pembiasaan' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-700" />
                Konsistensi Indikator Pembiasaan Utama (28 Hari)
              </h3>
              <span className="text-[11px] font-bold text-[#1B5E20] bg-green-50 px-2.5 py-1 rounded-full">
                Rata-rata: {current.indeksKonsistensi}%
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mb-4">
              Persentase kepatuhan ananda pada buku saku BKP selama bulan {current.label}
            </p>

            {/* Recharts Bar Chart untuk Habit */}
            <div className="w-full h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={current.habitConsistency}
                  margin={{ top: 5, right: 30, left: 30, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#6B7280' }} unit="%" />
                  <YAxis 
                    dataKey="habit" 
                    type="category" 
                    tick={{ fontSize: 9, fill: '#374151' }} 
                    width={110} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #E5E7EB' }}
                    formatter={(val: any) => [`${val}% Kepatuhan`, 'Konsistensi']}
                  />
                  <Bar dataKey="persentase" radius={[0, 6, 6, 0]}>
                    {current.habitConsistency.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* List Rincian Pembiasaan */}
            <div className="space-y-2.5 pt-2 border-t border-gray-100">
              {current.habitConsistency.map((item, idx) => (
                <div key={idx} className="bg-gray-50/80 p-2.5 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: item.color }} 
                    />
                    <span className="font-semibold text-gray-800">{item.habit}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-500">{item.label}</span>
                    <span className="font-extrabold text-[#1B5E20] w-10 text-right">{item.persentase}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DISTRIBUSI PILAR KARAKTER (PIE CHART RECHARTS) */}
      {activeSubTab === 'distribusi' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
            <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-green-700" />
              Distribusi Poin per Dimensi Karakter BKP
            </h3>
            <p className="text-[11px] text-gray-500 mb-3">
              Proporsi perolehan poin berdasarkan 5 pilar karakter santri SMK Thibbil Qulub Assimbani
            </p>

            <div className="w-full h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={current.categoryDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {current.categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #E5E7EB' }}
                    formatter={(val: any, name: any) => [`${val} Poin (${current.categoryDistribution.find(d => d.name === name)?.percentage}%)`, name]}
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    iconType="circle"
                    formatter={(val: string) => <span className="text-[10px] text-gray-700">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Tabel Detail Pilar */}
            <div className="mt-3 divide-y divide-gray-100 border-t border-gray-100 pt-2">
              {current.categoryDistribution.map((item, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-800 font-medium">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-900">{item.value} Pts</span>
                    <span className="text-[10px] text-gray-500 ml-1.5">({item.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CATATAN & HIGHLIGHT PERILAKU + FEEDBACK ORTU */}
      {activeSubTab === 'catatan' && (
        <div className="space-y-4">
          {/* Highlight Tren Perilaku */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
            <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Highlight Tren Perilaku & Catatan Wali Rayon
            </h3>
            <p className="text-[11px] text-gray-500 mb-3">
              Rangkuman perkembangan karakter ananda oleh Dewan Pembina Rayon Assimbani 1
            </p>

            <div className="space-y-2.5">
              {current.highlights.map((h, i) => (
                <div 
                  key={i} 
                  className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                    h.type === 'positive' 
                      ? 'bg-green-50/80 border-green-200 text-green-900' 
                      : 'bg-amber-50/80 border-amber-200 text-amber-900'
                  }`}
                >
                  {h.type === 'positive' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="font-bold">{h.title}</h4>
                    <p className="mt-0.5 leading-relaxed text-[11px] opacity-90">{h.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Korelasi dengan Borang Kesehatan */}
            <div className="mt-4 p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <Heart className="w-3.5 h-3.5 text-blue-700" />
                <span>Korelasi Catatan Kesehatan Jasmani</span>
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                Kondisi fisik ananda dalam sebulan terakhir sangat bugar. Tidak ada catatan mimisan, kejang, atau sakit berat. Kunjungan UKS nihil (0 kali). Kebersihan kuku, telinga, dan pakaian selalu rapi pada inspeksi pekanan.
              </p>
            </div>
          </div>

          {/* Form Tanggapan & Dukungan Orang Tua */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
            <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-green-700" />
              Tanggapan & Catatan dari Orang Tua
            </h3>
            <p className="text-[11px] text-gray-500 mb-3">
              Tuliskan pesan dukungan untuk ananda atau catatan komunikasi kepada Wali Rayon/Guru BK
            </p>

            {feedbackSaved && (
              <div className="mb-3 p-3 rounded-xl bg-green-100 text-green-800 border border-green-200 flex items-center gap-2 text-xs font-semibold">
                <Check className="w-4 h-4 text-green-700" />
                Tanggapan Anda telah tersimpan dan terkirim ke Wali Rayon!
              </div>
            )}

            <textarea
              rows={3}
              value={parentFeedback}
              onChange={(e) => setParentFeedback(e.target.value)}
              placeholder="Contoh: Alhamdulillah ananda Faiz sangat rajin sholat malam saat libur akhir pekan di rumah. Terima kasih bimbingan Ustadz/Ustadzah..."
              className="w-full p-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#2E7D32] focus:ring-2 focus:ring-green-100 outline-none transition-all placeholder:text-gray-400"
            />

            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">
                Akan dibaca oleh Ustadz Hendra Gunawan, S.Pd.I
              </span>
              <button
                onClick={handleSaveFeedback}
                disabled={!parentFeedback.trim()}
                className="py-2 px-4 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim Tanggapan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons: Cetak Ringkasan & Sahkan */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowPrintModal(true)}
          className="flex-1 py-3 px-3 bg-white hover:bg-gray-50 border border-green-200 text-[#1B5E20] font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
        >
          <Printer className="w-4 h-4 text-green-700" />
          <span>Lihat Ringkasan Cetak / PDF</span>
        </button>
      </div>

      {/* MODAL PRINT / REKAP CETAK RESMI */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl border border-green-100 text-gray-800">
            {/* Kop Resmi Sekolah */}
            <div className="text-center border-b-2 border-gray-800 pb-3 mb-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-green-900">
                YAYASAN PONDOK PESANTREN ASSIMBANI
              </div>
              <h2 className="text-base font-black text-gray-900 tracking-tight">
                SMK THIBBIL QULUB ASSIMBANI
              </h2>
              <p className="text-[10px] text-gray-600">
                Buku Kejar Prestasi (BKP) • Lembar Rekapitulasi Bulanan Karakter Santri
              </p>
            </div>

            {/* Biodata Singkat */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-xl border border-gray-200 mb-4">
              <div>
                <span className="text-[10px] text-gray-500 block">Nama Lengkap:</span>
                <span className="font-bold">{studentName}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">Periode Evaluasi:</span>
                <span className="font-bold">{current.label}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">Kelas & Program:</span>
                <span className="font-bold">{studentKelas}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">Rayon Asrama:</span>
                <span className="font-bold">{studentRayon}</span>
              </div>
            </div>

            {/* Ringkasan Skor Angka */}
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-4 text-xs">
              <div className="bg-green-900 text-white p-2.5 font-bold flex justify-between">
                <span>Indikator Penilaian</span>
                <span>Capaian</span>
              </div>
              <div className="divide-y divide-gray-200">
                <div className="p-2.5 flex justify-between">
                  <span>Total Poin Apresiasi Kebaikan</span>
                  <span className="font-bold text-green-700">+{current.totalApresiasi}</span>
                </div>
                <div className="p-2.5 flex justify-between">
                  <span>Total Poin Konsekuensi Pelanggaran</span>
                  <span className="font-bold text-red-600">-{current.totalKonsekuensi}</span>
                </div>
                <div className="p-2.5 flex justify-between bg-green-50/50">
                  <span className="font-bold">Net Poin Bulan Ini</span>
                  <span className="font-black text-[#1B5E20]">+{current.netPoin}</span>
                </div>
                <div className="p-2.5 flex justify-between">
                  <span>Indeks Konsistensi Pembiasaan</span>
                  <span className="font-bold text-gray-800">{current.indeksKonsistensi}%</span>
                </div>
                <div className="p-2.5 flex justify-between bg-amber-50/40">
                  <span className="font-bold">Predikat Akhir Bulan</span>
                  <span className="font-extrabold text-[#1B5E20]">{current.predikat}</span>
                </div>
              </div>
            </div>

            {/* Tanda Tangan 3 Pihak */}
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] pt-2 border-t border-gray-200 mb-4">
              <div>
                <span className="text-gray-500 block mb-8">Wali Rayon</span>
                <span className="font-bold block border-t border-gray-300 pt-1">Ust. Hendra G.</span>
              </div>
              <div>
                <span className="text-gray-500 block mb-8">Guru BK</span>
                <span className="font-bold block border-t border-gray-300 pt-1">Hj. Maryam, S.Psi</span>
              </div>
              <div>
                <span className="text-gray-500 block mb-8">Orang Tua / Wali</span>
                <span className="font-bold block border-t border-gray-300 pt-1">Bpk. Ahmad Rifa'i</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Lembar Rekap</span>
              </button>
              <button
                onClick={() => setShowPrintModal(false)}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaporanBulananOrtu;
