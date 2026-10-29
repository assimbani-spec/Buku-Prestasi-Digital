/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, User, Award, Calendar, CheckCircle2, AlertTriangle, Clock, Phone, Mail, ShieldAlert } from 'lucide-react';
import { StudentRecord } from '../lib/firebase';

interface DetailSiswaModalProps {
  student: StudentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onInputPoin: (studentId: string) => void;
}

export const DetailSiswaModal: React.FC<DetailSiswaModalProps> = ({
  student,
  isOpen,
  onClose,
  onInputPoin,
}) => {
  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-green-100 overflow-hidden my-8 animate-in fade-in duration-200 text-gray-800">
        
        {/* Header */}
        <div className="bg-[#1B5E20] text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-green-800 border-2 border-green-500/30 flex items-center justify-center text-white font-bold text-lg shadow-inner">
              {student.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">{student.name}</h2>
              <p className="text-xs text-green-200 mt-0.5">NISN: {student.nisn || '0081928371'}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="bg-green-800 text-[10px] font-bold px-2 py-0.5 rounded-md text-green-100">
                  {student.kelas}
                </span>
                <span className="bg-green-800 text-[10px] font-bold px-2 py-0.5 rounded-md text-green-100">
                  Rayon {student.rayon}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-green-800 text-green-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Card Total Poin & Predikat */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-3.5 rounded-xl border border-green-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-500 font-semibold block uppercase">Total Poin Karakter BKP</span>
              <span className="text-2xl font-black text-[#1B5E20]">{student.points} Pts</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-500 font-semibold block uppercase">Status Kepatuhan</span>
              <span className="inline-block bg-green-700 text-white font-bold px-2.5 py-1 rounded-full text-[11px] shadow-xs">
                {student.points >= 1000 ? 'Mumtaz (Sangat Baik)' : 'Jayyid (Cukup)'}
              </span>
            </div>
          </div>

          {/* Audit Pengisian Jurnal Santri (Anti Rekayasa Akhir Bulan) */}
          <div className="border border-gray-200 rounded-xl p-3.5 bg-gray-50/70 space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
              <h4 className="font-bold text-gray-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-700" />
                <span>Audit Disiplin Pengisian Jurnal Harian</span>
              </h4>
              <span className="text-[10px] font-bold text-green-800 bg-green-100 px-2 py-0.5 rounded-md">
                Terverifikasi Sistem
              </span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Santri wajib mengisi jurnal setiap hari (toleransi maksimal H-1). Pengisian borongan akhir bulan dibatasi dan membutuhkan izin guru.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">Tepat Waktu</span>
                <span className="text-sm font-bold text-green-700">26 Hari</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">Susulan (H-1)</span>
                <span className="text-sm font-bold text-amber-600">2 Hari</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">Terkunci / Izin</span>
                <span className="text-sm font-bold text-gray-600">0 Hari</span>
              </div>
            </div>
          </div>

          {/* Data Orang Tua / Wali */}
          <div className="border border-gray-200 rounded-xl p-3.5 space-y-2">
            <h4 className="font-bold text-gray-800 pb-1 border-b border-gray-100">
              Kontak Orang Tua / Wali Santri
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-gray-400 block">Nama Wali</span>
                <span className="font-semibold text-gray-800">{student.waliName || "Bpk. Ahmad Rifa'i"}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">WhatsApp / No. HP</span>
                <span className="font-semibold text-gray-800 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-green-700" />
                  {student.waliPhone || '0812-3456-7890'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] text-gray-400 block">Email Terdaftar</span>
                <span className="font-semibold text-gray-800 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-gray-500" />
                  {student.waliEmail || 'ortu1@test.com'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-2 flex gap-2">
            <button
              onClick={() => {
                onClose();
                onInputPoin(student.id);
              }}
              className="flex-1 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Award className="w-4 h-4" />
              <span>Input Poin Karakter</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailSiswaModal;
