/**
 * State dan aksi aplikasi. Dipisahkan dari tampilan agar setiap dashboard
 * hanya menerima satu model dan App tetap menjadi komposisi rute.
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import BottomNav, { NavTab } from '../components/BottomNav';
import TambahSiswaModal from '../components/TambahSiswaModal';
import DetailSiswaModal from '../components/DetailSiswaModal';
import SignatureCanvas from 'react-signature-canvas';
import type { UserProfile, StudentRecord, PrestasiRecord } from '../lib/tipe';
import {
  isLocalBackend,
  resetLocalData,
  signInWithEmail,
  signOutUser,
  watchAuthUser,
  type AppUser,
} from '../lib/auth';
import { LOCAL_SEED_PASSWORD, siapkanDataAwal } from '../lib/data/seed';
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
} from '../lib/data';
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
} from '../lib/rbac';
import { logAuditSafe, newAuditRef, buildAuditPayload } from '../lib/audit';
import { ajukanPrestasi, putuskanPrestasi } from '../features/prestasi/prestasi';
import LoginPage from '../features/auth/LoginPage';
import { MemuatPanel, ModulBelumTersedia } from '../components/StatusPanel';
import { initials, isoWeekNumber } from '../lib/format';

// Panel admin dan laporan (membawa recharts) hanya dimuat saat dibutuhkan,
// supaya siswa dan guru tidak mengunduh kode yang tidak mereka pakai.
const AdminPanel = lazy(() => import('../components/AdminPanel'));
const LaporanBulananOrtu = lazy(() => import('../components/LaporanBulananOrtu'));
import KalenderMenstruasi from '../components/KalenderMenstruasi';
import JadwalPelajaranView from '../components/JadwalPelajaranView';
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
  gender?: 'L' | 'P';
  points: number;
  studentEmail?: string;
  waliEmail?: string;
};

export function useAppModel() {
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
  const [guruTab, setGuruTab] = useState<'dashboard' | 'input_poin' | 'verifikasi' | 'jadwal' | 'kesehatan' | 'siswa'>('dashboard');

  // Siswa State
  const [siswaDate, setSiswaDate] = useState(new Date().toISOString().split('T')[0]);
  const [siswaSaveSuccess, setSiswaSaveSuccess] = useState(false);
  const [jurnalSaving, setJurnalSaving] = useState(false);
  const jurnalSavingRef = useRef(false);
  const [jurnalView, setJurnalView] = useState<'harian' | 'mingguan' | 'non_rutin' | 'jadwal' | 'kesehatan'>('harian');
  const [poinTabFilter, setPoinTabFilter] = useState<'semua' | 'prestasi' | 'apresiasi' | 'konsekuensi'>('semua');
  const [tahunPelajaranFilter, setTahunPelajaranFilter] = useState<string>('Semua');
  const [guruTahunFilter, setGuruTahunFilter] = useState<string>('Semua');
  const [guruStatusFilter, setGuruStatusFilter] = useState<string>('Semua');
  const [selectedClassForJadwal, setSelectedClassForJadwal] = useState<string>('X TKJ 1');

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
    tahunPelajaran: '2025/2026',
    semester: 'Genap' as 'Ganjil' | 'Genap',
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
  const [staffKelasFilter, setStaffKelasFilter] = useState('semua');

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
      const emailLower = (user.email ?? '').toLowerCase();
      const isAdminCandidate =
        emailLower === 'admassimbani@gmail.com' ||
        emailLower.startsWith('admin@') ||
        emailLower.includes('admin');

      if (isAdminCandidate) {
        const adminDoc = {
          uid: user.uid,
          email: emailLower,
          fullName: user.displayName || (emailLower.includes('admin') ? 'Administrator BKP' : 'Super Admin BKP'),
          role: 'admin' as const,
          active: true,
          total_poin: 0,
        };
        await setDoc(ref, adminDoc);
        snap = await getDoc(ref);
      } else {
        // Akun Firebase tanpa profil tidak boleh membuat profilnya sendiri.
        // Profil hanya dibuat admin, supaya akun baru tidak otomatis mendapat
        // akses tanpa persetujuan sekolah.
        await signOutUser();
        throw new Error(
          `Akun ${emailLower} berhasil masuk di Firebase Auth, namun belum terhubung ke dokumen profil sekolah di koleksi "profiles". Hubungi admin atau buat dokumen profilnya.`
        );
      }
    }
    const data = snap.data() as UserProfile;

    // Profil yang dinonaktifkan admin tidak boleh dipakai lagi, meskipun
    // token Firebase masih sah. Sesi lokal diperiksa di lapisan auth.
    if ((data as { active?: boolean }).active === false) {
      await signOutUser();
      throw new Error('Akun ini dinonaktifkan. Hubungi admin sekolah.');
    }

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

    // Mode lokal: akun admin awal (dan data demo bila diminta) disiapkan
    // sebelum sesi dipulihkan.
    siapkanDataAwal()
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
  const mapStudentDoc = (id: string, data: any): StudentRow => {
    const isPerempuanByRayonOrName =
      (data.rayon ?? '').toLowerCase().includes('khadijah') ||
      (data.rayon ?? '').toLowerCase().includes('aisyah') ||
      (data.name ?? '').toLowerCase().includes('aisyah') ||
      (data.name ?? '').toLowerCase().includes('zahra') ||
      (data.name ?? '').toLowerCase().includes('fatimah') ||
      (data.name ?? '').toLowerCase().includes('nurul');
    return {
      id,
      name: data.name ?? '(tanpa nama)',
      nisn: data.nisn ?? '',
      kelas: data.kelas ?? '-',
      rayon: data.rayon ?? '-',
      gender: data.gender ?? (isPerempuanByRayonOrName ? 'P' : 'L'),
      points: Number(data.points) || 0,
      studentEmail: data.studentEmail ?? data.email ?? '',
      waliEmail: data.waliEmail ?? '',
    };
  };

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
            tahunPelajaran: data.tahunPelajaran ?? '2025/2026',
            semester: data.semester ?? 'Genap',
            nama_siswa: data.nama_siswa ?? '',
            kelas: data.kelas ?? '',
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

  const [resetSentEmail, setResetSentEmail] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSendPasswordReset = async (targetEmail?: string) => {
    const e = (targetEmail || email).trim();
    if (!e) {
      setErrorMsg('Ketik alamat email terlebih dahulu untuk menerima tautan buat/setel ulang kata sandi.');
      return;
    }
    setResetLoading(true);
    setErrorMsg(null);
    setResetSentEmail(null);
    try {
      if (isLocalBackend) {
        setErrorMsg('Di mode lokal, kata sandi diatur ulang langsung oleh Admin dari menu Pengguna.');
        return;
      }
      const { sendPasswordResetThroughApp } = await import('../lib/createUserHelper');
      await sendPasswordResetThroughApp(e);
      setResetSentEmail(e);
    } catch (err: any) {
      const code = String(err?.code ?? '');
      if (code.includes('user-not-found')) {
        setErrorMsg(`Email "${e}" belum terdaftar di Firebase Authentication.`);
      } else {
        setErrorMsg('Gagal mengirim tautan reset sandi: ' + (err?.message ?? String(err)));
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleLoginGoogle = async () => {
    if (isLocalBackend) return;
    setGoogleLoading(true);
    setErrorMsg(null);
    try {
      const { loginWithGoogle } = await import('../lib/firebase');
      await loginWithGoogle();
      // watchAuthUser -> loadProfileAndRoute menangani routing otomatis
    } catch (err: any) {
      const code = String(err?.code ?? '');
      if (code.includes('popup-closed-by-user')) {
        setErrorMsg('Jendela masuk Google ditutup sebelum selesai.');
      } else if (code.includes('popup-blocked')) {
        setErrorMsg('Jendela pop-up masuk diblokir oleh peramban. Silakan izinkan pop-up pada peramban Anda.');
      } else {
        setErrorMsg('Gagal masuk dengan Google: ' + (err?.message ?? String(err)));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

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
      if (code.includes('operation-not-allowed')) {
        setErrorMsg('Penyedia Email/Password belum aktif di Firebase Console. Buka Firebase Console > Authentication > Sign-in method > aktifkan Email/Password.');
      } else if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        setErrorMsg('Email atau kata sandi tidak cocok. Bila Anda lupa kata sandi, silakan klik tombol "Lupa Kata Sandi?" di bawah formulir untuk membuat kata sandi baru melalui email.');
      } else if (code.includes('invalid-email')) {
        setErrorMsg('Format email tidak valid. Periksa kembali penulisan alamat email Anda.');
      } else if (!code && err instanceof Error) {
        setErrorMsg(err.message);
      } else if (code.includes('too-many-requests')) {
        setErrorMsg('Terlalu banyak percobaan masuk yang salah. Silakan coba lagi beberapa saat atau buat kata sandi baru.');
      } else if (code.includes('network')) {
        setErrorMsg('Tidak dapat menghubungi server autentikasi Firebase. Periksa koneksi internet Anda.');
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
    (myStudentId ? students.find((s) => s.id === myStudentId) : null) ||
    (students.length === 1 && role === 'siswa' ? students[0] : null) ||
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
          gender: profile?.gender || 'L',
          points: profile?.total_poin ?? 0,
        };

  // Indikator apakah santri aktif adalah siswi putri (untuk kalender menstruasi)
  const isSiswiPutri =
    currentStudent?.gender === 'P' ||
    (currentStudent?.rayon ?? '').toLowerCase().includes('khadijah') ||
    (currentStudent?.rayon ?? '').toLowerCase().includes('aisyah') ||
    (currentStudent?.name ?? '').toLowerCase().includes('aisyah') ||
    (currentStudent?.name ?? '').toLowerCase().includes('zahra') ||
    (currentStudent?.name ?? '').toLowerCase().includes('fatimah') ||
    (currentStudent?.name ?? '').toLowerCase().includes('nurul');

  const daftarKelasSemua = Array.from(
    new Set([
      'X TKJ 1',
      'X TKJ 2',
      'X Farmasi A',
      'X Farmasi B',
      'X Keperawatan A',
      'X Keperawatan B',
      'XI Farmasi A',
      'XI Keperawatan A',
      ...students.map((s) => s.kelas),
    ])
  ).filter(Boolean);

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
    const jurnalRef = doc(db, 'pembiasaan_harian', jurnalId);

    if (jurnalSavingRef.current) return;
    jurnalSavingRef.current = true;
    setJurnalSaving(true);

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
      // Idempoten: satu tanggal hanya boleh menambah poin sekali. Jurnal yang
      // sudah ada tidak ditimpa dan poin tidak ditambah lagi, sehingga klik
      // berulang atau dua tab sekaligus tidak menggandakan poin.
      const existing = await getDoc(jurnalRef);
      if (existing.exists() && role === 'siswa') {
        setErrorMsg(
          'Jurnal tanggal ini sudah tersimpan. Hubungi guru atau pembimbing rayon untuk koreksi.'
        );
        return;
      }

      // Jurnal, saldo poin, dan audit log ditulis atomik: kalau salah satu
      // ditolak rules, seluruh operasi batal (tidak ada data separuh jadi).
      const batch = writeBatch(db);
      batch.set(jurnalRef, payload);
      batch.update(doc(db, 'students', currentStudent.id), {
        ...(existing.exists() ? {} : { points: increment(dailyPts) }),
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
    } finally {
      jurnalSavingRef.current = false;
      setJurnalSaving(false);
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
  // Aturan status, poin, dan audit ada di module prestasi; handler hanya
  // meneruskan isian form dan menampilkan hasilnya.
  const handleSubmitPrestasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditActor) {
      setErrorMsg('Sesi berakhir. Silakan masuk kembali.');
      return;
    }

    setPrestasiSubmitting(true);
    setPrestasiMsg(null);

    try {
      await ajukanPrestasi(
        {
          siswaId: currentStudent.id,
          rayon: currentStudent.rayon,
          judul: prestasiForm.judul,
          kategori: prestasiForm.kategori,
          tingkat: prestasiForm.tingkat,
          capaian: prestasiForm.capaian,
          tanggal: prestasiForm.tanggal,
          tahunPelajaran: prestasiForm.tahunPelajaran,
          semester: prestasiForm.semester,
          namaSiswa: currentStudent.name,
          kelas: currentStudent.kelas,
          deskripsi: prestasiForm.deskripsi,
        },
        auditActor
      );
      setPrestasiMsg('Pengajuan prestasi terkirim. Menunggu verifikasi guru / pembimbing rayon.');
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
    if (!auditActor) {
      setErrorMsg('Sesi berakhir. Silakan masuk kembali.');
      return;
    }

    setVerifyingId(pres.id);
    try {
      await putuskanPrestasi(
        {
          id: pres.id,
          siswa_id: pres.siswa_id,
          rayon: pres.rayon,
          judul: pres.judul,
          status: pres.status,
          poin: pres.poin,
        },
        {
          status: decision,
          poin: Number(verifyPoin[pres.id] ?? 100),
          catatan: verifyCatatan[pres.id] ?? '',
        },
        auditActor
      );
    } catch (err) {
      setErrorMsg(
        'Gagal memverifikasi prestasi: ' + (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setVerifyingId(null);
    }
  };

  return {
    isLocalBackend,
    currentRoute,
    setCurrentRoute,
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    loginLoading,
    setLoginLoading,
    errorMsg,
    setErrorMsg,
    siswaTab,
    setSiswaTab,
    ortuTab,
    setOrtuTab,
    guruTab,
    setGuruTab,
    siswaDate,
    setSiswaDate,
    siswaSaveSuccess,
    setSiswaSaveSuccess,
    jurnalSaving,
    setJurnalSaving,
    jurnalSavingRef,
    jurnalView,
    setJurnalView,
    poinTabFilter,
    setPoinTabFilter,
    tahunPelajaranFilter,
    setTahunPelajaranFilter,
    guruTahunFilter,
    setGuruTahunFilter,
    guruStatusFilter,
    setGuruStatusFilter,
    selectedClassForJadwal,
    setSelectedClassForJadwal,
    jurnal,
    setJurnal,
    mingguan,
    setMingguan,
    nonRutinFilter,
    setNonRutinFilter,
    nonRutinSaveSuccess,
    setNonRutinSaveSuccess,
    nonRutinSaving,
    setNonRutinSaving,
    nonRutinList,
    setNonRutinList,
    prestasiList,
    setPrestasiList,
    prestasiForm,
    setPrestasiForm,
    prestasiSubmitting,
    setPrestasiSubmitting,
    prestasiMsg,
    setPrestasiMsg,
    showFormPrestasi,
    setShowFormPrestasi,
    verifyPoin,
    setVerifyPoin,
    verifyCatatan,
    setVerifyCatatan,
    verifyingId,
    setVerifyingId,
    masterKategori,
    setMasterKategori,
    sigCanvasRef,
    ttdSavedUrl,
    setTtdSavedUrl,
    ttdSuccess,
    setTtdSuccess,
    ttdLoading,
    setTtdLoading,
    selectedStudentId,
    setSelectedStudentId,
    selectedKode,
    setSelectedKode,
    guruDeskripsi,
    setGuruDeskripsi,
    guruSuccess,
    setGuruSuccess,
    studentSearch,
    setStudentSearch,
    staffKelasFilter,
    setStaffKelasFilter,
    students,
    setStudents,
    showTambahSiswa,
    setShowTambahSiswa,
    masterKodes,
    poinLogs,
    setPoinLogs,
    notifikasiList,
    setNotifikasiList,
    sessionUser,
    setSessionUser,
    profile,
    setProfile,
    authReady,
    setAuthReady,
    profileWarning,
    setProfileWarning,
    role,
    myStudentId,
    myChildIds,
    myRayonId,
    accountEmail,
    loadProfileAndRoute,
    mapStudentDoc,
    handleLogin,
    handleResetLocal,
    handleLogout,
    resetSentEmail,
    setResetSentEmail,
    resetLoading,
    handleSendPasswordReset,
    googleLoading,
    handleLoginGoogle,
    ownStudent,
    currentStudent,
    isSiswiPutri,
    daftarKelasSemua,
    effectiveKodes,
    auditActor,
    pendingPrestasi,
    currentWeek,
    targetPoin,
    progressPct,
    studentPoinLogs,
    lastKonsekuensi,
    startOfTodayMs,
    weekAgoMs,
    apresiasiHariIni,
    konsekuensiMingguIni,
    calculateDailyPoints,
    saveJurnal,
    saveNonRutin,
    clearSig,
    saveSig,
    handleGuruSubmit,
    handleSubmitPrestasi,
    handleVerifyPrestasi
  };
}

export type AppModel = ReturnType<typeof useAppModel>;
