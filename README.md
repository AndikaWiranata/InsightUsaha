# InsightUsaha

Aplikasi web SaaS yang mengubah data penjualan UMKM kuliner menjadi insight dan saran tindakan (lihat `PRD_InsightUsaha.md`).

```
pengbis/
├── web/         Laravel 12 (Blade + Tailwind + Chart.js): auth, unggah, dashboard, PDF, langganan, admin
├── analytics/   FastAPI + pandas + mlxtend: pembersihan data, tren, pola waktu, Apriori, Menu Engineering
└── tools/       skrip bantu (data contoh, uji end-to-end, cek tampilan HP)
```

Alur: Laravel menyimpan file → job antrean memanggil `analytics /clean` → hasil disimpan ke tabel `transactions` →
halaman analisis memanggil `analytics /analyze` (hasil di-cache di `analysis_results`) → ringkasan AI dibuat dari hasil agregat.

## Menjalankan secara lokal (Windows + XAMPP)

Butuh: PHP 8.2+ (ekstensi `pdo_sqlite`, `pdo_pgsql`, `zip`, `gd`, `fileinfo`, **OPcache aktif**), Composer, Node 20+, Python 3.11+.

```powershell
# 1. Layanan analitik
cd analytics
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
$env:ANALYTICS_TOKEN = "dev-token-ganti-di-produksi"
.venv\Scripts\python -m uvicorn app.main:app --port 8001

# 2. Web app (terminal lain)
cd web
php ..\tools\composer.phar install
npm install; npm run build
copy .env.example .env   # lalu sesuaikan, atau pakai .env yang sudah ada
php artisan key:generate
php artisan migrate
php artisan admin:buat admin@insightusaha.id --password=admin12345
php artisan serve          # http://127.0.0.1:8000

# 3. Queue worker (terminal lain) — wajib, impor file berjalan di latar belakang
php artisan queue:work --timeout=300

# 4. Penjadwal (pengingat H-3 & turun ke Gratis), di produksi via cron tiap menit
php artisan schedule:work
```

Data contoh: `python tools\make_sample.py contoh.csv` (±13.700 baris, 3 bulan kedai kopi).

Email lokal ditulis ke `web/storage/logs/laravel.log` (`MAIL_MAILER=log`), termasuk tautan verifikasi.

## Basis data: Supabase (PostgreSQL)

Lokal memakai SQLite. Untuk Supabase:

1. Buat project di Supabase, buka **Connect** → salin kredensial **Session pooler** (port 5432, kompatibel IPv4).
   Jangan pakai *Transaction pooler* (6543) karena tidak mendukung prepared statement PDO.
2. Isi `web/.env`:
   ```env
   DB_CONNECTION=pgsql
   DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
   DB_PORT=5432
   DB_DATABASE=postgres
   DB_USERNAME=postgres.<project-ref>
   DB_PASSWORD=<password-database>
   DB_SSLMODE=require
   ```
3. `php artisan config:clear && php artisan migrate`

Aplikasi memakai Supabase hanya sebagai PostgreSQL (autentikasi tetap Laravel). Semua query dibatasi `business_id`
di sisi aplikasi; karena Laravel terhubung sebagai role `postgres`, Row Level Security Supabase tidak dipakai.
Jangan membuka tabel ini lewat Supabase Data API/`anon key`. Matikan Data API untuk skema `public`, atau aktifkan RLS tanpa policy.

## Konfigurasi layanan luar (`web/.env`)

| Variabel | Fungsi |
| --- | --- |
| `ANALYTICS_URL`, `ANALYTICS_TOKEN` | Alamat & token layanan FastAPI (token sama dengan env `ANALYTICS_TOKEN` di layanan) |
| `AI_PROVIDER` | Penyedia ringkasan AI: `gemini` (default) atau `anthropic` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Google Gemini (default `gemini-2.5-flash`, mode berpikir dimatikan). Kosong → dashboard menampilkan "Ringkasan belum tersedia" |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Alternatif Claude (default `claude-opus-5-5`), dipakai bila `AI_PROVIDER=anthropic` |
| `MIDTRANS_SERVER_KEY`, `MIDTRANS_PRODUCTION` | Payment gateway (QRIS, e-wallet, VA). Kosong → mode simulasi. Webhook: `POST /webhook/pembayaran` |
| `MAIL_*` | SMTP untuk verifikasi email, reset sandi, pengingat |

## Pengujian

```powershell
cd analytics; .venv\Scripts\python -m pytest     # 14 test: F2 validasi, F3 vs hitung manual, F4 rumus, F5, F6 vs mlxtend, F7
cd web; php artisan test                          # 23 test: F1 auth, multi-tenant, F2 impor/konflik, F8 fallback & cek angka, F10, F11
```

Uji manual end-to-end (server, queue, analytics berjalan): `python tools\e2e.py contoh.csv`, cek tampilan 360 px: `python tools\overflow_check.py`.

## Tampilan dan chatbot

- Arah desain ada di `DESIGN.md` ("buku kas warung": kertas krem, tinta, satu aksen stabilo). UI mengikuti filter antislop
  (`.claude/skills/antislop/SKILL.md`). Tema terang/gelap lewat tombol "Tema gelap", mengikuti setelan perangkat bila belum dipilih.
- Kontras warna dicek dengan `python tools\contrast.py`; uji klik di browser nyata (Edge headless) dengan
  `python tools\clickthrough.py <folder-screenshot>` (68 pemeriksaan, termasuk HP 360 px di dua tema).
- **Chatbot "Tanya data"** (tombol di pojok kanan bawah semua halaman setelah masuk): tanya jawab soal hasil analisis periode
  yang sedang dibuka, memakai Gemini (`GEMINI_API_KEY`). Konteksnya hanya angka agregat; setiap angka di jawaban dicocokkan
  dengan angka analisis, jawaban dengan angka karangan ditolak. Riwayat disimpan di sesi (12 pesan terakhir), bisa dihapus
  dengan "Mulai ulang". Tersedia untuk paket Gratis dan Pro; paket Gratis hanya bisa bertanya soal data yang memang bisa ia lihat.

## Asumsi (hal yang tidak dijelaskan PRD)

- **Transaksi tanpa `id_transaksi`**: setiap baris dianggap 1 transaksi. Bundling tidak tersedia (ditampilkan penjelasan).
- **Duplikat** hanya dihapus jika ada `id_transaksi` (tanpa ID, dua baris sama bisa memang dua penjualan).
- **Periode** dihitung mundur dari tanggal data terakhir, bukan hari ini; pembanding = periode sama panjang tepat sebelumnya.
- **Paket Gratis "data 3 bulan"** = hanya 90 hari terakhir dari data yang bisa dilihat; data lama tidak dihapus.
- **Kuota Gratis** = 1 unggahan *berhasil* per bulan kalender.
- **Ringkasan AI** dimuat terpisah (AJAX) supaya dashboard tetap < 3 detik. Setiap angka di jawaban AI dicocokkan dengan
  angka di fakta agregat; bila ada angka asing, dicoba ulang sekali lalu dianggap gagal dan dicatat di log admin.
- **Payment gateway**: Midtrans Snap (PRD belum menentukan); mode simulasi tersedia untuk pengembangan.
- **Pola waktu** memakai heatmap HTML (sel berwarna + angka) alih-alih plugin Chart.js, agar ringan dan mudah dibaca di HP.
