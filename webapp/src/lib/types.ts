// Bentuk hasil fungsi analisis SQL (supabase/migrations/0003, 0004). Angka numeric Postgres datang sebagai number atau string.
type Num = number | string;

export type Summary = { omzet: Num; transaksi: Num; rata_rata_transaksi: Num; unit_terjual: Num;
  produk_terlaris: { nama: string; unit: Num; omzet: Num } | null };
export type Dashboard = {
  ringkasan: Summary; ringkasan_lalu: Summary;
  perubahan: { omzet: Num | null; transaksi: Num | null; rata_rata_transaksi: Num | null; produk_terlaris_unit: Num | null };
  tren: { granularitas: 'harian' | 'mingguan' | 'bulanan'; label: string[]; omzet: Num[]; transaksi: Num[] };
};

export type ProductRow = { nama: string; unit: number; unit_lalu: number; omzet: Num; omzet_lalu: Num; perubahan: Num | null;
  label: 'Naik' | 'Turun' | 'Stabil' | 'Produk Baru' | null };
export type Products = { produk: ProductRow[]; jumlah_label: Record<string, number>;
  naik_teratas: ProductRow[]; turun_teratas: ProductRow[]; baru: ProductRow[] };

export type Slot = { hari: string; jam: string | null; transaksi: number };
export type DayRow = { hari: string; transaksi: number; rata_rata_transaksi: Num; omzet: Num };
export type TimePattern = { kosong: boolean; punya_jam: boolean; per_hari: DayRow[];
  heatmap: { hari: string[]; jam: string[]; nilai: number[][] } | null; tersibuk: Slot[]; tersepi: Slot[] };

export type Rule = { jika: string; maka: string; support: number; confidence: number; lift: number;
  jumlah_transaksi_bersama: number; kalimat: string };
export type Bundling = { status: 'ok' | 'kosong' | 'tanpa_id' | 'kurang_data' | 'tidak_ada_aturan'; pesan: string | null;
  aturan: Rule[]; jumlah_transaksi?: number; transaksi_multi_produk?: number };

export type MenuItem = { nama: string; unit: number; omzet: Num; harga_rata_rata: Num; hpp: Num; margin_per_unit: Num;
  margin_total: Num; popularitas: Num; kategori: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog' };
export type Menu = { status: 'ok' | 'kosong' | 'hpp_kosong'; pesan: string | null; produk: MenuItem[];
  belum_lengkap: { nama: string; unit: number }[]; saran: Record<string, string>;
  batas_popularitas: Num; batas_margin: Num; jumlah_menu: number; jumlah_kategori: Record<string, number> };

export type Results = { dashboard: Dashboard; produk: Products; waktu: TimePattern; bundling: Bundling; menu: Menu };
