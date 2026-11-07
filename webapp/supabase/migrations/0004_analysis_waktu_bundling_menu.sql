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
