/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { UserPlus, X, Save, AlertCircle, CheckCircle2, User, Phone, Mail, Award, Edit } from 'lucide-react';
import type { StudentRecord } from '../lib/tipe';
import { tambahSiswa, updateSiswa } from '../features/siswa/siswa';
import { collection, db, onSnapshot } from '../lib/data';

interface TambahSiswaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentAdded: (newStudent: StudentRecord) => void;
  /** Role pelaku, dipakai untuk audit log. */
  actorRole?: string;
  /** Akun pelaku (uid, email) untuk audit log. */
  actor?: { uid: string; email: string | null } | null;
  /** Santri yang sedang diedit (bila mode ubah data). */
  editingStudent?: StudentRecord | null;
}

const DEFAULT_KELAS = [
  'X TKJ 1',
  'X TKJ 2',
  'X Farmasi A',
  'X Farmasi B',
  'X Keperawatan A',
  'X Keperawatan B',
  'XI Farmasi A',
  'XI Farmasi B',
  'XI Keperawatan A',
  'XI Keperawatan B',
  'XII Farmasi Industri',
  'XII Keperawatan Medikal',
];

const DEFAULT_RAYON = [
  'Simbang 2',
  'Assimbani 1',
  'Assimbani 2',
  'Siti Khadijah 1',
  'Siti Khadijah 2',
  'Siti Aisyah 1',
  'Siti Aisyah 2',
  'Ibnu Sina',
];

export const TambahSiswaModal: React.FC<TambahSiswaModalProps> = ({
  isOpen,
  onClose,
  onStudentAdded,
  actorRole,
  actor,
  editingStudent,
}) => {
  const [daftarKelas, setDaftarKelas] = useState<string[]>(DEFAULT_KELAS);
  const [daftarRayon, setDaftarRayon] = useState<string[]>(DEFAULT_RAYON);

  const [name, setName] = useState('');
  const [nisn, setNisn] = useState('');
  const [gender, setGender] = useState<'L' | 'P'>('P');
  const [kelas, setKelas] = useState(DEFAULT_KELAS[2]);
  const [rayon, setRayon] = useState(DEFAULT_RAYON[1]);
  const [waliName, setWaliName] = useState('');
  const [waliPhone, setWaliPhone] = useState('');
  const [waliEmail, setWaliEmail] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [initialPoints, setInitialPoints] = useState(1000);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);

  // Muat daftar kelas dan rayon dari master data secara real-time
  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'master_kelas'), (snap) => {
        const dbKelas = snap.docs.map((d) => ((d.data() as any).nama || d.id).trim()).filter(Boolean);
        const combined = Array.from(new Set([...DEFAULT_KELAS, ...dbKelas])).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true })
        );
        setDaftarKelas(combined);
      }),
      onSnapshot(collection(db, 'master_rayon'), (snap) => {
        const dbRayon = snap.docs.map((d) => ((d.data() as any).nama || d.id).trim()).filter(Boolean);
        const combined = Array.from(new Set([...DEFAULT_RAYON, ...dbRayon])).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true })
        );
        setDaftarRayon(combined);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // Isi form jika sedang dalam mode edit
  useEffect(() => {
    if (editingStudent) {
      setName(editingStudent.name || '');
      setNisn(editingStudent.nisn || '');
      setGender(editingStudent.gender || 'P');
      setKelas(editingStudent.kelas || (daftarKelas[0] ?? ''));
      setRayon(editingStudent.rayon || (daftarRayon[0] ?? ''));
      setWaliName(editingStudent.waliName || '');
      setWaliPhone(editingStudent.waliPhone || '');
      setWaliEmail(editingStudent.waliEmail || '');
      setStudentEmail(editingStudent.studentEmail || '');
      setInitialPoints(editingStudent.points ?? 1000);
    } else {
      setName('');
      setNisn('');
      setGender('P');
      setKelas(daftarKelas[0] ?? DEFAULT_KELAS[0]);
      setRayon(daftarRayon[0] ?? DEFAULT_RAYON[0]);
      setWaliName('');
      setWaliPhone('');
      setWaliEmail('');
      setStudentEmail('');
      setInitialPoints(1000);
    }
    setErrorMsg(null);
    setSuccessMsg(false);
  }, [editingStudent, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama lengkap santri wajib diisi.');
      return;
    }
    if (!nisn.trim()) {
      setErrorMsg('NISN santri wajib diisi.');
      return;
    }
    if (!actor) {
      setErrorMsg('Sesi berakhir. Silakan masuk kembali.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      if (editingStudent) {
        await updateSiswa(
          editingStudent.id,
          {
            name,
            nisn,
            kelas,
            rayon,
            gender,
            points: initialPoints,
            waliName,
            waliPhone,
            waliEmail,
            studentEmail,
          },
          { uid: actor.uid, email: actor.email, role: actorRole }
        );
        setSuccessMsg(true);
        onStudentAdded({
          ...editingStudent,
          name,
          nisn,
          kelas,
          rayon,
          gender,
          points: initialPoints,
          waliName: waliName || undefined,
          waliPhone: waliPhone || undefined,
          waliEmail: waliEmail || undefined,
          studentEmail: studentEmail || undefined,
        });
      } else {
        const student = await tambahSiswa(
          {
            name,
            nisn,
            kelas,
            rayon,
            gender,
            points: initialPoints,
            waliName,
            waliPhone,
            waliEmail,
            studentEmail,
          },
          { uid: actor.uid, email: actor.email, role: actorRole }
        );
        setSuccessMsg(true);
        onStudentAdded(student);
      }

      setTimeout(() => {
        setSuccessMsg(false);
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMsg(
        'Gagal menyimpan data ke database: ' + (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-green-100 overflow-hidden my-8 animate-in fade-in duration-200">
        
        {/* Header Modal */}
        <div className="bg-[#1B5E20] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-800 rounded-xl">
              {editingStudent ? (
                <Edit className="w-5 h-5 text-green-200" />
              ) : (
                <UserPlus className="w-5 h-5 text-green-200" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold">
                {editingStudent ? 'Ubah Data Santri' : 'Input Data Santri Baru'}
              </h2>
              <p className="text-xs text-green-200">
                {editingStudent
                  ? `Mengubah rincian kelas/rayon santri: ${editingStudent.name}`
                  : 'Tambahkan master santri ke Buku Kejar Prestasi (BKP)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-green-800 text-green-200 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>Alhamdulillah, data santri baru berhasil ditambahkan!</span>
            </div>
          )}

          {/* Section: Identitas Santri */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block border-b border-gray-100 pb-1">
              1. Identitas Akademik Santri
            </span>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Nama Lengkap Santri <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: Muhammad Rayhan Al-Fatih"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#2E7D32] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  NISN <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 0081234567"
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#2E7D32] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Jenis Kelamin</label>
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setGender('L')}
                    className={`py-1.5 px-2 rounded-xl border text-xs font-semibold transition-all ${
                      gender === 'L'
                        ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Putra (L)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('P')}
                    className={`py-1.5 px-2 rounded-xl border text-xs font-semibold transition-all ${
                      gender === 'P'
                        ? 'bg-rose-50 border-rose-400 text-rose-900 shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Putri (P)
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Poin Awal Karakter</label>
              <div className="relative">
                <Award className="w-4 h-4 text-emerald-600 absolute left-3 top-2.5" />
                <input
                  type="number"
                  value={initialPoints}
                  onChange={(e) => setInitialPoints(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#2E7D32] outline-none font-bold text-green-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Kelas & Rombel</label>
                <select
                  value={kelas}
                  onChange={(e) => setKelas(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#2E7D32] outline-none font-medium"
                >
                  {daftarKelas.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Rayon Asrama</label>
                <select
                  value={rayon}
                  onChange={(e) => setRayon(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#2E7D32] outline-none font-medium"
                >
                  {daftarRayon.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Email Akun Santri (Opsional untuk Login Siswa)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  placeholder="Contoh: rayhan@thibbilqulub.sch.id"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#2E7D32] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Orang Tua / Wali */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block border-b border-gray-100 pb-1">
              2. Data Orang Tua / Wali Santri
            </span>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Nama Orang Tua / Wali</label>
              <input
                type="text"
                placeholder="Contoh: Bpk. H. Rahmat Hidayat"
                value={waliName}
                onChange={(e) => setWaliName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#2E7D32] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">No. WhatsApp / HP</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    placeholder="Contoh: 08123456789"
                    value={waliPhone}
                    onChange={(e) => setWaliPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#2E7D32] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Email Wali Santri</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    placeholder="wali@example.com"
                    value={waliEmail}
                    onChange={(e) => setWaliEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#2E7D32] outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95 disabled:bg-gray-300"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{editingStudent ? 'Simpan Perubahan' : 'Simpan Data Santri'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TambahSiswaModal;
