# Arah desain BKP Digital

Dokumen ini mencatat arah visual yang **sudah ada** di aplikasi (hijau sekolah, kartu putih di atas kertas hijau pucat), lalu merapikannya. Tidak ada identitas baru yang diciptakan di sini.

## Konteks

- Produk: BKP Digital, buku kejar prestasi dan jurnal pembiasaan SMK Thibbil Qulub Assimbani.
- Pengguna: santri (mayoritas membuka dari ponsel), wali santri, guru/BK, pembimbing rayon, admin.
- Ruang pakai: di sekolah dan asrama, sering sambil berdiri, kadang di bawah cahaya luar. Teks harus terbaca dan tombol harus besar.

## Arah

Buku BKP aslinya adalah buku catatan cetak: kertas, garis, kolom poin, paraf. Antarmuka mengambil sifat itu, bukan meniru aplikasi SaaS.

- Motif identitas: lembar kertas dengan garis rambut (hairline) dan angka tabular, bukan gradien dan bukan bayangan mengambang.
- Satu titik fokus per layar: saldo poin atau aksi utama; sisanya turun hierarki lewat ketebalan dan warna tinta, bukan lewat warna-warna berbeda.

## Palet

| Peran | Nilai | Alasan |
|---|---|---|
| Kertas (latar) | `#EEF3EA` | Hijau sangat pucat, pengganti putih menyilaukan di layar ponsel. |
| Permukaan (kartu) | `#FFFFFF` | Bidang baca utama. |
| Tinta | `#18211A` | Hampir hitam kehijauan, kontras > 15:1 di atas kertas maupun kartu. |
| Hijau sekolah | `#1B5E20` / `#2E7D32` | Warna identitas yang sudah dipakai sekolah dan dokumen BKP. |
| Garis | `#D9E3D3` | Pemisah setipis buku, bukan bayangan. |
| Aksen perhatian | `#8D5405` di atas `#FDF4E4` | Hanya untuk hal yang menunggu tindakan pengguna. |
| Bahaya | `#A82A1F` di atas `#FCEDED` | Konsekuensi/penolakan, dipakai terbatas. |

Palet inti: tiga hijau + satu aksen. Merah hanya status, bukan warna dekoratif.

## Tipografi

- Poppins untuk seluruh antarmuka. Alasan: sudah dipakai sekolah, geometris, ramah untuk teks Indonesia, dan tidak terasa seperti font bawaan alat AI.
- Ukuran minimum 12px untuk label, 14-15px untuk isi, angka poin memakai `font-variant-numeric: tabular-nums` agar kolom rapi.
- Label mikro memakai huruf kapital dengan spasi longgar hanya pada judul bagian, tidak pada setiap teks.

## Dial

```
ENERGY 1 / RHYTHM 2 / MOTION 1
```

- ENERGY 1: ini alat administrasi sekolah, bukan kampanye pemasaran. Tenang, tegas, tanpa dekorasi.
- RHYTHM 2: dasbor per peran punya komposisi berbeda (mobile bertumpuk, panel staf dua kolom), tetapi di dalam satu peran pola konsisten.
- MOTION 1: hanya transisi hover/fokus dan indikator proses. Tidak ada animasi masuk, memantul, atau berdenyut.

## Batasan yang disengaja

- Tidak ada logo atau foto profil hasil kreasi sendiri. Inisial nama dipakai sebagai penanda identitas.
- Tidak ada angka, predikat, atau kutipan yang tidak berasal dari data Firestore.
- Tidak ada mode gelap. Aplikasi dipakai di ruang terang; menambah mode gelap tanpa pengujian kontras di semua layar akan menghasilkan dua mode yang sama-sama setengah jadi.
