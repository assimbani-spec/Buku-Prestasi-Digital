/**
 * Konfigurasi profil sekolah, kop surat, dan nama penandatangan
 * (Kepala Sekolah / Waka Kesiswaan).
 *
 * Disimpan di Firestore (`pengaturan_sekolah/profil`) agar terpusat lintas
 * perangkat, sekaligus dicache di localStorage agar halaman login dan cetak
 * tetap cepat merender identitas sekolah.
 */
import { db, doc, onSnapshot, serverTimestamp, setDoc } from './data';

export interface SchoolConfig {
  yayasan: string;
  sekolah: string;
  subjudul: string;
  alamat: string;
  kota: string;
  jabatanPenandatangan: string;
  kepalaSekolah: string;
  tahunAjaranAktif?: string;
  semesterAktif?: 'Ganjil' | 'Genap';
}

export const SCHOOL_CONFIG_STORAGE_KEY = 'jejak.school_config.v1';
const LEGACY_KOP_STORAGE_KEY = 'bkp.kop_surat.v1';

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  yayasan: 'YAYASAN PONDOK PESANTREN ASSIMBANI',
  sekolah: 'SMK THIBBIL QULUB ASSIMBANI',
  subjudul: 'Program Keahlian & Kompetensi • NSS/NPSN: -',
  alamat: 'Jl. Raya Simbani No. 01, Pasuruan, Jawa Timur',
  kota: 'Pasuruan',
  jabatanPenandatangan: 'Waka Kesiswaan / Kepala Sekolah',
  kepalaSekolah: '',
  tahunAjaranAktif: '2025/2026',
  semesterAktif: 'Genap',
};

function normalizeConfig(raw: Partial<SchoolConfig> | null | undefined): SchoolConfig {
  const merged: SchoolConfig = {
    ...DEFAULT_SCHOOL_CONFIG,
    ...(raw ?? {}),
  };
  // Bersihkan nama bawaan lama bila masih tersisa dari cache versi sebelumnya
  if (merged.kepalaSekolah === 'Drs. H. Ahmad Shodiq, M.Pd.') {
    merged.kepalaSekolah = '';
  }
  return merged;
}

export function loadLocalSchoolConfig(): SchoolConfig {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_SCHOOL_CONFIG;
    const raw =
      window.localStorage.getItem(SCHOOL_CONFIG_STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_KOP_STORAGE_KEY);
    if (!raw) return DEFAULT_SCHOOL_CONFIG;
    return normalizeConfig(JSON.parse(raw) as Partial<SchoolConfig>);
  } catch {
    return DEFAULT_SCHOOL_CONFIG;
  }
}

const SCHOOL_CONFIG_EVENT = 'jejak:schoolConfigUpdated';

export function saveLocalSchoolConfig(config: SchoolConfig): void {
  try {
    if (typeof window === 'undefined') return;
    if (window.localStorage) {
      window.localStorage.setItem(SCHOOL_CONFIG_STORAGE_KEY, JSON.stringify(config));
    }
    window.dispatchEvent(new CustomEvent<SchoolConfig>(SCHOOL_CONFIG_EVENT, { detail: config }));
  } catch {
    // abaikan jika storage tidak tersedia
  }
}

export function subscribeSchoolConfig(onUpdate: (config: SchoolConfig) => void): () => void {
  const handleLocalEvent = (ev: Event) => {
    const customEv = ev as CustomEvent<SchoolConfig>;
    if (customEv.detail) {
      onUpdate(normalizeConfig(customEv.detail));
    } else {
      onUpdate(loadLocalSchoolConfig());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(SCHOOL_CONFIG_EVENT, handleLocalEvent);
  }

  const unsubDb = onSnapshot(
    doc(db, 'pengaturan_sekolah', 'profil'),
    (snap) => {
      if (snap.exists()) {
        const next = normalizeConfig(snap.data() as Partial<SchoolConfig>);
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(SCHOOL_CONFIG_STORAGE_KEY, JSON.stringify(next));
          }
        } catch {
          // abaikan
        }
        onUpdate(next);
      }
    },
    () => {
      // Abaikan jika user belum login atau aturan belum di-deploy; pakai cache lokal
    }
  );

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(SCHOOL_CONFIG_EVENT, handleLocalEvent);
    }
    unsubDb();
  };
}

export async function saveSchoolConfigToServer(
  config: SchoolConfig,
  updatedByUid?: string
): Promise<void> {
  const clean = normalizeConfig({
    yayasan: config.yayasan.trim(),
    sekolah: config.sekolah.trim(),
    subjudul: config.subjudul.trim(),
    alamat: config.alamat.trim(),
    kota: config.kota.trim(),
    jabatanPenandatangan: config.jabatanPenandatangan.trim() || 'Waka Kesiswaan / Kepala Sekolah',
    kepalaSekolah: config.kepalaSekolah.trim(),
    tahunAjaranAktif: (config.tahunAjaranAktif || '2025/2026').trim(),
    semesterAktif: config.semesterAktif === 'Ganjil' ? 'Ganjil' : 'Genap',
  });
  saveLocalSchoolConfig(clean);
  await setDoc(
    doc(db, 'pengaturan_sekolah', 'profil'),
    {
      ...clean,
      ...(updatedByUid ? { updatedBy: updatedByUid } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
