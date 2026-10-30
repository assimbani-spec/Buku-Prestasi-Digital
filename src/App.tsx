/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import BottomNav, { NavTab } from './components/BottomNav';
import TambahSiswaModal from './components/TambahSiswaModal';
import DetailSiswaModal from './components/DetailSiswaModal';
import SignatureCanvas from 'react-signature-canvas';
import type { UserProfile, StudentRecord, PrestasiRecord } from './lib/firebase';
import {
  isLocalBackend,
  resetLocalData,
  signInWithEmail,
  signOutUser,
  watchAuthUser,
  type AppUser,
} from './lib/auth';
import { LOCAL_SEED_PASSWORD, ensureLocalSeed } from './lib/data/seed';
import { 
  db,
  doc, 
  getDoc, 
  setDoc, 
  addDoc,
  increment,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  collection, 
  writeBatch,
  onSnapshot
} from './lib/data';
import { 
  AppRoute,
  Role,
  routeForRole,
  roleLabel,
  isStaffRole,
  canVerifyPrestasi,
  canCreateStudent,
  canSeeAllStudents,
  profileStudentId,
  profileChildIds,
  profileRayonId
} from './lib/rbac';
import { logAuditSafe, newAuditRef, buildAuditPayload } from './lib/audit';

// Panel admin dan laporan (membawa recharts) hanya dimuat saat dibutuhkan,
// supaya siswa dan guru tidak mengunduh kode yang tidak mereka pakai.
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const LaporanBulananOrtu = lazy(() => import('./components/LaporanBulananOrtu'));
import { 
  BookOpen, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  X,
  Calendar,
  CheckSquare,
  Square,
  Save,
  Award,
  AlertTriangle,
  Sparkles,
  Sun,
  Moon,
  PenTool,
  RotateCcw,
  Check,
  ShieldAlert,
  Users,
  PlusCircle,
  LogOut,
  LayoutDashboard,
  Search,
  FileText,
  UserCheck,
  Smartphone,
  Monitor,
  HeartPulse,
  Activity,
  Stethoscope,
  Smile,
  Clock,
  Droplets,
  BedDouble,
  ShieldCheck,
  CheckCheck,
  Info,
  TrendingUp,
  BarChart3
} from 'lucide-react';

type StudentRow = {
  id: string;
  name: string;
  nisn: string;
  kelas: string;
  rayon: string;
  points: number;
  studentEmail?: string;
  waliEmail?: string;
};

/** Penanda saat potongan halaman sedang diunduh. */
function MemuatPanel({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-xs text-muted">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-700"
        aria-hidden="true"
      />
      Memuat {label}
    </div>
  );
}

/**
 * Modul yang belum punya penyimpanan data. Ditampilkan apa adanya supaya
 * tidak ada formulir yang seolah menyimpan padahal tidak.
 */
function ModulBelumTersedia({ judul }: { judul: string }) {
  return (
    <section className="rounded-card border border-line bg-surface px-4 py-8 text-center">
      <h2 className="text-sm font-semibold text-ink">{judul}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted">
        Modul ini belum tersambung ke database, sehingga isian belum bisa disimpan dan
        belum ditampilkan. Data yang Anda lihat sebelumnya adalah contoh tampilan.
      </p>
    </section>
  );
}

// Inisial nama sebagai penanda identitas. Tidak memakai foto/avatar buatan.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Nomor pekan ISO-8601 (Senin sebagai awal pekan), dipakai sebagai kunci rekap mingguan.
function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('login');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tab State for Mobile Roles
  const [siswaTab, setSiswaTab] = useState<NavTab>('jurnal');
  const [ortuTab, setOrtuTab] = useState<NavTab>('home');
  const [guruTab, setGuruTab] = useState<'dashboard' | 'input_poin' | 'verifikasi' | 'kesehatan' | 'siswa'>('dashboard');

  // Siswa State
  const [siswaDate, setSiswaDate] = useState(new Date().toISOString().split('T')[0]);
  const [siswaSaveSuccess, setSiswaSaveSuccess] = useState(false);
  const [jurnalView, setJurnalView] = useState<'harian' | 'mingguan' | 'non_rutin' | 'kesehatan'>('harian');
  const [poinTabFilter, setPoinTabFilter] = useState<'semua' | 'prestasi' | 'apresiasi' | 'konsekuensi'>('semua');
  
  // Pembiasaan Harian Lengkap Sesuai Dokumen Resmi BKP Hal 15-16 & 59
  const [jurnal, setJurnal] = useState({
    // Sholat Sunnah Utama
    tahajud: '4_rakaat' as '4_rakaat' | '2_rakaat' | 'tidak' | 'menstruasi', // 4 Rakaat (+6), 2 Rakaat (+3), Tidak (0), Menstruasi (M)
    dhuha: '4_rakaat' as '4_rakaat' | '2_rakaat' | 'tidak' | 'menstruasi',   // 4 Rakaat (+4), 2 Rakaat (+2), Tidak (0), Menstruasi (M)
    
    // 5 Sholat Fardhu
    subuh: 'berjamaah' as 'berjamaah' | 'masbuk' | 'munfarid' | 'menstruasi',
    dzuhur: 'berjamaah' as 'berjamaah' | 'masbuk' | 'munfarid' | 'menstruasi',
    ashar: 'berjamaah' as 'berjamaah' | 'masbuk' | 'munfarid' | 'menstruasi',
    maghrib: 'berjamaah' as 'berjamaah' | 'masbuk' | 'munfarid' | 'menstruasi',
    isya: 'berjamaah' as 'berjamaah' | 'masbuk' | 'munfarid' | 'menstruasi',
    
    // Spiritual & Quran
    mengaji: true,      // Mengaji/Menghafal Alquran (+1)
    zikir_pagi: true,   // Zikir Pagi (+1)
    zikir_sore: true,   // Zikir Sore (+1)
    
    // Aspek Kesehatan & Kebiasaan Fisik
    bangun_subuh: true, // Bangun sebelum pukul 5 (+1)
    tidur_awal: true,   // Tidur Sebelum Pukul 22.00 (+1 / -2)
    air_putih: true,    // Minum Air Putih 1,5 - 2 Liter (+1)
    mandi_2x: true,     // Mandi 2 kali setiap hari (+1)
    grooming: true,     // Grooming Diri (+8): Bersih, wangi, deodoran, kaos kaki, dalaman kerudung
    
    // Aspek Kewargaan
    kelompok_belajar: true, // Aktif dalam kelompok belajar (+4)
    sedang_menstruasi: false, // Dispensasi haid syar'i untuk siswi
    catatan: 'Mengaji QS. Al-Mulk ayat 1-15 bersama Ustadz pembina & sholat tahajud 4 rakaat',
  });

  // 12 Indikator Pembiasaan Mingguan (Pekanan)
  const [mingguan, setMingguan] = useState({
    sholat_jumat_keputrian: true,
    puasa_sunnah: false,
    berinfak: true,
    tablet_tambah_darah: true,
    olahraga: true,
    keramas_2x: true,
    kebersihan_diri: true,
    piket_rayon: true,
    daur_ulang: true,
    ekstrakurikuler: true,
    seni_budaya: true,
    kumpul_rayon: true,
    input_kejar_id: true,
  });

  // State Interaktif Kegiatan Non-Rutin (3-Mingguan, 9-Mingguan, Semester - Sesuai BKP Hal 20-22)
  const [nonRutinFilter, setNonRutinFilter] = useState<'Semua' | '3 Mingguan' | '9 Mingguan' | 'Semester'>('Semua');
  const [nonRutinSaveSuccess, setNonRutinSaveSuccess] = useState(false);
  const [nonRutinSaving, setNonRutinSaving] = useState(false);
  const [nonRutinList, setNonRutinList] = useState([
    {
      id: 'nr-1',
      kategori: '3 Mingguan',
      nama: 'Piket WC dan Ruang',
      mapel: 'PIPAS / P5',
      status: 'Ya, bersih dan rapi',
      poin: 150,
      saksi: 'Tugas P5',
      detail: '',
      options: [
        { label: 'Ya, bersih dan rapi (+150 Pts)', status: 'Ya, bersih dan rapi', poin: 150 },
        { label: 'Ya, tapi tidak rapi (+50 Pts)', status: 'Ya, tapi tidak rapi', poin: 50 },
        { label: 'Ya, kotor dan tidak rapi (0 Pts)', status: 'Ya, kotor dan tidak rapi', poin: 0 },
        { label: 'Tidak melaksanakan (-100 Pts / K 3.8)', status: 'Tidak melaksanakan', poin: -100 },
        { label: 'Tidak piket ada keterangan (-50 Pts / K 3.9)', status: 'Tidak piket ada keterangan', poin: -50 }
      ]
    },
    {
      id: 'nr-2',
      kategori: '3 Mingguan',
      nama: 'Upacara Bendera Hari Senin',
      mapel: 'PP',
      status: 'Mengikuti dgn khidmat',
      poin: 150,
      saksi: 'Wali Rayon / Guru Piket',
      detail: '',
      options: [
        { label: 'Mengikuti dgn khidmat (+150 Pts)', status: 'Mengikuti dgn khidmat', poin: 150 },
        { label: 'Mengikuti tapi tidak tertib / guyon (-50 Pts / K 1.14)', status: 'Mengikuti tapi tidak tertib / guyon', poin: -50 },
        { label: 'Tidak mengikuti izin/sakit (-50 Pts / K 2.17)', status: 'Tidak mengikuti izin/sakit', poin: -50 },
        { label: 'Tidak mengikuti alpa (-100 Pts / K 2.16)', status: 'Tidak mengikuti alpa', poin: -100 }
      ]
    },
    {
      id: 'nr-3',
      kategori: '3 Mingguan',
      nama: 'Pengajian Malam',
      mapel: 'PAIBP',
      status: 'Mengikuti sungguh-sungguh',
      poin: 150,
      saksi: 'Guru Agama / Pembina Asrama',
      detail: '',
      options: [
        { label: 'Mengikuti sungguh-sungguh (+150 Pts)', status: 'Mengikuti sungguh-sungguh', poin: 150 },
        { label: 'Mengikuti dgn guyon / tidur (-50 Pts / K 1.14)', status: 'Mengikuti dgn guyon / tidur', poin: -50 },
        { label: 'Tidak mengikuti izin/sakit (-50 Pts / K 2.17)', status: 'Tidak mengikuti izin/sakit', poin: -50 },
        { label: 'Tidak mengikuti alpa (-100 Pts / K 2.16)', status: 'Tidak mengikuti alpa', poin: -100 }
      ]
    },
    {
      id: 'nr-4',
      kategori: '3 Mingguan',
      nama: 'Jemur / Cuci Sepatu',
      mapel: 'PJOK',
      status: 'Melaksanakan',
      poin: 100,
      saksi: 'Orang Tua / Wali Asrama',
      detail: '',
      options: [
        { label: 'Melaksanakan (+100 Pts)', status: 'Melaksanakan', poin: 100 },
        { label: 'Tidak melaksanakan (0 Pts)', status: 'Tidak melaksanakan', poin: 0 }
      ]
    },
    {
      id: 'nr-5',
      kategori: '3 Mingguan',
      nama: 'Sarapan Bersama Menu Gizi Seimbang',
      mapel: 'PJOK',
      status: 'Ya, dengan menu gizi seimbang',
      poin: 100,
      saksi: 'Guru PJOK',
      detail: '',
      options: [
        { label: 'Ya, dengan menu gizi seimbang (+100 Pts)', status: 'Ya, dengan menu gizi seimbang', poin: 100 },
        { label: 'Ya, tanpa menu gizi seimbang (+50 Pts)', status: 'Ya, tanpa menu gizi seimbang', poin: 50 },
        { label: 'Tidak melaksanakan (0 Pts)', status: 'Tidak melaksanakan', poin: 0 }
      ]
    },
    {
      id: 'nr-6',
      kategori: '9 Mingguan',
      nama: 'Jumat Bersih Lingkungan Sekolah (Jumsih)',
      mapel: 'PIPAS',
      status: 'Mengikuti sungguh-sungguh',
      poin: 300,
      saksi: 'Guru Pendamping / Wali Rayon',
      detail: '',
      options: [
        { label: 'Mengikuti sungguh-sungguh (+300 Pts)', status: 'Mengikuti sungguh-sungguh', poin: 300 },
        { label: 'Mengikuti tapi guyon / tdk serius (-50 Pts / K 1.14)', status: 'Mengikuti tapi guyon / tdk serius', poin: -50 },
        { label: 'Tidak mengikuti izin/sakit (-50 Pts / K 2.17)', status: 'Tidak mengikuti izin/sakit', poin: -50 },
        { label: 'Tidak mengikuti alpa (-100 Pts / K 2.16)', status: 'Tidak mengikuti alpa', poin: -100 }
      ]
    },
    {
      id: 'nr-7',
      kategori: '9 Mingguan',
      nama: 'Pemeriksaan Kesehatan Skrining Berkala',
      mapel: 'PJOK / UKS',
      status: 'Mengikuti skrining lengkap',
      poin: 300,
      saksi: 'Petugas UKS / Puskesmas',
      detail: '',
      options: [
        { label: 'Mengikuti skrining lengkap (+300 Pts)', status: 'Mengikuti skrining lengkap', poin: 300 },
        { label: 'Mengikuti skrining sebagian (+150 Pts)', status: 'Mengikuti skrining sebagian', poin: 150 },
        { label: 'Tidak mengikuti izin/sakit (-150 Pts / K 5.9)', status: 'Tidak mengikuti izin/sakit', poin: -150 },
        { label: 'Tidak mengikuti alpa (-300 Pts / K 5.10)', status: 'Tidak mengikuti alpa', poin: -300 }
      ]
    },
    {
      id: 'nr-8',
      kategori: '9 Mingguan',
      nama: 'Diagnostik Literasi & Numerasi (Kelas 10)',
      mapel: 'Mapel Terkait',
      status: 'Mengikuti asesmen',
      poin: 300,
      saksi: 'Guru Pengawas / Kurikulum',
      detail: '',
      options: [
        { label: 'Mengikuti asesmen (+300 Pts)', status: 'Mengikuti asesmen', poin: 300 },
        { label: 'Tidak mengikuti asesmen (-100 Pts / K 2.16)', status: 'Tidak mengikuti asesmen', poin: -100 }
      ]
    },
    {
      id: 'nr-9',
      kategori: '9 Mingguan',
      nama: 'Setoran Target Hafalan Al-Quran 9 Pekan',
      mapel: 'PAIBP',
      status: 'Memenuhi target hafalan',
      poin: 500,
      saksi: 'Ustadz Pembina Tahfidz',
      detail: 'Surah Al-Mulk s.d. Al-Qalam (Juz 29)',
      options: [
        { label: 'Memenuhi target hafalan (+500 Pts)', status: 'Memenuhi target hafalan', poin: 500 },
        { label: 'Memenuhi separuh target hafalan (+250 Pts)', status: 'Memenuhi separuh target hafalan', poin: 250 },
        { label: 'Tidak setoran hafalan (0 Pts)', status: 'Tidak setoran hafalan', poin: 0 }
      ]
    },
    {
      id: 'nr-10',
      kategori: 'Semester',
      nama: 'Upacara Peringatan Hari Besar Nasional (PHBN)',
      mapel: 'PP',
      status: 'Mengikuti dgn khidmat',
      poin: 600,
      saksi: 'Guru PP / Waka Kesiswaan',
      detail: '',
      options: [
        { label: 'Mengikuti dgn khidmat (+600 Pts)', status: 'Mengikuti dgn khidmat', poin: 600 },
        { label: 'Mengikuti tapi tidak tertib (-50 Pts / K 1.14)', status: 'Mengikuti tapi tidak tertib', poin: -50 },
        { label: 'Tidak mengikuti izin/sakit (-50 Pts / K 2.17)', status: 'Tidak mengikuti izin/sakit', poin: -50 },
        { label: 'Tidak mengikuti tanpa keterangan (-100 Pts / K 2.16)', status: 'Tidak mengikuti tanpa keterangan', poin: -100 }
      ]
    },
    {
      id: 'nr-11',
      kategori: 'Semester',
      nama: 'Bakti Lingkungan & Bakti Sosial Rayon',
      mapel: 'Rayon / PIPAS',
      status: 'Mengikuti sungguh-sungguh',
      poin: 600,
      saksi: 'Wali Rayon / Pembimbing',
      detail: '',
      options: [
        { label: 'Mengikuti sungguh-sungguh (+600 Pts)', status: 'Mengikuti sungguh-sungguh', poin: 600 },
        { label: 'Mengikuti namun tdk bersungguh-sungguh (+300 Pts)', status: 'Mengikuti namun tdk bersungguh-sungguh', poin: 300 },
        { label: 'Tidak melaksanakan (0 Pts)', status: 'Tidak melaksanakan', poin: 0 }
      ]
    },
    {
      id: 'nr-12',
      kategori: 'Semester',
      nama: 'Tes VIERA Bahasa Inggris',
      mapel: 'B. Inggris',
      status: 'Mengikuti kegiatan',
      poin: 500,
      saksi: 'Guru B. Inggris',
      detail: '',
      options: [
        { label: 'Mengikuti kegiatan (+500 Pts)', status: 'Mengikuti kegiatan', poin: 500 },
        { label: 'Tidak mengikuti sakit/izin (0 Pts)', status: 'Tidak mengikuti sakit/izin', poin: 0 },
        { label: 'Tidak mengikuti alpa (-150 Pts / K 5.9)', status: 'Tidak mengikuti alpa', poin: -150 }
      ]
    }
    // Daftar di atas adalah kriteria resmi BKP, bukan isian siswa. Status dan
    // saksi sengaja dikosongkan sampai siswa benar-benar memilih.
  ].map((item) => ({ ...item, status: '', poin: 0, saksi: '' })));

  // Prestasi dimuat dari Firestore (collection "prestasi"):
  // siswa mengajukan (status pending, poin 0) → staf memverifikasi.
  const [prestasiList, setPrestasiList] = useState<(PrestasiRecord & { createdAtMs?: number })[]>([]);
  const [prestasiForm, setPrestasiForm] = useState({
    judul: '',
    kategori: 'Prestasi Kejuaraan',
    tingkat: 'Sekolah',
    capaian: '',
    tanggal: new Date().toISOString().split('T')[0],
    deskripsi: '',
  });
  const [prestasiSubmitting, setPrestasiSubmitting] = useState(false);
  const [prestasiMsg, setPrestasiMsg] = useState<string | null>(null);
  const [showFormPrestasi, setShowFormPrestasi] = useState(false);

  // Verifikasi prestasi oleh staf (guru / pembimbing rayon / admin)
  const [verifyPoin, setVerifyPoin] = useState<Record<string, number>>({});
  const [verifyCatatan, setVerifyCatatan] = useState<Record<string, string>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Master data & audit log (dipakai panel admin)
  const [masterKategori, setMasterKategori] = useState<
    { kode: string; tipe: 'apresiasi' | 'konsekuensi'; kategori: string; deskripsi: string; poin: number }[]
  >([]);

  // Ortu State
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);
  const [ttdSavedUrl, setTtdSavedUrl] = useState<string | null>(null);
  const [ttdSuccess, setTtdSuccess] = useState(false);
  const [ttdLoading, setTtdLoading] = useState(false);

  // Guru State
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedKode, setSelectedKode] = useState('A1.1');
  const [guruDeskripsi, setGuruDeskripsi] = useState('Sholat berjamaah tepat waktu 5 waktu berturut-turut di masjid');
  const [guruSuccess, setGuruSuccess] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Daftar santri dimuat dari Firestore (collection "students"),
  // sudah terbatas rayon/anak sendiri sesuai peran.
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [showTambahSiswa, setShowTambahSiswa] = useState(false);

  // Master Kode BKP Lengkap
  const masterKodes = [
    // APRESIASI & PRESTASI
    { kode: 'A 1.1', tipe: 'apresiasi', kategori: 'Beriman & Bertakwa', deskripsi: 'Memungut dan membuang sampah ke tempat sampah', poin: 200 },
    { kode: 'A 1.2', tipe: 'apresiasi', kategori: 'Beriman & Bertakwa', deskripsi: 'Merapikan fasilitas sekolah yang tidak pada tempatnya', poin: 300 },
    { kode: 'A 1.3', tipe: 'apresiasi', kategori: 'Ibadah', deskripsi: 'Menjadi imam sholat fardhu atau sholat sunnah', poin: 500 },
    { kode: 'A 1.4', tipe: 'apresiasi', kategori: 'Ibadah', deskripsi: 'Menjadi ketua kelompok sholat jumat', poin: 500 },
    { kode: 'A 1.5', tipe: 'apresiasi', kategori: 'Ibadah', deskripsi: 'Mengisi ceramah / kultum di hari Jumat', poin: 500 },
    { kode: 'A 1.9', tipe: 'apresiasi', kategori: 'Ibadah', deskripsi: 'Memberikan sumbangan (berinfak)', poin: 200 },
    { kode: 'A 1.10', tipe: 'apresiasi', kategori: 'Ibadah', deskripsi: 'Berpuasa sunnah ke-1 dalam 3 minggu', poin: 300 },
    { kode: 'A 1.11', tipe: 'apresiasi', kategori: 'Ibadah', deskripsi: 'Berpuasa sunnah ke-3 dalam 3 minggu', poin: 500 },
    { kode: 'A 1.13', tipe: 'apresiasi', kategori: 'Ibadah', deskripsi: 'Melaksanakan sholat Duha selama 3 minggu berturut-turut', poin: 300 },
    { kode: 'A 1.14', tipe: 'apresiasi', kategori: 'Ibadah', deskripsi: 'Melaksanakan sholat Tahajud selama 1 minggu berturut-turut', poin: 300 },
    { kode: 'A 1.15', tipe: 'apresiasi', kategori: 'Ibadah', deskripsi: 'Melaksanakan zikir pagi selama 1 minggu berturut-turut', poin: 300 },
    { kode: 'A 1.16', tipe: 'apresiasi', kategori: 'Ibadah', deskripsi: 'Melaksanakan zikir sore selama 1 minggu berturut-turut', poin: 500 },
    { kode: 'A 1.17', tipe: 'apresiasi', kategori: 'Tahfidz', deskripsi: 'Memenuhi target hafalan Alquran per 9 minggu', poin: 500 },
    { kode: 'A 2.1', tipe: 'apresiasi', kategori: 'Berkebhinekaan', deskripsi: 'Mengunggah informasi penerimaan siswa baru ke media sosial', poin: 300 },
    { kode: 'A 2.5', tipe: 'apresiasi', kategori: 'Upacara', deskripsi: 'Menjadi petugas upacara HUT Kemerdekaan RI', poin: 1000 },
    { kode: 'A 3.9', tipe: 'apresiasi', kategori: 'Gotong Royong', deskripsi: 'Melaksanakan seluruh piket rayon selama 9 minggu', poin: 300 },
    { kode: 'A 4.5', tipe: 'apresiasi', kategori: 'Mandiri & Sehat', deskripsi: 'Berolahraga durasi minimal 15 menit per minggu selama 9 minggu', poin: 500 },
    { kode: 'A 4.6', tipe: 'apresiasi', kategori: 'Mandiri & Sehat', deskripsi: 'Bangun sebelum pukul 05.00 selama 3 minggu berturut-turut', poin: 300 },
    { kode: 'A 4.7', tipe: 'apresiasi', kategori: 'Mandiri & Sehat', deskripsi: 'Tidur sebelum pukul 22.00 selama 3 minggu berturut-turut', poin: 300 },

    // KONSEKUENSI & TINDAKAN KURANG TERPUJI
    { kode: 'K 1.1', tipe: 'konsekuensi', kategori: 'Kebersihan', deskripsi: 'Membuang sampah sembarangan (Istighfar 3x, pilah sampah)', poin: 50 },
    { kode: 'K 1.2', tipe: 'konsekuensi', kategori: 'Adab', deskripsi: 'Makan/minum dengan berdiri atau berjalan', poin: 50 },
    { kode: 'K 1.3', tipe: 'konsekuensi', kategori: 'Adab', deskripsi: 'Makan/minum dengan tangan kiri', poin: 50 },
    { kode: 'K 1.6', tipe: 'konsekuensi', kategori: 'Ibadah', deskripsi: 'Tidak melaksanakan sholat fardhu', poin: 200 },
    { kode: 'K 1.8', tipe: 'konsekuensi', kategori: 'Ibadah', deskripsi: 'Tidak bersungguh-sungguh saat pengajian malam', poin: 100 },
    { kode: 'K 1.37', tipe: 'konsekuensi', kategori: 'Ibadah', deskripsi: 'Tidak melaksanakan Sholat Jumat / Tidak mengikuti Keputrian', poin: 150 },
    { kode: 'K 3.6', tipe: 'konsekuensi', kategori: 'Rayon', deskripsi: 'Tidak melaksanakan Piket Rayon (Piket pengganti 2x)', poin: 100 },
    { kode: 'K 3.7', tipe: 'konsekuensi', kategori: 'Rayon', deskripsi: 'Tidak mengikuti kumpul rayon tanpa izin', poin: 100 },
    { kode: 'K 4.1', tipe: 'konsekuensi', kategori: 'Disiplin', deskripsi: 'Terlambat hadir di sekolah', poin: 50 },
    { kode: 'K 4.3', tipe: 'konsekuensi', kategori: 'Disiplin', deskripsi: 'Tidak membawa buku kejar prestasi (BKP)', poin: 100 },
    { kode: 'K 4.4', tipe: 'konsekuensi', kategori: 'Kesehatan', deskripsi: 'Tidak membawa botol minum saat pelajaran olahraga', poin: 50 },
    { kode: 'K 4.18', tipe: 'konsekuensi', kategori: 'Disiplin', deskripsi: 'Membawa HP ke lingkungan sekolah tanpa izin', poin: 250 },
    { kode: 'K 5.9', tipe: 'konsekuensi', kategori: 'Kesehatan', deskripsi: 'Tidak mengikuti Pemeriksaan Kesehatan / Asesmen', poin: 150 },
  ];

  // Riwayat poin dimuat dari Firestore (collection "poin_log")
  const [poinLogs, setPoinLogs] = useState<{
    id: string;
    studentId: string;
    kode: string;
    tipe: string;
    deskripsi: string;
    poin: number;
    createdMs: number;
    time: string;
  }[]>([]);

  // Pemberitahuan resmi untuk akun ini (collection "notifikasi").
  const [notifikasiList, setNotifikasiList] = useState<{
    id: string;
    judul: string;
    isi: string;
    createdMs: number;
    time: string;
  }[]>([]);

  // ── Sesi & Profil (Firebase Auth + Firestore "profiles") ──────────
  const [sessionUser, setSessionUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileWarning, setProfileWarning] = useState<string | null>(null);

  const role = (profile?.role ?? null) as Role | null;
  const myStudentId = profileStudentId(profile);
  const myChildIds = profileChildIds(profile);
  const myRayonId = profileRayonId(profile);
  const accountEmail = (sessionUser?.email ?? '').toLowerCase();

  const loadProfileAndRoute = async (user: AppUser) => {
    const ref = doc(db, 'profiles', user.uid);
    let snap = await getDoc(ref);
    if (!snap.exists()) {
      // Profil belum ada: dibuat dengan hak paling rendah (siswa).
      // Role dinaikkan oleh admin (panel admin / Firebase Console).
      await setDoc(ref, {
        uid: user.uid,
        email: user.email ?? '',
        fullName: user.displayName || (user.email ?? '').split('@')[0],
        role: 'siswa',
        total_poin: 1000,
        createdAt: new Date().toISOString(),
      });
      snap = await getDoc(ref);
    }
    const data = snap.data() as UserProfile;
    setProfile(data);

    // Peringatan penautan agar admin tahu profil mana yang belum lengkap.
    const warnings: string[] = [];
    if (data.role === 'siswa' && !profileStudentId(data)) {
      warnings.push('Profil siswa belum memiliki studentId (tidak tertaut ke master santri).');
    }
    if (data.role === 'orang_tua' && profileChildIds(data).length === 0) {
      warnings.push('Profil orang tua belum memiliki childIds (belum ada anak yang tertaut).');
    }
    if (data.role === 'pembimbing_rayon' && !profileRayonId(data)) {
      warnings.push('Profil pembimbing rayon belum memiliki rayonId.');
    }
    setProfileWarning(warnings.length ? warnings.join(' ') : null);

    const route = routeForRole(data.role);
    setCurrentRoute(route);
  };

  useEffect(() => {
    let stopped = false;
    let unsub: (() => void) | undefined;

    // Mode lokal: data contoh dibuat sekali sebelum sesi dipulihkan.
    ensureLocalSeed()
      .catch(() => {
        /* kegagalan seed tidak mengunci layar; galat muncul saat baca data */
      })
      .then(() => {
        if (stopped) return;
        unsub = watchAuthUser(async (user) => {
          setSessionUser(user);
          if (user) {
            try {
              await loadProfileAndRoute(user);
              setErrorMsg(null);
            } catch (err) {
              setErrorMsg(
                'Gagal memuat profil pengguna: ' + (err instanceof Error ? err.message : String(err))
              );
              setCurrentRoute('login');
            }
          } else {
            setProfile(null);
            setCurrentRoute('login');
          }
          setAuthReady(true);
        });
      });

    return () => {
      stopped = true;
      unsub?.();
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // Query bertingkat sesuai peran.
  // Rules baru membatasi dokumen per peran, jadi setiap query WAJIB
  // memakai filter yang sejalan dengan rules (kalau tidak, Firestore
  // menolak permintaan dengan "Missing or insufficient permissions").
  // ═══════════════════════════════════════════════════════════════
  const mapStudentDoc = (id: string, data: any): StudentRow => ({
    id,
    name: data.name ?? '(tanpa nama)',
    nisn: data.nisn ?? '',
    kelas: data.kelas ?? '-',
    rayon: data.rayon ?? '-',
    points: Number(data.points) || 0,
    studentEmail: data.studentEmail ?? data.email ?? '',
    waliEmail: data.waliEmail ?? '',
  });

  // Daftar santri real-time (terbatas peran)
  useEffect(() => {
    if (!sessionUser || !profile) {
      setStudents([]);
      return;
    }

    const subs: Array<() => void> = [];
    const applyDocs = (docs: { id: string; data: () => any }[]) =>
      setStudents(docs.map((d) => mapStudentDoc(d.id, d.data())));
    const onErr = (label: string) => (err: Error) =>
      setErrorMsg(`${label}: ${err.message}`);

    if (canSeeAllStudents(role)) {
      // Guru & admin: seluruh koleksi.
      subs.push(
        onSnapshot(
          collection(db, 'students'),
          (snap) => applyDocs(snap.docs),
          onErr('Gagal memuat daftar santri')
        )
      );
    } else if (role === 'pembimbing_rayon') {
      if (!myRayonId) {
        setStudents([]);
      } else {
        subs.push(
          onSnapshot(
            query(collection(db, 'students'), where('rayon', '==', myRayonId)),
            (snap) => applyDocs(snap.docs),
            onErr('Gagal memuat santri rayon')
          )
        );
      }
    } else if (role === 'siswa') {
      if (myStudentId) {
        subs.push(
          onSnapshot(
            doc(db, 'students', myStudentId),
            (snap) => setStudents(snap.exists() ? [mapStudentDoc(snap.id, snap.data())] : []),
            onErr('Gagal memuat data santri')
          )
        );
      } else if (accountEmail) {
        subs.push(
          onSnapshot(
            query(collection(db, 'students'), where('studentEmail', '==', accountEmail)),
            (snap) => applyDocs(snap.docs),
            onErr('Gagal memuat data santri')
          )
        );
      } else {
        setStudents([]);
      }
    } else if (role === 'orang_tua') {
      if (myChildIds.length > 0) {
        const buffer: Record<string, StudentRow> = {};
        myChildIds.forEach((childId) => {
          subs.push(
            onSnapshot(
              doc(db, 'students', childId),
              (snap) => {
                if (snap.exists()) buffer[childId] = mapStudentDoc(snap.id, snap.data());
                else delete buffer[childId];
                setStudents(Object.values(buffer));
              },
              onErr('Gagal memuat data anak')
            )
          );
        });
      } else if (accountEmail) {
        subs.push(
          onSnapshot(
            query(collection(db, 'students'), where('waliEmail', '==', accountEmail)),
            (snap) => applyDocs(snap.docs),
            onErr('Gagal memuat data anak')
          )
        );
      } else {
        setStudents([]);
      }
    }

    return () => subs.forEach((unsub) => unsub());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser, profile, role, myStudentId, myRayonId, accountEmail, myChildIds.join('|')]);

  // Riwayat poin real-time (terbatas peran)
  useEffect(() => {
    if (!sessionUser || !profile) {
      setPoinLogs([]);
      return;
    }

    const toRow = (d: { id: string; data: () => any }) => {
      const data = d.data() as any;
      const createdMs: number = data.createdAt?.toMillis ? data.createdAt.toMillis() : 0;
      return {
        id: d.id,
        studentId: data.siswa_id ?? '',
        kode: data.kode ?? '',
        tipe: data.tipe ?? 'apresiasi',
        deskripsi: data.deskripsi ?? '',
        poin: Number(data.poin) || 0,
        createdMs,
        time: createdMs ? new Date(createdMs).toLocaleString('id-ID') : 'Baru saja',
      };
    };

    let logsQuery: ReturnType<typeof query> | null = null;
    if (canSeeAllStudents(role)) {
      logsQuery = query(collection(db, 'poin_log'), orderBy('createdAt', 'desc'), limit(50));
    } else if (role === 'pembimbing_rayon' && myRayonId) {
      logsQuery = query(collection(db, 'poin_log'), where('rayon', '==', myRayonId));
    } else if (role === 'siswa' && myStudentId) {
      logsQuery = query(collection(db, 'poin_log'), where('siswa_id', '==', myStudentId));
    } else if (role === 'orang_tua' && myChildIds.length > 0) {
      logsQuery = query(
        collection(db, 'poin_log'),
        where('siswa_id', 'in', myChildIds.slice(0, 10))
      );
    }

    if (!logsQuery) {
      setPoinLogs([]);
      return;
    }

    const unsub = onSnapshot(
      logsQuery,
      (snap) => {
        const rows = snap.docs.map(toRow).sort((a, b) => b.createdMs - a.createdMs);
        setPoinLogs(rows.slice(0, 50));
      },
      (err) => setErrorMsg('Gagal memuat riwayat poin: ' + err.message)
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser, profile, role, myStudentId, myRayonId, myChildIds.join('|')]);

  // Prestasi real-time (terbatas peran)
  useEffect(() => {
    if (!sessionUser || !profile) {
      setPrestasiList([]);
      return;
    }

    let prestasiQuery: ReturnType<typeof query> | null = null;
    if (canSeeAllStudents(role)) {
      prestasiQuery = query(collection(db, 'prestasi'));
    } else if (role === 'pembimbing_rayon' && myRayonId) {
      prestasiQuery = query(collection(db, 'prestasi'), where('rayon', '==', myRayonId));
    } else if (role === 'siswa') {
      prestasiQuery = query(
        collection(db, 'prestasi'),
        where('siswa_id', '==', myStudentId || '__tidak_tertaut__')
      );
    } else if (role === 'orang_tua' && myChildIds.length > 0) {
      prestasiQuery = query(
        collection(db, 'prestasi'),
        where('siswa_id', 'in', myChildIds.slice(0, 10))
      );
    }

    if (!prestasiQuery) {
      setPrestasiList([]);
      return;
    }

    const unsub = onSnapshot(
      prestasiQuery,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            siswa_id: data.siswa_id ?? '',
            rayon: data.rayon ?? '',
            judul: data.judul ?? '',
            kategori: data.kategori ?? '',
            tingkat: data.tingkat ?? '',
            capaian: data.capaian ?? '',
            tanggal: data.tanggal ?? '',
            deskripsi: data.deskripsi ?? '',
            status: data.status ?? 'pending',
            poin: Number(data.poin) || 0,
            createdBy: data.createdBy ?? '',
            verifiedBy: data.verifiedBy ?? '',
            catatan_verifikasi: data.catatan_verifikasi ?? '',
            createdAtMs: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0,
          } as PrestasiRecord & { createdAtMs: number };
        });
        setPrestasiList(rows.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0)));
      },
      (err) => setErrorMsg('Gagal memuat data prestasi: ' + err.message)
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser, profile, role, myStudentId, myRayonId, myChildIds.join('|')]);

  // Pemberitahuan: rules hanya mengizinkan dokumen milik akun sendiri.
  useEffect(() => {
    if (!sessionUser) {
      setNotifikasiList([]);
      return;
    }

    const notifQuery = query(
      collection(db, 'notifikasi'),
      where('user_id', '==', sessionUser.uid)
    );

    const unsub = onSnapshot(
      notifQuery,
      (snap) => {
        const rows = snap.docs
          .map((d) => {
            const data = d.data() as any;
            const createdMs: number = data.createdAt?.toMillis ? data.createdAt.toMillis() : 0;
            return {
              id: d.id,
              judul: data.judul ?? 'Pemberitahuan',
              isi: data.isi ?? '',
              createdMs,
              time: createdMs ? new Date(createdMs).toLocaleString('id-ID') : '',
            };
          })
          .sort((a, b) => b.createdMs - a.createdMs);
        setNotifikasiList(rows);
      },
      (err) => setErrorMsg('Gagal memuat pemberitahuan: ' + err.message)
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser]);

  // Master kategori poin: dipakai form guru (fallback ke daftar bawaan)
  useEffect(() => {
    if (!sessionUser) {
      setMasterKategori([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'master_kategori_poin'),
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            kode: data.kode ?? d.id,
            tipe: data.tipe === 'konsekuensi' ? 'konsekuensi' : 'apresiasi',
            kategori: data.kategori ?? '-',
            deskripsi: data.deskripsi ?? '',
            poin: Number(data.poin) || 0,
          } as { kode: string; tipe: 'apresiasi' | 'konsekuensi'; kategori: string; deskripsi: string; poin: number };
        });
        setMasterKategori(rows);
      },
      () => setMasterKategori([])
    );
    return () => unsub();
  }, [sessionUser]);

  const handleLogin = async (customEmail?: string, customPass?: string) => {
    const e = (customEmail || email).trim();
    const p = customPass || password;

    if (!e || !p) {
      setErrorMsg('Silakan masukkan email dan password.');
      return;
    }

    setLoginLoading(true);
    setErrorMsg(null);

    try {
      await signInWithEmail(e, p);
      // Routing dilakukan oleh watchAuthUser -> loadProfileAndRoute
      setPassword('');
    } catch (err: any) {
      const code = String(err?.code ?? '');
      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        setErrorMsg('Email atau kata sandi salah.');
      } else if (!code && err instanceof Error) {
        // Galat mode lokal sudah berbahasa Indonesia dan aman ditampilkan.
        setErrorMsg(err.message);
      } else if (code.includes('too-many-requests')) {
        setErrorMsg('Terlalu banyak percobaan masuk. Coba lagi beberapa saat.');
      } else if (code.includes('network')) {
        setErrorMsg('Tidak dapat menghubungi server autentikasi. Periksa koneksi internet.');
      } else {
        setErrorMsg('Gagal masuk: ' + (err?.message ?? String(err)));
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleResetLocal = async () => {
    try {
      await resetLocalData();
      setEmail('');
      setPassword('');
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg('Gagal menghapus data lokal: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch {
      /* diabaikan: sesi lokal tetap dibersihkan di bawah */
    }
    setCurrentRoute('login');
    setEmail('');
    setPassword('');
    setProfile(null);
  };

  // Santri milik akun yang sedang masuk (untuk role siswa / orang tua)
  const ownStudent =
    students.find((s) => s.studentEmail && s.studentEmail.toLowerCase() === accountEmail) ||
    students.find((s) => s.waliEmail && s.waliEmail.toLowerCase() === accountEmail);

  const currentStudent =
    (currentRoute === 'siswa' || currentRoute === 'ortu') && ownStudent
      ? ownStudent
      : students.find((s) => s.id === selectedStudentId) ||
        ownStudent ||
        students[0] || {
          id: '',
          name: profile?.fullName || 'Santri',
          nisn: profile?.nisn || '-',
          kelas: profile?.kelas || '-',
          rayon: myRayonId || '-',
          points: profile?.total_poin ?? 0,
        };

  // Muat isian non-rutin yang sudah tersimpan pada pekan ini (bila ada).
  useEffect(() => {
    const studentId = currentStudent.id;
    if (!studentId || role !== 'siswa') return;

    const periodeKey = `${new Date().getFullYear()}_P${isoWeekNumber(new Date())}`;
    let cancelled = false;

    getDoc(doc(db, 'pembiasaan_non_rutin', `${studentId}_${periodeKey}`))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const data = snap.data() as any;
        if (!Array.isArray(data.items)) return;
        setNonRutinList((prev) =>
          prev.map((item) => {
            const saved = data.items.find((s: any) => s.id === item.id);
            if (!saved) return item;
            return {
              ...item,
              status: typeof saved.status === 'string' ? saved.status : '',
              poin: Number(saved.poin) || 0,
              saksi: typeof saved.saksi === 'string' ? saved.saksi : '',
              detail: typeof saved.detail === 'string' ? saved.detail : '',
            };
          })
        );
      })
      .catch(() => {
        // Dokumen belum ada atau akun belum berhak: mulai dari isian kosong.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStudent.id, role]);

  // Master kode dari Firestore (dikelola admin) menimpa daftar bawaan.
  const effectiveKodes = masterKategori.length > 0 ? masterKategori : masterKodes;

  // Identitas pelaku untuk audit log.
  const auditActor = sessionUser
    ? { uid: sessionUser.uid, email: sessionUser.email, role }
    : null;

  const pendingPrestasi = prestasiList.filter((p) => p.status === 'pending');

  // Angka yang ditampilkan ke wali santri: semua dihitung dari data tersimpan.
  const currentWeek = isoWeekNumber(new Date());
  const targetPoin = 1000;
  const progressPct = Math.max(
    0,
    Math.min(100, Math.round((currentStudent.points / targetPoin) * 100))
  );
  // Riwayat milik santri yang sedang dilihat (wali dengan banyak anak tetap terpisah).
  const studentPoinLogs = currentStudent.id
    ? poinLogs.filter((l) => l.studentId === currentStudent.id)
    : poinLogs;
  const lastKonsekuensi = studentPoinLogs.find((l) => l.tipe === 'konsekuensi');

  // Ringkasan staf dihitung dari data nyata, bukan angka tetap.
  const startOfTodayMs = new Date().setHours(0, 0, 0, 0);
  const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const apresiasiHariIni = poinLogs
    .filter((l) => l.tipe === 'apresiasi' && l.createdMs >= startOfTodayMs)
    .reduce((acc, l) => acc + l.poin, 0);
  const konsekuensiMingguIni = poinLogs.filter(
    (l) => l.tipe === 'konsekuensi' && l.createdMs >= weekAgoMs
  ).length;

  // Hitung Estimasi Poin Harian Otomatis
  const calculateDailyPoints = () => {
    let pts = 0;
    // Tahajud: 4 rakaat (+6), 2 rakaat (+3), menstruasi (0)
    if (jurnal.tahajud === '4_rakaat') pts += 6;
    else if (jurnal.tahajud === '2_rakaat') pts += 3;

    // Dhuha: 4 rakaat (+4), 2 rakaat (+2), menstruasi (0)
    if (jurnal.dhuha === '4_rakaat') pts += 4;
    else if (jurnal.dhuha === '2_rakaat') pts += 2;

    // 5 Sholat Fardhu: berjamaah (+4), masbuk (+3), munfarid (+1)
    const fardhu = [jurnal.subuh, jurnal.dzuhur, jurnal.ashar, jurnal.maghrib, jurnal.isya];
    fardhu.forEach((s) => {
      if (s === 'berjamaah') pts += 4;
      else if (s === 'masbuk') pts += 3;
      else if (s === 'munfarid') pts += 1;
    });

    if (jurnal.mengaji) pts += 1;
    if (jurnal.zikir_pagi) pts += 1;
    if (jurnal.zikir_sore) pts += 1;
    if (jurnal.bangun_subuh) pts += 1;
    if (jurnal.tidur_awal) pts += 1;
    if (jurnal.air_putih) pts += 1;
    if (jurnal.mandi_2x) pts += 1;
    if (jurnal.grooming) pts += 8;
    if (jurnal.kelompok_belajar) pts += 4;

    return pts;
  };

  const saveJurnal = async () => {
    if (!sessionUser) {
      setErrorMsg('Sesi berakhir. Silakan masuk kembali.');
      return;
    }
    if (!currentStudent.id) {
      setErrorMsg('Data santri belum tertaut ke akun ini. Hubungi Guru / BK.');
      return;
    }
    if (role === 'siswa' && !myStudentId) {
      setErrorMsg(
        'Profil Anda belum memiliki studentId. Minta admin mengisi profiles/{uid}.studentId = ID dokumen santri, lalu masuk ulang.'
      );
      return;
    }

    const dailyPts = calculateDailyPoints();
    setSiswaSaveSuccess(false);
    const jurnalId = `${sessionUser.uid}_${siswaDate}`;

    const payload = {
      siswa_id: sessionUser.uid,
      student_id: currentStudent.id,
      rayon: currentStudent.rayon,
      tanggal: siswaDate,
      tahajud: jurnal.tahajud,
      dhuha: jurnal.dhuha,
      subuh: jurnal.subuh,
      dzuhur: jurnal.dzuhur,
      ashar: jurnal.ashar,
      maghrib: jurnal.maghrib,
      isya: jurnal.isya,
      mengaji: jurnal.mengaji,
      zikir_pagi: jurnal.zikir_pagi,
      zikir_sore: jurnal.zikir_sore,
      bangun_subuh: jurnal.bangun_subuh,
      tidur_awal: jurnal.tidur_awal,
      air_putih: jurnal.air_putih,
      mandi_2x: jurnal.mandi_2x,
      grooming: jurnal.grooming,
      kelompok_belajar: jurnal.kelompok_belajar,
      sedang_menstruasi: jurnal.sedang_menstruasi,
      catatan: jurnal.catatan,
      poin_harian: dailyPts,
      updatedAt: serverTimestamp(),
    };

    try {
      // Jurnal, saldo poin, dan audit log ditulis atomik: kalau salah satu
      // ditolak rules, seluruh operasi batal (tidak ada data separuh jadi).
      const batch = writeBatch(db);
      batch.set(doc(db, 'pembiasaan_harian', jurnalId), payload);
      batch.update(doc(db, 'students', currentStudent.id), {
        points: increment(dailyPts),
        lastJournalDate: siswaDate,
        updatedAt: serverTimestamp(),
      });
      if (auditActor) {
        batch.set(
          newAuditRef(),
          buildAuditPayload({
            actor: auditActor,
            action: 'jurnal_save',
            collectionName: 'pembiasaan_harian',
            docId: jurnalId,
            siswaId: currentStudent.id,
            rayon: currentStudent.rayon,
            after: { tanggal: siswaDate, poin_harian: dailyPts },
          })
        );
      }
      await batch.commit();

      setSiswaSaveSuccess(true);
      setTimeout(() => setSiswaSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMsg(
        'Gagal menyimpan jurnal: ' + (err instanceof Error ? err.message : String(err))
      );
    }
  };

  // Isian kegiatan non-rutin disimpan per santri dan per pekan.
  // Sebelum ini tombolnya hanya menampilkan pesan sukses tanpa menyimpan apa pun.
  const saveNonRutin = async () => {
    if (!sessionUser) {
      setErrorMsg('Sesi berakhir. Silakan masuk kembali.');
      return;
    }
    if (!currentStudent.id) {
      setErrorMsg('Data santri belum tertaut ke akun ini. Hubungi Guru / BK.');
      return;
    }

    const belumDiisi = nonRutinList.filter((item) => !item.status).length;
    if (belumDiisi > 0) {
      setErrorMsg(`Masih ada ${belumDiisi} kegiatan yang belum dipilih statusnya.`);
      return;
    }

    const tahun = new Date().getFullYear();
    const periodeKey = `${tahun}_P${currentWeek}`;
    const docId = `${currentStudent.id}_${periodeKey}`;
    const items = nonRutinList.map((item) => ({
      id: item.id,
      nama: item.nama,
      kategori: item.kategori,
      mapel: item.mapel,
      status: item.status,
      poin: item.poin,
      saksi: item.saksi,
      detail: item.detail,
    }));
    const totalPoin = items.reduce((acc, item) => acc + (item.poin > 0 ? item.poin : 0), 0);

    setNonRutinSaving(true);
    try {
      const batch = writeBatch(db);
      batch.set(
        doc(db, 'pembiasaan_non_rutin', docId),
        {
          siswa_id: currentStudent.id,
          rayon: currentStudent.rayon,
          tahun,
          pekan: currentWeek,
          periode: periodeKey,
          items,
          total_poin: totalPoin,
          dicatat_oleh: sessionUser.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      if (auditActor) {
        batch.set(
          newAuditRef(),
          buildAuditPayload({
            actor: auditActor,
            action: 'non_rutin_save',
            collectionName: 'pembiasaan_non_rutin',
            docId,
            siswaId: currentStudent.id,
            rayon: currentStudent.rayon,
            after: { periode: periodeKey, total_poin: totalPoin, jumlah_kegiatan: items.length },
          })
        );
      }
      await batch.commit();
      setNonRutinSaveSuccess(true);
      setTimeout(() => setNonRutinSaveSuccess(false), 3500);
    } catch (err) {
      setErrorMsg(
        'Gagal menyimpan kegiatan non-rutin: ' +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setNonRutinSaving(false);
    }
  };

  // Ortu Signature actions
  const clearSig = () => {
    if (sigCanvasRef.current) {
      sigCanvasRef.current.clear();
      setTtdSavedUrl(null);
    }
  };

  const saveSig = async () => {
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
      alert('Mohon bubuhkan tanda tangan Anda terlebih dahulu pada kanvas.');
      return;
    }
    if (!sessionUser) {
      setErrorMsg('Sesi berakhir. Silakan masuk kembali.');
      return;
    }

    setTtdLoading(true);
    try {
      const url = sigCanvasRef.current.getTrimmedCanvas().toDataURL('image/png');
      setTtdSavedUrl(url);

      if (currentStudent.id) {
        const now = new Date();
        const mingguKe = isoWeekNumber(now);
        const rekapId = `${currentStudent.id}_${now.getFullYear()}_${mingguKe}`;
        await setDoc(
          doc(db, 'pembiasaan_mingguan', rekapId),
          {
            siswa_id: currentStudent.id,
            rayon: currentStudent.rayon,
            minggu_ke: mingguKe,
            tahun: now.getFullYear(),
            ttd_ortu: true,
            // Data URL disimpan hanya jika wajar (<900 KB, batas dokumen Firestore 1 MB).
            // Untuk produksi, unggah ke Firebase Storage dan simpan URL-nya saja.
            ttd_url: url.length < 900_000 ? url : '',
            dicatat_oleh: sessionUser.uid,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        if (auditActor) {
          const warn = await logAuditSafe({
            actor: auditActor,
            action: 'ttd_ortu',
            collectionName: 'pembiasaan_mingguan',
            docId: rekapId,
            siswaId: currentStudent.id,
            rayon: currentStudent.rayon,
            after: { minggu_ke: mingguKe, tahun: now.getFullYear(), ttd_ortu: true },
          });
          if (warn) setErrorMsg('TTD tersimpan, tetapi audit log gagal: ' + warn);
        }
      }

      setTtdSuccess(true);
      setTimeout(() => setTtdSuccess(false), 3500);
    } catch (err) {
      setErrorMsg(
        'Gagal menyimpan tanda tangan: ' + (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setTtdLoading(false);
    }
  };

  // Guru Point Submit
  const handleGuruSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const master = effectiveKodes.find((m) => m.kode === selectedKode);
    if (!master) return;

    if (!sessionUser || !auditActor) {
      setErrorMsg('Sesi berakhir. Silakan masuk kembali.');
      return;
    }
    if (!isStaffRole(role)) {
      setErrorMsg('Hanya guru, pembimbing rayon, atau admin yang dapat mencatat poin.');
      return;
    }

    const targetStudent = students.find((s) => s.id === selectedStudentId);
    if (!targetStudent) {
      setErrorMsg('Pilih santri terlebih dahulu sebelum menyimpan poin.');
      return;
    }

    const deskripsi = `${targetStudent.name}: ${guruDeskripsi || master.deskripsi}`;
    const delta = master.tipe === 'apresiasi' ? master.poin : -master.poin;

    try {
      const batch = writeBatch(db);
      const logRef = doc(collection(db, 'poin_log'));

      batch.set(logRef, {
        siswa_id: targetStudent.id,
        rayon: targetStudent.rayon,
        kode: master.kode,
        tipe: master.tipe,
        deskripsi,
        poin: master.poin,
        dicatat_oleh: sessionUser.uid,
        createdAt: serverTimestamp(),
      });

      batch.update(doc(db, 'students', targetStudent.id), {
        points: increment(delta),
        updatedAt: serverTimestamp(),
      });

      batch.set(
        newAuditRef(),
        buildAuditPayload({
          actor: auditActor,
          action: 'poin_create',
          collectionName: 'poin_log',
          docId: logRef.id,
          siswaId: targetStudent.id,
          rayon: targetStudent.rayon,
          after: { kode: master.kode, tipe: master.tipe, poin: master.poin, delta, deskripsi },
        })
      );

      await batch.commit();

      setGuruSuccess(true);
      setTimeout(() => setGuruSuccess(false), 3000);
    } catch (err) {
      setErrorMsg(
        'Gagal menyimpan poin: ' + (err instanceof Error ? err.message : String(err))
      );
    }
  };

  // ── Alur pengajuan prestasi ─────────────────────────────────────
  // Siswa mengirim pengajuan (status pending, poin 0). Field status/poin/
  // verifiedBy tidak dikirim sama sekali, dan rules menolak jika dikirim.
  const handleSubmitPrestasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser || !auditActor) {
      setErrorMsg('Sesi berakhir. Silakan masuk kembali.');
      return;
    }
    if (!currentStudent.id) {
      setErrorMsg('Data santri belum tertaut ke akun ini. Hubungi Guru / BK.');
      return;
    }
    if (!prestasiForm.judul.trim() || !prestasiForm.capaian.trim()) {
      setErrorMsg('Judul prestasi dan capaian wajib diisi.');
      return;
    }

    setPrestasiSubmitting(true);
    setPrestasiMsg(null);

    const payload = {
      siswa_id: currentStudent.id,
      rayon: currentStudent.rayon,
      judul: prestasiForm.judul.trim(),
      kategori: prestasiForm.kategori,
      tingkat: prestasiForm.tingkat,
      capaian: prestasiForm.capaian.trim(),
      tanggal: prestasiForm.tanggal,
      deskripsi: prestasiForm.deskripsi.trim(),
      status: 'pending' as const,
      poin: 0,
      createdBy: sessionUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const ref = await addDoc(collection(db, 'prestasi'), payload);
      const warn = await logAuditSafe({
        actor: auditActor,
        action: 'prestasi_submit',
        collectionName: 'prestasi',
        docId: ref.id,
        siswaId: currentStudent.id,
        rayon: currentStudent.rayon,
        after: payload,
      });
      setPrestasiMsg(
        warn
          ? 'Prestasi tersimpan, tetapi audit log gagal: ' + warn
          : 'Pengajuan prestasi terkirim. Menunggu verifikasi guru / pembimbing rayon.'
      );
      setPrestasiForm((prev) => ({ ...prev, judul: '', capaian: '', deskripsi: '' }));
      setShowFormPrestasi(false);
    } catch (err) {
      setErrorMsg(
        'Gagal mengirim pengajuan prestasi: ' +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setPrestasiSubmitting(false);
    }
  };

  // ── Verifikasi prestasi (guru / pembimbing rayon / admin) ────────
  const handleVerifyPrestasi = async (
    pres: PrestasiRecord,
    decision: 'verified' | 'rejected'
  ) => {
    if (!sessionUser || !auditActor) {
      setErrorMsg('Sesi berakhir. Silakan masuk kembali.');
      return;
    }
    if (!canVerifyPrestasi(role)) {
      setErrorMsg('Hanya guru, pembimbing rayon, atau admin yang dapat memverifikasi.');
      return;
    }
    if (pres.status !== 'pending') {
      setErrorMsg('Pengajuan ini sudah diproses.');
      return;
    }

    const poin = decision === 'verified' ? Number(verifyPoin[pres.id] ?? 100) : 0;
    if (decision === 'verified' && (!Number.isFinite(poin) || poin <= 0 || poin > 5000)) {
      setErrorMsg('Poin verifikasi harus berupa angka antara 1 dan 5000.');
      return;
    }

    const catatan = verifyCatatan[pres.id] ?? '';
    setVerifyingId(pres.id);

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'prestasi', pres.id), {
        status: decision,
        poin,
        verifiedBy: sessionUser.uid,
        verifiedAt: serverTimestamp(),
        catatan_verifikasi: catatan,
        updatedAt: serverTimestamp(),
      });

      if (decision === 'verified' && poin > 0) {
        batch.update(doc(db, 'students', pres.siswa_id), {
          points: increment(poin),
          updatedAt: serverTimestamp(),
        });
      }

      batch.set(
        newAuditRef(),
        buildAuditPayload({
          actor: auditActor,
          action: decision === 'verified' ? 'prestasi_verify' : 'prestasi_reject',
          collectionName: 'prestasi',
          docId: pres.id,
          siswaId: pres.siswa_id,
          rayon: pres.rayon,
          before: { status: pres.status, poin: pres.poin },
          after: { status: decision, poin, catatan_verifikasi: catatan },
        })
      );

      await batch.commit();
    } catch (err) {
      setErrorMsg(
        'Gagal memverifikasi prestasi: ' + (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setVerifyingId(null);
    }
  };

  // Tunggu Firebase Auth selesai memulihkan sesi sebelum menentukan halaman.
  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="text-center text-[#1B5E20] text-sm font-semibold">
          <div className="w-8 h-8 border-4 border-green-200 border-t-[#2E7D32] rounded-full animate-spin mx-auto mb-3" />
          Memuat BKP Digital…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper font-sans text-ink">

      {/* Notifikasi error global (gagal simpan, gagal muat, dsb) */}
      {errorMsg && currentRoute !== 'login' && (
        <div
          role="alert"
          className="fixed left-1/2 top-3 z-50 flex w-[92%] max-w-md -translate-x-1/2 items-start gap-2 rounded-control border border-danger/40 bg-surface px-4 py-3 text-xs font-medium text-danger shadow-lg"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            aria-label="Tutup pesan kesalahan"
            className="flex h-6 w-6 items-center justify-center rounded text-danger/80 hover:bg-danger-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Peringatan penautan profil (studentId/childIds/rayonId belum diisi) */}
      {profileWarning && currentRoute !== 'login' && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%] bg-amber-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{profileWarning}</span>
        </div>
      )}

      {/* TOPBAR: identitas aplikasi */}
      <div className="z-40 flex shrink-0 items-center gap-2 border-b border-brand-950 bg-brand-900 px-4 py-2 text-xs text-white">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-brand-100" aria-hidden="true" />
          <span className="font-semibold tracking-tight">BKP Digital</span>
          <span className="hidden text-brand-100 sm:inline">SMK Thibbil Qulub Assimbani</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 1. HALAMAN LOGIN                            */}
      {/* ═══════════════════════════════════════════ */}
      {currentRoute === 'login' && (
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm">
            <div className="overflow-hidden rounded-card border border-line bg-surface">
              <div className="bg-brand-800 px-6 py-6 text-white">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-white/20 bg-brand-950/40">
                    <BookOpen className="h-5 w-5 text-brand-100" aria-hidden="true" />
                  </span>
                  <div>
                    <h1 className="text-lg font-semibold leading-tight">BKP Digital</h1>
                    <p className="text-xs text-brand-100">Buku Kejar Prestasi</p>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-brand-100">
                  SMK Thibbil Qulub Assimbani. Jurnal pembiasaan, poin karakter, dan pengesahan wali santri.
                </p>
              </div>

              <div className="px-6 py-6">
                {isLocalBackend && (
                  <div className="mb-4 rounded-control border border-line bg-paper/60 px-3 py-2.5">
                    <p className="text-xs font-semibold text-ink">Mode lokal</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      Data tersimpan di peramban ini, bukan di server. Akun awal administrator:{' '}
                      <span className="font-semibold text-ink">admin@lokal.test</span> dengan kata sandi{' '}
                      <span className="font-semibold text-ink">{LOCAL_SEED_PASSWORD}</span>. Akun lain dibuat
                      admin dari menu Pengguna.
                    </p>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLogin();
                  }}
                  className="space-y-4"
                  noValidate
                >
                  {errorMsg && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger-50 px-3 py-2.5 text-xs text-danger"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-ink">
                      Email sekolah
                    </label>
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@thibbilqulub.sch.id"
                      className="w-full rounded-control border border-line bg-paper/60 px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:bg-white focus:border-brand-700"
                    />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold text-ink">
                      Kata sandi
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-control border border-line bg-paper/60 py-2.5 pl-3 pr-11 text-sm text-ink focus:bg-white focus:border-brand-700"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                        aria-pressed={showPassword}
                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-brand-800"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-control bg-brand-700 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:bg-brand-700/50"
                  >
                    {loginLoading ? (
                      <>
                        <span
                          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                          aria-hidden="true"
                        />
                        <span>Memeriksa akun</span>
                      </>
                    ) : (
                      'Masuk'
                    )}
                  </button>
                </form>
              </div>
            </div>

            <p className="mt-4 text-center text-xs leading-relaxed text-muted">
              {isLocalBackend
                ? 'Lupa kata sandi? Minta admin sekolah mengatur ulang dari menu Pengguna.'
                : 'Akun dibuat oleh admin sekolah. Bila belum punya akses, hubungi Guru BK atau pembimbing rayon.'}
            </p>

            {isLocalBackend && (
              <button
                type="button"
                onClick={handleResetLocal}
                disabled={loginLoading}
                className="mx-auto mt-3 block min-h-11 rounded-control px-3 text-xs font-semibold text-muted hover:text-danger disabled:opacity-60"
              >
                Hapus data lokal dan mulai ulang
              </button>
            )}
          </div>
        </main>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 2. DASHBOARD SISWA (ROLE: siswa)            */}
      {/* ═══════════════════════════════════════════ */}
      {currentRoute === 'siswa' && (
        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-3xl bg-paper flex flex-col min-h-screen relative pb-24">
            
            <Header
              fullName={currentStudent.name}
              subtitle={`Kelas: ${currentStudent.kelas} • Rayon: ${currentStudent.rayon}`}
              poin={currentStudent.points}
              onLogout={handleLogout}
            />

            <div className="px-4 py-4 space-y-4 flex-1">
              
              {/* TAB SISWA: JURNAL & PEMBIASAAN LENGKAP */}
              {siswaTab === 'jurnal' && (
                <div className="space-y-4">
                  {/* Multi-Sub Tab Navigator */}
                  <div className="bg-white p-1 rounded-2xl shadow-sm border border-green-100 grid grid-cols-4 gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setJurnalView('harian')}
                      className={`py-2 px-1 text-center font-bold rounded-xl transition-all ${
                        jurnalView === 'harian'
                          ? 'bg-[#2E7D32] text-white shadow-sm'
                          : 'text-gray-500 hover:text-green-800'
                      }`}
                    >
                      Harian
                    </button>
                    <button
                      type="button"
                      onClick={() => setJurnalView('mingguan')}
                      className={`py-2 px-1 text-center font-bold rounded-xl transition-all ${
                        jurnalView === 'mingguan'
                          ? 'bg-[#2E7D32] text-white shadow-sm'
                          : 'text-gray-500 hover:text-green-800'
                      }`}
                    >
                      Pekanan
                    </button>
                    <button
                      type="button"
                      onClick={() => setJurnalView('non_rutin')}
                      className={`py-2 px-1 text-center font-bold rounded-xl transition-all ${
                        jurnalView === 'non_rutin'
                          ? 'bg-[#2E7D32] text-white shadow-sm'
                          : 'text-gray-500 hover:text-green-800'
                      }`}
                    >
                      Non Rutin
                    </button>
                    <button
                      type="button"
                      onClick={() => setJurnalView('kesehatan')}
                      className={`py-2 px-1 text-center font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                        jurnalView === 'kesehatan'
                          ? 'bg-[#2E7D32] text-white shadow-sm'
                          : 'text-gray-500 hover:text-green-800'
                      }`}
                    >
                      <HeartPulse className="w-3 h-3" />
                      Kesehatan
                    </button>
                  </div>

                  {siswaSaveSuccess && (
                    <div className="p-3 bg-green-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Alhamdulillah, Jurnal Pembiasaan berhasil disimpan (+{calculateDailyPoints()} Poin)!</span>
                    </div>
                  )}

                  {/* SUB-VIEW 1: JURNAL HARIAN LENGKAP */}
                  {jurnalView === 'harian' && (
                    <div className="space-y-4">
                      {/* Tanggal & Estimasi Poin */}
                      <div className="bg-white rounded-2xl p-3 shadow-sm border border-green-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                          <Calendar className="w-4 h-4 text-[#2E7D32]" />
                          <span>Tanggal:</span>
                          <input
                            type="date"
                            value={siswaDate}
                            onChange={(e) => setSiswaDate(e.target.value)}
                            className="text-xs font-semibold bg-green-50 text-green-900 px-2 py-1 rounded-lg border border-green-200 outline-none"
                          />
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gray-400 block">Potensi Harian:</span>
                          <span className="text-xs font-black text-[#1B5E20] bg-green-100 px-2 py-0.5 rounded-full">
                            +{calculateDailyPoints()} Poin
                          </span>
                        </div>
                      </div>

                      {/* Dispensasi Menstruasi Bar */}
                      <div className="bg-pink-50 border border-pink-200 rounded-2xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                          <div>
                            <span className="text-xs font-bold text-pink-900 block">Dispensasi Syar'i (Menstruasi)</span>
                            <span className="text-xs text-pink-700">Untuk siswi yang sedang berhalangan haid</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !jurnal.sedang_menstruasi;
                            setJurnal({
                              ...jurnal,
                              sedang_menstruasi: next,
                              tahajud: next ? 'menstruasi' : '4_rakaat',
                              dhuha: next ? 'menstruasi' : '4_rakaat',
                              subuh: next ? 'menstruasi' : 'berjamaah',
                              dzuhur: next ? 'menstruasi' : 'berjamaah',
                              ashar: next ? 'menstruasi' : 'berjamaah',
                              maghrib: next ? 'menstruasi' : 'berjamaah',
                              isya: next ? 'menstruasi' : 'berjamaah',
                            });
                          }}
                          className={`text-xs px-3 py-1 rounded-xl font-bold transition-all ${
                            jurnal.sedang_menstruasi
                              ? 'bg-pink-600 text-white shadow-sm'
                              : 'bg-white text-pink-700 border border-pink-300'
                          }`}
                        >
                          {jurnal.sedang_menstruasi ? 'Sedang Haid (M)' : 'Tidak Haid'}
                        </button>
                      </div>

                      {/* 1. SHOLAT TAHAJUD & SHOLAT DHUHA (Sesuai Hal 15 Dokumen BKP) */}
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-3">
                        <h3 className="text-sm font-bold text-[#1B5E20] pb-2 border-b border-gray-100 flex items-center gap-2">
                          <Moon className="w-4 h-4 text-indigo-600" />
                          Sholat Sunnah Tahajud & Dhuha
                        </h3>

                        {/* Sholat Tahajud */}
                        <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                              <span>Sholat Tahajud</span>
                              <span className="text-xs font-normal text-indigo-700">(Qiyamul Lail)</span>
                            </span>
                            <span className="text-xs font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                              {jurnal.tahajud === '4_rakaat' ? '+6 Poin' : jurnal.tahajud === '2_rakaat' ? '+3 Poin' : jurnal.tahajud === 'menstruasi' ? 'Dispensasi (M)' : '0 Poin'}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-xs">
                            {[
                              { id: '4_rakaat', label: '4 Rakaat', pts: '6' },
                              { id: '2_rakaat', label: '2 Rakaat', pts: '3' },
                              { id: 'tidak', label: 'Tidak', pts: '0' },
                              { id: 'menstruasi', label: 'Haid (M)', pts: 'M' },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setJurnal({ ...jurnal, tahajud: opt.id as any })}
                                className={`py-1.5 px-1 rounded-lg font-bold text-center transition-all ${
                                  jurnal.tahajud === opt.id
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-indigo-50'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Sholat Dhuha */}
                        <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                              <span>Sholat Dhuha</span>
                              <span className="text-xs font-normal text-amber-700">(Pagi Hari)</span>
                            </span>
                            <span className="text-xs font-bold text-amber-700 bg-white px-2 py-0.5 rounded-full border border-amber-200">
                              {jurnal.dhuha === '4_rakaat' ? '+4 Poin' : jurnal.dhuha === '2_rakaat' ? '+2 Poin' : jurnal.dhuha === 'menstruasi' ? 'Dispensasi (M)' : '0 Poin'}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-xs">
                            {[
                              { id: '4_rakaat', label: '4 Rakaat', pts: '4' },
                              { id: '2_rakaat', label: '2 Rakaat', pts: '2' },
                              { id: 'tidak', label: 'Tidak', pts: '0' },
                              { id: 'menstruasi', label: 'Haid (M)', pts: 'M' },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setJurnal({ ...jurnal, dhuha: opt.id as any })}
                                className={`py-1.5 px-1 rounded-lg font-bold text-center transition-all ${
                                  jurnal.dhuha === opt.id
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-amber-50'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 2. SHOLAT FARDHU 5 WAKTU BERJAMAAH */}
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                          <h3 className="text-sm font-bold text-[#1B5E20] flex items-center gap-2">
                            <Sun className="w-4 h-4 text-emerald-600" />
                            Sholat Fardhu 5 Waktu
                          </h3>
                          <span className="text-xs text-gray-400">Tepat Waktu (+4) • Masbuk (+3)</span>
                        </div>

                        <div className="space-y-2">
                          {[
                            { key: 'subuh', label: 'Subuh' },
                            { key: 'dzuhur', label: 'Dzuhur' },
                            { key: 'ashar', label: 'Ashar' },
                            { key: 'maghrib', label: 'Maghrib' },
                            { key: 'isya', label: 'Isya' },
                          ].map((item) => {
                            const val = jurnal[item.key as keyof typeof jurnal] as string;
                            return (
                              <div key={item.key} className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-200 flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-gray-800 w-16">
                                  {item.label}
                                </span>
                                <div className="flex-1 grid grid-cols-4 gap-1 text-xs">
                                  {[
                                    { id: 'berjamaah', label: 'Tepat Waktu (+4)' },
                                    { id: 'masbuk', label: 'Masbuk (+3)' },
                                    { id: 'munfarid', label: 'Munfarid (+1)' },
                                    { id: 'menstruasi', label: 'Haid (M)' },
                                  ].map((opt) => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => setJurnal({ ...jurnal, [item.key]: opt.id })}
                                      className={`py-1 rounded font-semibold text-center transition-all ${
                                        val === opt.id
                                          ? 'bg-green-700 text-white shadow-xs font-bold'
                                          : 'bg-white text-gray-600 border border-gray-200'
                                      }`}
                                    >
                                      {opt.label.split(' ')[0]}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. TILAWAH, ZIKIR PAGI & SORE */}
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-2">
                        <h3 className="text-sm font-bold text-[#1B5E20] pb-2 border-b border-gray-100 flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-green-700" />
                          Tilawah & Dzikir Harian
                        </h3>

                        {[
                          { key: 'mengaji', label: 'Mengaji / Menghafal Alquran (+1 Poin)', icon: BookOpen },
                          { key: 'zikir_pagi', label: 'Membaca Dzikir Pagi (+1 Poin)', icon: Sun },
                          { key: 'zikir_sore', label: 'Membaca Dzikir Sore (+1 Poin)', icon: Moon },
                        ].map((item) => {
                          const isChecked = Boolean(jurnal[item.key as keyof typeof jurnal]);
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              aria-pressed={isChecked}
                              onClick={() => setJurnal({ ...jurnal, [item.key]: !isChecked })}
                              className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-control border px-2.5 py-2 text-left transition-colors ${
                                isChecked
                                  ? 'border-brand-700/40 bg-brand-50 text-brand-900'
                                  : 'border-line bg-paper/50 text-muted hover:border-brand-700/30'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <Icon
                                  className={`h-4 w-4 ${isChecked ? 'text-brand-700' : 'text-muted'}`}
                                  aria-hidden="true"
                                />
                                <span className={`text-xs ${isChecked ? 'font-semibold' : 'font-medium'}`}>
                                  {item.label}
                                </span>
                              </span>
                              {isChecked ? (
                                <CheckSquare className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                              ) : (
                                <Square className="h-4 w-4 shrink-0 text-muted/60" aria-hidden="true" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* 4. ASPEK KESEHATAN, GROOMING & DISIPLIN (Sesuai Hal 16 Dokumen BKP) */}
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-2">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                          <h3 className="text-sm font-bold text-[#1B5E20] flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-emerald-600" />
                            Kesehatan, Kebersihan & Kedisiplinan
                          </h3>
                        </div>

                        {[
                          { key: 'grooming', label: 'Grooming Diri (+8 Poin)', desc: 'Bersih, wangi, deodoran, ganti kaos kaki & dalaman kerudung' },
                          { key: 'bangun_subuh', label: 'Bangun Sebelum Pukul 05.00 (+1 Poin)', desc: 'Disiplin qiyam dan persiapan sholat subuh' },
                          { key: 'tidur_awal', label: 'Tidur Sebelum Pukul 22.00 (+1 Poin)', desc: 'Tidak begadang tanpa udzur (Jika lewat -2 Poin)' },
                          { key: 'air_putih', label: 'Minum Air Putih 1,5 - 2 Liter (+1 Poin)', desc: 'Menjaga hidrasi dan kesehatan ginjal' },
                          { key: 'mandi_2x', label: 'Mandi 2 Kali Setiap Hari (+1 Poin)', desc: 'Kebersihan tubuh sebelum & sesudah kegiatan' },
                          { key: 'kelompok_belajar', label: 'Aktif dalam Kelompok Belajar (+4 Poin)', desc: 'Aspek kewargaan & kolaborasi akademik' },
                        ].map((item) => {
                          const isChecked = Boolean(jurnal[item.key as keyof typeof jurnal]);
                          return (
                            <button
                              key={item.key}
                              type="button"
                              aria-pressed={isChecked}
                              onClick={() => setJurnal({ ...jurnal, [item.key]: !isChecked })}
                              className={`block min-h-[44px] w-full rounded-control border px-2.5 py-2 text-left transition-colors ${
                                isChecked
                                  ? 'border-brand-700/40 bg-brand-50 text-brand-900'
                                  : 'border-line bg-paper/50 text-muted hover:border-brand-700/30'
                              }`}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className={`text-xs ${isChecked ? 'font-semibold' : 'font-medium'}`}>
                                  {item.label}
                                </span>
                                {isChecked ? (
                                  <CheckSquare className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                                ) : (
                                  <Square className="h-4 w-4 shrink-0 text-muted/60" aria-hidden="true" />
                                )}
                              </span>
                              <span className="mt-0.5 block text-xs text-muted">{item.desc}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Catatan Jurnal */}
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Catatan Tambahan / Refleksi Diri:</label>
                        <textarea
                          value={jurnal.catatan}
                          onChange={(e) => setJurnal({ ...jurnal, catatan: e.target.value })}
                          rows={2}
                          placeholder="Tuliskan ayat yang dihafal, materi pengajian, atau catatan ibadah..."
                          className="w-full p-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-green-600"
                        />
                      </div>

                      <button
                        onClick={saveJurnal}
                        className="w-full py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        <span>Simpan Jurnal Harian (+{calculateDailyPoints()} Pts)</span>
                      </button>
                    </div>
                  )}

                  {/* SUB-VIEW 2: PEMBIASAAN MINGGUAN (12 ITEM) */}
                  {jurnalView === 'mingguan' && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-[#1B5E20]">12 Indikator Pembiasaan Mingguan</h3>
                          <p className="text-xs text-gray-500">Evaluasi pekanan menuju Tanda Tangan Orang Tua</p>
                        </div>
                        <span className="text-xs font-bold text-green-800 bg-green-100 px-3 py-1 rounded-full">
                          Pekan ke-{currentWeek}
                        </span>
                      </div>

                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-2">
                        {[
                          { key: 'sholat_jumat_keputrian', label: '1. Sholat Jumat / Keputrian (+50 Poin)' },
                          { key: 'puasa_sunnah', label: '2. Puasa Sunnah Senin-Kamis (+80/+40 Poin)' },
                          { key: 'berinfak', label: '3. Berinfak / Sedekah (+40 Poin)' },
                          { key: 'tablet_tambah_darah', label: '4. Tablet Tambah Darah / Vit. (+30 Poin)' },
                          { key: 'olahraga', label: '5. Olahraga Minimal 15 Menit (+60 Poin)' },
                          { key: 'keramas_2x', label: '6. Keramas min. 2x Seminggu (+50 Poin)' },
                          { key: 'kebersihan_diri', label: '7. Kuku, Telinga, dan Bercukur (+50 Poin)' },
                          { key: 'piket_rayon', label: '8. Piket Rayon Asrama (+50 Poin)' },
                          { key: 'daur_ulang', label: '9. Bawa Bahan Daur Ulang P5 (+50 Poin)' },
                          { key: 'ekstrakurikuler', label: '10. Hadir Ekstrakurikuler (+50 Poin)' },
                          { key: 'seni_budaya', label: '11. Hadir Seni Budaya (+50 Poin)' },
                          { key: 'kumpul_rayon', label: '12. Hadir Kumpul Rayon (+50 Poin)' },
                          { key: 'input_kejar_id', label: '13. Input Rekap BKP ke Kejar.id (+100 Poin)' },
                        ].map((item) => {
                          const isChecked = Boolean(mingguan[item.key as keyof typeof mingguan]);
                          return (
                            <button
                              key={item.key}
                              type="button"
                              aria-pressed={isChecked}
                              onClick={() => setMingguan({ ...mingguan, [item.key]: !isChecked })}
                              className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-control border px-3 py-2.5 text-left transition-colors ${
                                isChecked
                                  ? 'border-brand-700/40 bg-brand-50 text-brand-900'
                                  : 'border-line bg-paper/50 text-muted hover:border-brand-700/30'
                              }`}
                            >
                              <span className={`text-xs ${isChecked ? 'font-semibold' : 'font-medium'}`}>
                                {item.label}
                              </span>
                              {isChecked ? (
                                <CheckSquare className="h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
                              ) : (
                                <Square className="h-5 w-5 shrink-0 text-muted/60" aria-hidden="true" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={saveJurnal}
                        className="w-full py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        <span>Simpan Pembiasaan Pekanan</span>
                      </button>
                    </div>
                  )}

                  {/* SUB-VIEW 3: KEGIATAN NON-RUTIN (INTERAKTIF SISWA) */}
                  {jurnalView === 'non_rutin' && (
                    <div className="space-y-3">
                      {/* Banner Penjelasan Resmi BKP */}
                      <div className="rounded-card border border-line bg-surface p-3.5">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-[#1B5E20] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs font-bold text-[#1B5E20]">Panduan Pengisian Kegiatan Non-Rutin</h3>
                              <span className="text-xs bg-green-200 text-green-900 font-bold px-1.5 py-0.2 rounded">BKP Hal. 20</span>
                            </div>
                            <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                              <strong>Kegiatan ini diisi mandiri oleh Siswa</strong> pada periode terkait (3-Mingguan, 9-Mingguan, atau Semester), kemudian disetujui / ditandatangani Orang Tua & Guru/Wali Rayon.
                            </p>
                            <p className="text-xs text-emerald-800 mt-1 bg-white/70 p-1.5 rounded-lg border border-green-100">
                              <strong>Status kegiatan</strong> (seperti <em>&quot;Mengikuti dgn khidmat&quot;</em> atau <em>&quot;Memenuhi target hafalan&quot;</em>) adalah pilihan kriteria resmi yang dapat dipilih siswa di bawah ini sesuai kenyataan di lapangan.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Filter Kategori & Ringkasan Poin */}
                      <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-700">Filter Periode:</span>
                          <span className="text-xs font-semibold text-[#1B5E20] bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                            Total Poin Periode: +{nonRutinList.reduce((acc, item) => acc + (item.poin > 0 ? item.poin : 0), 0)} Pts
                          </span>
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                          {(['Semua', '3 Mingguan', '9 Mingguan', 'Semester'] as const).map((kat) => (
                            <button
                              key={kat}
                              type="button"
                              onClick={() => setNonRutinFilter(kat)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                                nonRutinFilter === kat
                                  ? 'bg-[#1B5E20] text-white shadow-sm font-semibold'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {kat}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Notifikasi Simpan Berhasil */}
                      {nonRutinSaveSuccess && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-fade-in shadow-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Isian kegiatan non-rutin pekan ini tersimpan.</span>
                        </div>
                      )}

                      {/* List Kegiatan Non-Rutin yang Bisa Diisi Siswa */}
                      <div className="space-y-2.5">
                        {nonRutinList
                          .filter((item) => nonRutinFilter === 'Semua' || item.kategori === nonRutinFilter)
                          .map((nr) => (
                            <div key={nr.id} className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm space-y-2.5 hover:border-green-200 transition-all">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="bg-green-100 text-[#1B5E20] font-bold text-xs px-2 py-0.5 rounded-full">
                                      {nr.kategori}
                                    </span>
                                    <span className="bg-gray-100 text-gray-600 font-medium text-xs px-1.5 py-0.5 rounded">
                                      Mapel: {nr.mapel}
                                    </span>
                                  </div>
                                  <h4 className="text-xs font-bold text-gray-800 mt-1">{nr.nama}</h4>
                                </div>
                                <span className={`text-xs font-black px-2 py-0.5 rounded-lg shrink-0 ${
                                  nr.poin > 0 
                                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' 
                                    : nr.poin < 0 
                                      ? 'text-red-700 bg-red-50 border border-red-200'
                                      : 'text-gray-600 bg-gray-50 border border-gray-200'
                                }`}>
                                  {nr.poin > 0 ? `+${nr.poin}` : nr.poin} Pts
                                </span>
                              </div>

                              {/* Pilihan Kriteria / Status Pelaksanaan oleh Siswa */}
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                  Pilih Status Capaian:
                                </label>
                                <select
                                  value={nr.status}
                                  onChange={(e) => {
                                    const selectedOpt = nr.options?.find(opt => opt.status === e.target.value);
                                    setNonRutinList(prev => prev.map(item => {
                                      if (item.id === nr.id) {
                                        return {
                                          ...item,
                                          status: e.target.value,
                                          poin: selectedOpt ? selectedOpt.poin : item.poin
                                        };
                                      }
                                      return item;
                                    }));
                                  }}
                                  className="w-full text-xs p-2 rounded-xl border border-gray-200 bg-gray-50/50 font-medium text-gray-800 focus:bg-white focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] outline-none transition-all cursor-pointer"
                                >
                                  <option value="">Belum diisi</option>
                                  {nr.options?.map((opt, idx) => (
                                    <option key={idx} value={opt.status}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Field Khusus Jika Setoran Target Hafalan (nr-9) */}
                              {nr.id === 'nr-9' && (
                                <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/80 space-y-1.5">
                                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-wide">
                                    Target Surah / Hadits / Juz yang Disetorkan:
                                  </label>
                                  <input
                                    type="text"
                                    value={nr.detail || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setNonRutinList(prev => prev.map(item => item.id === nr.id ? { ...item, detail: val } : item));
                                    }}
                                    placeholder="Contoh: Surah Al-Mulk s.d. Al-Qalam (Juz 29)"
                                    className="w-full text-xs p-2 rounded-lg border border-amber-300 bg-white text-gray-800 placeholder-gray-400 outline-none focus:ring-1 focus:ring-amber-500"
                                  />
                                </div>
                              )}

                              {/* Input Nama Saksi / Guru Penilai */}
                              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                                <span className="text-xs text-gray-500 shrink-0 font-medium">Saksi/Guru:</span>
                                <input
                                  type="text"
                                  value={nr.saksi}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setNonRutinList(prev => prev.map(item => item.id === nr.id ? { ...item, saksi: val } : item));
                                  }}
                                  placeholder="Nama Guru Pengampu / Wali Rayon"
                                  className="w-full text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 outline-none focus:border-green-600"
                                />
                              </div>
                            </div>
                          ))}
                      </div>

                      {/* Tombol Simpan Form Non-Rutin */}
                      <button
                        type="button"
                        onClick={saveNonRutin}
                        disabled={nonRutinSaving}
                        className="flex w-full items-center justify-center gap-2 rounded-control bg-brand-700 py-3 text-xs font-semibold text-white transition-colors hover:bg-brand-800 disabled:bg-brand-700/50"
                      >
                        {nonRutinSaving ? (
                          <>
                            <span
                              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                              aria-hidden="true"
                            />
                            Menyimpan
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" aria-hidden="true" />
                            Simpan isian pekan ini
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* SUB-VIEW 4: BORANG KESEHATAN TERPADU */}
                  {jurnalView === 'kesehatan' && (
                    <ModulBelumTersedia judul="Borang kesehatan siswa" />
                  )}
                </div>
              )}

              {/* TAB SISWA: BORANG KESEHATAN (DARI BOTTOM NAV) */}
              {siswaTab === 'kesehatan' && <ModulBelumTersedia judul="Borang kesehatan siswa" />}

              {/* TAB SISWA: HOME */}
              {siswaTab === 'home' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status Kejar Prestasi</h3>
                    <div className="text-2xl font-black text-[#1B5E20]">{currentStudent.points} Poin</div>
                    <p className="text-xs text-gray-600 mt-1">Target minimal kelulusan karakter: 1000 Poin</p>
                  </div>

                  {/* Ringkasan Pembiasaan Hari Ini */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <span>Ibadah & Karakter Hari Ini</span>
                      </h3>
                      <button onClick={() => setSiswaTab('jurnal')} className="text-xs text-[#2E7D32] font-semibold hover:underline">
                        Buka Jurnal &rarr;
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-green-50 p-2.5 rounded-xl border border-green-100">
                        <span className="text-xs text-gray-500 block">Tahajud:</span>
                        <span className="font-bold text-green-900">{jurnal.tahajud === '4_rakaat' ? '4 Rakaat (+6)' : jurnal.tahajud === '2_rakaat' ? '2 Rakaat (+3)' : 'Belum'}</span>
                      </div>
                      <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                        <span className="text-xs text-gray-500 block">Dhuha:</span>
                        <span className="font-bold text-amber-900">{jurnal.dhuha === '4_rakaat' ? '4 Rakaat (+4)' : jurnal.dhuha === '2_rakaat' ? '2 Rakaat (+2)' : 'Belum'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ringkasan Prestasi Unggulan */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-yellow-500" />
                        <span>Prestasi Unggulan Santri</span>
                      </h3>
                      <button onClick={() => setSiswaTab('poin')} className="text-xs text-[#2E7D32] font-semibold hover:underline">
                        Lihat Semua
                      </button>
                    </div>
                    {prestasiList[0] ? (
                      <div className="p-3 bg-yellow-50/70 border border-yellow-200 rounded-xl">
                        <span className="text-xs font-bold text-yellow-900 block">{prestasiList[0].judul}</span>
                        <span className="text-xs text-yellow-700 block mt-0.5">
                          {prestasiList[0].kategori} •{' '}
                          {prestasiList[0].status === 'verified'
                            ? `+${prestasiList[0].poin} Poin`
                            : prestasiList[0].status === 'pending'
                              ? 'Menunggu verifikasi'
                              : 'Ditolak'}
                        </span>
                      </div>
                    ) : (
                      <div className="p-3 bg-yellow-50/70 border border-yellow-200 rounded-xl text-xs text-yellow-800">
                        Belum ada prestasi tercatat. Ajukan dari tab Poin.
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* TAB SISWA: POIN & PRESTASI LENGKAP */}
              {siswaTab === 'poin' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-bold text-gray-800">Buku Rekap Poin & Prestasi</h3>
                      <span className="text-xs font-black text-[#1B5E20] bg-green-100 px-3 py-1 rounded-full">
                        {currentStudent.points} Pts
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Standar minimal kelulusan karakter: 1000 Poin</p>
                  </div>

                  {/* Filter Poin & Prestasi */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                    {(['semua', 'prestasi', 'apresiasi', 'konsekuensi'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setPoinTabFilter(tab)}
                        className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                          poinTabFilter === tab
                            ? 'bg-[#1B5E20] text-white shadow-xs'
                            : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Pengajuan & Daftar Prestasi Santri */}
                  {(poinTabFilter === 'semua' || poinTabFilter === 'prestasi') && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Prestasi Santri
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowFormPrestasi((v) => !v)}
                          className="text-xs font-bold text-[#2E7D32] bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-100"
                        >
                          {showFormPrestasi ? 'Tutup Form' : '+ Ajukan Prestasi'}
                        </button>
                      </div>

                      {prestasiMsg && (
                        <div className="p-2.5 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800">
                          {prestasiMsg}
                        </div>
                      )}

                      {showFormPrestasi && (
                        <form
                          onSubmit={handleSubmitPrestasi}
                          className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-2.5 text-xs"
                        >
                          <p className="text-xs text-gray-500">
                            Pengajuan dikirim sebagai <b>pending</b>. Poin ditentukan oleh guru / pembimbing rayon saat verifikasi.
                          </p>
                          <div>
                            <label className="block font-semibold text-gray-700 mb-1">Nama Prestasi *</label>
                            <input
                              type="text"
                              required
                              value={prestasiForm.judul}
                              onChange={(e) => setPrestasiForm({ ...prestasiForm, judul: e.target.value })}
                              placeholder="Contoh: Juara 1 Lomba Tahfidz 5 Juz"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#2E7D32] outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block font-semibold text-gray-700 mb-1">Kategori</label>
                              <select
                                value={prestasiForm.kategori}
                                onChange={(e) => setPrestasiForm({ ...prestasiForm, kategori: e.target.value })}
                                className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                              >
                                {['Prestasi Kejuaraan', 'Duta Karakter', 'Peduli Lingkungan', 'Akademik', 'Keagamaan', 'Lainnya'].map((k) => (
                                  <option key={k} value={k}>{k}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold text-gray-700 mb-1">Tingkat</label>
                              <select
                                value={prestasiForm.tingkat}
                                onChange={(e) => setPrestasiForm({ ...prestasiForm, tingkat: e.target.value })}
                                className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                              >
                                {['Sekolah', 'Kecamatan', 'Kabupaten', 'Provinsi', 'Nasional', 'Internasional'].map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block font-semibold text-gray-700 mb-1">Capaian *</label>
                              <input
                                type="text"
                                required
                                value={prestasiForm.capaian}
                                onChange={(e) => setPrestasiForm({ ...prestasiForm, capaian: e.target.value })}
                                placeholder="Contoh: Juara 1"
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-gray-700 mb-1">Tanggal</label>
                              <input
                                type="date"
                                value={prestasiForm.tanggal}
                                onChange={(e) => setPrestasiForm({ ...prestasiForm, tanggal: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block font-semibold text-gray-700 mb-1">Keterangan</label>
                            <textarea
                              rows={2}
                              value={prestasiForm.deskripsi}
                              onChange={(e) => setPrestasiForm({ ...prestasiForm, deskripsi: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={prestasiSubmitting}
                            className="w-full py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white font-bold rounded-xl flex items-center justify-center gap-1.5"
                          >
                            <Save className="w-4 h-4" />
                            {prestasiSubmitting ? 'Mengirim…' : 'Kirim Pengajuan'}
                          </button>
                        </form>
                      )}

                      {prestasiList.length === 0 && (
                        <p className="text-xs text-gray-500 px-1">Belum ada prestasi.</p>
                      )}

                      {prestasiList.map((pres) => (
                        <div key={pres.id} className="rounded-card border border-line bg-surface p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-gray-900 block">{pres.judul}</span>
                              <p className="text-xs text-yellow-800 mt-0.5">
                                Tingkat: {pres.tingkat} • Capaian: {pres.capaian}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span
                                  className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                    pres.status === 'verified'
                                      ? 'bg-green-100 text-green-800'
                                      : pres.status === 'rejected'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {pres.status === 'verified'
                                    ? 'Terverifikasi'
                                    : pres.status === 'rejected'
                                      ? 'Ditolak'
                                      : 'Menunggu verifikasi'}
                                </span>
                                <span className="text-xs text-gray-400">{pres.tanggal}</span>
                              </div>
                              {pres.catatan_verifikasi && (
                                <p className="text-xs text-gray-500 mt-1 italic">Catatan: {pres.catatan_verifikasi}</p>
                              )}
                            </div>
                            <span className="text-xs font-black text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full shrink-0">
                              {pres.status === 'verified' ? `+${pres.poin} Pts` : '0 Pts'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Riwayat Mutasi Poin Karakter */}
                  {(poinTabFilter === 'semua' || poinTabFilter === 'apresiasi' || poinTabFilter === 'konsekuensi') && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider px-1">
                        Catatan Apresiasi & Konsekuensi Harian
                      </h4>
                      {poinLogs
                        .filter((p) => {
                          if (poinTabFilter === 'apresiasi') return p.tipe === 'apresiasi';
                          if (poinTabFilter === 'konsekuensi') return p.tipe === 'konsekuensi';
                          return true;
                        })
                        .map((log) => (
                          <div
                            key={log.id}
                            className={`bg-white rounded-2xl p-3.5 shadow-sm border flex items-start justify-between gap-2 ${
                              log.tipe === 'apresiasi' ? 'border-green-100' : 'border-red-100'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span
                                  className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                    log.tipe === 'apresiasi' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {log.kode}
                                </span>
                                <span className="text-xs text-gray-400">{log.time}</span>
                              </div>
                              <p className="text-xs font-medium text-gray-800">{log.deskripsi}</p>
                            </div>
                            <span
                              className={`text-xs font-black px-2 py-0.5 rounded-full shrink-0 ${
                                log.tipe === 'apresiasi' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                              }`}
                            >
                              {log.tipe === 'apresiasi' ? `+${log.poin}` : `-${log.poin}`}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB SISWA: PROFIL */}
              {siswaTab === 'profil' && (
                <div className="space-y-4">
                  <section className="rounded-card border border-line bg-surface p-4">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-brand-50 text-base font-bold text-brand-800"
                      >
                        {initials(currentStudent.name)}
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-ink">{currentStudent.name}</h2>
                        <p className="text-xs text-muted">
                          {currentStudent.kelas} · Rayon {currentStudent.rayon}
                        </p>
                        {accountEmail && (
                          <p className="truncate text-xs text-muted">{accountEmail}</p>
                        )}
                      </div>
                    </div>

                    <dl className="mt-4 divide-y divide-line border-t border-line text-xs">
                      <div className="flex items-center justify-between py-2">
                        <dt className="text-muted">NISN</dt>
                        <dd className="font-semibold text-ink tabular">
                          {currentStudent.nisn && currentStudent.nisn !== '-'
                            ? currentStudent.nisn
                            : 'Belum diisi admin'}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <dt className="text-muted">Total poin karakter</dt>
                        <dd className="font-semibold text-brand-800 tabular">{currentStudent.points}</dd>
                      </div>
                    </dl>
                  </section>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-2 rounded-control border border-danger/25 bg-danger-50 py-3 text-xs font-semibold text-danger hover:bg-danger/10"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Keluar dari akun
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Bottom Nav */}
            <BottomNav
              role="siswa"
              activeTab={siswaTab}
              onChangeTab={(t) => setSiswaTab(t)}
            />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 3. DASHBOARD ORANG TUA (ROLE: orang_tua)    */}
      {/* ═══════════════════════════════════════════ */}
      {currentRoute === 'ortu' && (
        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-3xl bg-paper flex flex-col min-h-screen relative pb-24">
            
            <Header
              greeting="Assalamu’alaikum, Bapak/Ibu"
              fullName={profile?.fullName || "Bapak/Ibu Wali"}
              subtitle={`Wali dari: ${currentStudent.name} (${currentStudent.kelas})`}
              poin={currentStudent.points}
              onLogout={handleLogout}
            />

            <div className="px-4 py-4 space-y-4 flex-1">
              
              {/* TAB ORTU: HOME */}
              {ortuTab === 'home' && (
                <div className="space-y-4">
                  {/* Saldo poin anak, satu-satunya angka besar di layar ini. */}
                  <section className="rounded-card border border-line bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                          Poin karakter ananda
                        </h2>
                        <p className="mt-1 text-3xl font-bold tabular text-brand-800">
                          {currentStudent.points}
                          <span className="ml-1 text-sm font-medium text-muted">poin</span>
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {currentStudent.name} · {currentStudent.kelas} · Rayon {currentStudent.rayon}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-control border border-line bg-paper px-2.5 py-1 text-xs font-semibold text-brand-800">
                        Pekan ke-{currentWeek}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>Target kelulusan karakter</span>
                        <span className="tabular">{targetPoin} poin</span>
                      </div>
                      <div
                        className="mt-1 h-2 w-full overflow-hidden rounded-full bg-paper"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={targetPoin}
                        aria-valuenow={Math.max(0, currentStudent.points)}
                        aria-label="Capaian poin terhadap target kelulusan"
                      >
                        <div
                          className="h-full rounded-full bg-brand-700"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted tabular">{progressPct}% dari target</p>
                    </div>
                  </section>

                  {/* Pengesahan pekan ini. Status hanya diklaim setelah tersimpan. */}
                  <section className="rounded-card border border-line bg-surface p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-ink">Pengesahan pekan ke-{currentWeek}</h2>
                        <p className="mt-0.5 text-xs text-muted">
                          {ttdSavedUrl
                            ? 'Tanda tangan tersimpan pada sesi ini.'
                            : 'Buku BKP pekan ini belum ditandatangani.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOrtuTab('ttd')}
                        className="shrink-0 rounded-control bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800"
                      >
                        {ttdSavedUrl ? 'Lihat lembar' : 'Tanda tangani'}
                      </button>
                    </div>
                  </section>

                  {/* Riwayat poin terbaru, diambil dari koleksi poin_log. */}
                  <section className="rounded-card border border-line bg-surface">
                    <div className="flex items-center justify-between border-b border-line px-4 py-3">
                      <h2 className="text-sm font-semibold text-ink">Catatan poin terbaru</h2>
                      <button
                        type="button"
                        onClick={() => setOrtuTab('laporan')}
                        className="text-xs font-semibold text-brand-700 hover:underline"
                      >
                        Lihat laporan
                      </button>
                    </div>

                    {studentPoinLogs.length === 0 ? (
                      <p className="px-4 py-4 text-xs text-muted">
                        Belum ada catatan poin dari guru atau pembimbing rayon.
                      </p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {studentPoinLogs.slice(0, 4).map((log) => (
                          <li key={log.id} className="flex items-start justify-between gap-3 px-4 py-3">
                            <div>
                              <p className="text-xs font-semibold text-ink">
                                <span className="mr-1.5 rounded bg-paper px-1.5 py-0.5 text-xs font-bold text-muted">
                                  {log.kode}
                                </span>
                                {log.deskripsi}
                              </p>
                              <p className="mt-0.5 text-xs text-muted">{log.time}</p>
                            </div>
                            <span
                              className={`shrink-0 text-xs font-bold tabular ${
                                log.tipe === 'apresiasi' ? 'text-brand-700' : 'text-danger'
                              }`}
                            >
                              {log.tipe === 'apresiasi' ? `+${log.poin}` : `-${log.poin}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {lastKonsekuensi && (
                    <section className="rounded-card border border-danger/25 bg-danger-50 p-4">
                      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-danger">
                        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                        Konsekuensi terakhir
                      </h2>
                      <p className="mt-1 text-xs text-ink">
                        {lastKonsekuensi.deskripsi}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {lastKonsekuensi.kode} · {lastKonsekuensi.time} ·{' '}
                        <span className="font-semibold text-danger tabular">-{lastKonsekuensi.poin} poin</span>
                      </p>
                    </section>
                  )}
                </div>
              )}

              {/* TAB ORTU: LAPORAN BULANAN (RECHARTS) */}
              {ortuTab === 'laporan' && (
                <Suspense fallback={<MemuatPanel label="laporan" />}>
                  <LaporanBulananOrtu
                    studentName={currentStudent.name}
                    studentKelas={currentStudent.kelas}
                    studentRayon={currentStudent.rayon}
                    currentPoints={currentStudent.points}
                    poinLogs={studentPoinLogs}
                  />
                </Suspense>
              )}

              {/* TAB ORTU: BORANG KESEHATAN */}
              {ortuTab === 'kesehatan' && (
                <ModulBelumTersedia judul="Borang kesehatan ananda" />
              )}

              {/* TAB ORTU: TTD DIGITAL */}
              {ortuTab === 'ttd' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                    <h3 className="text-sm font-bold text-[#1B5E20] mb-1">Pengesahan Buku BKP Pekanan</h3>
                    <p className="text-xs text-gray-600">
                      Goreskan tanda tangan digital di bawah sebagai persetujuan dan pengawasan buku pembiasaan ananda.
                    </p>
                  </div>

                  {ttdSuccess && (
                    <div className="p-3 bg-green-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Tanda tangan tersimpan untuk pekan ini.</span>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700">Area Kanvas:</span>
                      <button
                        onClick={clearSig}
                        className="text-xs text-gray-500 hover:text-red-600 font-semibold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>

                    <div className="w-full border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 overflow-hidden flex items-center justify-center relative">
                      <SignatureCanvas
                        ref={sigCanvasRef}
                        penColor="#1B5E20"
                        canvasProps={{
                          width: 340,
                          height: 180,
                          className: 'cursor-crosshair w-full h-[180px]',
                        }}
                      />
                      <span className="absolute bottom-1 text-xs text-gray-400 pointer-events-none">
                        (Tanda tangani menggunakan jari atau kursor)
                      </span>
                    </div>

                    <button
                      onClick={saveSig}
                      disabled={ttdLoading}
                      className="w-full py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      {ttdLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Simpan TTD & Sahkan Pekan Ini</span>
                        </>
                      )}
                    </button>
                  </div>

                  {ttdSavedUrl && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 text-center">
                      <h4 className="text-xs font-bold text-gray-700 mb-2">Pratinjau Tanda Tangan Tersimpan:</h4>
                      <img src={ttdSavedUrl} alt="TTD Ortu" className="mx-auto max-h-24 border rounded-xl bg-gray-50 p-2" />
                      <span className="inline-block mt-2 text-xs text-green-700 font-bold bg-green-50 px-3 py-1 rounded-full">
                        Status: Sah & Tercatat di Server BKP
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB ORTU: NOTIFIKASI */}
              {ortuTab === 'notifikasi' && (
                <div className="space-y-3">
                  <section className="rounded-card border border-line bg-surface p-4">
                    <h2 className="text-sm font-semibold text-ink">Pemberitahuan sekolah</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      Pesan resmi dari pembimbing rayon dan BK untuk akun ini.
                    </p>
                  </section>

                  {notifikasiList.length === 0 ? (
                    <p className="rounded-card border border-line bg-surface px-4 py-5 text-xs text-muted">
                      Belum ada pemberitahuan.
                    </p>
                  ) : (
                    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                      {notifikasiList.map((n) => (
                        <li key={n.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-xs font-semibold text-ink">{n.judul}</h3>
                            <span className="shrink-0 text-xs text-muted">{n.time}</span>
                          </div>
                          {n.isi && <p className="mt-1 text-xs leading-relaxed text-ink/90">{n.isi}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* TAB ORTU: PROFIL */}
              {ortuTab === 'profil' && (
                <div className="space-y-4">
                  <section className="rounded-card border border-line bg-surface p-4">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-brand-50 text-base font-bold text-brand-800"
                      >
                        {initials(profile?.fullName || 'Wali Santri')}
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-ink">
                          {profile?.fullName || 'Wali Santri'}
                        </h2>
                        <p className="text-xs text-muted">Orang tua / wali santri</p>
                        {accountEmail && (
                          <p className="truncate text-xs text-muted">{accountEmail}</p>
                        )}
                      </div>
                    </div>

                    <dl className="mt-4 divide-y divide-line border-t border-line text-xs">
                      <div className="flex items-center justify-between gap-3 py-2">
                        <dt className="text-muted">Santri terhubung</dt>
                        <dd className="text-right font-semibold text-ink">
                          {currentStudent.name} ({currentStudent.kelas})
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-2 rounded-control border border-danger/25 bg-danger-50 py-3 text-xs font-semibold text-danger hover:bg-danger/10"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Keluar dari akun
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Bottom Nav Ortu */}
            <BottomNav
              role="orang_tua"
              activeTab={ortuTab}
              onChangeTab={(t) => setOrtuTab(t)}
            />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 4. DASHBOARD GURU / BK (ROLE: guru)         */}
      {/* ═══════════════════════════════════════════ */}
      {currentRoute === 'guru' && (
        <div className="flex-1 flex flex-col md:flex-row">
          
          {/* SIDEBAR HIJAU KIRI (#1B5E20) */}
          <aside className="w-full md:w-64 bg-[#1B5E20] text-white p-5 flex flex-col justify-between shrink-0 shadow-lg">
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-green-800">
                <div className="w-10 h-10 rounded-xl bg-green-800 border border-green-500/40 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-green-300" />
                </div>
                <div>
                  <h2 className="text-sm font-bold leading-tight">Panel {roleLabel(role)}</h2>
                  <span className="text-xs text-green-300">SMK Thibbil Qulub</span>
                  {role === 'pembimbing_rayon' && (
                    <span className="block text-xs text-green-400 mt-0.5">
                      Rayon: {myRayonId || 'belum diatur'}
                    </span>
                  )}
                </div>
              </div>

              <nav className="space-y-1.5 text-xs font-medium">
                <button
                  onClick={() => setGuruTab('dashboard')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                    guruTab === 'dashboard' ? 'bg-[#2E7D32] text-white font-bold shadow-sm' : 'text-green-200 hover:bg-green-800'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard Guru</span>
                </button>

                <button
                  onClick={() => setGuruTab('input_poin')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                    guruTab === 'input_poin' ? 'bg-[#2E7D32] text-white font-bold shadow-sm' : 'text-green-200 hover:bg-green-800'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Input Poin & Prestasi</span>
                </button>

                <button
                  onClick={() => setGuruTab('verifikasi')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                    guruTab === 'verifikasi' ? 'bg-[#2E7D32] text-white font-bold shadow-sm' : 'text-green-200 hover:bg-green-800'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Verifikasi Prestasi</span>
                  {pendingPrestasi.length > 0 && (
                    <span className="ml-auto bg-amber-400 text-amber-950 text-xs font-black px-1.5 py-0.5 rounded-full">
                      {pendingPrestasi.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setGuruTab('kesehatan')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                    guruTab === 'kesehatan' ? 'bg-[#2E7D32] text-white font-bold shadow-sm' : 'text-green-200 hover:bg-green-800'
                  }`}
                >
                  <HeartPulse className="w-4 h-4" />
                  <span>Borang Kesehatan / UKS</span>
                </button>

                <button
                  onClick={() => setGuruTab('siswa')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                    guruTab === 'siswa' ? 'bg-[#2E7D32] text-white font-bold shadow-sm' : 'text-green-200 hover:bg-green-800'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Daftar Santri ({students.length})</span>
                </button>
              </nav>
            </div>

            <div className="pt-6 border-t border-green-800/80">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-green-800 flex items-center justify-center font-bold text-xs text-green-200 border border-green-600">
                  UH
                </div>
                <div>
                  <span className="text-xs font-bold block">{profile?.fullName || roleLabel(role)}</span>
                  <span className="text-xs text-green-300">{roleLabel(role)}</span>
                  <span className="block text-xs text-green-400 truncate max-w-[150px]">
                    {profile?.email}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full py-2 px-3 bg-red-900/60 hover:bg-red-800 text-red-200 text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </aside>

          {/* MAIN CONTENT GURU */}
          <main className="flex-1 p-4 md:p-8 overflow-y-auto">
            
            {/* 1. GURU DASHBOARD */}
            {guruTab === 'dashboard' && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Ringkasan Karakter Santri BKP</h1>
                  <p className="text-xs text-gray-500">Pemantauan jurnal harian, kedisiplinan, dan kesehatan siswa</p>
                </div>

                {/* 3 STATS CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-green-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-gray-500">Total Santri Aktif</span>
                      <div className="text-2xl font-bold text-[#1B5E20] mt-1">{students.length} Siswa</div>
                      <span className="text-xs text-green-600 font-semibold">
                        {myRayonId ? `Rayon ${myRayonId}` : 'Seluruh rayon'}
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-[#2E7D32]">
                      <Users className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-green-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-gray-500">Poin Apresiasi Hari Ini</span>
                      <div className="text-2xl font-bold text-[#2E7D32] mt-1">+{apresiasiHariIni} Pts</div>
                      <span className="text-xs text-emerald-600 font-semibold">Dari catatan poin terbaru</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Sparkles className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-green-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-gray-500">Konsekuensi 7 Hari Terakhir</span>
                      <div className="text-2xl font-bold text-red-600 mt-1">{konsekuensiMingguIni} Catatan</div>
                      <span className="text-xs text-red-500 font-semibold">Dari riwayat poin</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                {/* TABEL 10 SISWA TERBARU */}
                <div className="bg-white rounded-2xl shadow-sm border border-green-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-800">Daftar santri dan total poin karakter</h3>
                    <span className="text-xs text-gray-500">
                      {students.length} santri terdaftar
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold">
                        <tr>
                          <th className="p-3">Nama Santri</th>
                          <th className="p-3">Kelas</th>
                          <th className="p-3">Rayon</th>
                          <th className="p-3">Total Poin</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {students.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-4 text-xs text-muted">
                              Belum ada santri pada lingkup akun ini. Admin dapat menambah data
                              santri dari panel admin atau menu Tambah Santri.
                            </td>
                          </tr>
                        )}
                        {students.map((st) => (
                          <tr key={st.id} className="hover:bg-gray-50">
                            <td className="p-3 font-bold text-gray-900">{st.name}</td>
                            <td className="p-3 text-gray-600">{st.kelas}</td>
                            <td className="p-3 text-gray-600">{st.rayon}</td>
                            <td className="p-3 font-bold text-[#1B5E20]">{st.points} Pts</td>
                            <td className="p-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  st.points >= 1000
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {st.points >= 1000 ? 'Sangat Baik' : 'Cukup Baik'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedStudentId(st.id);
                                  setGuruTab('input_poin');
                                }}
                                className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 font-semibold rounded-lg border border-green-200 text-xs"
                              >
                                + Poin
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. GURU: INPUT POIN & KONSEKUENSI */}
            {guruTab === 'input_poin' && (
              <div className="space-y-6 max-w-3xl mx-auto">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Form Pencatatan Poin Karakter</h1>
                  <p className="text-xs text-gray-500">Input kode tindakan terpuji (A1-A6) atau konsekuensi (K1-K6)</p>
                </div>

                {guruSuccess && (
                  <div className="p-3.5 bg-green-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Poin berhasil dicatat dan diakumulasikan ke buku santri!</span>
                  </div>
                )}

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-100">
                  <form onSubmit={handleGuruSubmit} className="space-y-4 text-xs">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1.5">Pilih Santri Target</label>
                      <select
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                      >
                        {students.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name} ({st.kelas} - {st.rayon}) • Total Saat Ini: {st.points} Pts
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1.5">Pilih Kode Tindakan BKP</label>
                      <select
                        value={selectedKode}
                        onChange={(e) => {
                          setSelectedKode(e.target.value);
                          const m = effectiveKodes.find((item) => item.kode === e.target.value);
                          if (m) setGuruDeskripsi(m.deskripsi);
                        }}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                      >
                        <optgroup label="Tindakan Terpuji (Apresiasi)">
                          {effectiveKodes
                            .filter((m) => m.tipe === 'apresiasi')
                            .map((m) => (
                              <option key={m.kode} value={m.kode}>
                                [{m.kode}] {m.deskripsi} (+{m.poin} Poin)
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="Tindakan Kurang Terpuji (Konsekuensi)">
                          {effectiveKodes
                            .filter((m) => m.tipe === 'konsekuensi')
                            .map((m) => (
                              <option key={m.kode} value={m.kode}>
                                [{m.kode}] {m.deskripsi} (-{m.poin} Poin)
                              </option>
                            ))}
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1.5">Deskripsi / Catatan Pembinaan</label>
                      <textarea
                        rows={3}
                        value={guruDeskripsi}
                        onChange={(e) => setGuruDeskripsi(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>Simpan & Mutasikan Poin</span>
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* 2b. GURU: VERIFIKASI PRESTASI */}
            {guruTab === 'verifikasi' && (
              <div className="space-y-5 max-w-3xl mx-auto">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Verifikasi Prestasi Santri</h1>
                  <p className="text-xs text-gray-500">
                    Setujui dengan menentukan poin, atau tolak dengan catatan. Setiap keputusan
                    tercatat di audit log dan tidak bisa dihapus.
                  </p>
                </div>

                {pendingPrestasi.length === 0 && (
                  <div className="bg-white rounded-2xl border border-green-100 p-4 text-xs text-gray-500">
                    Tidak ada pengajuan yang menunggu verifikasi.
                  </div>
                )}

                {pendingPrestasi.map((pres) => {
                  const santri = students.find((s) => s.id === pres.siswa_id);
                  return (
                    <div
                      key={pres.id}
                      className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 space-y-3 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-gray-900 block">{pres.judul}</span>
                          <span className="text-gray-500 block">
                            {santri?.name ?? pres.siswa_id} • {santri?.kelas ?? '-'} • Rayon{' '}
                            {pres.rayon}
                          </span>
                          <span className="text-gray-400 block">
                            {pres.kategori} • {pres.tingkat} • {pres.capaian} • {pres.tanggal}
                          </span>
                          {pres.deskripsi && (
                            <p className="text-gray-600 mt-1">{pres.deskripsi}</p>
                          )}
                        </div>
                        <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md shrink-0">
                          PENDING
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2">
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">Poin disetujui</label>
                          <input
                            type="number"
                            min={0}
                            max={5000}
                            value={verifyPoin[pres.id] ?? 100}
                            onChange={(e) =>
                              setVerifyPoin({ ...verifyPoin, [pres.id]: Number(e.target.value) })
                            }
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">Catatan verifikasi</label>
                          <input
                            type="text"
                            value={verifyCatatan[pres.id] ?? ''}
                            onChange={(e) =>
                              setVerifyCatatan({ ...verifyCatatan, [pres.id]: e.target.value })
                            }
                            placeholder="Opsional, mis. bukti sertifikat kurang"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={verifyingId === pres.id}
                          onClick={() => handleVerifyPrestasi(pres, 'verified')}
                          className="flex-1 min-w-[160px] py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-gray-300 text-white font-bold rounded-xl flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {verifyingId === pres.id ? 'Memproses…' : 'Verifikasi & Beri Poin'}
                        </button>
                        <button
                          type="button"
                          disabled={verifyingId === pres.id}
                          onClick={() => handleVerifyPrestasi(pres, 'rejected')}
                          className="px-4 py-2.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 font-bold rounded-xl border border-red-200 flex items-center justify-center gap-1.5"
                        >
                          <AlertTriangle className="w-4 h-4" /> Tolak
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1">
                    Riwayat keputusan
                  </h2>
                  {prestasiList.filter((p) => p.status !== 'pending').length === 0 && (
                    <p className="text-xs text-gray-400 px-1">Belum ada keputusan.</p>
                  )}
                  {prestasiList
                    .filter((p) => p.status !== 'pending')
                    .map((pres) => (
                      <div
                        key={pres.id}
                        className="bg-white rounded-xl border border-gray-200 p-3 text-xs flex items-start justify-between gap-2"
                      >
                        <div>
                          <span className="font-semibold text-gray-800 block">{pres.judul}</span>
                          <span className="text-gray-500 block">
                            {students.find((s) => s.id === pres.siswa_id)?.name ?? pres.siswa_id} •{' '}
                            {pres.tanggal}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md shrink-0 ${
                            pres.status === 'verified'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {pres.status === 'verified' ? `+${pres.poin} Pts` : 'Ditolak'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 3. GURU: BORANG KESEHATAN / UKS */}
            {guruTab === 'kesehatan' && (
              <div className="space-y-6 max-w-4xl mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Pemantauan Skrining Kesehatan Santri</h1>
                    <p className="text-xs text-gray-500">Evaluasi pengukuran fisik, gigi, riwayat kesehatan & catatan UKS</p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-gray-600">Pilih Siswa:</span>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="p-2 bg-white border border-green-200 rounded-xl font-bold text-gray-800 shadow-xs"
                    >
                      {students.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.kelas})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <ModulBelumTersedia judul="Borang kesehatan dan buku UKS" />
              </div>
            )}

            {/* 4. GURU: SISWA */}
            {guruTab === 'siswa' && (
              <div className="space-y-4 max-w-5xl mx-auto">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-bold text-gray-900">Direktori Santri Rayon Assimbani</h1>                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Cari siswa / rombel..."
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          className="p-2 text-xs bg-white border border-gray-200 rounded-xl w-60 outline-none"
                        />
                        {canCreateStudent(role) && (
                          <button
                            type="button"
                            onClick={() => setShowTambahSiswa(true)}
                            className="px-3 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>Tambah Santri</span>
                          </button>
                        )}
                      </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {students
                    .filter((s) => s.name.toLowerCase().includes(studentSearch.toLowerCase()))
                    .map((s) => (
                      <div key={s.id} className="bg-white p-4 rounded-2xl border border-green-100 shadow-sm flex items-center justify-between">
                        <div>
                          <span className="font-bold text-gray-900 block">{s.name}</span>
                          <span className="text-gray-500 block">{s.kelas} • {s.rayon}</span>
                          <span className="font-bold text-[#1B5E20] block mt-1">{s.points} Poin Karakter</span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedStudentId(s.id);
                            setGuruTab('kesehatan');
                          }}
                          className="px-3 py-1.5 bg-green-50 text-green-800 font-bold rounded-xl border border-green-200 text-xs flex items-center gap-1 hover:bg-green-100"
                        >
                          <HeartPulse className="w-3.5 h-3.5" />
                          <span>Kesehatan</span>
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </main>

          <TambahSiswaModal
            isOpen={showTambahSiswa}
            onClose={() => setShowTambahSiswa(false)}
            onStudentAdded={() => setShowTambahSiswa(false)}
            actorRole={role ?? undefined}
            actor={sessionUser ? { uid: sessionUser.uid, email: sessionUser.email } : null}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 5. PANEL ADMIN (ROLE: admin)                */}
      {/* ═══════════════════════════════════════════ */}
      {currentRoute === 'admin' && (
        <Suspense fallback={<MemuatPanel label="panel admin" />}>
          <AdminPanel
            profile={profile}
            onLogout={handleLogout}
            onOpenStaffDashboard={() => setCurrentRoute('guru')}
          />
        </Suspense>
      )}
    </div>
  );
}
