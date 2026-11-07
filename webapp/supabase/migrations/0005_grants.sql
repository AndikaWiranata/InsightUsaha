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
