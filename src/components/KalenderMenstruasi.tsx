/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  HeartPulse,
  Droplets,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Sparkles,
  ShieldCheck,
  Clock,
  Pill,
  Save,
  Check
} from 'lucide-react';
import type { StudentRecord, MenstruasiRecord } from '../lib/tipe';
import {
  db,
  collection,
  doc,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from '../lib/data';
import type { AppUser } from '../lib/auth';

interface KalenderMenstruasiProps {
  student: StudentRecord;
  user: AppUser | null;
  onTutup?: () => void;
  onStatusChange?: (isHaid: boolean) => void;
}

const DAFTAR_KELUHAN = [
  'Kram Perut (Dismenore)',
  'Nyeri Pinggang',
  'Pusing / Anemia',
  'Lemas & Cepat Lelah',
  'Sakit Kepala',
  'Emosi / Mood Swing',
  'Perut Kembung',
];

export const KalenderMenstruasi: React.FC<KalenderMenstruasiProps> = ({
  student,
  user,
  onTutup,
  onStatusChange,
}) => {
  const [catatanList, setCatatanList] = useState<MenstruasiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Month navigation for visual calendar
  const [currentDate, setCurrentDate] = useState(new Date());

  // Form input state
  const [showForm, setShowForm] = useState(false);
  const [formMulai, setFormMulai] = useState(new Date().toISOString().split('T')[0]);
  const [formSelesai, setFormSelesai] = useState('');
  const [formStatus, setFormStatus] = useState<'haid_aktif' | 'selesai_suci'>('haid_aktif');
  const [formMinumTTD, setFormMinumTTD] = useState(false);
  const [formKeluhan, setFormKeluhan] = useState<string[]>([]);
  const [formCatatan, setFormCatatan] = useState('');
  const [saving, setSaving] = useState(false);

  // Real-time listener for student's menstruation logs
  useEffect(() => {
    if (!student.id) return;

    setLoading(true);
    const q = query(
      collection(db, 'catatan_menstruasi'),
      where('siswa_id', '==', student.id),
      orderBy('tanggal_mulai', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        })) as MenstruasiRecord[];

        setCatatanList(list);
        setLoading(false);

        // Check if there is an active menstruation
        const ongoing = list.find((item) => item.status === 'haid_aktif');
        if (onStatusChange) {
          onStatusChange(Boolean(ongoing));
        }
      },
      (err) => {
        console.warn('Gagal memuat catatan menstruasi:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [student.id]);

  const ongoingHaid = catatanList.find((c) => c.status === 'haid_aktif');

  // Toggle keluhan
  const toggleKeluhan = (k: string) => {
    setFormKeluhan((prev) =>
      prev.includes(k) ? prev.filter((item) => item !== k) : [...prev, k]
    );
  };

  // Submit new / updated record
  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student.id || !user) {
      setErrorMsg('Sesi berakhir atau data santri belum siap.');
      return;
    }
    if (!formMulai) {
      setErrorMsg('Tanggal mulai haid wajib diisi.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const payload = {
        siswa_id: student.id,
        nama_siswi: student.name,
        kelas: student.kelas,
        rayon: student.rayon,
        tanggal_mulai: formMulai,
        tanggal_selesai: formStatus === 'selesai_suci' ? formSelesai || formMulai : null,
        status: formStatus,
        minum_ttd: formMinumTTD,
        keluhan: formKeluhan,
        catatan: formCatatan.trim(),
        dicatat_oleh: user.uid,
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'catatan_menstruasi'), {
        ...payload,
        createdAt: serverTimestamp(),
      });

      setSuccessMsg('Catatan siklus berhasil disimpan.');
      setShowForm(false);
      setFormKeluhan([]);
      setFormCatatan('');
      setFormSelesai('');
      setFormMinumTTD(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg('Gagal menyimpan: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Mark active period as finished / suci
  const handleTandaiSuci = async (record: MenstruasiRecord) => {
    const today = new Date().toISOString().split('T')[0];
    try {
      await updateDoc(doc(db, 'catatan_menstruasi', record.id), {
        status: 'selesai_suci',
        tanggal_selesai: today,
        updatedAt: serverTimestamp(),
      });
      setSuccessMsg('Alhamdulillah, status ditandai sudah suci.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg('Gagal memperbarui status: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Visual calendar calculation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Helper to check if a day in current calendar month is within any haid range
  const isHaidDay = (day: number) => {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return catatanList.some((c) => {
      if (c.status === 'haid_aktif') {
        return dStr >= c.tanggal_mulai;
      }
      if (c.tanggal_selesai) {
        return dStr >= c.tanggal_mulai && dStr <= c.tanggal_selesai;
      }
      return dStr === c.tanggal_mulai;
    });
  };

  const isToday = (day: number) => {
    const now = new Date();
    return (
      now.getFullYear() === year &&
      now.getMonth() === month &&
      now.getDate() === day
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Quick Status */}
      <div className="bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-2xl p-4 shadow-md relative overflow-hidden">
        <div className="absolute right-[-10px] bottom-[-10px] opacity-15 pointer-events-none">
          <Droplets className="w-36 h-36" />
        </div>

        <div className="flex items-start justify-between relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-xs mb-1.5">
              <Droplets className="w-3.5 h-3.5 text-rose-200" />
              <span>Khusus Siswi Putri</span>
            </div>
            <h3 className="text-base font-bold">Kalender & Siklus Menstruasi</h3>
            <p className="text-xs text-rose-100 max-w-sm mt-0.5">
              Pencatatan siklus bulanan, pemantauan kesehatan rematri, dan dispensasi ibadah syar'i.
            </p>
          </div>
          {onTutup && (
            <button
              onClick={onTutup}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status Haid Card */}
        <div className="mt-3.5 pt-3 border-t border-white/20 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                ongoingHaid ? 'bg-amber-300 animate-pulse' : 'bg-emerald-300'
              }`}
            />
            <span className="text-xs font-bold">
              {ongoingHaid
                ? `Sedang Udzur Haid (Mulai: ${ongoingHaid.tanggal_mulai})`
                : 'Status: Suci (Wajib Sholat & Ibadah Rutin)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {ongoingHaid ? (
              <button
                type="button"
                onClick={() => handleTandaiSuci(ongoingHaid)}
                className="px-3 py-1 bg-white text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Tandai Sudah Suci (Mandi Wajib)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setFormStatus('haid_aktif');
                  setFormMulai(new Date().toISOString().split('T')[0]);
                  setShowForm(true);
                }}
                className="px-3 py-1 bg-white text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Catat Mulai Haid
              </button>
            )}
          </div>
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

      {/* Form Tambah Catatan */}
      {showForm && (
        <form
          onSubmit={handleSimpan}
          className="bg-white rounded-2xl p-4 shadow-sm border border-rose-200 space-y-3 text-xs animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h4 className="font-bold text-gray-800 flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-rose-500" />
              <span>Input Siklus Haid Santriwati</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Tanggal Mulai Haid *
              </label>
              <input
                type="date"
                required
                value={formMulai}
                onChange={(e) => setFormMulai(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Status Siklus</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
              >
                <option value="haid_aktif">Masih Berlangsung (Aktif)</option>
                <option value="selesai_suci">Sudah Selesai (Suci)</option>
              </select>
            </div>
          </div>

          {formStatus === 'selesai_suci' && (
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Tanggal Selesai Haid (Mandi Wajib)
              </label>
              <input
                type="date"
                value={formSelesai}
                onChange={(e) => setFormSelesai(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
              />
            </div>
          )}

          {/* Minum Tablet Tambah Darah (TTD) */}
          <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-rose-600" />
              <div>
                <span className="font-bold text-gray-800 block">Minum Tablet Tambah Darah (TTD)?</span>
                <span className="text-[11px] text-gray-500">
                  Program kesehatan remaja putri pencegahan anemia di asrama.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFormMinumTTD(!formMinumTTD)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                formMinumTTD
                  ? 'bg-rose-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600'
              }`}
            >
              {formMinumTTD ? 'Sudah Minum' : 'Belum Minum'}
            </button>
          </div>

          {/* Gejala / Keluhan */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1.5">
              Gejala / Keluhan Fisik (Pilih jika ada):
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DAFTAR_KELUHAN.map((k) => {
                const active = formKeluhan.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleKeluhan(k)}
                    className={`px-2.5 py-1 rounded-lg border transition-all text-xs ${
                      active
                        ? 'bg-rose-100 border-rose-400 text-rose-800 font-semibold shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Catatan Tambahan (Opsional)</label>
            <textarea
              rows={2}
              value={formCatatan}
              onChange={(e) => setFormCatatan(e.target.value)}
              placeholder="Contoh: Darah keluar deras hari ke-2, istirahat di UKS 1 jam..."
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-rose-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm disabled:bg-gray-300"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan…' : 'Simpan Siklus'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Visual Calendar View */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-rose-600" />
            <h4 className="font-bold text-gray-800 text-xs">
              Kalender Siklus ({monthNames[month]} {year})
            </h4>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of week */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-400 mb-1">
          <span>Min</span>
          <span>Sen</span>
          <span>Sel</span>
          <span>Rab</span>
          <span>Kam</span>
          <span>Jum</span>
          <span>Sab</span>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="h-8" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const haid = isHaidDay(day);
            const today = isToday(day);

            return (
              <div
                key={`day-${day}`}
                className={`h-8 rounded-xl flex items-center justify-center font-semibold transition-all relative ${
                  haid
                    ? 'bg-rose-500 text-white font-bold shadow-xs'
                    : today
                    ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title={haid ? 'Masa Haid / Udzur Sholat' : today ? 'Hari Ini' : undefined}
              >
                <span>{day}</span>
                {haid && (
                  <span className="absolute bottom-1 w-1 h-1 bg-white rounded-full" />
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-rose-500 rounded-md" />
            <span>Hari Menstruasi (Dispensasi Sholat)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded-md" />
            <span>Hari Ini</span>
          </div>
        </div>
      </div>

      {/* Riwayat Siklus Sebelumnya */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">
            Riwayat Siklus Menstruasi
          </h4>
          <button
            type="button"
            onClick={() => {
              setFormStatus('haid_aktif');
              setFormMulai(new Date().toISOString().split('T')[0]);
              setShowForm(true);
            }}
            className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg hover:bg-rose-100"
          >
            + Catat Siklus
          </button>
        </div>

        {loading ? (
          <div className="text-center py-6 text-xs text-gray-400">Memuat catatan siklus…</div>
        ) : catatanList.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400 bg-gray-50 rounded-xl">
            Belum ada catatan menstruasi tersimpan. Klik "+ Catat Siklus" di atas untuk memulai.
          </div>
        ) : (
          <div className="space-y-2">
            {catatanList.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-xl border flex items-start justify-between gap-2 text-xs ${
                  item.status === 'haid_aktif'
                    ? 'bg-rose-50/70 border-rose-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                        item.status === 'haid_aktif'
                          ? 'bg-rose-600 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {item.status === 'haid_aktif' ? 'Haid Aktif' : 'Selesai / Suci'}
                    </span>
                    <span className="font-bold text-gray-800">
                      {item.tanggal_mulai}
                      {item.tanggal_selesai ? ` s.d. ${item.tanggal_selesai}` : ' (berlangsung)'}
                    </span>
                  </div>

                  {item.keluhan && item.keluhan.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.keluhan.map((k) => (
                        <span
                          key={k}
                          className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.minum_ttd && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-semibold mt-1">
                      <Pill className="w-3 h-3" />
                      Minum Tablet Tambah Darah (TTD)
                    </span>
                  )}

                  {item.catatan && (
                    <p className="text-gray-500 italic mt-1 text-[11px]">{item.catatan}</p>
                  )}
                </div>

                {item.status === 'haid_aktif' && (
                  <button
                    type="button"
                    onClick={() => handleTandaiSuci(item)}
                    className="px-2.5 py-1 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg font-bold text-xs shrink-0 shadow-2xs"
                  >
                    Tandai Suci
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edukasi Fiqih Thaharah Wanita */}
      <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200 text-xs text-amber-900 space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-950">
          <Info className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Panduan Fiqih Thaharah & Udzur Syar'i (Mazhab Syafi'i)</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-amber-800 leading-relaxed text-[11px]">
          <li>
            <strong>Batas Minimal Haid:</strong> 1 hari 1 malam (24 jam secara akumulatif).
          </li>
          <li>
            <strong>Masa Kebiasaan:</strong> 6 sampai 7 hari.
          </li>
          <li>
            <strong>Batas Maksimal Haid:</strong> 15 hari 15 malam. Jika darah masih keluar setelah 15 hari, maka itu dihukumi darah <em>Istihadhah</em> (wajib mandi dan wajib sholat).
          </li>
          <li>
            <strong>Dispensasi di BKP Digital:</strong> Selama berstatus haid, kewajiban sholat otomatis mendapat dispensasi (tidak dianggap alpa sholat dan tidak mengurangi nilai pembiasaan karakter).
          </li>
        </ul>
      </div>
    </div>
  );
};

export default KalenderMenstruasi;
