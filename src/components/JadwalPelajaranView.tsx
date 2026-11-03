/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  BookOpen,
  User,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Layers,
  RotateCcw
} from 'lucide-react';
import type { HariSekolah, JadwalPelajaranRecord } from '../lib/tipe';
import {
  db,
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  orderBy
} from '../lib/data';
import type { AppUser } from '../lib/auth';

interface JadwalPelajaranViewProps {
  currentClass: string;
  userRole?: string;
  user?: AppUser | null;
  daftarKelas?: string[];
  onChangeClass?: (newClass: string) => void;
}

const HARI_SEKOLAH: HariSekolah[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

// Default schedule template for SMK Thibbil Qulub Assimbani
const JADWAL_TEMPLATE: Omit<JadwalPelajaranRecord, 'id' | 'kelas'>[] = [
  // Senin
  {
    hari: 'Senin',
    jam_mulai: '07:00',
    jam_selesai: '07:45',
    mata_pelajaran: 'Upacara Bendera & Apel Pagi',
    guru_pengampu: 'Wali Rayon & Guru Piket',
    ruang: 'Lapangan Utama',
    urutan: 1,
  },
  {
    hari: 'Senin',
    jam_mulai: '07:45',
    jam_selesai: '09:15',
    mata_pelajaran: 'Pendidikan Agama Islam & Budi Pekerti (PAIBP)',
    guru_pengampu: 'Ust. H. Abdurrahman, M.Pd.I',
    ruang: 'R. Teori 1',
    urutan: 2,
  },
  {
    hari: 'Senin',
    jam_mulai: '09:30',
    jam_selesai: '11:45',
    mata_pelajaran: 'Matematika Terapan',
    guru_pengampu: 'Ibu Siti Khodijah, S.Pd',
    ruang: 'R. Teori 1',
    urutan: 3,
  },
  {
    hari: 'Senin',
    jam_mulai: '12:30',
    jam_selesai: '14:30',
    mata_pelajaran: 'Dasar-Dasar Kejuruan (Produktif)',
    guru_pengampu: 'Bpk. Irfan Maulana, S.Kom',
    ruang: 'Lab Praktik A',
    urutan: 4,
  },

  // Selasa
  {
    hari: 'Selasa',
    jam_mulai: '07:15',
    jam_selesai: '09:15',
    mata_pelajaran: 'Bahasa Indonesia & Literasi',
    guru_pengampu: 'Ibu Nurul Aini, S.Pd',
    ruang: 'R. Teori 1',
    urutan: 1,
  },
  {
    hari: 'Selasa',
    jam_mulai: '09:30',
    jam_selesai: '11:45',
    mata_pelajaran: 'Bahasa Inggris Komunikasi',
    guru_pengampu: 'Bpk. Wildan Fauzi, M.Hum',
    ruang: 'R. Bahasa',
    urutan: 2,
  },
  {
    hari: 'Selasa',
    jam_mulai: '12:30',
    jam_selesai: '15:00',
    mata_pelajaran: 'Praktik Kejuruan & Laboratorium',
    guru_pengampu: 'Ustzh. Maryam, S.Kep / Apt.',
    ruang: 'Lab Farmasi / Keperawatan',
    urutan: 3,
  },

  // Rabu
  {
    hari: 'Rabu',
    jam_mulai: '07:15',
    jam_selesai: '09:15',
    mata_pelajaran: 'Pendidikan Pancasila & Kewarganegaraan',
    guru_pengampu: 'Bpk. Slamet Riyadi, S.H',
    ruang: 'R. Teori 1',
    urutan: 1,
  },
  {
    hari: 'Rabu',
    jam_mulai: '09:30',
    jam_selesai: '11:45',
    mata_pelajaran: 'Projek IPAS (Ilmu Pengetahuan Alam & Sosial)',
    guru_pengampu: 'Ibu Dr. Ratna Dewi, M.Si',
    ruang: 'Lab Sains Terpadu',
    urutan: 2,
  },
  {
    hari: 'Rabu',
    jam_mulai: '12:30',
    jam_selesai: '14:30',
    mata_pelajaran: 'Informatika & Keterampilan Digital',
    guru_pengampu: 'Bpk. Irfan Maulana, S.Kom',
    ruang: 'Lab Komputer 1',
    urutan: 3,
  },

  // Kamis
  {
    hari: 'Kamis',
    jam_mulai: '07:15',
    jam_selesai: '09:15',
    mata_pelajaran: 'Pendidikan Jasmani, Olahraga & Kesehatan (PJOK)',
    guru_pengampu: 'Ust. Fajar Ramadhan, S.Pd',
    ruang: 'Lapangan & Gelanggang',
    urutan: 1,
  },
  {
    hari: 'Kamis',
    jam_mulai: '09:30',
    jam_selesai: '11:45',
    mata_pelajaran: 'Sejarah Kebudayaan Islam & Kepesantrenan',
    guru_pengampu: 'Ust. Ahmad Dahlan, S.Pd.I',
    ruang: 'R. Teori 1',
    urutan: 2,
  },
  {
    hari: 'Kamis',
    jam_mulai: '12:30',
    jam_selesai: '15:00',
    mata_pelajaran: 'Projek Penguatan Profil Pelajar Pancasila (P5)',
    guru_pengampu: 'Tim Fasilitator P5',
    ruang: 'Aula Assimbani',
    urutan: 3,
  },

  // Jumat
  {
    hari: 'Jumat',
    jam_mulai: '07:00',
    jam_selesai: '08:00',
    mata_pelajaran: 'Jumat Bersih & Senam Kesegaran Jasmani',
    guru_pengampu: 'Wali Kelas & Pembimbing Rayon',
    ruang: 'Area Kampus & Asrama',
    urutan: 1,
  },
  {
    hari: 'Jumat',
    jam_mulai: '08:00',
    jam_selesai: '09:30',
    mata_pelajaran: 'Tahfidz Al-Qur\'an & Muraja\'ah Bersama',
    guru_pengampu: 'Ustadz Pembina Tahfidz',
    ruang: 'Masjid Thibbil Qulub',
    urutan: 2,
  },
  {
    hari: 'Jumat',
    jam_mulai: '09:45',
    jam_selesai: '11:15',
    mata_pelajaran: 'Bimbingan Konseling & Bina Karakter Siswa',
    guru_pengampu: 'Guru BK / Konselor',
    ruang: 'R. Kelas',
    urutan: 3,
  },
];

export const JadwalPelajaranView: React.FC<JadwalPelajaranViewProps> = ({
  currentClass,
  userRole = 'siswa',
  daftarKelas = [],
  onChangeClass,
}) => {
  // Determine today's day name in Indonesian
  const dayNamesIndo: Record<number, HariSekolah> = {
    1: 'Senin',
    2: 'Selasa',
    3: 'Rabu',
    4: 'Kamis',
    5: 'Jumat',
  };
  const now = new Date();
  const currentDayIndex = now.getDay(); // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
  const initialActiveDay: HariSekolah = dayNamesIndo[currentDayIndex] || 'Senin';

  const [activeDay, setActiveDay] = useState<HariSekolah>(initialActiveDay);
  const [selectedClass, setSelectedClass] = useState<string>(currentClass || 'X TKJ 1');
  const [jadwalList, setJadwalList] = useState<JadwalPelajaranRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Form tambah/edit state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formHari, setFormHari] = useState<HariSekolah>('Senin');
  const [formMulai, setFormMulai] = useState('07:15');
  const [formSelesai, setFormSelesai] = useState('08:45');
  const [formMapel, setFormMapel] = useState('');
  const [formGuru, setFormGuru] = useState('');
  const [formRuang, setFormRuang] = useState('');
  const [formCatatan, setFormCatatan] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isStaff = userRole === 'guru' || userRole === 'pembimbing_rayon' || userRole === 'admin';

  useEffect(() => {
    if (currentClass && currentClass !== selectedClass) {
      setSelectedClass(currentClass);
    }
  }, [currentClass]);

  // Load real-time schedule for selectedClass
  useEffect(() => {
    if (!selectedClass) return;

    setLoading(true);
    const q = query(
      collection(db, 'jadwal_pelajaran'),
      where('kelas', '==', selectedClass)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as JadwalPelajaranRecord[];

        // Sort by jam_mulai ascending
        list.sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));
        setJadwalList(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Gagal memuat jadwal pelajaran:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [selectedClass]);

  // Handle class switch
  const handleClassChange = (newCls: string) => {
    setSelectedClass(newCls);
    if (onChangeClass) {
      onChangeClass(newCls);
    }
  };

  // Check if a schedule item is currently ongoing
  const isOngoing = (item: JadwalPelajaranRecord) => {
    if (dayNamesIndo[now.getDay()] !== item.hari) return false;
    const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return curTime >= item.jam_mulai && curTime <= item.jam_selesai;
  };

  // Submit add / edit item
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMapel.trim()) {
      setErrorMsg('Nama mata pelajaran wajib diisi.');
      return;
    }

    setFormSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        kelas: selectedClass,
        hari: formHari,
        jam_mulai: formMulai,
        jam_selesai: formSelesai,
        mata_pelajaran: formMapel.trim(),
        guru_pengampu: formGuru.trim() || 'Guru Pengampu',
        ruang: formRuang.trim() || 'R. Kelas',
        catatan: formCatatan.trim(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'jadwal_pelajaran', editingId), payload);
        setSuccessMsg('Jadwal pelajaran berhasil diperbarui.');
      } else {
        await addDoc(collection(db, 'jadwal_pelajaran'), payload);
        setSuccessMsg('Jadwal pelajaran berhasil ditambahkan.');
      }

      setShowForm(false);
      setEditingId(null);
      setFormMapel('');
      setFormGuru('');
      setFormRuang('');
      setFormCatatan('');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg('Gagal menyimpan jadwal: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete item
  const handleDelete = async (id: string, mapel: string) => {
    if (!confirm(`Hapus jadwal mata pelajaran "${mapel}"?`)) return;
    try {
      await deleteDoc(doc(db, 'jadwal_pelajaran', id));
      setSuccessMsg('Jadwal berhasil dihapus.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg('Gagal menghapus jadwal: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Seed default template for this class if empty
  const handleSeedTemplate = async () => {
    if (!confirm(`Terapkan jadwal pelajaran standar resmi untuk kelas ${selectedClass}?`)) return;

    setFormSubmitting(true);
    try {
      for (const item of JADWAL_TEMPLATE) {
        await addDoc(collection(db, 'jadwal_pelajaran'), {
          ...item,
          kelas: selectedClass,
        });
      }
      setSuccessMsg(`Jadwal standar berhasil diterapkan untuk ${selectedClass}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg('Gagal menerapkan jadwal standar: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setFormSubmitting(false);
    }
  };

  // Filter schedules by active day
  const filteredJadwal = jadwalList.filter((j) => j.hari === activeDay);

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#2E7D32]" />
            <h3 className="text-base font-bold text-gray-800">Jadwal Pelajaran Mingguan</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Jadwal kegiatan belajar mengajar dari hari Senin sampai Jumat.
          </p>
        </div>

        {/* Class selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-semibold">Kelas:</span>
          {isStaff && daftarKelas.length > 0 ? (
            <select
              value={selectedClass}
              onChange={(e) => handleClassChange(e.target.value)}
              className="px-3 py-1.5 bg-green-50 border border-green-200 text-green-900 rounded-xl text-xs font-bold outline-none cursor-pointer"
            >
              {daftarKelas.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          ) : (
            <span className="px-3 py-1 bg-green-100 text-green-900 font-bold rounded-xl text-xs">
              {selectedClass}
            </span>
          )}

          {isStaff && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setFormHari(activeDay);
                setFormMapel('');
                setFormGuru('');
                setFormRuang('');
                setFormCatatan('');
                setShowForm(true);
              }}
              className="px-3 py-1.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Jadwal</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Monday - Friday Tabs */}
      <div className="flex items-center gap-1.5 bg-gray-100/80 p-1.5 rounded-2xl overflow-x-auto">
        {HARI_SEKOLAH.map((hari) => {
          const isActive = activeDay === hari;
          const isCurrentHari = dayNamesIndo[now.getDay()] === hari;
          const countForHari = jadwalList.filter((j) => j.hari === hari).length;

          return (
            <button
              key={hari}
              type="button"
              onClick={() => setActiveDay(hari)}
              className={`flex-1 min-w-[70px] py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                isActive
                  ? 'bg-white text-[#1B5E20] shadow-sm border border-green-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
              }`}
            >
              <div className="flex items-center gap-1">
                <span>{hari}</span>
                {isCurrentHari && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" title="Hari ini" />
                )}
              </div>
              <span className="text-[10px] text-gray-400 font-medium">
                {countForHari > 0 ? `${countForHari} Mapel` : 'Libur/Kosong'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Form Tambah/Ubah Jadwal */}
      {showForm && isStaff && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-4 shadow-sm border border-green-200 space-y-3 text-xs animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h4 className="font-bold text-gray-800 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-[#2E7D32]" />
              <span>{editingId ? 'Edit Mata Pelajaran' : `Tambah Jadwal (${selectedClass})`}</span>
            </h4>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Hari *</label>
              <select
                value={formHari}
                onChange={(e) => setFormHari(e.target.value as HariSekolah)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
              >
                {HARI_SEKOLAH.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Jam Mulai</label>
              <input
                type="time"
                required
                value={formMulai}
                onChange={(e) => setFormMulai(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Jam Selesai</label>
              <input
                type="time"
                required
                value={formSelesai}
                onChange={(e) => setFormSelesai(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Nama Mata Pelajaran *
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Matematika Terapan, PAIBP, Praktik Farmasi..."
              value={formMapel}
              onChange={(e) => setFormMapel(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Guru Pengampu</label>
              <input
                type="text"
                placeholder="Contoh: Ust. Ahmad Dahlan, S.Pd"
                value={formGuru}
                onChange={(e) => setFormGuru(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Ruangan / Lab</label>
              <input
                type="text"
                placeholder="Contoh: R. Teori 1, Lab Komputer"
                value={formRuang}
                onChange={(e) => setFormRuang(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Catatan Tambahan (Opsional)</label>
            <input
              type="text"
              placeholder="Contoh: Membawa jas lab dan modul praktikum"
              value={formCatatan}
              onChange={(e) => setFormCatatan(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="px-3 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-4 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm disabled:bg-gray-300"
            >
              <Save className="w-4 h-4" />
              <span>{formSubmitting ? 'Menyimpan…' : editingId ? 'Perbarui' : 'Simpan'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Daftar Jadwal Hari Terpilih */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="text-center py-10 text-xs text-gray-400 bg-white rounded-2xl border border-gray-100">
            Memuat jadwal pelajaran kelas {selectedClass}…
          </div>
        ) : filteredJadwal.length === 0 ? (
          <div className="text-center py-8 px-4 bg-white rounded-2xl border border-gray-200 space-y-3">
            <p className="text-xs text-gray-500">
              Belum ada jadwal pelajaran tercatat untuk hari <strong>{activeDay}</strong> pada kelas <strong>{selectedClass}</strong>.
            </p>
            {isStaff && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setFormHari(activeDay);
                    setFormMapel('');
                    setFormGuru('');
                    setFormRuang('');
                    setFormCatatan('');
                    setShowForm(true);
                  }}
                  className="px-3 py-1.5 bg-[#2E7D32] text-white text-xs font-bold rounded-xl hover:bg-[#1B5E20] shadow-xs"
                >
                  + Tambah Mapel Manual
                </button>
                {jadwalList.length === 0 && (
                  <button
                    type="button"
                    onClick={handleSeedTemplate}
                    disabled={formSubmitting}
                    className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold rounded-xl hover:bg-amber-100 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Terapkan Jadwal Standar SMK (Senin - Jumat)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          filteredJadwal.map((item, idx) => {
            const active = isOngoing(item);

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border transition-all flex items-start justify-between gap-3 ${
                  active
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                    : 'border-gray-200 hover:border-green-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Jam & Urutan */}
                  <div className="shrink-0 text-center bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 min-w-[70px]">
                    <span className="text-[10px] text-gray-500 block font-semibold">
                      Jam ke-{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-gray-800">
                      {item.jam_mulai}
                    </span>
                    <span className="text-[10px] text-gray-400 block">- {item.jam_selesai}</span>
                  </div>

                  {/* Detail Pelajaran */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-gray-900">{item.mata_pelajaran}</h4>
                      {active && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] animate-pulse">
                          Sedang Berlangsung
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span>{item.guru_pengampu}</span>
                      </span>
                      {item.ruang && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span>{item.ruang}</span>
                        </span>
                      )}
                    </div>

                    {item.catatan && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md mt-1.5 inline-block">
                        Catatan: {item.catatan}
                      </p>
                    )}
                  </div>
                </div>

                {/* Staff Actions */}
                {isStaff && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setFormHari(item.hari);
                        setFormMulai(item.jam_mulai);
                        setFormSelesai(item.jam_selesai);
                        setFormMapel(item.mata_pelajaran);
                        setFormGuru(item.guru_pengampu);
                        setFormRuang(item.ruang || '');
                        setFormCatatan(item.catatan || '');
                        setShowForm(true);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-green-700 hover:bg-green-50 transition-colors"
                      title="Ubah Jadwal"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.mata_pelajaran)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Hapus Jadwal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default JadwalPelajaranView;
