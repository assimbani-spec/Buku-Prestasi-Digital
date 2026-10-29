import { createClient } from '@supabase/supabase-js';

// Baca kredensial dari Next.js env (atau fallback Vite jika di preview)
const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || 
  'https://placeholder-project.supabase.co';

const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const isSupabaseConfigured = Boolean(
  (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL)
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Type Definitions
export type UserRole = 'siswa' | 'orang_tua' | 'guru';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  kelas?: string;
  rayon?: string;
  anak_id?: string;
  avatar_url?: string;
  total_poin: number;
  created_at?: string;
}

export interface PembiasaanHarian {
  id?: string;
  siswa_id: string;
  tanggal: string; // YYYY-MM-DD
  tahajud?: '4_rakaat' | '2_rakaat' | 'tidak' | 'menstruasi'; // 4 Rakaat (+6), 2 Rakaat (+3), Tidak (0), Menstruasi (M)
  dhuha?: '4_rakaat' | '2_rakaat' | 'tidak' | 'menstruasi';   // 4 Rakaat (+4), 2 Rakaat (+2), Tidak (0), Menstruasi (M)
  subuh: boolean;
  dzuhur: boolean;
  ashar: boolean;
  maghrib: boolean;
  isya: boolean;
  sholat_berjamaah?: boolean;
  mengaji: boolean;
  zikir_pagi?: boolean; // Zikir Pagi (+1)
  zikir_sore?: boolean; // Zikir Sore (+1)
  bangun_subuh: boolean; // Bangun sebelum pukul 5 (+1)
  grooming: boolean;     // Grooming diri (+8)
  tidur_awal: boolean;   // Tidur Sebelum Pukul 22.00 (+1 / -2)
  air_putih: boolean;    // Minum Air Putih 1,5 - 2 Liter (+1)
  mandi_2x?: boolean;    // Mandi 2 kali setiap hari (+1)
  kelompok_belajar?: boolean; // Aktif dlm kelompok belajar (+4)
  sedang_menstruasi?: boolean;
  catatan?: string;
  created_at?: string;
}

export interface BorangKesehatan {
  id?: string;
  siswa_id: string;
  periode: string; // Misal: MEB 1 s.d 9 Periode STS Ganjil
  tanggal_periksa?: string;
  // A. Hasil Pengukuran
  tinggi_badan: number;     // cm
  berat_badan: number;      // kg
  tekanan_darah: string;    // mmHg (misal: "115/75")
  lingkar_pinggang: number; // cm
  // B. Kesehatan Gigi
  gigi_berlubang: boolean;
  karang_gigi: boolean;
  gusi_bengkak: boolean;
  gusi_berdarah: boolean;
  // C. Riwayat Kesehatan (frekuensi kali dalam periode)
  riwayat_pingsan: number;
  riwayat_mimisan: number;
  riwayat_kejang: number;
  riwayat_rawat_rs: number;
  // D. Catatan Guru PJOK / UKS
  catatan_pjok_uks?: string;
  ttd_ortu?: boolean;
  ttd_pembimbing?: boolean;
  ttd_pembina_uks?: boolean;
  created_at?: string;
}

export interface KunjunganUKS {
  id?: string;
  siswa_id: string;
  tanggal: string;
  jam_masuk: string;
  jam_keluar: string;
  penyebab: string;
  tindak_lanjut: string;
  petugas_uks: string;
  paraf: boolean;
  created_at?: string;
}

export interface KalenderMenstruasi {
  id?: string;
  siswa_id: string;
  bulan: string;
  tgl_mulai: string;
  tgl_selesai: string;
  banyaknya_hari: number;
  jarak_siklus: number;
  paraf_ortu: boolean;
  created_at?: string;
}

export interface PembiasaanNonRutin {
  id?: string;
  siswa_id: string;
  kategori: '3_mingguan' | '9_mingguan' | 'semester';
  nama_kegiatan: string;
  mapel?: string;
  kode_input?: string;
  pelaksanaan: string;
  poin: number;
  saksi_guru?: string;
  tanggal?: string;
  created_at?: string;
}

export interface PembiasaanMingguan {
  id?: string;
  siswa_id: string;
  minggu_ke: number;
  tahun?: number;
  sholat_jumat_keputrian: boolean; // Sholat Jumat / Keputrian (+50)
  puasa_sunnah: boolean;           // Puasa Sunnah (Senin/Kamis) (+80 / +40)
  berinfak: boolean;               // Berinfak (+40)
  tablet_tambah_darah: boolean;    // Tablet Tambah Darah / Vit. (+30)
  olahraga: boolean;               // Olahraga Minimal 15 Menit (+60)
  keramas_2x: boolean;             // Keramas min. 2x Seminggu (+50)
  kebersihan_diri: boolean;        // Kuku, Telinga, dan Bercukur (+50)
  piket_rayon: boolean;            // Piket Rayon (+50 / +30)
  daur_ulang: boolean;             // Bawa Bahan Daur Ulang (+50)
  ekstrakurikuler: boolean;        // Ekstrakurikuler (+50)
  seni_budaya: boolean;            // Seni Budaya (+50)
  kumpul_rayon: boolean;           // Kumpul Rayon (+50)
  ttd_ortu: boolean;
  ttd_url?: string;
  catatan_ortu?: string;
  created_at?: string;
}

export interface PoinLog {
  id?: string;
  siswa_id?: string;
  tipe: 'apresiasi' | 'konsekuensi';
  kode: string;
  deskripsi: string;
  poin: number;
  dicatat_oleh?: string;
  created_at?: string;
}

export interface MasterKodePoin {
  kode: string;
  tipe: 'apresiasi' | 'konsekuensi';
  kategori: string;
  deskripsi: string;
  poin: number;
}

export interface Notifikasi {
  id?: string;
  user_id: string;
  judul: string;
  pesan: string;
  tipe: 'info' | 'reward' | 'warning' | 'reminder';
  sudah_dibaca: boolean;
  created_at?: string;
}
