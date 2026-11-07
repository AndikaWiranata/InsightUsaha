// Fakta agregat yang dikirim ke LLM. Tanpa baris transaksi, kode transaksi, atau data pelanggan.
// Kunci ditulis dalam kata biasa (bukan nama_field) dan setiap angka sudah berupa teks siap pakai,
// karena model kecil cenderung menyalin nama kunci teknis ke jawabannya.
import * as F from '../format';
import { label, previousLabel, type Period } from '../period';
import type { ProductRow, Results, Slot } from '../types';

export function buildFacts(r: Partial<Results>, p: Period, opts: { detail?: boolean } = {}) {
  const s = r.dashboard?.ringkasan;
  const c = r.dashboard?.perubahan;
  const pct = (v: unknown) => (v === null || v === undefined ? 'tidak ada data pembanding' : F.percent(Number(v)));
  const unit = (n: unknown) => `${F.number(Number(n))} unit`;
  const facts: Record<string, unknown> = {
    'Periode': label(p),
    'Periode pembanding': previousLabel(p),
    'Omzet': F.rupiah(s?.omzet),
    'Perubahan omzet': pct(c?.omzet),
    'Jumlah transaksi': F.number(s?.transaksi),
    'Perubahan jumlah transaksi': pct(c?.transaksi),
    'Rata-rata nilai transaksi': F.rupiah(s?.rata_rata_transaksi),
    'Menu terlaris': s?.produk_terlaris ? { 'Nama': s.produk_terlaris.nama, 'Terjual': unit(s.produk_terlaris.unit) } : 'tidak ada',
  };

  const prod = r.produk;
  const map = (i: ProductRow) => ({ 'Nama': i.nama, 'Perubahan': F.percent(i.perubahan), 'Terjual': unit(i.unit) });
  facts['Menu naik'] = (prod?.naik_teratas ?? []).slice(0, 3).map(map);
  facts['Menu turun'] = (prod?.turun_teratas ?? []).slice(0, 3).map(map);
  facts['Menu baru'] = (prod?.baru ?? []).slice(0, 3).map((i) => ({ 'Nama': i.nama, 'Terjual': unit(i.unit) }));

  if (r.waktu && !r.waktu.kosong) {
    const slot = (x: Slot) => `${x.hari}${x.jam ? ' jam ' + x.jam : ''}`;
    facts['Waktu tersibuk'] = r.waktu.tersibuk.map(slot);
    facts['Waktu tersepi'] = r.waktu.tersepi.map(slot);
  }
  if (r.bundling?.status === 'ok') facts['Pasangan menu'] = r.bundling.aturan.slice(0, 3).map((a) => a.kalimat);
  if (r.menu?.status === 'ok') {
    const groups: Record<string, string[]> = {};
    for (const m of r.menu.produk) (groups[m.kategori] ??= []).push(m.nama);
    facts['Klasifikasi menu'] = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.slice(0, 3)]));
  }

  // Tanya Data butuh rincian per menu dan per hari agar bisa menjawab pertanyaan spesifik.
  if (opts.detail) {
    facts['Semua menu'] = (prod?.produk ?? []).slice(0, 40).map((x) => ({
      'Nama': x.nama, 'Terjual': unit(x.unit), 'Omzet': F.rupiah(x.omzet),
      'Perubahan': x.perubahan === null ? 'tidak ada pembanding' : F.percent(x.perubahan), 'Tanda': x.label ?? 'data sedikit',
    }));
    if (r.waktu?.per_hari?.length) {
      facts['Per hari'] = r.waktu.per_hari.map((d) => ({
        'Hari': d.hari, 'Transaksi': `${F.number(d.transaksi)} transaksi`,
        'Rata-rata': `${F.number(d.rata_rata_transaksi, 1)} transaksi per hari`, 'Omzet': F.rupiah(d.omzet),
      }));
    }
    if (r.menu?.status === 'ok') {
      facts['Detail klasifikasi menu'] = r.menu.produk.slice(0, 30).map((m) => ({
        'Nama': m.nama, 'Kelompok': m.kategori, 'Untung per porsi': F.rupiah(m.margin_per_unit),
      }));
    }
  }
  return facts;
}
