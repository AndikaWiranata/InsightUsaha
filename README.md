# InsightUsaha

Aplikasi web yang mengubah data penjualan UMKM kuliner menjadi insight dan saran tindakan dalam bahasa Indonesia.
Kebutuhan lengkap ada di [PRD_InsightUsaha.md](PRD_InsightUsaha.md); arah tampilan di [DESIGN.md](DESIGN.md).

Repo ini berisi dua versi yang fiturnya sama. Pilih salah satu:

| Folder | Stack | Hosting | Status |
| --- | --- | --- | --- |
| [`webapp/`](webapp/) | Next.js 16 + Supabase (Postgres, Auth, RLS) | Vercel + Supabase, gratis | Versi utama (PRD v2) |
| [`web/`](web/) + [`analytics/`](analytics/) | Laravel 12 + FastAPI (pandas, mlxtend) | VPS / Render / Oracle Cloud | Versi awal (PRD v1), tetap berfungsi |

Angka analisis kedua versi dibuktikan sama: `webapp/tests/parity.test.ts` membandingkan fungsi SQL dengan hasil Python
pada 13.743 baris data contoh, di tiga periode.

## Versi Next.js (`webapp/`)

### Menjalankan secara lokal

Butuh Node 20+ dan satu project Supabase.

1. Di Supabase Dashboard → **SQL Editor**, jalankan sekali seluruh isi `webapp/supabase/setup-semua.sql`.
2. Salin `webapp/.env.example` menjadi `webapp/.env.local`, lalu isi kuncinya (tabel di bawah).
3. Jalankan:
   ```powershell
   cd webapp
   npm install
   npm run dev                         # http://localhost:3000
   node scripts/demo-account.mjs pro   # akun demo terverifikasi: demo@insightusaha.id / demo12345
   ```
4. Masuk, buka **Data penjualan**, unggah file. Data contoh: `webapp/tests/fixtures/contoh-penjualan.csv`.

| Variabel | Fungsi |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API. Boleh terlihat di browser |
| `SUPABASE_SECRET_KEY` | Rahasia, hanya di server (admin, webhook, log error). Jangan diberi awalan `NEXT_PUBLIC_` |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | Ringkasan AI dan Tanya Data. Model cadangan dipakai saat kuota harian model utama habis |
| `MIDTRANS_SERVER_KEY`, `MIDTRANS_PRODUCTION` | Pembayaran Pro. Kosong = mode simulasi |
| `CRON_SECRET` | Pengaman endpoint harian `/api/cron/langganan` (turun ke Gratis saat langganan berakhir) |

### Deploy ke Vercel

1. Import repo ini di Vercel, set **Root Directory** = `webapp`.
2. Isi semua variabel di atas pada **Settings → Environment Variables**.
3. Di Supabase → **Authentication → URL Configuration**, tambahkan domain Vercel ke **Site URL** dan **Redirect URLs**
   (`https://<domain>/auth/konfirmasi`) agar tautan verifikasi email dan atur ulang sandi mengarah ke aplikasi.
4. Cron harian sudah diatur di `webapp/vercel.json`.

### Arsitektur singkat

- File Excel/CSV dibaca dan dibersihkan **di browser** (`src/lib/import/`), lalu dikirim bertahap ke fungsi database
  `import_start` → `import_chunk` → `import_finish`. File asli tidak disimpan di server.
- Analisis F3–F7 adalah fungsi SQL (`supabase/migrations/0003`, `0004`), dipanggil dengan sesi pengguna.
- Pemisahan data antar usaha ditegakkan **Row Level Security**; pengguna tidak bisa menulis tabel transaksi atau
  langganan langsung, hanya lewat fungsi yang memeriksa kepemilikan.
- Ringkasan AI dan Tanya Data hanya mengirim angka agregat ke Gemini. Jawaban yang memuat angka di luar hasil analisis,
  atau menyalin nama kunci data, ditolak lalu dicoba ulang sekali.
- Laporan PDF dibuat dengan **Simpan sebagai PDF** di browser dari halaman `/laporan/cetak`.

### Pengujian

```powershell
cd webapp
npx vitest run                         # 41 tes: rumus F2–F7, RLS, impor, kesetaraan dengan Python, cek angka AI
node scripts/verify-supabase.mjs       # cek skema, RLS, dan impor di Supabase sungguhan (akun uji dihapus lagi)
node scripts/clickthrough.mjs <folder> # klik nyata di Edge headless: 67 pemeriksaan, termasuk HP 360 px dan tema gelap
```

`clickthrough.mjs` butuh server berjalan (`npm run build && npm start`) dan akun demo.

## Versi Laravel (`web/` + `analytics/`)

Butuh PHP 8.2+ (ekstensi `pdo_sqlite`, `pdo_pgsql`, `zip`, `gd`, `fileinfo`, OPcache aktif), Composer, Node 20+, Python 3.11+.

```powershell
# Layanan analitik
cd analytics
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
$env:ANALYTICS_TOKEN = "dev-token-ganti-di-produksi"
.venv\Scripts\python -m uvicorn app.main:app --port 8001

# Web app (terminal lain)
cd web
php ..\tools\composer.phar install
npm install; npm run build
copy .env.example .env
php artisan key:generate
php artisan migrate
php artisan admin:buat admin@insightusaha.id --password=admin12345
php artisan serve                   # http://127.0.0.1:8000
php artisan queue:work --timeout=300   # terminal lain; impor berjalan di latar belakang
```

Basis data lokal memakai SQLite. Untuk PostgreSQL/Supabase, isi `DB_*` di `web/.env` dengan kredensial
**Session pooler** (port 5432), lalu `php artisan migrate`.

Pengujian: `cd analytics; .venv\Scripts\python -m pytest` (14 tes) dan `cd web; php artisan test` (31 tes).

## Alat bantu (`tools/`)

- `make_sample.py <file.csv>`: data contoh kedai kopi 3 bulan (±13.700 baris, isi selalu sama).
- `parity_reference.py`: hasil acuan versi Python untuk tes kesetaraan versi Next.js.
- `contrast.py`: cek kontras WCAG warna tema terang dan gelap.
- `clickthrough.py`: uji klik versi Laravel.

## Asumsi (hal yang tidak dijelaskan PRD)

- **Transaksi tanpa `id_transaksi`**: setiap baris dianggap 1 transaksi. Bundling tidak tersedia (ditampilkan penjelasan).
- **Duplikat** hanya dihapus jika ada `id_transaksi` (tanpa ID, dua baris sama bisa memang dua penjualan).
- **Periode** dihitung mundur dari tanggal data terakhir, bukan hari ini; pembanding = periode sama panjang tepat sebelumnya.
- **Paket Gratis "data 3 bulan"** = 90 hari terakhir dari data; data lama tidak dihapus.
- **Kuota Gratis** = 1 unggahan berhasil per bulan kalender.
- **Ringkasan AI** dimuat terpisah agar halaman tetap cepat; disimpan per periode dan dibuat ulang hanya bila data berubah.
- **Payment gateway**: Midtrans Snap; mode simulasi tersedia untuk pengembangan.
- **Email pengingat H-3** (versi Next.js) belum dikirim: Supabase hanya mengirim email akun. Pengingat tampil di halaman
  Langganan; untuk email perlu layanan email tambahan (mis. Resend).
- **Kuota AI**: paket gratis Gemini membatasi jumlah permintaan per model per hari; saat habis dipakai model cadangan,
  dan bila keduanya habis halaman tetap tampil dengan pesan "Ringkasan belum tersedia".
