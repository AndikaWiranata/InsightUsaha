// Bukti kesetaraan: fungsi SQL versi Next.js vs versi Python, pada 13.743 baris data contoh yang sama.
// Acuan dibuat oleh tools/parity_reference.py dari analytics/app/analysis.py.
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, call, createUser, freshDb, insertSales, type SaleRow } from './db';

const ref = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'python-reference.json'), 'utf8'));
const hpp: Record<string, number> = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'hpp.json'), 'utf8'));
const U = '00000000-0000-0000-0000-0000000000aa';

let db: PGlite;

/** Samakan representasi angka (Postgres numeric datang sebagai string) lalu bandingkan rekursif. */
function norm(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)]));
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

beforeAll(async () => {
  db = await freshDb();
  const biz = await createUser(db, U, { nama: 'Rina', nama_usaha: 'Kedai Kopi Rina' });
  const b = ref.baris;
  const rows: SaleRow[] = b.tanggal.map((t: string, i: number) => ({
    tanggal: t, jam: b.jam[i], kode: b.id_transaksi[i], produk: b.nama_produk[i], jumlah: b.jumlah[i], harga: b.harga_satuan[i],
  }));
  await insertSales(db, biz, rows);
  for (const [nama, h] of Object.entries(hpp)) {
    await db.query('update public.products set hpp = $1 where business_id = $2 and nama = $3', [h, biz, nama]);
  }
}, 600_000);

const keys = Object.keys(ref.periode) as string[];

describe.each(keys)('periode %s hari: SQL sama dengan Python', (k) => {
  const p = ref.periode_tanggal[k];
  const py = ref.periode[k];
  const sql = (fn: string, ...extra: unknown[]) => asUser(db, U, () => call(db, fn, p.mulai, p.selesai, ...extra));

  it('dashboard: ringkasan, perubahan, tren', async () => {
    const d = norm(await sql('analisis_dashboard')) as any;
    expect(d.ringkasan).toEqual(norm(py.dashboard.ringkasan));
    expect(d.ringkasan_lalu).toEqual(norm(py.dashboard.ringkasan_lalu));
    expect(d.perubahan).toEqual(norm(py.dashboard.perubahan));
    expect(d.tren.granularitas).toBe(py.dashboard.tren.granularitas);
    expect(d.tren.omzet).toEqual(norm(py.dashboard.tren.omzet));
    expect(d.tren.transaksi).toEqual(norm(py.dashboard.tren.transaksi));
  });

  it('produk naik/turun: setiap menu, label, dan daftar teratas', async () => {
    const d = norm(await sql('analisis_produk')) as any;
    expect(d.produk).toEqual(norm(py.produk.produk));
    expect(d.jumlah_label).toEqual(norm(py.produk.jumlah_label));
    expect(d.naik_teratas).toEqual(norm(py.produk.naik_teratas));
    expect(d.turun_teratas).toEqual(norm(py.produk.turun_teratas));
    expect(d.baru).toEqual(norm(py.produk.baru));
  });

  it('pola waktu: per hari, heatmap, tersibuk, tersepi', async () => {
    const d = norm(await sql('analisis_waktu')) as any;
    const w = norm(py.waktu) as any;
    expect(d.punya_jam).toBe(w.punya_jam);
    expect(d.per_hari).toEqual(w.per_hari);
    expect(d.heatmap).toEqual(w.heatmap);
    expect(d.tersibuk).toEqual(w.tersibuk);
    expect(d.tersepi).toEqual(w.tersepi);
  });

  it('bundling Apriori: aturan sama dengan mlxtend', async () => {
    const d = norm(await sql('analisis_bundling')) as any;
    const b = norm(py.bundling) as any;
    expect(d.status).toBe(b.status);
    expect(d.jumlah_transaksi).toBe(b.jumlah_transaksi);
    expect(d.transaksi_multi_produk).toBe(b.transaksi_multi_produk);
    expect(d.aturan).toEqual(b.aturan);
  });

  it('klasifikasi menu: batas, kategori, belum lengkap', async () => {
    const d = norm(await sql('analisis_menu')) as any;
    const m = norm(py.menu) as any;
    expect(d.status).toBe(m.status);
    expect(d.batas_popularitas).toBe(m.batas_popularitas);
    expect(d.batas_margin).toBe(m.batas_margin);
    expect(d.jumlah_kategori).toEqual(m.jumlah_kategori);
    expect(d.produk).toEqual(m.produk);
    expect(d.belum_lengkap).toEqual(m.belum_lengkap);
  });
});
