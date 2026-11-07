-- Tempel seluruh isi file ini ke Supabase Dashboard > SQL Editor, lalu klik Run. Cukup sekali.

-- ===== 0001_schema.sql =====
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


-- ===== 0002_rls.sql =====
-- Row Level Security: setiap pengguna hanya melihat dan mengubah data usahanya sendiri.
-- Admin membaca lintas usaha lewat API route server yang memakai service role (RLS dilewati di sana).

create function public.my_business_id() returns bigint
language sql stable security definer set search_path = '' as $$
  select id from public.businesses where user_id = auth.uid()
$$;

create function public.is_pro(bid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s
    where s.business_id = bid and s.paket = 'pro' and s.status = 'aktif'
      and (s.berakhir is null or s.berakhir > now())
  )
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.uploads enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.analysis_results enable row level security;
alter table public.ai_summaries enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.error_logs enable row level security;
alter table public.activity_logs enable row level security;

create policy "profil sendiri" on public.profiles for select using (id = auth.uid());
create policy "ubah profil sendiri" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = 'owner');

create policy "usaha sendiri" on public.businesses for select using (user_id = auth.uid());
create policy "ubah usaha sendiri" on public.businesses for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "unggahan sendiri" on public.uploads for all
  using (business_id = public.my_business_id()) with check (business_id = public.my_business_id());
create policy "produk sendiri" on public.products for all
  using (business_id = public.my_business_id()) with check (business_id = public.my_business_id());
-- Pemeriksaan foreign key tidak tunduk pada RLS, jadi rujukan ke unggahan/produk milik usaha lain ditolak di sini.
create policy "transaksi sendiri" on public.transactions for all
  using (business_id = public.my_business_id())
  with check (business_id = public.my_business_id()
    and exists (select 1 from public.uploads u where u.id = upload_id and u.business_id = public.my_business_id()));
create policy "item transaksi sendiri" on public.transaction_items for all
  using (exists (select 1 from public.transactions t where t.id = transaction_id and t.business_id = public.my_business_id()))
  with check (exists (select 1 from public.transactions t where t.id = transaction_id and t.business_id = public.my_business_id())
    and exists (select 1 from public.products p where p.id = product_id and p.business_id = public.my_business_id()));

-- Cache analisis dan ringkasan AI (termasuk umpan balik) hanya ditulis lewat server; pengguna cukup membaca.
create policy "baca cache analisis sendiri" on public.analysis_results for select using (business_id = public.my_business_id());
create policy "baca ringkasan sendiri" on public.ai_summaries for select using (business_id = public.my_business_id());

-- Status langganan dan pembayaran hanya diubah server (webhook); pengguna hanya membaca.
create policy "langganan sendiri" on public.subscriptions for select using (business_id = public.my_business_id());
create policy "pembayaran sendiri" on public.payments for select
  using (exists (select 1 from public.subscriptions s where s.id = subscription_id and s.business_id = public.my_business_id()));

create policy "catat aktivitas sendiri" on public.activity_logs for insert with check (user_id = auth.uid());
-- error_logs: tanpa policy, jadi hanya bisa ditulis/dibaca server (service role).


-- ===== 0003_analysis.sql =====
-- Fungsi analisis (F3-F7). Semua berjalan sebagai pemanggil (security invoker), jadi RLS tetap membatasi
-- data ke usaha pengguna. Rumus mengikuti PRD dan diuji di tests/analysis.test.ts.

-- Satu baris per item terjual dalam rentang tanggal, dengan kunci transaksi.
-- Transaksi tanpa kode dianggap satu transaksi per baris (asumsi tercatat di README).
create function public.sales_rows(bid bigint, d_start date, d_end date)
returns table (tgl date, jam int, trx text, punya_kode boolean, produk text, jumlah int, harga numeric, omzet numeric)
language sql stable security invoker set search_path = '' as $$
  select t.waktu::date,
         case when t.punya_jam then extract(hour from t.waktu)::int end,
         case when t.kode_transaksi is not null then 'k|' || t.waktu::date || '|' || t.kode_transaksi else 'i|' || t.id end,
         t.kode_transaksi is not null,
         p.nama, i.jumlah, i.harga_satuan, i.jumlah * i.harga_satuan
  from public.transactions t
  join public.transaction_items i on i.transaction_id = t.id
  join public.products p on p.id = i.product_id
  where t.business_id = bid and t.waktu >= d_start and t.waktu < d_end + 1
$$;

-- (periode ini - periode lalu) / periode lalu x 100%, dibulatkan 1 desimal; null bila periode lalu nol.
create function public.pct_change(cur numeric, prev numeric) returns numeric
language sql immutable as $$
  select case when prev is null or prev = 0 then null else round((cur - prev) / prev * 100, 1) end
$$;

create function public.summary_of(bid bigint, d_start date, d_end date) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with r as (select * from public.sales_rows(bid, d_start, d_end)),
  agg as (select coalesce(sum(omzet), 0) omzet, count(distinct trx) trx, coalesce(sum(jumlah), 0) unit from r),
  top as (
    select produk, sum(jumlah) unit, sum(omzet) omzet from r group by produk
    order by sum(jumlah) desc, sum(omzet) desc, produk collate "C" limit 1
  )
  select jsonb_build_object(
    'omzet', agg.omzet,
    'transaksi', agg.trx,
    'rata_rata_transaksi', case when agg.trx > 0 then round(agg.omzet / agg.trx, 2) else 0 end,
    'unit_terjual', agg.unit,
    'produk_terlaris', (select jsonb_build_object('nama', produk, 'unit', unit, 'omzet', omzet) from top)
  ) from agg
$$;

-- F3 Dashboard: kartu ringkasan, perubahan vs periode sebelumnya (panjang sama), dan tren.
create function public.analisis_dashboard(d_start date, d_end date, granularitas text default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  bid bigint := public.my_business_id();
  n int := d_end - d_start + 1;
  p_start date := d_start - n;
  p_end date := d_start - 1;
  cur jsonb; prev jsonb; gran text; tren jsonb; top_prev numeric;
begin
  cur := public.summary_of(bid, d_start, d_end);
  prev := public.summary_of(bid, p_start, p_end);
  gran := coalesce(nullif(granularitas, ''), case when n <= 45 then 'harian' when n <= 180 then 'mingguan' else 'bulanan' end);

  if cur -> 'produk_terlaris' <> 'null'::jsonb then
    select coalesce(sum(jumlah), 0) into top_prev from public.sales_rows(bid, p_start, p_end)
    where produk = cur -> 'produk_terlaris' ->> 'nama';
  end if;

  with buckets as (
    select b_start, least(b_end, d_end) b_end, greatest(b_start, d_start) s from (
      select g::date b_start,
             case gran when 'harian' then g::date
                       when 'mingguan' then (g + interval '6 day')::date
                       else (g + interval '1 month' - interval '1 day')::date end b_end
      from generate_series(
        case gran when 'mingguan' then date_trunc('week', d_start)::date when 'bulanan' then date_trunc('month', d_start)::date else d_start end,
        d_end,
        case gran when 'harian' then interval '1 day' when 'mingguan' then interval '1 week' else interval '1 month' end
      ) g
    ) x
  ),
  r as (select * from public.sales_rows(bid, d_start, d_end))
  select jsonb_build_object(
    'granularitas', gran,
    'label', jsonb_agg(
      case gran when 'bulanan' then to_char(s, 'YYYY-MM') else to_char(s, 'YYYY-MM-DD') end order by b_start),
    'omzet', jsonb_agg((select coalesce(sum(omzet), 0) from r where r.tgl between s and b_end) order by b_start),
    'transaksi', jsonb_agg((select count(distinct trx) from r where r.tgl between s and b_end) order by b_start)
  ) into tren from buckets;

  return jsonb_build_object(
    'periode', jsonb_build_object('mulai', d_start, 'selesai', d_end, 'lalu_mulai', p_start, 'lalu_selesai', p_end),
    'ringkasan', cur,
    'ringkasan_lalu', prev,
    'perubahan', jsonb_build_object(
      'omzet', public.pct_change((cur ->> 'omzet')::numeric, (prev ->> 'omzet')::numeric),
      'transaksi', public.pct_change((cur ->> 'transaksi')::numeric, (prev ->> 'transaksi')::numeric),
      'rata_rata_transaksi', public.pct_change((cur ->> 'rata_rata_transaksi')::numeric, (prev ->> 'rata_rata_transaksi')::numeric),
      'produk_terlaris_unit', case when top_prev is null then null
                                   else public.pct_change((cur -> 'produk_terlaris' ->> 'unit')::numeric, top_prev) end
    ),
    'tren', tren
  );
end;
$$;

-- F4 Produk naik/turun. Naik > +10%, Turun < -10%, Produk Baru bila periode lalu 0,
-- tanpa label bila kurang dari 5 unit di kedua periode.
create function public.analisis_produk(d_start date, d_end date) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with params as (select public.my_business_id() bid, d_end - d_start + 1 n),
  cur as (select produk, sum(jumlah) unit, sum(omzet) omzet from params, public.sales_rows(bid, d_start, d_end) group by produk),
  prev as (select produk, sum(jumlah) unit, sum(omzet) omzet from params, public.sales_rows(bid, d_start - n, d_start - 1) group by produk),
  joined as (
    select coalesce(c.produk, p.produk) nama, coalesce(c.unit, 0)::int unit, coalesce(p.unit, 0)::int unit_lalu,
           coalesce(c.omzet, 0) omzet, coalesce(p.omzet, 0) omzet_lalu,
           public.pct_change(coalesce(c.unit, 0), coalesce(p.unit, 0)) perubahan
    from cur c full join prev p on p.produk = c.produk
  ),
  labelled as (
    select *, case
      when unit < 5 and unit_lalu < 5 then null
      when unit_lalu = 0 then 'Produk Baru'
      when perubahan > 10 then 'Naik'
      when perubahan < -10 then 'Turun'
      else 'Stabil' end label
    from joined
  )
  -- Urutan pengikat (unit, unit_lalu, nama) sama dengan versi Python agar hasil identik.
  select jsonb_build_object(
    'produk', coalesce((select jsonb_agg(to_jsonb(l) order by unit desc, unit_lalu desc, nama collate "C") from labelled l), '[]'),
    'jumlah_label', jsonb_build_object(
      'Naik', (select count(*) from labelled where label = 'Naik'),
      'Stabil', (select count(*) from labelled where label = 'Stabil'),
      'Turun', (select count(*) from labelled where label = 'Turun'),
      'Produk Baru', (select count(*) from labelled where label = 'Produk Baru'),
      'Tanpa label', (select count(*) from labelled where label is null)),
    'naik_teratas', coalesce((select jsonb_agg(to_jsonb(x) - 'rn' order by rn) from (
        select l.*, row_number() over (order by perubahan desc, unit desc, unit_lalu desc, nama collate "C") rn
        from labelled l where label = 'Naik' order by rn limit 5) x), '[]'),
    'turun_teratas', coalesce((select jsonb_agg(to_jsonb(x) - 'rn' order by rn) from (
        select l.*, row_number() over (order by perubahan, unit desc, unit_lalu desc, nama collate "C") rn
        from labelled l where label = 'Turun' order by rn limit 5) x), '[]'),
    'baru', coalesce((select jsonb_agg(to_jsonb(x) - 'rn' order by rn) from (
        select l.*, row_number() over (order by unit desc, unit_lalu desc, nama collate "C") rn
        from labelled l where label = 'Produk Baru' order by rn limit 5) x), '[]')
  )
$$;


-- ===== 0004_analysis_waktu_bundling_menu.sql =====
-- F5 Pola waktu, F6 Bundling (Apriori 2-produk), F7 Menu Engineering.

-- F5. Heatmap hari x jam bila >= 50% transaksi punya jam; selain itu pola per hari saja.
create function public.analisis_waktu(d_start date, d_end date) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  bid bigint := public.my_business_id();
  hari text[] := array['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
  trx jsonb; n_trx int; n_jam int; h_min int; h_max int; per_hari jsonb; grid jsonb; pakai_jam boolean;
begin
  -- Satu baris per transaksi: (hari 0=Senin, jam atau null).
  select coalesce(jsonb_agg(jsonb_build_object('d', d, 'h', jam)), '[]'), count(*), count(jam), min(jam), max(jam)
    into trx, n_trx, n_jam, h_min, h_max
  from (select distinct on (s.trx) extract(isodow from s.tgl)::int - 1 d, s.jam
        from public.sales_rows(bid, d_start, d_end) s order by s.trx) t;

  if n_trx = 0 then
    return jsonb_build_object('punya_jam', false, 'kosong', true, 'per_hari', '[]'::jsonb,
                              'heatmap', null, 'tersibuk', '[]'::jsonb, 'tersepi', '[]'::jsonb);
  end if;
  pakai_jam := n_jam > 0 and n_jam >= 0.5 * n_trx;

  -- Rata-rata per hari = jumlah transaksi dibagi berapa kali hari itu muncul dalam periode.
  select jsonb_agg(jsonb_build_object(
           'hari', hari[dw + 1],
           'transaksi', n,
           'rata_rata_transaksi', case when k > 0 then round(n::numeric / k, 1) else 0 end,
           'omzet', om) order by dw)
    into per_hari
  from (
    select dw,
           (select count(*) from jsonb_array_elements(trx) e where (e ->> 'd')::int = dw) n,
           (select count(*) from generate_series(d_start, d_end, interval '1 day') g where extract(isodow from g)::int - 1 = dw) k,
           (select coalesce(sum(s.omzet), 0) from public.sales_rows(bid, d_start, d_end) s where extract(isodow from s.tgl)::int - 1 = dw) om
    from generate_series(0, 6) dw
  ) x;

  if not pakai_jam then
    return jsonb_build_object(
      'punya_jam', false, 'kosong', false, 'per_hari', per_hari, 'heatmap', null,
      'tersibuk', (select coalesce(jsonb_agg(jsonb_build_object('hari', e ->> 'hari', 'jam', null, 'transaksi', (e ->> 'transaksi')::int)
                                             order by (e ->> 'rata_rata_transaksi')::numeric desc, ord), '[]')
                   from (select e, ord from jsonb_array_elements(per_hari) with ordinality t(e, ord)
                         where (e ->> 'transaksi')::int > 0
                         order by (e ->> 'rata_rata_transaksi')::numeric desc, ord limit 3) a),
      'tersepi', (select coalesce(jsonb_agg(jsonb_build_object('hari', e ->> 'hari', 'jam', null, 'transaksi', (e ->> 'transaksi')::int)
                                            order by (e ->> 'rata_rata_transaksi')::numeric, ord), '[]')
                  from (select e, ord from jsonb_array_elements(per_hari) with ordinality t(e, ord)
                        where (e ->> 'transaksi')::int > 0
                        order by (e ->> 'rata_rata_transaksi')::numeric, ord limit 3) b));
  end if;

  -- Hanya transaksi yang punya jam yang masuk heatmap.
  select jsonb_agg(jsonb_build_object('d', d, 'h', h, 'v', v) order by d, h) into grid
  from (
    select d, h, (select count(*) from jsonb_array_elements(trx) e
                  where (e ->> 'd')::int = d and (e ->> 'h') is not null and (e ->> 'h')::int = h) v
    from generate_series(0, 6) d cross join generate_series(h_min, h_max) h
  ) g;

  return jsonb_build_object(
    'punya_jam', true, 'kosong', false, 'per_hari', per_hari,
    'heatmap', jsonb_build_object(
      'hari', to_jsonb(hari),
      'jam', (select jsonb_agg(lpad(h::text, 2, '0') order by h) from generate_series(h_min, h_max) h),
      'nilai', (select jsonb_agg(r order by d) from (
                 select (c ->> 'd')::int d, jsonb_agg((c ->> 'v')::int order by (c ->> 'h')::int) r
                 from jsonb_array_elements(grid) c group by 1) x)),
    'tersibuk', (select coalesce(jsonb_agg(s order by v desc, d, h), '[]') from (
                 select jsonb_build_object('hari', hari[(c ->> 'd')::int + 1],
                          'jam', lpad(c ->> 'h', 2, '0') || '.00–' || lpad(((c ->> 'h')::int + 1)::text, 2, '0') || '.00',
                          'transaksi', (c ->> 'v')::int) s, (c ->> 'v')::int v, (c ->> 'd')::int d, (c ->> 'h')::int h
                 from jsonb_array_elements(grid) c where (c ->> 'v')::int > 0
                 order by v desc, d, h limit 3) a),
    'tersepi', (select coalesce(jsonb_agg(s order by v, d, h), '[]') from (
                select jsonb_build_object('hari', hari[(c ->> 'd')::int + 1],
                         'jam', lpad(c ->> 'h', 2, '0') || '.00–' || lpad(((c ->> 'h')::int + 1)::text, 2, '0') || '.00',
                         'transaksi', (c ->> 'v')::int) s, (c ->> 'v')::int v, (c ->> 'd')::int d, (c ->> 'h')::int h
                from jsonb_array_elements(grid) c where (c ->> 'v')::int > 0
                order by v, d, h limit 3) b));
end;
$$;

-- F6. Apriori untuk pasangan 2 produk (sama dengan mlxtend apriori max_len=2 + association_rules).
-- support = transaksi berisi A dan B / semua transaksi berkode; confidence = support(A,B) / support(A);
-- lift = confidence / support(B). Hanya lift > 1, diurutkan lift, confidence, support.
create function public.analisis_bundling(d_start date, d_end date, p_min_support numeric default null, p_min_confidence numeric default null)
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  bid bigint := public.my_business_id();
  ms numeric; mc numeric; n_trx int; n_multi int; any_code boolean; rules jsonb;
begin
  select coalesce(p_min_support, b.min_support), coalesce(p_min_confidence, b.min_confidence) into ms, mc
  from public.businesses b where b.id = bid;

  select bool_or(punya_kode) into any_code from public.sales_rows(bid, d_start, d_end);
  if any_code is null then
    return jsonb_build_object('status', 'kosong', 'aturan', '[]'::jsonb, 'min_support', ms, 'min_confidence', mc,
      'pesan', 'Belum ada data penjualan pada periode ini.');
  end if;
  if not any_code then
    return jsonb_build_object('status', 'tanpa_id', 'aturan', '[]'::jsonb, 'min_support', ms, 'min_confidence', mc,
      'pesan', 'Data kamu tidak memiliki kolom ID transaksi, sehingga sistem tidak bisa tahu produk mana yang dibeli bersamaan. '
            || 'Ekspor ulang data dari aplikasi kasir dengan kolom nomor transaksi/struk (id_transaksi) agar rekomendasi bundling bisa dibuat.');
  end if;

  -- Keranjang: produk unik per transaksi berkode.
  with basket as (
    select distinct trx, produk from public.sales_rows(bid, d_start, d_end) where punya_kode
  ),
  sizes as (select trx, count(*) k from basket group by trx)
  select count(*), count(*) filter (where k >= 2) into n_trx, n_multi from sizes;

  if n_trx < 10 or n_multi = 0 then
    return jsonb_build_object('status', 'kurang_data', 'aturan', '[]'::jsonb, 'min_support', ms, 'min_confidence', mc,
      'jumlah_transaksi', n_trx, 'transaksi_multi_produk', n_multi,
      'pesan', 'Transaksi dengan lebih dari satu produk masih terlalu sedikit untuk mencari pola bundling. Coba pilih periode yang lebih panjang.');
  end if;

  with basket as (
    select distinct trx, produk from public.sales_rows(bid, d_start, d_end) where punya_kode
  ),
  item as (select produk, count(*)::numeric / n_trx sup from basket group by produk having count(*)::numeric / n_trx >= ms),
  pair as (
    select a.produk x, b.produk y, count(*)::numeric / n_trx sup, count(*) n
    from basket a join basket b on a.trx = b.trx and a.produk < b.produk
    where a.produk in (select produk from item) and b.produk in (select produk from item)
    group by 1, 2 having count(*)::numeric / n_trx >= ms
  ),
  dir as (
    select p.x jika, p.y maka, p.sup, p.n, p.sup / ix.sup conf, p.sup / ix.sup / iy.sup lift
    from pair p join item ix on ix.produk = p.x join item iy on iy.produk = p.y
    union all
    select p.y, p.x, p.sup, p.n, p.sup / iy.sup, p.sup / iy.sup / ix.sup
    from pair p join item ix on ix.produk = p.x join item iy on iy.produk = p.y
  ),
  ok as (
    select * from dir where conf >= mc and lift > 1
    order by lift desc, conf desc, sup desc, jika, maka limit 50
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'jika', jika, 'maka', maka,
           'support', round(sup, 4), 'confidence', round(conf, 4), 'lift', round(lift, 3),
           'jumlah_transaksi_bersama', n,
           'kalimat', round(conf * 100) || '% pembeli ' || jika || ' juga membeli ' || maka)
         order by lift desc, conf desc, sup desc, jika, maka), '[]')
    into rules from ok;

  if jsonb_array_length(rules) = 0 then
    return jsonb_build_object('status', 'tidak_ada_aturan', 'aturan', rules, 'min_support', ms, 'min_confidence', mc,
      'jumlah_transaksi', n_trx, 'transaksi_multi_produk', n_multi,
      'pesan', 'Belum ditemukan pasangan produk yang sering dibeli bersamaan dengan pengaturan saat ini. '
            || 'Coba turunkan minimum support atau confidence di pengaturan lanjutan.');
  end if;
  return jsonb_build_object('status', 'ok', 'pesan', null, 'aturan', rules, 'min_support', ms, 'min_confidence', mc,
    'jumlah_transaksi', n_trx, 'transaksi_multi_produk', n_multi);
end;
$$;

-- F7. Menu Engineering. Batas popularitas = 70% x (1 / jumlah menu ber-HPP);
-- batas margin = rata-rata margin tertimbang = total margin / total unit. Produk tanpa HPP: "belum lengkap".
create function public.analisis_menu(d_start date, d_end date) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  bid bigint := public.my_business_id();
  n int; total_unit numeric; total_margin numeric; pop numeric; marg numeric; produk jsonb; belum jsonb;
  saran jsonb := jsonb_build_object(
    'Star', 'Pertahankan kualitas dan porsinya, taruh di posisi paling terlihat di menu, jangan didiskon besar.',
    'Plowhorse', 'Laris tapi untungnya tipis. Naikkan harga sedikit, kurangi biaya bahan, atau paketkan dengan menu bermargin tinggi.',
    'Puzzle', 'Untungnya besar tapi kurang laku. Promosikan, beri rekomendasi dari kasir, atau ganti nama/foto agar lebih menarik.',
    'Dog', 'Kurang laku dan untungnya kecil. Pertimbangkan untuk dihapus, diganti, atau dirombak resepnya.');
begin
  if not exists (select 1 from public.sales_rows(bid, d_start, d_end)) then
    return jsonb_build_object('status', 'kosong', 'produk', '[]'::jsonb, 'belum_lengkap', '[]'::jsonb, 'saran', saran,
      'pesan', 'Belum ada data penjualan pada periode ini.');
  end if;

  with g as (
    select s.produk nama, sum(s.jumlah) unit, sum(s.omzet) omzet, p.hpp
    from public.sales_rows(bid, d_start, d_end) s
    join public.products p on p.business_id = bid and p.nama = s.produk
    group by s.produk, p.hpp
  )
  select coalesce(jsonb_agg(jsonb_build_object('nama', nama, 'unit', unit, 'status', 'belum lengkap') order by unit desc, nama)
                  filter (where hpp is null), '[]'),
         count(*) filter (where hpp is not null),
         sum(unit) filter (where hpp is not null),
         sum((omzet / unit - hpp) * unit) filter (where hpp is not null)
    into belum, n, total_unit, total_margin
  from g;

  if n = 0 then
    return jsonb_build_object('status', 'hpp_kosong', 'produk', '[]'::jsonb, 'belum_lengkap', belum, 'saran', saran,
      'pesan', 'Isi HPP (harga pokok) produk terlebih dahulu di halaman Produk agar menu bisa diklasifikasi.');
  end if;

  pop := 0.7 * (1.0 / n);
  marg := total_margin / total_unit;

  with g as (
    select s.produk nama, sum(s.jumlah) unit, sum(s.omzet) omzet, p.hpp
    from public.sales_rows(bid, d_start, d_end) s
    join public.products p on p.business_id = bid and p.nama = s.produk
    where p.hpp is not null
    group by s.produk, p.hpp
  ),
  m as (
    select nama, unit, omzet, hpp, omzet / unit harga, omzet / unit - hpp margin, unit / total_unit popularitas from g
  )
  select jsonb_agg(jsonb_build_object(
           'nama', nama, 'unit', unit, 'omzet', round(omzet, 2),
           'harga_rata_rata', round(harga, 2), 'hpp', hpp,
           'margin_per_unit', round(margin, 2), 'margin_total', round(margin * unit, 2),
           'popularitas', round(popularitas, 4),
           'kategori', case when popularitas >= pop then (case when margin >= marg then 'Star' else 'Plowhorse' end)
                            else (case when margin >= marg then 'Puzzle' else 'Dog' end) end)
         order by unit desc, nama)
    into produk from m;

  return jsonb_build_object(
    'status', 'ok', 'pesan', null, 'produk', produk, 'belum_lengkap', belum, 'saran', saran,
    'batas_popularitas', round(pop, 4), 'batas_margin', round(marg, 2), 'jumlah_menu', n,
    'jumlah_kategori', (select jsonb_object_agg(k, (select count(*) from jsonb_array_elements(produk) e where e ->> 'kategori' = k))
                        from unnest(array['Star','Plowhorse','Puzzle','Dog']) k));
end;
$$;


-- ===== 0005_grants.sql =====
-- Fungsi analisis hanya untuk pengguna yang sudah masuk; pengunjung anonim tidak perlu memanggilnya.
revoke execute on function
  public.analisis_dashboard(date, date, text),
  public.analisis_produk(date, date),
  public.analisis_waktu(date, date),
  public.analisis_bundling(date, date, numeric, numeric),
  public.analisis_menu(date, date),
  public.sales_rows(bigint, date, date),
  public.summary_of(bigint, date, date)
from public, anon;

grant execute on function
  public.analisis_dashboard(date, date, text),
  public.analisis_produk(date, date),
  public.analisis_waktu(date, date),
  public.analisis_bundling(date, date, numeric, numeric),
  public.analisis_menu(date, date),
  public.sales_rows(bigint, date, date),
  public.summary_of(bigint, date, date),
  public.my_business_id(),
  public.is_pro(bigint)
to authenticated;
