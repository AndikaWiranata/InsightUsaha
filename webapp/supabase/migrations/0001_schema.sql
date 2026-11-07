-- InsightUsaha: skema inti. Pemisahan data antar usaha ditegakkan oleh Row Level Security (lihat 0002_rls.sql).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nama text not null,
  role text not null default 'owner' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now()
);

create table public.businesses (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  nama_usaha text not null,
  kota text,
  jenis_usaha text,
  jam_buka time,
  jam_tutup time,
  onboarding_selesai boolean not null default false,
  min_support numeric(6, 4) not null default 0.01,
  min_confidence numeric(6, 4) not null default 0.30,
  versi_data integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.uploads (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses (id) on delete cascade,
  nama_file text not null,
  mode text not null default 'baru' check (mode in ('baru', 'ganti', 'gabung')),
  status text not null default 'diproses' check (status in ('diproses', 'selesai', 'gagal')),
  jumlah_baris_valid integer not null default 0,
  jumlah_baris_ditolak integer not null default 0,
  ringkasan jsonb,
  baris_ditolak jsonb,
  tanggal_mulai date,
  tanggal_selesai date,
  pesan_error text,
  dibuat_pada timestamptz not null default now()
);
create index on public.uploads (business_id, dibuat_pada desc);

create table public.products (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses (id) on delete cascade,
  nama text not null,
  kategori text,
  hpp numeric(14, 2) check (hpp is null or hpp >= 0),
  unique (business_id, nama)
);

create table public.transactions (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses (id) on delete cascade,
  upload_id bigint not null references public.uploads (id) on delete cascade,
  kode_transaksi text,
  waktu timestamp not null,
  punya_jam boolean not null default false
);
create index on public.transactions (business_id, waktu);
create index on public.transactions (upload_id);

create table public.transaction_items (
  id bigint generated always as identity primary key,
  transaction_id bigint not null references public.transactions (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete cascade,
  jumlah integer not null check (jumlah > 0),
  harga_satuan numeric(14, 2) not null check (harga_satuan >= 0),
  row_hash text
);
create index on public.transaction_items (transaction_id);
create index on public.transaction_items (row_hash);

create table public.analysis_results (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses (id) on delete cascade,
  jenis text not null,
  periode_mulai date not null,
  periode_selesai date not null,
  parameter_hash text not null default '',
  versi_data integer not null,
  hasil_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (business_id, jenis, periode_mulai, periode_selesai, parameter_hash)
);

create table public.ai_summaries (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses (id) on delete cascade,
  periode text not null,
  versi_data integer not null,
  status text not null check (status in ('ok', 'gagal')),
  isi_json jsonb,
  umpan_balik text check (umpan_balik in ('membantu', 'tidak_membantu')),
  updated_at timestamptz not null default now(),
  unique (business_id, periode)
);

create table public.subscriptions (
  id bigint generated always as identity primary key,
  business_id bigint not null unique references public.businesses (id) on delete cascade,
  paket text not null default 'gratis' check (paket in ('gratis', 'pro')),
  mulai timestamptz not null default now(),
  berakhir timestamptz,
  status text not null default 'aktif',
  pengingat_dikirim_pada timestamptz
);

create table public.payments (
  id bigint generated always as identity primary key,
  subscription_id bigint not null references public.subscriptions (id) on delete cascade,
  jumlah integer not null,
  metode text,
  status text not null default 'menunggu' check (status in ('menunggu', 'lunas', 'gagal', 'kedaluwarsa')),
  ref_gateway text not null unique,
  url_pembayaran text,
  payload jsonb,
  dibayar_pada timestamptz,
  created_at timestamptz not null default now()
);

create table public.error_logs (
  id bigint generated always as identity primary key,
  business_id bigint references public.businesses (id) on delete set null,
  jenis text not null,
  pesan text not null,
  konteks jsonb,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  tanggal date not null default current_date,
  primary key (user_id, tanggal)
);

-- Saat pengguna mendaftar, metadata pendaftaran (nama, nama_usaha, jenis_usaha) membuat profil, usaha, dan langganan Gratis.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  bid bigint;
begin
  insert into public.profiles (id, nama) values (new.id, coalesce(new.raw_user_meta_data ->> 'nama', ''));
  insert into public.businesses (user_id, nama_usaha, jenis_usaha)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'nama_usaha', ''), 'Usaha saya'), new.raw_user_meta_data ->> 'jenis_usaha')
  returning id into bid;
  insert into public.subscriptions (business_id) values (bid);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
