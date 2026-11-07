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
