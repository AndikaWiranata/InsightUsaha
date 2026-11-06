# DESIGN.md: InsightUsaha

Status: **arah awal yang disimpulkan dari PRD**, belum disetujui pemilik produk. Ubah bagian mana pun yang tidak sesuai;
antislop membaca file ini sebagai arah desain.

Dial: ENERGY 2 / RHYTHM 2 / MOTION 1

## Design Read

Membaca ini sebagai: aplikasi web kerja harian untuk pemilik UMKM kuliner Surabaya (Rina, 28, sering buka HP; Pak Budi, 45,
kurang paham teknologi), dengan bahasa visual **buku kas warung**: kertas hangat, angka besar yang jelas, tanda stabilo
untuk hal yang perlu diperhatikan, dial ENERGY 2 / RHYTHM 2 / MOTION 1.

## Identitas

- **Kepribadian:** teman yang paham pembukuan, bukan konsultan. Bicara santai ("kamu"), langsung ke angka dan tindakan.
- **Metafora:** catatan penjualan di buku kas. Data dibaca seperti laporan, bukan seperti panel kendali pesawat.
- **Motif identitas:** *sapuan stabilo* kuning di belakang angka atau frasa terpenting di setiap layar
  (satu per layar, maksimal dua). Ini satu-satunya aksen; dipakai untuk "yang paling perlu kamu lihat".

## Palet (2 warna inti + 1 aksen, netral tidak dihitung)

| Token | Terang | Gelap | Alasan |
| --- | --- | --- | --- |
| paper (latar) | `#F6F1E7` | `#15120F` | Kertas krem: hangat, tidak silau di HP saat siang, membedakan dari dashboard SaaS putih |
| surface (kartu) | `#FFFCF6` | `#1E1A16` | Lembar kertas di atas meja; kontras rendah dengan latar, dipisah garis, bukan bayangan |
| ink (teks utama, tombol utama) | `#221C17` | `#F3EDE4` | Tinta hitam-cokelat; tombol utama memakai tinta agar tidak bersaing dengan stabilo |
| brand / sienna | `#7A4521` | `#E0A46B` | Warna kopi & bumbu: data seri utama (garis grafik, titik, heatmap), tautan |
| stabilo (aksen) | `#F4C542` | `#7A5A12` | Satu-satunya aksen, hanya untuk motif stabilo dan fokus keyboard |
| good / bad | `#2D6A2F` / `#A3341C` | `#86C686` / `#F29379` | Status naik/turun, selalu dengan ikon/tanda + teks, tidak pernah warna saja |

Semua pasangan teks lulus WCAG AA di kedua tema (dicek dengan `tools/contrast.py`).

## Tipografi

- **Seluruh UI: Plus Jakarta Sans** (Google Fonts, dibuat Tokotype, desainer tipe Indonesia, untuk identitas Jakarta).
  Alasan: produk untuk UMKM Indonesia, angka tabular jelas, terbaca di layar kecil.
- **Angka besar (kartu ringkasan):** Plus Jakarta Sans 800 dengan `tabular-nums`, agar angka terasa seperti total di buku kas.
- Tidak ada label huruf kapital dengan tracking lebar; label kolom tabel memakai huruf kecil biasa, tebal 600.

## Komposisi

- Satu titik fokus per layar: di dashboard, **omzet** (stabilo); di halaman lain, judul temuan utama.
- Kartu tidak seragam: kartu utama lebih lebar, angka pendukung tampil sebagai baris "buku kas" (label kiri, angka kanan).
- Elevasi: garis 1px, tanpa bayangan; bayangan hanya untuk panel yang mengambang di atas konten (panel chatbot).
- Radius: 6px kontrol, 10px kartu, penuh hanya untuk tombol bulat chatbot.

## Gerak (MOTION 1)

Hanya status hover/fokus/aktif dan transisi buka-tutup panel chatbot; semuanya mati di `prefers-reduced-motion`.

## Tema

Terang sebagai bawaan (dipakai siang hari di warung), gelap tersedia lewat tombol tema dan mengikuti setelan perangkat.

## Ikon

Ikon garis buatan sendiri (stroke 2px, sudut tegas) hanya bila ikon menambah makna (unggah, unduh, hapus, jam, peringatan).
Tanpa ikon kilau/bintang/robot. Fitur AI diberi label teks "Ringkasan dari angka analisis", bukan ikon ajaib.

## Logo

Belum ada logo resmi: dipakai **nama produk sebagai teks** ("InsightUsaha" dengan "Usaha" berstabilo).
Ganti dengan logo asli bila sudah ada.
