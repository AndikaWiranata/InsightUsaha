-- Impor lewat fungsi database: kuota paket Gratis dan aturan ganti/gabung tidak bisa dilewati dengan menulis
-- tabel langsung. Fungsi analisis cukup cepat, jadi cache analysis_results tidak dipakai.

drop table if exists public.analysis_results;

-- Kunci pengelompokan transaksi dalam satu unggahan, agar baris satu struk yang terbagi ke beberapa kiriman tetap satu transaksi.
alter table public.transactions add column kunci text;
create unique index transactions_upload_kunci on public.transactions (upload_id, kunci);

-- Pengguna hanya membaca unggahan dan transaksinya; menulis dan menghapus lewat fungsi di bawah.
drop policy "unggahan sendiri" on public.uploads;
drop policy "transaksi sendiri" on public.transactions;
drop policy "item transaksi sendiri" on public.transaction_items;
create policy "baca unggahan sendiri" on public.uploads for select using (business_id = public.my_business_id());
create policy "baca transaksi sendiri" on public.transactions for select using (business_id = public.my_business_id());
create policy "baca item transaksi sendiri" on public.transaction_items for select
  using (exists (select 1 from public.transactions t where t.id = transaction_id and t.business_id = public.my_business_id()));

create function public.import_start(p_nama_file text, p_mode text, p_mulai date, p_selesai date) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  bid bigint := public.my_business_id();
  new_id bigint;
begin
  if bid is null then raise exception 'Silakan masuk terlebih dahulu.'; end if;
  if p_mode not in ('baru', 'ganti', 'gabung') then raise exception 'Mode impor tidak dikenal.'; end if;
  if not public.is_pro(bid) and (select count(*) from public.uploads where business_id = bid and status = 'selesai'
                                  and dibuat_pada >= date_trunc('month', now())) >= 1 then
    raise exception 'Paket Gratis hanya bisa 1 unggahan per bulan. Upgrade ke Pro untuk unggahan tanpa batas.';
  end if;
  -- Unggahan yang terhenti di tengah jalan (tab ditutup) dibersihkan agar tidak meninggalkan data setengah jadi.
  delete from public.uploads where business_id = bid and status = 'diproses' and dibuat_pada < now() - interval '1 hour';
  insert into public.uploads (business_id, nama_file, mode, status, tanggal_mulai, tanggal_selesai)
  values (bid, left(p_nama_file, 200), p_mode, 'diproses', p_mulai, p_selesai)
  returning id into new_id;
  return new_id;
end;
$$;

-- Satu kiriman baris bersih dari browser. Mengembalikan jumlah item yang tersimpan (baris duplikat mode gabung dilewati).
create function public.import_chunk(p_upload bigint, p_rows jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  bid bigint := public.my_business_id();
  v_mode text;
  n int;
begin
  select mode into v_mode from public.uploads where id = p_upload and business_id = bid and status = 'diproses';
  if v_mode is null then raise exception 'Unggahan tidak ditemukan atau sudah selesai.'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception 'Terlalu banyak baris dalam satu kiriman.'; end if;

  insert into public.products (business_id, nama, kategori)
  select distinct on (x.nama_produk) bid, x.nama_produk, x.kategori
  from jsonb_to_recordset(p_rows) as x(no int, nama_produk text, kategori text)
  order by x.nama_produk, x.kategori is null, x.no
  on conflict (business_id, nama) do update set kategori = excluded.kategori
    where public.products.kategori is null and excluded.kategori is not null;

  -- Tanpa ID transaksi: satu baris = satu transaksi. Dengan ID: dikelompokkan per tanggal + ID, jam dari baris pertama.
  with s as (
    select x.*, case when x.id_transaksi is not null then 'k|' || x.tanggal || '|' || x.id_transaksi else 'r|' || x.no end k
    from jsonb_to_recordset(p_rows) as x(no int, tanggal date, jam text, id_transaksi text, hash text)
    where not (v_mode = 'gabung' and x.id_transaksi is not null and exists (
      select 1 from public.transaction_items i join public.transactions t on t.id = i.transaction_id
      where t.business_id = bid and t.upload_id <> p_upload and i.row_hash = x.hash))
  )
  insert into public.transactions (business_id, upload_id, kode_transaksi, waktu, punya_jam, kunci)
  select distinct on (k) bid, p_upload, id_transaksi, tanggal + coalesce(jam::time, time '00:00'), jam is not null, k
  from s order by k, no
  on conflict (upload_id, kunci) do nothing;

  with s as (
    select x.*, case when x.id_transaksi is not null then 'k|' || x.tanggal || '|' || x.id_transaksi else 'r|' || x.no end k
    from jsonb_to_recordset(p_rows) as x(no int, tanggal date, id_transaksi text, nama_produk text,
                                         jumlah int, harga_satuan numeric, hash text)
    where not (v_mode = 'gabung' and x.id_transaksi is not null and exists (
      select 1 from public.transaction_items i join public.transactions t on t.id = i.transaction_id
      where t.business_id = bid and t.upload_id <> p_upload and i.row_hash = x.hash))
  )
  insert into public.transaction_items (transaction_id, product_id, jumlah, harga_satuan, row_hash)
  select t.id, p.id, s.jumlah, s.harga_satuan, s.hash
  from s
  join public.transactions t on t.upload_id = p_upload and t.kunci = s.k
  join public.products p on p.business_id = bid and p.nama = s.nama_produk;
  get diagnostics n = row_count;
  return n;
end;
$$;

create function public.import_finish(p_upload bigint, p_ringkasan jsonb, p_ditolak jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  bid bigint := public.my_business_id();
  v_mode text; v_mulai date; v_selesai date; n_valid int;
begin
  select mode, tanggal_mulai, tanggal_selesai into v_mode, v_mulai, v_selesai
  from public.uploads where id = p_upload and business_id = bid and status = 'diproses';
  if v_mode is null then raise exception 'Unggahan tidak ditemukan atau sudah selesai.'; end if;

  if v_mode = 'ganti' then
    delete from public.transactions
    where business_id = bid and upload_id <> p_upload and waktu >= v_mulai and waktu < v_selesai + 1;
  end if;

  -- Jumlah baris masuk dihitung dari database, bukan dari angka kiriman browser.
  select count(*) into n_valid
  from public.transaction_items i join public.transactions t on t.id = i.transaction_id
  where t.upload_id = p_upload;

  update public.uploads set
    status = 'selesai',
    jumlah_baris_valid = n_valid,
    jumlah_baris_ditolak = coalesce((p_ringkasan ->> 'jumlah_baris_ditolak')::int, 0),
    ringkasan = p_ringkasan || jsonb_build_object('duplikat_dilewati_gabung',
                  greatest(coalesce((p_ringkasan ->> 'jumlah_baris_valid')::int, 0) - n_valid, 0)),
    baris_ditolak = p_ditolak
  where id = p_upload;
  update public.businesses set versi_data = versi_data + 1, onboarding_selesai = true where id = bid;
  return n_valid;
end;
$$;

create function public.import_fail(p_upload bigint, p_pesan text) returns void
language sql security definer set search_path = '' as $$
  delete from public.transactions where upload_id = p_upload and business_id = public.my_business_id();
  update public.uploads set status = 'gagal', pesan_error = left(p_pesan, 500)
  where id = p_upload and business_id = public.my_business_id() and status = 'diproses';
$$;

create function public.hapus_unggahan(p_upload bigint) returns void
language sql security definer set search_path = '' as $$
  delete from public.uploads where id = p_upload and business_id = public.my_business_id();
  update public.businesses set versi_data = versi_data + 1 where id = public.my_business_id();
$$;

create function public.hapus_semua_data() returns void
language sql security definer set search_path = '' as $$
  delete from public.uploads where business_id = public.my_business_id();
  delete from public.products where business_id = public.my_business_id();
  delete from public.ai_summaries where business_id = public.my_business_id();
  update public.businesses set versi_data = versi_data + 1 where id = public.my_business_id();
$$;

create function public.beri_umpan_balik(p_periode text, p_nilai text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_nilai not in ('membantu', 'tidak_membantu') then return false; end if;
  update public.ai_summaries set umpan_balik = p_nilai
  where business_id = public.my_business_id() and periode = p_periode and status = 'ok';
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke execute on function
  public.import_start(text, text, date, date), public.import_chunk(bigint, jsonb), public.import_finish(bigint, jsonb, jsonb),
  public.import_fail(bigint, text), public.hapus_unggahan(bigint), public.hapus_semua_data(), public.beri_umpan_balik(text, text)
from public, anon;
grant execute on function
  public.import_start(text, text, date, date), public.import_chunk(bigint, jsonb), public.import_finish(bigint, jsonb, jsonb),
  public.import_fail(bigint, text), public.hapus_unggahan(bigint), public.hapus_semua_data(), public.beri_umpan_balik(text, text)
to authenticated;
