/**
 * Modal untuk import massal data Master Kategori Poin dari file Excel (.xlsx / .xls / .csv)
 */
import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Award,
} from 'lucide-react';
import {
  downloadTemplateKategori,
  readExcelFile,
  parseKategoriRows,
  type KategoriExcelRow,
} from '../lib/excelHelper';
import { db, doc, serverTimestamp, writeBatch } from '../lib/data';
import { newAuditRef, buildAuditPayload } from '../lib/audit';
import type { Aktor } from '../lib/aktor';

interface ImportKategoriModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
  actor: Aktor | null;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function ImportKategoriModal({
  isOpen,
  onClose,
  onSuccess,
  actor,
}: ImportKategoriModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<{
    valid: KategoriExcelRow[];
    invalid: KategoriExcelRow[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'valid' | 'invalid'>('valid');
  const [isProcessing, setIsProcessing] = useState(false);
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
      const parsed = parseKategoriRows(rawData);
      setParsedRows(parsed);
      setActiveTab(parsed.valid.length > 0 ? 'valid' : 'invalid');
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
    const CHUNK_SIZE = 200;

    try {
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = itemsToImport.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        for (const item of chunk) {
          const id = slug(item.kode);
          batch.set(
            doc(db, 'master_kategori_poin', id),
            {
              kode: item.kode,
              tipe: item.tipe,
              kategori: item.kategori,
              deskripsi: item.deskripsi,
              poin: item.poin,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        await batch.commit();
        await new Promise((res) => setTimeout(res, 50));
      }

      // 1 entri audit log terpadu
      const auditBatch = writeBatch(db);
      auditBatch.set(
        newAuditRef(),
        buildAuditPayload({
          actor: actor,
          action: 'master_create',
          collectionName: 'master_kategori_poin',
          docId: `bulk-kategori-${Date.now()}`,
          meta: {
            tipe: 'import_bulk_kategori',
            jumlah: total,
            file: file?.name || 'excel_kategori',
          },
        })
      );
      await auditBatch.commit();

      onSuccess(total);
      onClose();
    } catch (err: any) {
      setErrorMsg('Gagal mengimpor kategori poin: ' + (err.message || String(err)));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-green-100 flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-green-50/70 to-emerald-50/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2E7D32] text-white flex items-center justify-center shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 leading-tight">
                Import Kategori Poin (Excel)
              </h3>
              <p className="text-xs text-gray-500">
                Unggah tata tertib poin apresiasi dan konsekuensi sekaligus
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
                  Gunakan format resmi: Kode, Tipe (apresiasi/konsekuensi), Pilar, Deskripsi, Poin.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadTemplateKategori}
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
                Format yang didukung: .xlsx, .xls, .csv
              </p>
            </div>
          </div>

          {/* Pratinjau Kategori */}
          {parsedRows && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2">
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
                    {parsedRows.valid.length} Kategori
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
                    <AlertCircle className="w-3.5 h-3.5 text-red-600" /> Tidak Lengkap / Rusak
                  </span>
                  <p className="text-base font-extrabold text-red-800">
                    {parsedRows.invalid.length} Baris
                  </p>
                </button>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 sticky top-0 border-b border-gray-200">
                      <tr>
                        <th className="p-2">Kode</th>
                        <th className="p-2">Tipe</th>
                        <th className="p-2">Pilar/Kategori</th>
                        <th className="p-2">Deskripsi Perilaku</th>
                        <th className="p-2 text-right">Poin</th>
                        <th className="p-2">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activeTab === 'valid' &&
                        parsedRows.valid.map((r, i) => (
                          <tr key={i} className="hover:bg-emerald-50/40">
                            <td className="p-2 font-mono font-bold text-gray-900">{r.kode}</td>
                            <td className="p-2">
                              <span
                                className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                                  r.tipe === 'apresiasi'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {r.tipe === 'apresiasi' ? 'Apresiasi (+)' : 'Konsekuensi (-)'}
                              </span>
                            </td>
                            <td className="p-2">{r.kategori}</td>
                            <td className="p-2">{r.deskripsi}</td>
                            <td className="p-2 text-right font-bold">{r.poin}</td>
                            <td className="p-2 text-emerald-700 font-medium">✓ Valid</td>
                          </tr>
                        ))}

                      {activeTab === 'invalid' &&
                        parsedRows.invalid.map((r, i) => (
                          <tr key={i} className="hover:bg-red-50/40 bg-red-50/20">
                            <td className="p-2 font-mono font-bold text-red-900">{r.kode || '-'}</td>
                            <td className="p-2">{r.tipe}</td>
                            <td className="p-2">{r.kategori}</td>
                            <td className="p-2">{r.deskripsi || '-'}</td>
                            <td className="p-2 text-right">{r.poin}</td>
                            <td className="p-2 text-red-700 font-medium">{r.error}</td>
                          </tr>
                        ))}

                      {activeTab === 'valid' && parsedRows.valid.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-gray-400">
                            Tidak ada kategori yang valid untuk diimpor.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="text-[11px] text-gray-500 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
            <span>Kategori dengan kode yang sama akan diperbarui nilainya.</span>
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
                  Mengimpor...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Mulai Impor ({parsedRows?.valid.length || 0} Kategori)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
