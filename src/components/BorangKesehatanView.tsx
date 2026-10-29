import React, { useState } from 'react';
import { 
  HeartPulse, 
  Activity, 
  Smile, 
  AlertTriangle, 
  Plus, 
  Save, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Stethoscope, 
  FileCheck, 
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { BorangKesehatan, KunjunganUKS, KalenderMenstruasi } from '../lib/supabase';

interface BorangKesehatanViewProps {
  role: 'siswa' | 'orang_tua' | 'guru';
  studentName?: string;
  studentKelas?: string;
  readOnly?: boolean;
}

export const BorangKesehatanView: React.FC<BorangKesehatanViewProps> = ({
  role,
  studentName = 'Ahmad Fadhil Assimbani',
  studentKelas = 'X TKJ 1 / Rayon Simbang 2',
  readOnly = false,
}) => {
  const [periode, setPeriode] = useState('MEB 1 s.d. 9 | Periode STS Ganjil');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'fisik_gigi' | 'riwayat_uks' | 'menstruasi'>('fisik_gigi');

  // Form Borang Kesehatan
  const [kesehatan, setKesehatan] = useState<BorangKesehatan>({
    siswa_id: '1',
    periode: 'MEB 1 s.d. 9 | Periode STS Ganjil',
    tanggal_periksa: '2026-10-24',
    tinggi_badan: 168,
    berat_badan: 58,
    tekanan_darah: '115/75',
    lingkar_pinggang: 72,
    gigi_berlubang: false,
    karang_gigi: false,
    gusi_bengkak: false,
    gusi_berdarah: false,
    riwayat_pingsan: 0,
    riwayat_mimisan: 0,
    riwayat_kejang: 0,
    riwayat_rawat_rs: 0,
    catatan_pjok_uks: 'Kondisi fisik prima, tekanan darah normal, postur gizi ideal. Siap mengikuti seluruh KBM praktik kejuruan dan olahraga.',
    ttd_ortu: true,
    ttd_pembimbing: true,
    ttd_pembina_uks: true,
  });

  // Kunjungan UKS
  const [daftarKunjungan, setDaftarKunjungan] = useState<KunjunganUKS[]>([
    {
      id: 'uks-1',
      siswa_id: '1',
      tanggal: '2026-09-18',
      jam_masuk: '09:40',
      jam_keluar: '10:30',
      penyebab: 'Pusing ringan setelah upacara bendera hari Senin',
      tindak_lanjut: 'Diberikan istirahat di bed UKS, minum air hangat & minyak kayu putih',
      petugas_uks: 'Ibu Nurlaila, S.Kep',
      paraf: true,
    },
    {
      id: 'uks-2',
      siswa_id: '1',
      tanggal: '2026-10-04',
      jam_masuk: '13:15',
      jam_keluar: '13:45',
      penyebab: 'Luka lecet di siku saat praktik olahraga futsal',
      tindak_lanjut: 'Dibersihkan dengan antiseptik povidone iodine, diplester steril',
      petugas_uks: 'Ustadz Danang (PJOK)',
      paraf: true,
    }
  ]);

  // Form input baru UKS
  const [newUks, setNewUks] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    jam_masuk: '10:00',
    jam_keluar: '10:45',
    penyebab: '',
    tindak_lanjut: '',
    petugas_uks: role === 'guru' ? 'Pembina UKS SMK' : 'Petugas Piket UKS',
  });
  const [showAddUks, setShowAddUks] = useState(false);

  // Kalender Menstruasi
  const [kalenderMenstruasi, setKalenderMenstruasi] = useState<KalenderMenstruasi[]>([
    {
      id: 'mens-1',
      siswa_id: '1',
      bulan: 'Agustus 2024',
      tgl_mulai: '2024-08-04',
      tgl_selesai: '2024-08-10',
      banyaknya_hari: 7,
      jarak_siklus: 28,
      paraf_ortu: true,
    },
    {
      id: 'mens-2',
      siswa_id: '1',
      bulan: 'September 2024',
      tgl_mulai: '2024-09-02',
      tgl_selesai: '2024-09-08',
      banyaknya_hari: 7,
      jarak_siklus: 29,
      paraf_ortu: true,
    },
    {
      id: 'mens-3',
      siswa_id: '1',
      bulan: 'Oktober 2024',
      tgl_mulai: '2024-10-01',
      tgl_selesai: '2024-10-07',
      banyaknya_hari: 7,
      jarak_siklus: 29,
      paraf_ortu: true,
    }
  ]);

  // Hitung BMI / IMT
  const calculateBmi = () => {
    if (!kesehatan.tinggi_badan || !kesehatan.berat_badan) return { val: 0, label: '-' };
    const tbMeter = kesehatan.tinggi_badan / 100;
    const bmi = parseFloat((kesehatan.berat_badan / (tbMeter * tbMeter)).toFixed(1));
    let label = 'Normal (Gizi Baik)';
    let color = 'text-green-600 bg-green-50 border-green-200';
    if (bmi < 18.5) {
      label = 'Kurang (Underweight)';
      color = 'text-amber-600 bg-amber-50 border-amber-200';
    } else if (bmi >= 23 && bmi < 25) {
      label = 'Kelebihan Berat Badan';
      color = 'text-orange-600 bg-orange-50 border-orange-200';
    } else if (bmi >= 25) {
      label = 'Obesitas';
      color = 'text-red-600 bg-red-50 border-red-200';
    }
    return { val: bmi, label, color };
  };

  const bmiInfo = calculateBmi();

  const handleSaveBorang = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleAddKunjunganUks = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUks.penyebab) return;
    const entry: KunjunganUKS = {
      id: `uks-${Date.now()}`,
      siswa_id: '1',
      tanggal: newUks.tanggal,
      jam_masuk: newUks.jam_masuk,
      jam_keluar: newUks.jam_keluar,
      penyebab: newUks.penyebab,
      tindak_lanjut: newUks.tindak_lanjut || 'Diberikan pertolongan pertama',
      petugas_uks: newUks.petugas_uks,
      paraf: true,
    };
    setDaftarKunjungan([entry, ...daftarKunjungan]);
    setNewUks({
      tanggal: new Date().toISOString().split('T')[0],
      jam_masuk: '10:00',
      jam_keluar: '10:45',
      penyebab: '',
      tindak_lanjut: '',
      petugas_uks: role === 'guru' ? 'Pembina UKS SMK' : 'Petugas Piket UKS',
    });
    setShowAddUks(false);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] text-white p-4 rounded-2xl shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shrink-0">
            <HeartPulse className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Borang Pemantauan Kesehatan</h2>
            <p className="text-xs text-green-100">
              SMK Thibbil Qulub Assimbani • Program Sekolah Sehat
            </p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-green-700/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="text-green-200">Siswa: </span>
            <span className="font-semibold">{studentName}</span> ({studentKelas})
          </div>
          <div className="bg-white/10 px-2.5 py-1 rounded-lg">
            <label className="text-[11px] text-green-200 block mb-0.5">Periode Evaluasi:</label>
            <select
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              className="bg-transparent text-white font-medium text-xs focus:outline-none cursor-pointer"
            >
              <option value="MEB 1 s.d. 9 | Periode STS Ganjil" className="text-gray-900">MEB 1 s.d. 9 (STS Ganjil)</option>
              <option value="MEB 10 s.d. 18 | Periode SAS Ganjil" className="text-gray-900">MEB 10 s.d. 18 (SAS Ganjil)</option>
              <option value="MEB 19 s.d. 27 | Periode STS Genap" className="text-gray-900">MEB 19 s.d. 27 (STS Genap)</option>
              <option value="MEB 28 s.d. 36 | Periode SAS Genap" className="text-gray-900">MEB 28 s.d. 36 (SAS Genap)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Navigasi Sub-Tab */}
      <div className="flex bg-white p-1 rounded-xl shadow-sm border border-green-100 gap-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('fisik_gigi')}
          className={`flex-1 py-2 px-2 text-center rounded-lg font-medium transition-all ${
            activeTab === 'fisik_gigi'
              ? 'bg-[#2E7D32] text-white shadow-sm font-semibold'
              : 'text-gray-600 hover:text-green-800'
          }`}
        >
          Pengukuran & Gigi
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('riwayat_uks')}
          className={`flex-1 py-2 px-2 text-center rounded-lg font-medium transition-all ${
            activeTab === 'riwayat_uks'
              ? 'bg-[#2E7D32] text-white shadow-sm font-semibold'
              : 'text-gray-600 hover:text-green-800'
          }`}
        >
          Kunjungan UKS ({daftarKunjungan.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('menstruasi')}
          className={`flex-1 py-2 px-2 text-center rounded-lg font-medium transition-all ${
            activeTab === 'menstruasi'
              ? 'bg-[#2E7D32] text-white shadow-sm font-semibold'
              : 'text-gray-600 hover:text-green-800'
          }`}
        >
          Kalender Menstruasi
        </button>
      </div>

      {saveSuccess && (
        <div className="bg-green-100 border border-green-400 text-[#1B5E20] px-4 py-3 rounded-xl flex items-center gap-2 text-sm shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-green-700" />
          <span>Borang Pemantauan Kesehatan berhasil disimpan ke database sekolah!</span>
        </div>
      )}

      {/* TAB 1: PENGUKURAN FISIK & KESEHATAN GIGI */}
      {activeTab === 'fisik_gigi' && (
        <form onSubmit={handleSaveBorang} className="space-y-4">
          {/* A. Hasil Pengukuran */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-green-100 text-[#1B5E20] flex items-center justify-center text-xs font-bold">A</span>
                Hasil Pengukuran Fisik
              </h3>
              <span className="text-[11px] text-gray-500">T.A. 2024-2026</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-green-50/50 p-3 rounded-xl border border-green-100">
                <label className="block text-gray-600 font-medium mb-1">Tinggi Badan (TB)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={kesehatan.tinggi_badan || ''}
                    disabled={readOnly}
                    onChange={(e) => setKesehatan({ ...kesehatan, tinggi_badan: Number(e.target.value) })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-gray-800 focus:outline-none focus:border-green-600"
                    placeholder="165"
                  />
                  <span className="text-gray-500 font-semibold">cm</span>
                </div>
              </div>

              <div className="bg-green-50/50 p-3 rounded-xl border border-green-100">
                <label className="block text-gray-600 font-medium mb-1">Berat Badan (BB)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={kesehatan.berat_badan || ''}
                    disabled={readOnly}
                    onChange={(e) => setKesehatan({ ...kesehatan, berat_badan: Number(e.target.value) })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-gray-800 focus:outline-none focus:border-green-600"
                    placeholder="55"
                  />
                  <span className="text-gray-500 font-semibold">kg</span>
                </div>
              </div>

              <div className="bg-green-50/50 p-3 rounded-xl border border-green-100">
                <label className="block text-gray-600 font-medium mb-1">Tekanan Darah</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={kesehatan.tekanan_darah}
                    disabled={readOnly}
                    onChange={(e) => setKesehatan({ ...kesehatan, tekanan_darah: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-gray-800 focus:outline-none focus:border-green-600"
                    placeholder="110/70"
                  />
                  <span className="text-gray-500 font-semibold text-[10px]">mmHg</span>
                </div>
              </div>

              <div className="bg-green-50/50 p-3 rounded-xl border border-green-100">
                <label className="block text-gray-600 font-medium mb-1">Lingkar Pinggang</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={kesehatan.lingkar_pinggang || ''}
                    disabled={readOnly}
                    onChange={(e) => setKesehatan({ ...kesehatan, lingkar_pinggang: Number(e.target.value) })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-gray-800 focus:outline-none focus:border-green-600"
                    placeholder="70"
                  />
                  <span className="text-gray-500 font-semibold">cm</span>
                </div>
              </div>
            </div>

            {/* Indeks Massa Tubuh (IMT / BMI) Hasil Otomatis */}
            <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${bmiInfo.color}`}>
              <div>
                <span className="font-bold text-[13px] block">Status Gizi (IMT / BMI): {bmiInfo.val || '-'}</span>
                <span className="text-[11px] opacity-90">{bmiInfo.label}</span>
              </div>
              <Activity className="w-5 h-5 shrink-0 opacity-80" />
            </div>
          </div>

          {/* B. Kesehatan Gigi & Mulut */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-green-100 text-[#1B5E20] flex items-center justify-center text-xs font-bold">B</span>
                Pemeriksaan Kesehatan Gigi
              </h3>
              <Smile className="w-4 h-4 text-green-700" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { key: 'gigi_berlubang', label: 'Gigi Berlubang' },
                { key: 'karang_gigi', label: 'Karang Gigi' },
                { key: 'gusi_bengkak', label: 'Gusi Bengkak' },
                { key: 'gusi_berdarah', label: 'Gusi Berdarah' },
              ].map((item) => {
                const isTrue = Boolean(kesehatan[item.key as keyof BorangKesehatan]);
                return (
                  <div key={item.key} className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 flex items-center justify-between">
                    <span className="text-gray-700 font-medium">{item.label}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => setKesehatan({ ...kesehatan, [item.key]: false })}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                          !isTrue ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        Tidak
                      </button>
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => setKesehatan({ ...kesehatan, [item.key]: true })}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                          isTrue ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        Ya
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* C. Riwayat Kesehatan Khusus (Pingsan, Mimisan, Kejang, RS) */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-green-100 text-[#1B5E20] flex items-center justify-center text-xs font-bold">C</span>
                Riwayat Kesehatan Periode Ini
              </h3>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-[11px] text-gray-500">
              Sebutkan sakit yang dialami selama periode rapor (mencakup di sekolah maupun di rumah):
            </p>

            <div className="space-y-2 text-xs">
              {[
                { key: 'riwayat_pingsan', label: 'a. Pingsan' },
                { key: 'riwayat_mimisan', label: 'b. Mimisan' },
                { key: 'riwayat_kejang', label: 'c. Kejang' },
                { key: 'riwayat_rawat_rs', label: 'd. Dirawat di Rumah Sakit' },
              ].map((item) => {
                const count = Number(kesehatan[item.key as keyof BorangKesehatan]) || 0;
                return (
                  <div key={item.key} className="flex items-center justify-between p-2 rounded-xl bg-gray-50 border border-gray-200">
                    <span className="text-gray-700 font-medium">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => setKesehatan({ ...kesehatan, [item.key]: 0 })}
                        className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                          count === 0 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        Tidak Pernah
                      </button>
                      <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border">
                        <span className="text-[11px] text-gray-500">Ya:</span>
                        <input
                          type="number"
                          min="0"
                          disabled={readOnly}
                          value={count}
                          onChange={(e) => setKesehatan({ ...kesehatan, [item.key]: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-10 text-center font-bold text-gray-800 focus:outline-none"
                        />
                        <span className="text-[11px] text-gray-500">kali</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* D. Catatan Guru PJOK / Pembina UKS & Pengesahan */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-3">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-green-100 text-[#1B5E20] flex items-center justify-center text-xs font-bold">D</span>
              Catatan Guru PJOK / Pembina UKS
            </h3>
            <textarea
              rows={2}
              disabled={readOnly && role !== 'guru'}
              value={kesehatan.catatan_pjok_uks}
              onChange={(e) => setKesehatan({ ...kesehatan, catatan_pjok_uks: e.target.value })}
              className="w-full bg-green-50/30 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 focus:outline-none focus:border-green-600"
              placeholder="Catatan hasil skrining kesehatan berkala..."
            />

            <div className="pt-2 border-t border-gray-100 grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="bg-green-50 p-2 rounded-xl border border-green-100 flex flex-col items-center">
                <span className="text-gray-500">Peserta Didik</span>
                <span className="font-semibold text-gray-800 text-[11px] mt-0.5">Menyatakan</span>
                <span className="inline-flex items-center gap-1 text-green-700 font-bold mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sah
                </span>
              </div>
              <div className="bg-green-50 p-2 rounded-xl border border-green-100 flex flex-col items-center">
                <span className="text-gray-500">Orang Tua/Wali</span>
                <span className="font-semibold text-gray-800 text-[11px] mt-0.5">Mengetahui</span>
                <span className="inline-flex items-center gap-1 text-green-700 font-bold mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Terverifikasi
                </span>
              </div>
              <div className="bg-green-50 p-2 rounded-xl border border-green-100 flex flex-col items-center">
                <span className="text-gray-500">PJOK / UKS</span>
                <span className="font-semibold text-gray-800 text-[11px] mt-0.5">Pembina</span>
                <span className="inline-flex items-center gap-1 text-green-700 font-bold mt-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Validasi
                </span>
              </div>
            </div>
          </div>

          {!readOnly && (
            <button
              type="submit"
              className="w-full bg-[#2E7D32] hover:bg-green-800 text-white font-bold py-3 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <Save className="w-4 h-4" />
              Simpan Data Borang Kesehatan
            </button>
          )}
        </form>
      )}

      {/* TAB 2: LOG KUNJUNGAN UKS */}
      {activeTab === 'riwayat_uks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-green-700" />
              Buku Kunjungan UKS Sekolah
            </h3>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setShowAddUks(!showAddUks)}
                className="bg-[#2E7D32] text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-semibold shadow-sm hover:bg-green-800"
              >
                <Plus className="w-3.5 h-3.5" /> Catat Kunjungan
              </button>
            )}
          </div>

          {showAddUks && (
            <form onSubmit={handleAddKunjunganUks} className="bg-green-50/70 p-3 rounded-2xl border border-green-200 space-y-2.5 text-xs animate-fade-in">
              <h4 className="font-bold text-[#1B5E20]">Tambah Catatan Masuk UKS</h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Tanggal</label>
                  <input
                    type="date"
                    value={newUks.tanggal}
                    onChange={(e) => setNewUks({ ...newUks, tanggal: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg p-1.5 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Jam Masuk</label>
                  <input
                    type="time"
                    value={newUks.jam_masuk}
                    onChange={(e) => setNewUks({ ...newUks, jam_masuk: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg p-1.5 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Jam Keluar</label>
                  <input
                    type="time"
                    value={newUks.jam_keluar}
                    onChange={(e) => setNewUks({ ...newUks, jam_keluar: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg p-1.5 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Penyebab / Keluhan Sakit</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Sakit perut mulas, demam ringan, luka jatuh..."
                  value={newUks.penyebab}
                  onChange={(e) => setNewUks({ ...newUks, penyebab: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:border-green-600"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Tindak Lanjut / Penanganan</label>
                <input
                  type="text"
                  placeholder="Misal: Diberi antasida & teh manis hangat, istirahat 30 menit..."
                  value={newUks.tindak_lanjut}
                  onChange={(e) => setNewUks({ ...newUks, tindak_lanjut: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:border-green-600"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddUks(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-1.5 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#2E7D32] text-white py-1.5 rounded-lg font-bold shadow-sm"
                >
                  Simpan Catatan
                </button>
              </div>
            </form>
          )}

          {/* List Kunjungan */}
          <div className="space-y-2">
            {daftarKunjungan.map((kunj) => (
              <div key={kunj.id} className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm space-y-2 text-xs">
                <div className="flex items-center justify-between border-b pb-1.5 border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1B5E20]">{kunj.tanggal}</span>
                    <span className="text-[11px] text-gray-400">•</span>
                    <span className="text-[11px] text-gray-600 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" /> {kunj.jam_masuk} - {kunj.jam_keluar} WIB
                    </span>
                  </div>
                  <span className="bg-green-100 text-[#1B5E20] font-bold px-2 py-0.5 rounded text-[10px]">
                    Paraf Petugas ✓
                  </span>
                </div>

                <div>
                  <span className="text-gray-500 font-semibold block text-[11px]">Penyebab / Gejala:</span>
                  <p className="text-gray-800 font-medium">{kunj.penyebab}</p>
                </div>

                <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                  <span className="text-gray-500 font-semibold block text-[10px]">Tindak Lanjut UKS:</span>
                  <p className="text-gray-700 text-[11px]">{kunj.tindak_lanjut}</p>
                  <p className="text-[10px] text-gray-400 mt-1 italic">Petugas: {kunj.petugas_uks}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: KALENDER MENSTRUASI */}
      {activeTab === 'menstruasi' && (
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-green-100 shadow-sm space-y-2">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-pink-600" />
              Kalender Menstruasi Peserta Didik
            </h3>
            <p className="text-[11px] text-gray-500">
              Sesuai halaman 120 BKP: Khusus siswi untuk mencatat siklus haid, durasi hari, dan jarak hari antar siklus agar pelaksanaan dispensasi ibadah sholat dan puasa tercatat tertib.
            </p>
          </div>

          <div className="overflow-x-auto bg-white rounded-2xl border border-green-100 shadow-sm p-3">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600 font-semibold">
                  <th className="pb-2">Bulan</th>
                  <th className="pb-2">Tgl Mulai</th>
                  <th className="pb-2">Tgl Selesai</th>
                  <th className="pb-2 text-center">Durasi</th>
                  <th className="pb-2 text-center">Jarak Siklus*</th>
                  <th className="pb-2 text-center">Paraf Ortu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {kalenderMenstruasi.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/60">
                    <td className="py-2.5 font-bold text-gray-800">{m.bulan}</td>
                    <td className="py-2.5 text-gray-600">{m.tgl_mulai}</td>
                    <td className="py-2.5 text-gray-600">{m.tgl_selesai}</td>
                    <td className="py-2.5 text-center">
                      <span className="bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
                        {m.banyaknya_hari} hari
                      </span>
                    </td>
                    <td className="py-2.5 text-center text-gray-600 font-medium">{m.jarak_siklus} hari</td>
                    <td className="py-2.5 text-center">
                      <span className="text-green-700 font-bold text-xs">✓ Diperiksa</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-gray-400 mt-3 italic">
              *Jarak dari hari pertama menstruasi bulan sebelumnya (dalam satuan hari).
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BorangKesehatanView;
