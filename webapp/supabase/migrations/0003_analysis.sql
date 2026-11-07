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
