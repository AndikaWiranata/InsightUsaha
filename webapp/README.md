# InsightUsaha (Next.js + Supabase)

Petunjuk menjalankan, deploy ke Vercel, dan pengujian ada di [README utama](../README.md#versi-nextjs-webapp).

```
webapp/
├── src/app/              halaman (App Router) dan API route
├── src/components/       komponen tampilan bersama
├── src/lib/              data, analisis, impor, AI, pembayaran
├── supabase/migrations/  skema, RLS, fungsi analisis dan impor (urut nomor)
├── supabase/setup-semua.sql   gabungan migrasi untuk project Supabase baru
├── scripts/              akun demo, cek Supabase, uji klik, log error
└── tests/                tes Vitest (database diuji dengan PGlite, tanpa Docker)
```
