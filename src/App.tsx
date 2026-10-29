/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import BottomNav, { NavTab } from './components/BottomNav';
import BorangKesehatanView from './components/BorangKesehatanView';
import LaporanBulananOrtu from './components/LaporanBulananOrtu';
import TambahSiswaModal from './components/TambahSiswaModal';
import DetailSiswaModal from './components/DetailSiswaModal';
import SignatureCanvas from 'react-signature-canvas';
import { 
  auth, 
  db, 
  loginWithGoogle, 
  logoutUser, 
  UserProfile, 
  StudentRecord,
  UserRole
} from './lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { 
  BookOpen, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
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

type AppRoute = 'login' | 'siswa' | 'ortu' | 'guru';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('login');
  const [deviceView, setDeviceView] = useState<'mobile' | 'desktop'>('mobile');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tab State for Mobile Roles
  const [siswaTab, setSiswaTab] = useState<NavTab>('jurnal');
  const [ortuTab, setOrtuTab] = useState<NavTab>('home');
  const [guruTab, setGuruTab] = useState<'dashboard' | 'input_poin' | 'kesehatan' | 'siswa'>('dashboard');

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
  ]);

  // Data Prestasi Santri Sesuai Halaman 114
  const [prestasiSiswa, setPrestasiSiswa] = useState([
    { id: '1', judul: 'Juara 1 Lomba Tahfidz Al-Quran 5 Juz Tingkat Kabupaten Pekalongan', kategori: 'Prestasi Kejuaraan', tingkat: 'Kabupaten', capaian: 'Juara 1', poin: 1000, tanggal: '15 Okt 2026', pembina: 'Ustadz Abdullah, Lc.' },
    { id: '2', judul: 'Santri Teladan Sholat Berjamaah & Kedisiplinan Rayon Simbang', kategori: 'Duta Karakter', tingkat: 'Sekolah', capaian: 'Teladan 1', poin: 300, tanggal: '22 Okt 2026', pembina: 'Ustadz Hendra Gunawan, S.Pd.I' },
    { id: '3', judul: 'Inisiator Pilah Sampah & Bank Daur Ulang Assimbani', kategori: 'Peduli Lingkungan', tingkat: 'Kecamatan', capaian: 'Pelopor', poin: 150, tanggal: '26 Okt 2026', pembina: 'Wali Rayon' },
  ]);

  // Ortu State
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);
  const [ttdSavedUrl, setTtdSavedUrl] = useState<string | null>(null);
  const [ttdSuccess, setTtdSuccess] = useState(false);
  const [ttdLoading, setTtdLoading] = useState(false);

  // Guru State
  const [selectedStudentId, setSelectedStudentId] = useState('1');
  const [selectedKode, setSelectedKode] = useState('A1.1');
  const [guruDeskripsi, setGuruDeskripsi] = useState('Sholat berjamaah tepat waktu 5 waktu berturut-turut di masjid');
  const [guruSuccess, setGuruSuccess] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Dummy Students Database
  const [students, setStudents] = useState([
    { id: '1', name: 'Muhammad Faiz Assimbani', kelas: 'X TKJ 1', rayon: 'Simbang 2', points: 1250 },
    { id: '2', name: 'Aisyah Nurul Qulub', kelas: 'XI Keperawatan B', rayon: 'Siti Khadijah 2', points: 980 },
    { id: '3', name: 'Zaidan Al-Farisi', kelas: 'X Farmasi A', rayon: 'Assimbani 1', points: 1100 },
    { id: '4', name: 'Fatimah Az-Zahra', kelas: 'XI Keperawatan A', rayon: 'Siti Khadijah 1', points: 1050 },
    { id: '5', name: 'Rizky Pratama', kelas: 'XII Farmasi Industri', rayon: 'Ibnu Sina', points: 880 },
    { id: '6', name: 'Nabila Syahrani', kelas: 'X Keperawatan B', rayon: 'Siti Aisyah 1', points: 1180 },
    { id: '7', name: 'Ahmad Daniyal', kelas: 'X Farmasi B', rayon: 'Assimbani 2', points: 1020 },
    { id: '8', name: 'Zahra Amelia', kelas: 'XI Farmasi A', rayon: 'Siti Khadijah 2', points: 990 },
    { id: '9', name: 'Ihsan Kamil', kelas: 'XII Keperawatan', rayon: 'Assimbani 1', points: 1250 },
    { id: '10', name: 'Salma Salsabila', kelas: 'X Farmasi A', rayon: 'Siti Aisyah 2', points: 1140 },
  ]);

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

  // Point History
  const [poinLogs, setPoinLogs] = useState([
    { id: '1', studentId: '1', kode: 'A 1.14', tipe: 'apresiasi', deskripsi: 'Muhammad Faiz: Melaksanakan sholat Tahajud & Dhuha rutin 1 pekan', poin: 300, time: 'Hari ini, 05:40' },
    { id: '2', studentId: '1', kode: 'A 4.7', tipe: 'apresiasi', deskripsi: 'Muhammad Faiz: Tidur sebelum pukul 22.00 dan minum air putih 2L', poin: 100, time: 'Kemarin, 21:50' },
    { id: '3', studentId: '1', kode: 'K 4.18', tipe: 'konsekuensi', deskripsi: 'Muhammad Faiz: Kopyah tertinggal di asrama saat apel pagi', poin: 150, time: '27 Okt, 07:15' },
    { id: '4', studentId: '2', kode: 'A 1.17', tipe: 'apresiasi', deskripsi: 'Aisyah: Target hafalan Alquran 9 minggu tercapai mutqin', poin: 500, time: '26 Okt, 15:00' },
  ]);

  const handleLogin = (customEmail?: string, customPass?: string) => {
    const e = customEmail || email;
    const p = customPass || password;

    if (!e || !p) {
      setErrorMsg('Silakan masukkan email dan password.');
      return;
    }

    setLoginLoading(true);
    setErrorMsg(null);

    setTimeout(() => {
      setLoginLoading(false);
      if (e.includes('ortu')) {
        setCurrentRoute('ortu');
        setDeviceView('mobile');
      } else if (e.includes('guru') || e.includes('bk')) {
        setCurrentRoute('guru');
        setDeviceView('desktop');
      } else {
        setCurrentRoute('siswa');
        setDeviceView('mobile');
      }
    }, 400);
  };

  const handleLogout = () => {
    setCurrentRoute('login');
    setEmail('');
    setPassword('');
  };

  const currentStudent = students.find((s) => s.id === selectedStudentId) || students[0];

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

  const saveJurnal = () => {
    const dailyPts = calculateDailyPoints();
    setStudents((prev) =>
      prev.map((s) => (s.id === currentStudent.id ? { ...s, points: s.points + dailyPts } : s))
    );
    setSiswaSaveSuccess(true);
    setTimeout(() => setSiswaSaveSuccess(false), 3000);
  };

  // Ortu Signature actions
  const clearSig = () => {
    if (sigCanvasRef.current) {
      sigCanvasRef.current.clear();
      setTtdSavedUrl(null);
    }
  };

  const saveSig = () => {
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
      alert('Mohon bubuhkan tanda tangan Anda terlebih dahulu pada kanvas.');
      return;
    }
    setTtdLoading(true);
    setTimeout(() => {
      const url = sigCanvasRef.current?.getTrimmedCanvas().toDataURL('image/png') || '';
      setTtdSavedUrl(url);
      setTtdLoading(false);
      setTtdSuccess(true);
      setTimeout(() => setTtdSuccess(false), 3500);
    }, 500);
  };

  // Guru Point Submit
  const handleGuruSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const master = masterKodes.find((m) => m.kode === selectedKode);
    if (!master) return;

    const targetStudent = students.find((s) => s.id === selectedStudentId);
    const isAp = master.tipe === 'apresiasi';

    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === selectedStudentId) {
          const newPts = isAp ? s.points + master.poin : Math.max(0, s.points - master.poin);
          return { ...s, points: newPts };
        }
        return s;
      })
    );

    const newLog = {
      id: String(Date.now()),
      studentId: selectedStudentId,
      kode: master.kode,
      tipe: master.tipe,
      deskripsi: `${targetStudent?.name}: ${guruDeskripsi || master.deskripsi}`,
      poin: master.poin,
      time: 'Baru saja',
    };
    setPoinLogs([newLog, ...poinLogs]);

    setGuruSuccess(true);
    setTimeout(() => setGuruSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#E8F5E9] text-gray-900 font-sans flex flex-col">
      
      {/* TOPBAR SWITCHER BAR: Navigasi cepat antar peran */}
      <div className="bg-[#1B5E20] text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between border-b border-green-800 gap-2 shrink-0 z-40">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-green-300" />
          <span className="font-bold tracking-tight">BKP Digital</span>
          <span className="text-green-300 hidden sm:inline">• SMK Thibbil Qulub Assimbani</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-green-200 hidden md:inline">Pratinjau Peran:</span>
          <div className="flex items-center bg-green-950/60 p-0.5 rounded-lg border border-green-700/50">
            <button
              onClick={() => { setCurrentRoute('login'); }}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                currentRoute === 'login' ? 'bg-[#2E7D32] text-white' : 'text-green-200 hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => { setCurrentRoute('siswa'); setDeviceView('mobile'); }}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                currentRoute === 'siswa' ? 'bg-[#2E7D32] text-white' : 'text-green-200 hover:text-white'
              }`}
            >
              Siswa
            </button>
            <button
              onClick={() => { setCurrentRoute('ortu'); setDeviceView('mobile'); }}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                currentRoute === 'ortu' ? 'bg-[#2E7D32] text-white' : 'text-green-200 hover:text-white'
              }`}
            >
              Orang Tua
            </button>
            <button
              onClick={() => { setCurrentRoute('guru'); setDeviceView('desktop'); }}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                currentRoute === 'guru' ? 'bg-[#2E7D32] text-white' : 'text-green-200 hover:text-white'
              }`}
            >
              Guru / BK
            </button>
          </div>

          {/* Toggle Device Frame */}
          {(currentRoute === 'siswa' || currentRoute === 'ortu') && (
            <button
              onClick={() => setDeviceView(deviceView === 'mobile' ? 'desktop' : 'mobile')}
              className="p-1 rounded bg-green-800 text-green-200 hover:text-white transition-colors ml-1"
              title="Toggle Mobile/Desktop view"
            >
              {deviceView === 'mobile' ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 1. HALAMAN LOGIN                            */}
      {/* ═══════════════════════════════════════════ */}
      {currentRoute === 'login' && (
        <div className="flex-1 flex flex-col justify-center items-center px-4 py-8">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-green-100 overflow-hidden">
            <div className="bg-[#1B5E20] px-6 pt-8 pb-7 text-white text-center rounded-b-3xl shadow-sm">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-800 border-2 border-green-500/40 shadow-inner mb-2.5">
                <BookOpen className="w-7 h-7 text-green-200" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">BKP Digital</h1>
              <p className="text-xs text-green-200 mt-0.5">Sistem Buku Kejar Prestasi & Jurnal Pembiasaan</p>
              <div className="inline-block mt-2 bg-green-800 px-3 py-0.5 rounded-full text-[10px] font-bold text-green-100">
                SMK THIBBIL QULUB ASSIMBANI
              </div>
            </div>

            <div className="p-6">
              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Alamat Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contoh: siswa1@test.com"
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#2E7D32] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Kata Sandi</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#2E7D32] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {loginLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Masuk ke Akun</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* 1-Klik Masuk Demo Preset */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <span className="text-[11px] font-bold text-gray-500 uppercase block mb-2">
                  Uji Coba Akun Demo (1-Klik Masuk):
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { setEmail('siswa1@test.com'); setPassword('rahasia123'); handleLogin('siswa1@test.com', 'rahasia123'); }}
                    className="py-2 px-1 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl text-center"
                  >
                    <div className="text-xs font-bold text-[#1B5E20]">Siswa</div>
                    <div className="text-[10px] text-gray-500">Faiz</div>
                  </button>
                  <button
                    onClick={() => { setEmail('ortu1@test.com'); setPassword('rahasia123'); handleLogin('ortu1@test.com', 'rahasia123'); }}
                    className="py-2 px-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-center"
                  >
                    <div className="text-xs font-bold text-blue-900">Orang Tua</div>
                    <div className="text-[10px] text-gray-500">Wali Faiz</div>
                  </button>
                  <button
                    onClick={() => { setEmail('guru1@test.com'); setPassword('rahasia123'); handleLogin('guru1@test.com', 'rahasia123'); }}
                    className="py-2 px-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-center"
                  >
                    <div className="text-xs font-bold text-amber-900">Guru / BK</div>
                    <div className="text-[10px] text-gray-500">Ust. Hendra</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 2. DASHBOARD SISWA (ROLE: siswa)            */}
      {/* ═══════════════════════════════════════════ */}
      {currentRoute === 'siswa' && (
        <div className={`flex-1 flex justify-center ${deviceView === 'mobile' ? 'py-4' : 'p-0'}`}>
          <div className={`w-full ${deviceView === 'mobile' ? 'max-w-md shadow-2xl rounded-3xl overflow-hidden border border-green-200' : 'max-w-4xl'} bg-[#E8F5E9] flex flex-col min-h-screen relative pb-24`}>
            
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
                  <div className="bg-white p-1 rounded-2xl shadow-sm border border-green-100 grid grid-cols-4 gap-1 text-[11px]">
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
                    <div className="p-3 bg-green-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm animate-bounce">
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
                          <span className="text-[10px] text-gray-400 block">Potensi Harian:</span>
                          <span className="text-xs font-black text-[#1B5E20] bg-green-100 px-2 py-0.5 rounded-full">
                            +{calculateDailyPoints()} Poin
                          </span>
                        </div>
                      </div>

                      {/* Dispensasi Menstruasi Bar */}
                      <div className="bg-pink-50 border border-pink-200 rounded-2xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
                          <div>
                            <span className="text-xs font-bold text-pink-900 block">Dispensasi Syar'i (Menstruasi)</span>
                            <span className="text-[10px] text-pink-700">Untuk siswi yang sedang berhalangan haid</span>
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
                              <span>🌙 Sholat Tahajud</span>
                              <span className="text-[10px] font-normal text-indigo-700">(Qiyamul Lail)</span>
                            </span>
                            <span className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                              {jurnal.tahajud === '4_rakaat' ? '+6 Poin' : jurnal.tahajud === '2_rakaat' ? '+3 Poin' : jurnal.tahajud === 'menstruasi' ? 'Dispensasi (M)' : '0 Poin'}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-[11px]">
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
                              <span>☀️ Sholat Dhuha</span>
                              <span className="text-[10px] font-normal text-amber-700">(Pagi Hari)</span>
                            </span>
                            <span className="text-[10px] font-bold text-amber-700 bg-white px-2 py-0.5 rounded-full border border-amber-200">
                              {jurnal.dhuha === '4_rakaat' ? '+4 Poin' : jurnal.dhuha === '2_rakaat' ? '+2 Poin' : jurnal.dhuha === 'menstruasi' ? 'Dispensasi (M)' : '0 Poin'}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-[11px]">
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
                          <span className="text-[10px] text-gray-400">Tepat Waktu (+4) • Masbuk (+3)</span>
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
                                <div className="flex-1 grid grid-cols-4 gap-1 text-[10px]">
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
                            <div
                              key={item.key}
                              onClick={() => setJurnal({ ...jurnal, [item.key]: !isChecked })}
                              className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                                isChecked ? 'bg-green-50/80 border-green-300 text-green-900' : 'bg-gray-50 border-gray-200 text-gray-600'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 ${isChecked ? 'text-green-700' : 'text-gray-400'}`} />
                                <span className={`text-xs ${isChecked ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                              </div>
                              {isChecked ? <CheckSquare className="w-4 h-4 text-[#2E7D32]" /> : <Square className="w-4 h-4 text-gray-300" />}
                            </div>
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
                            <div
                              key={item.key}
                              onClick={() => setJurnal({ ...jurnal, [item.key]: !isChecked })}
                              className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                                isChecked ? 'bg-green-50/80 border-green-300 text-green-900' : 'bg-gray-50 border-gray-200 text-gray-600'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-xs ${isChecked ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                                {isChecked ? <CheckSquare className="w-4 h-4 text-[#2E7D32]" /> : <Square className="w-4 h-4 text-gray-300" />}
                              </div>
                              <p className="text-[10px] text-gray-500 mt-0.5">{item.desc}</p>
                            </div>
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
                          Pekan Ke-43
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
                            <div
                              key={item.key}
                              onClick={() => setMingguan({ ...mingguan, [item.key]: !isChecked })}
                              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                isChecked ? 'bg-green-50/80 border-green-300 text-green-900' : 'bg-gray-50 border-gray-200 text-gray-600'
                              }`}
                            >
                              <span className={`text-xs ${isChecked ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                              {isChecked ? <CheckSquare className="w-5 h-5 text-[#2E7D32]" /> : <Square className="w-5 h-5 text-gray-300" />}
                            </div>
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
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-3.5 rounded-2xl border border-green-200 shadow-sm">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-[#1B5E20] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs font-bold text-[#1B5E20]">Panduan Pengisian Kegiatan Non-Rutin</h3>
                              <span className="text-[10px] bg-green-200 text-green-900 font-bold px-1.5 py-0.2 rounded">BKP Hal. 20</span>
                            </div>
                            <p className="text-[11px] text-gray-700 mt-1 leading-relaxed">
                              <strong>Kegiatan ini diisi mandiri oleh Siswa</strong> pada periode terkait (3-Mingguan, 9-Mingguan, atau Semester), kemudian disetujui / ditandatangani Orang Tua & Guru/Wali Rayon.
                            </p>
                            <p className="text-[10px] text-emerald-800 mt-1 bg-white/70 p-1.5 rounded-lg border border-green-100">
                              💡 <strong>Status kegiatan</strong> (seperti <em>&quot;Mengikuti dgn khidmat&quot;</em> atau <em>&quot;Memenuhi target hafalan&quot;</em>) adalah pilihan kriteria resmi yang dapat dipilih siswa di bawah ini sesuai kenyataan di lapangan.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Filter Kategori & Ringkasan Poin */}
                      <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-700">Filter Periode:</span>
                          <span className="text-[11px] font-semibold text-[#1B5E20] bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
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
                          <span>Alhamdulillah! Isian Kegiatan Non-Rutin dan Poin berhasil diperbarui.</span>
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
                                    <span className="bg-green-100 text-[#1B5E20] font-bold text-[10px] px-2 py-0.5 rounded-full">
                                      {nr.kategori}
                                    </span>
                                    <span className="bg-gray-100 text-gray-600 font-medium text-[10px] px-1.5 py-0.5 rounded">
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
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
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
                                  <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wide">
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
                                <span className="text-[10px] text-gray-500 shrink-0 font-medium">Saksi/Guru:</span>
                                <input
                                  type="text"
                                  value={nr.saksi}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setNonRutinList(prev => prev.map(item => item.id === nr.id ? { ...item, saksi: val } : item));
                                  }}
                                  placeholder="Nama Guru Pengampu / Wali Rayon"
                                  className="w-full text-[11px] px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 outline-none focus:border-green-600"
                                />
                              </div>
                            </div>
                          ))}
                      </div>

                      {/* Tombol Simpan Form Non-Rutin */}
                      <button
                        type="button"
                        onClick={() => {
                          setNonRutinSaveSuccess(true);
                          setTimeout(() => setNonRutinSaveSuccess(false), 3500);
                        }}
                        className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                      >
                        <Save className="w-4 h-4" />
                        <span>Simpan Isian Kegiatan Non-Rutin</span>
                      </button>
                    </div>
                  )}

                  {/* SUB-VIEW 4: BORANG KESEHATAN TERPADU */}
                  {jurnalView === 'kesehatan' && (
                    <BorangKesehatanView
                      role="siswa"
                      studentName={currentStudent.name}
                      studentKelas={`${currentStudent.kelas} / ${currentStudent.rayon}`}
                    />
                  )}
                </div>
              )}

              {/* TAB SISWA: BORANG KESEHATAN (DARI BOTTOM NAV) */}
              {siswaTab === 'kesehatan' && (
                <BorangKesehatanView
                  role="siswa"
                  studentName={currentStudent.name}
                  studentKelas={`${currentStudent.kelas} / ${currentStudent.rayon}`}
                />
              )}

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
                      <button onClick={() => setSiswaTab('jurnal')} className="text-[11px] text-[#2E7D32] font-semibold hover:underline">
                        Buka Jurnal &rarr;
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-green-50 p-2.5 rounded-xl border border-green-100">
                        <span className="text-[10px] text-gray-500 block">Tahajud:</span>
                        <span className="font-bold text-green-900">{jurnal.tahajud === '4_rakaat' ? '4 Rakaat (+6)' : jurnal.tahajud === '2_rakaat' ? '2 Rakaat (+3)' : 'Belum'}</span>
                      </div>
                      <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                        <span className="text-[10px] text-gray-500 block">Dhuha:</span>
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
                      <button onClick={() => setSiswaTab('poin')} className="text-[11px] text-[#2E7D32] font-semibold hover:underline">
                        Lihat Semua
                      </button>
                    </div>
                    <div className="p-3 bg-yellow-50/70 border border-yellow-200 rounded-xl">
                      <span className="text-xs font-bold text-yellow-900 block">{prestasiSiswa[0].judul}</span>
                      <span className="text-[10px] text-yellow-700 block mt-0.5">{prestasiSiswa[0].kategori} • +{prestasiSiswa[0].poin} Poin</span>
                    </div>
                  </div>

                  <div className="bg-[#1B5E20]/10 border border-green-200 rounded-2xl p-4 text-xs text-green-900 italic">
                    "Menjaga sholat fardhu berjamaah, tahajud, dhuha, tidur sebelum 22.00, minum air putih 2L, serta pemeriksaan kesehatan adalah ikhtiar pembentukan insan bertakwa."
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

                  {/* Daftar Prestasi Santri */}
                  {(poinTabFilter === 'semua' || poinTabFilter === 'prestasi') && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider px-1">
                        🏆 Daftar Prestasi yang Diraih (Hal 114)
                      </h4>
                      {prestasiSiswa.map((pres) => (
                        <div key={pres.id} className="bg-white rounded-2xl p-3.5 shadow-sm border border-yellow-200 bg-gradient-to-r from-yellow-50/50 to-white">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-gray-900 block">{pres.judul}</span>
                              <p className="text-[11px] text-yellow-800 mt-0.5">Tingkat: {pres.tingkat} • Capaian: {pres.capaian} • Pembina: {pres.pembina}</p>
                              <span className="text-[10px] text-gray-400 mt-1 block">{pres.tanggal}</span>
                            </div>
                            <span className="text-xs font-black text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full shrink-0">
                              +{pres.poin} Pts
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
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                    log.tipe === 'apresiasi' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {log.kode}
                                </span>
                                <span className="text-[10px] text-gray-400">{log.time}</span>
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
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-100 text-[#1B5E20] font-black text-xl flex items-center justify-center mx-auto mb-2 border-2 border-green-300">
                      FA
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">{currentStudent.name}</h3>
                    <p className="text-xs text-gray-500">NISN: 0072618291 • {currentStudent.kelas}</p>
                    <div className="inline-block mt-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                      Rayon: {currentStudent.rayon}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-gray-500">Nama Pembimbing Rayon:</span>
                      <span className="font-semibold text-gray-800">Ustadz Hendra Gunawan, S.Pd.I</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-gray-500">Program Keahlian:</span>
                      <span className="font-semibold text-gray-800">Teknik Komputer & Jaringan</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-100">
                      <span className="text-gray-500">Total Akumulasi Poin:</span>
                      <span className="font-bold text-[#1B5E20]">{currentStudent.points} Pts</span>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl border border-red-200 transition-all flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Keluar dari Akun Siswa</span>
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
        <div className={`flex-1 flex justify-center ${deviceView === 'mobile' ? 'py-4' : 'p-0'}`}>
          <div className={`w-full ${deviceView === 'mobile' ? 'max-w-md shadow-2xl rounded-3xl overflow-hidden border border-green-200' : 'max-w-4xl'} bg-[#E8F5E9] flex flex-col min-h-screen relative pb-24`}>
            
            <Header
              greeting="Assalamu’alaikum, Bapak/Ibu"
              fullName="Bapak Ahmad Rifa'i"
              subtitle={`Wali dari: ${currentStudent.name} (${currentStudent.kelas})`}
              poin={currentStudent.points}
              onLogout={handleLogout}
            />

            <div className="px-4 py-4 space-y-4 flex-1">
              
              {/* TAB ORTU: HOME */}
              {ortuTab === 'home' && (
                <div className="space-y-4">
                  {/* Card Rekap Mingguan: jumlah hari penuh, sakit, haid */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                    <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                      <h3 className="text-sm font-bold text-[#1B5E20] flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-green-700" />
                        Rekap Mingguan Ke-43
                      </h3>
                      <span className="text-[11px] text-gray-500">Target 7 Hari</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-green-50 p-3 rounded-xl border border-green-200">
                        <span className="text-[11px] text-gray-600 block">Hari Penuh</span>
                        <span className="text-xl font-black text-[#1B5E20]">6</span>
                        <span className="text-[10px] text-green-700 block font-semibold">Lengkap</span>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                        <span className="text-[11px] text-gray-600 block">Sakit</span>
                        <span className="text-xl font-black text-blue-800">1</span>
                        <span className="text-[10px] text-blue-600 block font-semibold">Surat Dokter</span>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
                        <span className="text-[11px] text-gray-600 block">Haid/Udzur</span>
                        <span className="text-xl font-black text-purple-800">0</span>
                        <span className="text-[10px] text-purple-600 block font-semibold">Syari</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-600">Status Tanda Tangan:</span>
                      {ttdSavedUrl ? (
                        <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Sudah Disahkan
                        </span>
                      ) : (
                        <button
                          onClick={() => setOrtuTab('ttd')}
                          className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full hover:bg-amber-200"
                        >
                          Perlu Tanda Tangan &rarr;
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Kesehatan & Ibadah Anak */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                      <h3 className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                        <HeartPulse className="w-4 h-4 text-green-700" />
                        <span>Kesehatan & Pembiasaan Ananda</span>
                      </h3>
                      <button onClick={() => setOrtuTab('kesehatan')} className="text-[11px] text-[#2E7D32] font-semibold hover:underline">
                        Lihat Borang &rarr;
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-green-50/70 p-2.5 rounded-xl border border-green-100">
                        <span className="text-[10px] text-gray-500 block">Status Gizi (IMT):</span>
                        <span className="font-bold text-green-800">20.5 (Normal / Baik)</span>
                      </div>
                      <div className="bg-green-50/70 p-2.5 rounded-xl border border-green-100">
                        <span className="text-[10px] text-gray-500 block">Kesehatan Gigi:</span>
                        <span className="font-bold text-green-800">Bebas Karang / Sehat</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Peringatan / Pelanggaran */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                    <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                      Peringatan Pelanggaran
                    </h3>
                    <div className="bg-red-50/70 border border-red-200 rounded-xl p-3 flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-red-800">[K 4.18] Kopyah tertinggal saat apel pagi</span>
                        <p className="text-[11px] text-red-600 mt-0.5">Tercatat pada 27 Okt 2026 oleh Ustadz BK</p>
                      </div>
                      <span className="text-xs font-black text-red-600 shrink-0">-150 Pts</span>
                    </div>
                  </div>

                  {/* Card Highlight Laporan Bulanan & Tren */}
                  <div className="bg-gradient-to-br from-[#1B5E20] to-[#2E7D32] rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
                    <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-15 pointer-events-none">
                      <TrendingUp className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="bg-white/20 backdrop-blur-xs text-green-100 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-yellow-300" />
                          Laporan Bulan Ini • Oktober 2026
                        </span>
                        <span className="text-[11px] text-green-200 font-semibold">Predikat: Mumtaz</span>
                      </div>
                      
                      <h3 className="text-base font-black tracking-tight mb-1">
                        Tren Karakter & Akumulasi Poin
                      </h3>
                      <p className="text-xs text-green-100/90 leading-relaxed mb-3">
                        Total raihan <strong className="text-white">+2.450 poin</strong> (122% dari target) dengan konsistensi pembiasaan <strong className="text-white">94%</strong>.
                      </p>

                      <div className="grid grid-cols-3 gap-2 bg-black/15 rounded-xl p-2.5 mb-3 text-center border border-white/10">
                        <div>
                          <span className="text-[10px] text-green-200 block">Net Poin</span>
                          <span className="text-sm font-extrabold text-white">+2.450</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-green-200 block">Kepatuhan</span>
                          <span className="text-sm font-extrabold text-white">94%</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-green-200 block">Tren</span>
                          <span className="text-sm font-extrabold text-yellow-300 flex items-center justify-center gap-0.5">
                            <TrendingUp className="w-3.5 h-3.5" /> Naik
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setOrtuTab('laporan')}
                        className="w-full py-2.5 bg-white hover:bg-green-50 text-[#1B5E20] font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                      >
                        <BarChart3 className="w-4 h-4 text-green-700" />
                        <span>Buka Grafik Tren & Analisis Lengkap &rarr;</span>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setOrtuTab('ttd')}
                    className="w-full py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <PenTool className="w-4 h-4" />
                    <span>Buka Lembar Tanda Tangan Digital</span>
                  </button>
                </div>
              )}

              {/* TAB ORTU: LAPORAN BULANAN (RECHARTS) */}
              {ortuTab === 'laporan' && (
                <LaporanBulananOrtu
                  studentName={currentStudent.name}
                  studentKelas={currentStudent.kelas}
                  studentRayon={currentStudent.rayon}
                  currentPoints={currentStudent.points}
                />
              )}

              {/* TAB ORTU: BORANG KESEHATAN */}
              {ortuTab === 'kesehatan' && (
                <BorangKesehatanView
                  role="orang_tua"
                  studentName={currentStudent.name}
                  studentKelas={`${currentStudent.kelas} / ${currentStudent.rayon}`}
                />
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
                    <div className="p-3 bg-green-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm animate-bounce">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Alhamdulillah, Tanda Tangan berhasil disimpan dan diverifikasi!</span>
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
                      <span className="absolute bottom-1 text-[10px] text-gray-400 pointer-events-none">
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
                      <span className="inline-block mt-2 text-[11px] text-green-700 font-bold bg-green-50 px-3 py-1 rounded-full">
                        Status: Sah & Tercatat di Server BKP
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB ORTU: NOTIFIKASI */}
              {ortuTab === 'notifikasi' && (
                <div className="space-y-3">
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
                    <h3 className="text-sm font-bold text-gray-800">Notifikasi & Laporan Sekolah</h3>
                    <p className="text-xs text-gray-500">Pemberitahuan resmi pembimbing rayon dan BK</p>
                  </div>

                  <div className="space-y-2">
                    <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1B5E20]">Undangan Kumpul Rayon Pekanan</span>
                        <span className="text-[10px] text-gray-400">Kemarin</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Kumpul rayon evaluasi MEB 1-9 akan diadakan hari Jumat setelah sholat Ashar di Masjid Al-Ikram.
                      </p>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-700">Skrining Kesehatan 9-Mingguan</span>
                        <span className="text-[10px] text-gray-400">3 hari lalu</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Ananda telah selesai mengikuti pengukuran fisik TB, BB, tekanan darah, dan pemeriksaan kesehatan gigi di UKS.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB ORTU: PROFIL */}
              {ortuTab === 'profil' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 text-center">
                    <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-900 font-black text-xl flex items-center justify-center mx-auto mb-2 border-2 border-blue-300">
                      AR
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">Bapak Ahmad Rifa'i</h3>
                    <p className="text-xs text-gray-500">Orang Tua / Wali Santri</p>
                    <div className="inline-block mt-2 bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-xs font-bold">
                      Santri Bimbingan: {currentStudent.name}
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl border border-red-200 transition-all flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Keluar dari Akun Orang Tua</span>
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
                  <h2 className="text-sm font-bold leading-tight">Panel Guru / BK</h2>
                  <span className="text-[11px] text-green-300">SMK Thibbil Qulub</span>
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
                  <span className="text-xs font-bold block">Ust. Hendra Gunawan</span>
                  <span className="text-[10px] text-green-300">Wali Rayon / Guru BK</span>
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
                      <span className="text-[11px] text-green-600 font-semibold">100% Mengisi BKP</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-[#2E7D32]">
                      <Users className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-green-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-gray-500">Poin Apresiasi Hari Ini</span>
                      <div className="text-2xl font-bold text-[#2E7D32] mt-1">+950 Pts</div>
                      <span className="text-[11px] text-emerald-600 font-semibold">Rutin Tahajud & Dhuha</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Sparkles className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-green-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-gray-500">Pelanggaran Minggu Ini</span>
                      <div className="text-2xl font-bold text-red-600 mt-1">2 Catatan</div>
                      <span className="text-[11px] text-red-500 font-semibold">Telah ditindaklanjuti</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                {/* TABEL 10 SISWA TERBARU */}
                <div className="bg-white rounded-2xl shadow-sm border border-green-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-800">Daftar Santri & Total Poin Karakter</h3>
                    <span className="text-xs text-gray-500">10 Santri Terdaftar</span>
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
                        {students.map((st) => (
                          <tr key={st.id} className="hover:bg-gray-50">
                            <td className="p-3 font-bold text-gray-900">{st.name}</td>
                            <td className="p-3 text-gray-600">{st.kelas}</td>
                            <td className="p-3 text-gray-600">{st.rayon}</td>
                            <td className="p-3 font-bold text-[#1B5E20]">{st.points} Pts</td>
                            <td className="p-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
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
                                className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 font-semibold rounded-lg border border-green-200 text-[11px]"
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
                  <div className="p-3.5 bg-green-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm animate-bounce">
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
                          const m = masterKodes.find((item) => item.kode === e.target.value);
                          if (m) setGuruDeskripsi(m.deskripsi);
                        }}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#2E7D32]"
                      >
                        <optgroup label="Tindakan Terpuji (Apresiasi)">
                          {masterKodes
                            .filter((m) => m.tipe === 'apresiasi')
                            .map((m) => (
                              <option key={m.kode} value={m.kode}>
                                [{m.kode}] {m.deskripsi} (+{m.poin} Poin)
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="Tindakan Kurang Terpuji (Konsekuensi)">
                          {masterKodes
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

                <BorangKesehatanView
                  role="guru"
                  studentName={currentStudent.name}
                  studentKelas={`${currentStudent.kelas} / ${currentStudent.rayon}`}
                />
              </div>
            )}

            {/* 4. GURU: SISWA */}
            {guruTab === 'siswa' && (
              <div className="space-y-4 max-w-5xl mx-auto">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-bold text-gray-900">Direktori Santri Rayon Assimbani</h1>
                  <input
                    type="text"
                    placeholder="Cari siswa / rombel..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="p-2 text-xs bg-white border border-gray-200 rounded-xl w-60 outline-none"
                  />
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
        </div>
      )}
    </div>
  );
}
