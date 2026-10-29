/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserPlus, X, Save, AlertCircle, CheckCircle2, School, User, Phone, Mail, Award, MapPin } from 'lucide-react';
import { db, handleFirestoreError, OperationType, StudentRecord } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface TambahSiswaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentAdded: (newStudent: StudentRecord) => void;
}

const DAFTAR_KELAS = [
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

const DAFTAR_RAYON = [
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
}) => {
  const [name, setName] = useState('');
  const [nisn, setNisn] = useState('');
  const [kelas, setKelas] = useState(DAFTAR_KELAS[2]); // X Farmasi A
  const [rayon, setRayon] = useState(DAFTAR_RAYON[1]); // Assimbani 1
  const [waliName, setWaliName] = useState('');
  const [waliPhone, setWaliPhone] = useState('');
  const [waliEmail, setWaliEmail] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [initialPoints, setInitialPoints] = useState(1000);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama lengkap siswa wajib diisi.');
      return;
    }
    if (!nisn.trim()) {
      setErrorMsg('NISN siswa wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const newId = `sis_${Date.now()}`;
    const studentData: StudentRecord = {
      id: newId,
      name: name.trim(),
      nisn: nisn.trim(),
      kelas,
      rayon,
      points: Number(initialPoints) || 1000,
      waliName: waliName.trim() || undefined,
      waliPhone: waliPhone.trim() || undefined,
      waliEmail: waliEmail.trim() || undefined,
      studentEmail: studentEmail.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      // Simpan ke Firestore
      await setDoc(doc(db, 'students', newId), {
        ...studentData,
        dibuat_oleh: 'Guru / BK SMK Thibbil Qulub Assimbani',
      });
    } catch (err) {
      console.warn('Firestore write warning:', err);
      // Tetap lanjutkan pembaruan state lokal
    }

    setLoading(false);
    setSuccessMsg(true);
    onStudentAdded(studentData);

    setTimeout(() => {
      setSuccessMsg(false);
      onClose();
      // Reset form
      setName('');
      setNisn('');
      setWaliName('');
      setWaliPhone('');
      setWaliEmail('');
      setStudentEmail('');
      setInitialPoints(1000);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-green-100 overflow-hidden my-8 animate-in fade-in duration-200">
        
        {/* Header Modal */}
        <div className="bg-[#1B5E20] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-800 rounded-xl">
              <UserPlus className="w-5 h-5 text-green-200" />
            </div>
            <div>
              <h2 className="text-base font-bold">Input Data Santri Baru</h2>
              <p className="text-xs text-green-200">Tambahkan master santri ke Buku Kejar Prestasi (BKP)</p>
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
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block border-b border-gray-100 pb-1">
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
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Kelas & Rombel</label>
                <select
                  value={kelas}
                  onChange={(e) => setKelas(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#2E7D32] outline-none font-medium"
                >
                  {DAFTAR_KELAS.map((k) => (
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
                  {DAFTAR_RAYON.map((r) => (
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
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block border-b border-gray-100 pb-1">
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
                  <span>Simpan Data Santri</span>
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
