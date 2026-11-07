# InsightUsaha

Aplikasi web yang mengubah data penjualan UMKM kuliner menjadi insight dan saran tindakan dalam bahasa Indonesia.
Kebutuhan lengkap ada di [PRD_InsightUsaha.md](PRD_InsightUsaha.md); arah tampilan di [DESIGN.md](DESIGN.md).

Stack: Next.js 16 + Supabase (Postgres, Auth, Row Level Security), di-deploy ke Vercel. Kode aplikasi ada di [`webapp/`](webapp/).

## Menjalankan secara lokal

Butuh Node 20+ dan satu project Supabase.

1. Di Supabase Dashboard → **SQL Editor**, jalankan sekali seluruh isi `webapp/supabase/setup-semua.sql`.
2. Salin `webapp/.env.example` menjadi `webapp/.env.local`, lalu isi kuncinya (tabel di bawah).
3. Jalankan:
   ```powershell
   cd webapp
   npm install
   npm run dev                         # http://localhost:3000
   node --experimental-strip-types scripts/demo-account.mjs pro --isi   # akun demo Pro + data contoh + HPP
   node scripts/admin-account.mjs      # akun admin: admin@insightusaha.id / admin12345
   ```
   Kata sandi admin bisa ditentukan sendiri: `node scripts/admin-account.mjs <email> <kata-sandi>`. Menjalankan ulang
   skrip menyetel ulang kata sandinya. Ganti kata sandi bawaan sebelum aplikasi dipakai orang lain.
4. Masuk dengan akun demo `demo@insightusaha.id` / `demo12345` (paket Pro 1 tahun, sudah berisi data 3 bulan dan HPP),
   atau buat akun baru lalu unggah file di **Data penjualan**. Data contoh: `webapp/tests/fixtures/contoh-penjualan.csv`.
   Tanpa `--isi`, akun demo dibuat kosong.

| Variabel | Fungsi |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API. Boleh terlihat di browser |
| `SUPABASE_SECRET_KEY` | Rahasia, hanya di server (admin, webhook, log error). Jangan diberi awalan `NEXT_PUBLIC_` |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | Ringkasan AI dan Tanya Data. Model cadangan dipakai saat kuota harian model utama habis |
| `MIDTRANS_SERVER_KEY`, `MIDTRANS_PRODUCTION` | Pembayaran Pro. Kosong = mode simulasi |
| `CRON_SECRET` | Pengaman endpoint harian `/api/cron/langganan` (turun ke Gratis saat langganan berakhir) |

## Deploy ke Vercel

1. Import repo ini di Vercel, set **Root Directory** = `webapp`.
2. Isi semua variabel di atas pada **Settings → Environment Variables**.
3. Di Supabase → **Authentication → URL Configuration**, tambahkan domain Vercel ke **Site URL** dan **Redirect URLs**
   (`https://<domain>/auth/konfirmasi`) agar tautan verifikasi email dan atur ulang sandi mengarah ke aplikasi.
4. Cron harian sudah diatur di `webapp/vercel.json`.

## Arsitektur singkat

- File Excel/CSV dibaca dan dibersihkan **di browser** (`src/lib/import/`), lalu dikirim bertahap ke fungsi database
  `import_start` → `import_chunk` → `import_finish`. File asli tidak disimpan di server.
- Analisis F3–F7 adalah fungsi SQL (`supabase/migrations/0003`, `0004`), dipanggil dengan sesi pengguna.
- Pemisahan data antar usaha ditegakkan **Row Level Security**; pengguna tidak bisa menulis tabel transaksi atau
  langganan langsung, hanya lewat fungsi yang memeriksa kepemilikan.
- Ringkasan AI dan Tanya Data hanya mengirim angka agregat ke Gemini. Jawaban yang memuat angka di luar hasil analisis,
  atau menyalin nama kunci data, ditolak lalu dicoba ulang sekali.
- Laporan PDF dibuat dengan **Simpan sebagai PDF** di browser dari halaman `/laporan/cetak`.

## Pengujian

```powershell
cd webapp
npx vitest run                         # 41 tes: rumus F2–F7, RLS, impor, kesetaraan dengan acuan, cek angka AI
node scripts/verify-supabase.mjs       # cek skema, RLS, dan impor di Supabase sungguhan (akun uji dihapus lagi)
node scripts/clickthrough.mjs <folder> # klik nyata di Edge headless: 67 pemeriksaan, termasuk HP 360 px dan tema gelap
node scripts/check-roles.mjs <sandi-admin> <sandi-demo>  # masuk sebagai admin (harus ke /admin) dan sebagai demo (harus ke /dashboard)
```

`clickthrough.mjs` butuh server berjalan (`npm run build && npm start`) dan akun demo kosong
(`node scripts/demo-account.mjs pro`), karena uji ini mengunggah data contoh sendiri lewat browser.
Setelahnya jalankan lagi dengan `--isi` agar akun demo kembali lengkap dengan HPP.

`tests/fixtures/python-reference.json` adalah hasil acuan dari versi Laravel + Python sebelumnya (dihapus dari repo,
masih ada di riwayat git). Tes `parity.test.ts` memastikan fungsi SQL menghasilkan angka yang sama.

## Alat bantu (`tools/`)

- `make_sample.py <file.csv>`: data contoh kedai kopi 3 bulan (±13.700 baris, isi selalu sama).
- `contrast.py`: cek kontras WCAG warna tema terang dan gelap.

## Asumsi (hal yang tidak dijelaskan PRD)

- **Transaksi tanpa `id_transaksi`**: setiap baris dianggap 1 transaksi. Bundling tidak tersedia (ditampilkan penjelasan).
- **Duplikat** hanya dihapus jika ada `id_transaksi` (tanpa ID, dua baris sama bisa memang dua penjualan).
- **Periode** dihitung mundur dari tanggal data terakhir, bukan hari ini; pembanding = periode sama panjang tepat sebelumnya.
- **Paket Gratis "data 3 bulan"** = 90 hari terakhir dari data; data lama tidak dihapus.
- **Kuota Gratis** = 1 unggahan berhasil per bulan kalender.
- **Ringkasan AI** dimuat terpisah agar halaman tetap cepat; disimpan per periode dan dibuat ulang hanya bila data berubah.
- **Payment gateway**: Midtrans Snap; mode simulasi tersedia untuk pengembangan.
- **Email pengingat H-3** belum dikirim: Supabase hanya mengirim email akun. Pengingat tampil di halaman Langganan;
  untuk email perlu layanan email tambahan (mis. Resend).
- **Kuota AI**: paket gratis Gemini membatasi jumlah permintaan per model per hari; saat habis dipakai model cadangan,
  dan bila keduanya habis halaman tetap tampil dengan pesan "Ringkasan belum tersedia".
