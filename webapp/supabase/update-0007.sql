-- Tempel ke Supabase Dashboard > SQL Editor, lalu klik Run (cukup sekali).

-- Kecepatan: RLS pada transaction_items menjalankan subquery per baris (belasan ribu baris per analisis), sehingga
-- bundling melewati batas waktu 8 detik Supabase. sales_rows kini membaca langsung (security definer) tetapi hanya
-- untuk usaha milik pemanggil: bid yang bukan miliknya menghasilkan nol baris. Pemisahan data tetap terjaga.
create or replace function public.sales_rows(bid bigint, d_start date, d_end date)
returns table (tgl date, jam int, trx text, punya_kode boolean, produk text, jumlah int, harga numeric, omzet numeric)
language sql stable security definer set search_path = '' as $$
  select t.waktu::date,
         case when t.punya_jam then extract(hour from t.waktu)::int end,
         case when t.kode_transaksi is not null then 'k|' || t.waktu::date || '|' || t.kode_transaksi else 'i|' || t.id end,
         t.kode_transaksi is not null,
         p.nama, i.jumlah, i.harga_satuan, i.jumlah * i.harga_satuan
  from public.transactions t
  join public.transaction_items i on i.transaction_id = t.id
  join public.products p on p.id = i.product_id
  where bid = public.my_business_id()
    and t.business_id = bid and t.waktu >= d_start and t.waktu < d_end + 1
$$;

revoke execute on function public.sales_rows(bigint, date, date) from public, anon;
grant execute on function public.sales_rows(bigint, date, date) to authenticated;
