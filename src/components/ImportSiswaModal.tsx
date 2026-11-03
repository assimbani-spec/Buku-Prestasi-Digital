/**
 * Modal untuk import massal data santri/siswa dari file Excel (.xlsx / .xls / .csv)
 */
import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import {
  downloadTemplateSiswa,
  readExcelFile,
  parseSiswaRows,
  type SiswaExcelRow,
} from '../lib/excelHelper';
import { db, doc, serverTimestamp, writeBatch } from '../lib/data';
import { newAuditRef, buildAuditPayload } from '../lib/audit';
import type { Aktor } from '../lib/aktor';

interface ImportSiswaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
  existingNisns: Set<string>;
  existingKelas: string[];
  existingRayon: string[];
  actor: Aktor | null;
}

export default function ImportSiswaModal({
  isOpen,
  onClose,
  onSuccess,
  existingNisns,
  existingKelas,
  existingRayon,
  actor,
}: ImportSiswaModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<{
    valid: SiswaExcelRow[];
    invalid: SiswaExcelRow[];
    duplicates: SiswaExcelRow[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'valid' | 'duplicates' | 'invalid'>('valid');
  const [autoAddMaster, setAutoAddMaster] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File) => {
    setErrorMsg(null);
    setFile(selectedFile);
    try {
      const rawData = await readExcelFile(selectedFile);
      if (!rawData || rawData.length === 0) {
        setErrorMsg('File Excel kosong atau tidak memiliki data yang dapat dibaca.');
        setParsedRows(null);
        return;
      }
      const parsed = parseSiswaRows(rawData, existingNisns);
      setParsedRows(parsed);
      if (parsed.valid.length > 0) {
        setActiveTab('valid');
      } else if (parsed.duplicates.length > 0) {
        setActiveTab('duplicates');
      } else {
        setActiveTab('invalid');
      }
    } catch (err: any) {
      setErrorMsg('Gagal membaca file Excel: ' + (err.message || String(err)));
      setParsedRows(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleStartImport = async () => {
    if (!parsedRows || parsedRows.valid.length === 0 || !actor) return;
    setIsProcessing(true);
    setErrorMsg(null);

    const itemsToImport = parsedRows.valid;
    const total = itemsToImport.length;
    setProgress({ current: 0, total });

    const CHUNK_SIZE = 150; // Aman dari batas 500 writes Firestore per batch
    const newKelasSet = new Set<string>();
    const newRayonSet = new Set<string>();
    const knownKelas = new Set(existingKelas.map((k) => k.toLowerCase()));
    const knownRayon = new Set(existingRayon.map((r) => r.toLowerCase()));

    try {
      // 1. Simpan master kelas & rayon baru jika diizinkan
      if (autoAddMaster) {
        itemsToImport.forEach((item) => {
          if (item.kelas && !knownKelas.has(item.kelas.toLowerCase())) {
            newKelasSet.add(item.kelas);
          }
          if (item.rayon && !knownRayon.has(item.rayon.toLowerCase())) {
            newRayonSet.add(item.rayon);
          }
        });

        if (newKelasSet.size > 0 || newRayonSet.size > 0) {
          const masterBatch = writeBatch(db);
          newKelasSet.forEach((kName) => {
            const kId = kName.toLowerCase().replace(/[^a-z0-9]/g, '-');
            masterBatch.set(
              doc(db, 'master_kelas', kId),
              { nama: kName, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
              { merge: true }
            );
          });
          newRayonSet.forEach((rName) => {
            const rId = rName.toLowerCase().replace(/[^a-z0-9]/g, '-');
            masterBatch.set(
              doc(db, 'master_rayon', rId),
              { nama: rName, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
              { merge: true }
            );
          });
          await masterBatch.commit();
        }
      }

      // 2. Simpan santri dalam chunk batch
      let processed = 0;
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = itemsToImport.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        for (const item of chunk) {
          const studentId =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? `sis-${crypto.randomUUID()}`
              : `sis-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

          const gender: 'L' | 'P' =
            item.name.toLowerCase().includes('siti') ||
            item.name.toLowerCase().includes('nur') ||
            item.name.toLowerCase().includes('aisyah') ||
            item.name.toLowerCase().includes('fatimah')
              ? 'P'
              : 'L';

          // Dokumen students/{id}
          batch.set(doc(db, 'students', studentId), {
            id: studentId,
            name: item.name,
            nisn: item.nisn,
            kelas: item.kelas,
            rayon: item.rayon,
            gender,
            points: item.points || 1000,
            waliName: item.waliName || '',
            waliPhone: item.waliPhone || '',
            studentEmail: item.studentEmail || '',
            waliEmail: item.waliEmail || '',
            dibuat_oleh: actor.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Indeks NISN untuk pencegahan duplikasi
          batch.set(doc(db, 'nisn_index', item.nisn), {
            nisn: item.nisn,
            studentId,
            createdAt: serverTimestamp(),
          });
        }

        await batch.commit();
        processed += chunk.length;
        setProgress({ current: processed, total });
        // Jeda sangat singkat untuk menjaga kestabilan thread
        await new Promise((res) => setTimeout(res, 50));
      }

      // 3. Catat 1 entri audit log terpadu (hemat kuota dan rapi)
      const auditBatch = writeBatch(db);
      auditBatch.set(
        newAuditRef(),
        buildAuditPayload({
          actor: actor,
          action: 'student_create',
          collectionName: 'students',
          docId: `bulk-import-${Date.now()}`,
          meta: {
            tipe: 'import_excel_massal',
            jumlah: total,
            file: file?.name || 'excel_import',
            kelasBaru: Array.from(newKelasSet),
            rayonBaru: Array.from(newRayonSet),
          },
        })
      );
      await auditBatch.commit();

      onSuccess(total);
      onClose();
    } catch (err: any) {
      setErrorMsg('Gagal mengimpor data: ' + (err.message || String(err)));
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-green-100 flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-green-50/70 to-emerald-50/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2E7D32] text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 leading-tight">
                Import Massal Data Santri (Excel)
              </h3>
              <p className="text-xs text-gray-500">
                Unggah banyak data siswa sekaligus tanpa input manual satu per satu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Area Template & Upload */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Box 1: Unduh template */}
            <div className="p-3.5 bg-green-50/70 rounded-xl border border-green-200 flex flex-col justify-between">
              <div>
                <span className="font-bold text-green-900 flex items-center gap-1.5 mb-1">
                  <Download className="w-4 h-4 text-[#2E7D32]" /> 1. Unduh Template
                </span>
                <p className="text-[11px] text-green-800 leading-relaxed">
                  Gunakan format resmi agar susunan kolom sesuai (NISN, Nama, Kelas, Rayon, Poin, Wali).
                </p>
              </div>
              <button
                type="button"
                onClick={downloadTemplateSiswa}
                className="mt-3 w-full py-2 px-3 bg-white hover:bg-green-100 text-green-900 font-bold rounded-lg border border-green-300 shadow-2xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#2E7D32]" />
                Unduh Format Excel (.xlsx)
              </button>
            </div>

            {/* Box 2 & 3: Upload file */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="md:col-span-2 p-4 border-2 border-dashed border-gray-300 hover:border-[#2E7D32] hover:bg-green-50/30 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-gray-50/60"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="w-10 h-10 rounded-full bg-green-100 text-[#2E7D32] flex items-center justify-center mb-1.5">
                <Upload className="w-5 h-5" />
              </div>
              <p className="font-bold text-gray-800">
                {file ? file.name : 'Klik untuk pilih file Excel atau tarik file ke sini'}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Format yang didukung: .xlsx, .xls, .csv (Maksimal 2.000 siswa per file)
              </p>
            </div>
          </div>

          {/* Hasil Pembacaan & Preview */}
          {parsedRows && (
            <div className="space-y-3 pt-1">
              {/* Statistik Kartu */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('valid')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    activeTab === 'valid'
                      ? 'bg-emerald-50 border-emerald-300 shadow-xs'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Siap Diimpor
                  </span>
                  <p className="text-base font-extrabold text-emerald-800">
                    {parsedRows.valid.length} Siswa
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('duplicates')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    activeTab === 'duplicates'
                      ? 'bg-amber-50 border-amber-300 shadow-xs'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> NISN Duplikat (Dilewati)
                  </span>
                  <p className="text-base font-extrabold text-amber-800">
                    {parsedRows.duplicates.length} Siswa
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('invalid')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    activeTab === 'invalid'
                      ? 'bg-red-50 border-red-300 shadow-xs'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600" /> Data Tidak Lengkap
                  </span>
                  <p className="text-base font-extrabold text-red-800">
                    {parsedRows.invalid.length} Baris
                  </p>
                </button>
              </div>

              {/* Tabel Pratinjau */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 sticky top-0 border-b border-gray-200">
                      <tr>
                        <th className="p-2">NISN</th>
                        <th className="p-2">Nama Santri</th>
                        <th className="p-2">Kelas</th>
                        <th className="p-2">Rayon</th>
                        <th className="p-2 text-right">Poin</th>
                        <th className="p-2">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activeTab === 'valid' &&
                        parsedRows.valid.map((r, i) => (
                          <tr key={i} className="hover:bg-emerald-50/40">
                            <td className="p-2 font-mono font-medium">{r.nisn}</td>
                            <td className="p-2 font-semibold text-gray-900">{r.name}</td>
                            <td className="p-2">{r.kelas}</td>
                            <td className="p-2">{r.rayon}</td>
                            <td className="p-2 text-right font-bold text-green-900">{r.points}</td>
                            <td className="p-2 text-emerald-700 font-medium">✓ Valid</td>
                          </tr>
                        ))}

                      {activeTab === 'duplicates' &&
                        parsedRows.duplicates.map((r, i) => (
                          <tr key={i} className="hover:bg-amber-50/40 bg-amber-50/20">
                            <td className="p-2 font-mono font-medium text-amber-900">{r.nisn}</td>
                            <td className="p-2 font-semibold text-gray-800">{r.name}</td>
                            <td className="p-2">{r.kelas}</td>
                            <td className="p-2">{r.rayon}</td>
                            <td className="p-2 text-right">{r.points}</td>
                            <td className="p-2 text-amber-700 font-medium">{r.error}</td>
                          </tr>
                        ))}

                      {activeTab === 'invalid' &&
                        parsedRows.invalid.map((r, i) => (
                          <tr key={i} className="hover:bg-red-50/40 bg-red-50/20">
                            <td className="p-2 font-mono text-gray-400">{r.nisn || '-'}</td>
                            <td className="p-2 font-semibold text-red-800">{r.name || '(Kosong)'}</td>
                            <td className="p-2">{r.kelas || '-'}</td>
                            <td className="p-2">{r.rayon || '-'}</td>
                            <td className="p-2 text-right">{r.points}</td>
                            <td className="p-2 text-red-700 font-medium">{r.error}</td>
                          </tr>
                        ))}

                      {activeTab === 'valid' && parsedRows.valid.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-gray-400">
                            Tidak ada data santri yang valid untuk diimpor.
                          </td>
                        </tr>
                      )}
                      {activeTab === 'duplicates' && parsedRows.duplicates.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-gray-400">
                            Bagus! Tidak ada NISN duplikat.
                          </td>
                        </tr>
                      )}
                      {activeTab === 'invalid' && parsedRows.invalid.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-gray-400">
                            Bagus! Seluruh baris data terisi lengkap.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Opsi Tambahan */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                  <input
                    type="checkbox"
                    checked={autoAddMaster}
                    onChange={(e) => setAutoAddMaster(e.target.checked)}
                    className="w-4 h-4 accent-[#2E7D32]"
                  />
                  <span>
                    Daftarkan Kelas & Rayon baru ke Master Data secara otomatis jika belum ada di sistem
                  </span>
                </label>
                <p className="text-[11px] text-gray-500 pl-6 leading-relaxed">
                  Contoh: Jika ada santri di kelas &ldquo;X Farmasi B&rdquo; dan kelas tersebut belum dibuat di panel admin, sistem akan otomatis menambahkannya ke master kelas.
                </p>
              </div>

              {/* Indikator Progres */}
              {isProcessing && progress && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-green-900">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin text-[#2E7D32]" />
                      Mengimpor data siswa ke sistem...
                    </span>
                    <span>
                      {progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-green-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#2E7D32] h-full transition-all duration-150"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="text-[11px] text-gray-500 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
            <span>Poin awal otomatis diisi 1000 jika kolom poin dikosongkan.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-40"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleStartImport}
              disabled={!parsedRows || parsedRows.valid.length === 0 || isProcessing}
              className="px-5 py-2 text-xs font-bold text-white bg-[#2E7D32] hover:bg-[#1B5E20] rounded-xl shadow-xs disabled:bg-gray-300 flex items-center gap-1.5 transition-colors"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Mulai Impor ({parsedRows?.valid.length || 0} Siswa)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
