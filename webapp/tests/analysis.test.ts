// Skenario dan angka harapan sama dengan tes versi Python lama (lihat riwayat git).
import { beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, call, createUser, freshDb, insertSales, type SaleRow } from './db';

const U1 = '00000000-0000-0000-0000-000000000001';
const U2 = '00000000-0000-0000-0000-000000000002';
const P = ['2026-10-08', '2026-10-14'] as const; // periode ini; periode lalu otomatis 1-7 Okt

let db: PGlite;
let biz: number;
const row = (tanggal: string, jam: string | null, kode: string | number | null, produk: string, jumlah: number, harga: number): SaleRow =>
  ({ tanggal, jam, kode: kode === null ? null : String(kode), produk, jumlah, harga });

beforeEach(async () => {
  db = await freshDb();
  biz = await createUser(db, U1, { nama: 'Rina', nama_usaha: 'Kedai Rina', jenis_usaha: 'Kedai kopi' });
});

describe('pendaftaran', () => {
  it('membuat profil, usaha, dan langganan Gratis', async () => {
    const r = await db.query<any>(`select b.nama_usaha, s.paket from public.businesses b join public.subscriptions s on s.business_id = b.id where b.id = $1`, [biz]);
    expect(r.rows[0]).toEqual({ nama_usaha: 'Kedai Rina', paket: 'gratis' });
  });
});

describe('F3 dashboard', () => {
  it('sama dengan perhitungan manual', async () => {
    await insertSales(db, biz, [
      row('2026-10-02', '08:00', 1, 'Kopi', 2, 10000),
      row('2026-10-08', '08:00', 2, 'Kopi', 3, 10000),
      row('2026-10-08', '08:00', 2, 'Roti', 1, 15000),
      row('2026-10-09', '12:00', 3, 'Kopi', 1, 10000),
    ]);
    const d = await asUser(db, U1, () => call(db, 'analisis_dashboard', ...P));
    expect(Number(d.ringkasan.omzet)).toBe(55000);
    expect(Number(d.ringkasan.transaksi)).toBe(2);
    expect(Number(d.ringkasan.rata_rata_transaksi)).toBe(27500);
    expect(d.ringkasan.produk_terlaris.nama).toBe('Kopi');
    expect(Number(d.ringkasan.produk_terlaris.unit)).toBe(4);
    expect(Number(d.perubahan.omzet)).toBe(175);
    expect(Number(d.perubahan.transaksi)).toBe(100);
    expect(Number(d.perubahan.produk_terlaris_unit)).toBe(100);
    expect(d.tren.granularitas).toBe('harian');
    expect(d.tren.label).toHaveLength(7);
    expect(d.tren.omzet.slice(0, 2).map(Number)).toEqual([45000, 10000]);
  });
});

describe('F4 produk naik/turun', () => {
  it('rumus perubahan dan label', async () => {
    const rows: SaleRow[] = [];
    const add = (tgl: string, n: number, name: string, start: number) => {
      for (let i = 0; i < n; i++) rows.push(row(tgl, null, start + i, name, 1, 1000));
    };
    add('2026-10-02', 10, 'Naik', 0); add('2026-10-09', 15, 'Naik', 100);
    add('2026-10-02', 20, 'Turun', 200); add('2026-10-09', 10, 'Turun', 300);
    add('2026-10-02', 10, 'Stabil', 400); add('2026-10-09', 10, 'Stabil', 500);
    add('2026-10-09', 6, 'Baru', 600);
    rows.push(row('2026-10-02', null, 700, 'Sedikit', 2, 1000), row('2026-10-09', null, 701, 'Sedikit', 4, 1000));
    await insertSales(db, biz, rows);

    const res = await asUser(db, U1, () => call(db, 'analisis_produk', ...P));
    const p = Object.fromEntries(res.produk.map((x: any) => [x.nama, x]));
    expect(Number(p.Naik.perubahan)).toBe(50);
    expect(p.Naik.label).toBe('Naik');
    expect(Number(p.Turun.perubahan)).toBe(-50);
    expect(p.Turun.label).toBe('Turun');
    expect(p.Stabil.label).toBe('Stabil');
    expect(p.Baru.label).toBe('Produk Baru');
    expect(p.Sedikit.label).toBeNull();
    expect(Number(p.Sedikit.perubahan)).toBe(100);
  });
});

describe('F5 pola waktu', () => {
  it('heatmap dengan jam', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => row('2026-10-12', '08:10', i, 'Kopi', 1, 1000));
    rows.push(row('2026-10-12', '13:00', 10, 'Kopi', 1, 1000));
    await insertSales(db, biz, rows);
    const w = await asUser(db, U1, () => call(db, 'analisis_waktu', ...P));
    expect(w.punya_jam).toBe(true);
    expect(w.heatmap.hari[0]).toBe('Senin');
    expect(w.tersibuk[0]).toEqual({ hari: 'Senin', jam: '08.00–09.00', transaksi: 5 });
  });

  it('tanpa jam tetap tampil per hari', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => row('2026-10-12', null, i, 'Kopi', 1, 1000));
    rows.push(row('2026-10-13', null, 10, 'Kopi', 1, 1000));
    await insertSales(db, biz, rows);
    const w = await asUser(db, U1, () => call(db, 'analisis_waktu', ...P));
    expect(w.punya_jam).toBe(false);
    expect(w.heatmap).toBeNull();
    expect(w.per_hari).toHaveLength(7);
    expect(w.tersibuk[0].hari).toBe('Senin');
  });
});

describe('F6 bundling', () => {
  it('tanpa ID transaksi memberi penjelasan, bukan error', async () => {
    await insertSales(db, biz, Array.from({ length: 20 }, () => row('2026-10-10', null, null, 'Kopi', 1, 1000)));
    const b = await asUser(db, U1, () => call(db, 'analisis_bundling', ...P));
    expect(b.status).toBe('tanpa_id');
    expect(b.pesan).toContain('ID transaksi');
  });
});

describe('F7 menu engineering', () => {
  it('klasifikasi dan produk tanpa HPP', async () => {
    const rows: SaleRow[] = [];
    const add = (n: number, name: string, harga: number, start: number) => {
      for (let i = 0; i < n; i++) rows.push(row('2026-10-10', null, start + i, name, 1, harga));
    };
    add(40, 'A', 20000, 0); add(40, 'B', 10000, 100); add(5, 'C', 30000, 200); add(5, 'D', 8000, 300); add(5, 'E', 8000, 400);
    await insertSales(db, biz, rows);
    await db.query(`update public.products set hpp = v.h from (values ('A', 8000), ('B', 8000), ('C', 10000), ('D', 7000)) v(n, h)
                    where nama = v.n and business_id = $1`, [biz]);

    const m = await asUser(db, U1, () => call(db, 'analisis_menu', ...P));
    expect(Object.fromEntries(m.produk.map((x: any) => [x.nama, x.kategori]))).toEqual({ A: 'Star', B: 'Plowhorse', C: 'Puzzle', D: 'Dog' });
    expect(m.belum_lengkap.map((x: any) => x.nama)).toEqual(['E']);
    expect(m.belum_lengkap[0].status).toBe('belum lengkap');
    expect(Number(m.batas_popularitas)).toBeCloseTo(0.7 / 4, 4);
    const totalMargin = 40 * 12000 + 40 * 2000 + 5 * 20000 + 5 * 1000;
    expect(Number(m.batas_margin)).toBeCloseTo(totalMargin / 90, 2);
  });
});

describe('F1 multi-tenant (Row Level Security)', () => {
  it('pengguna lain tidak bisa membaca atau mengubah data usaha lain', async () => {
    await insertSales(db, biz, [row('2026-10-10', '09:00', 1, 'Kopi', 2, 18000)]);
    const biz2 = await createUser(db, U2, { nama: 'Budi', nama_usaha: 'Warung Budi' });

    await asUser(db, U2, async () => {
      expect((await db.query('select * from public.transactions')).rows).toHaveLength(0);
      expect((await db.query('select * from public.uploads')).rows).toHaveLength(0);
      expect((await db.query('select * from public.businesses')).rows.map((r: any) => Number(r.id))).toEqual([biz2]);
      const d = await call(db, 'analisis_dashboard', '2026-10-01', '2026-10-31');
      expect(Number(d.ringkasan.omzet)).toBe(0);
      // sales_rows membaca tanpa RLS demi kecepatan, jadi wajib menolak id usaha milik orang lain.
      const leak = await db.query('select * from public.sales_rows($1, $2, $3)', [biz, '2026-01-01', '2026-12-31']);
      expect(leak.rows).toHaveLength(0);
      const del = await db.query('delete from public.products where business_id = $1', [biz]);
      expect(del.affectedRows ?? 0).toBe(0);
      await expect(db.query(`insert into public.uploads (business_id, nama_file) values ($1, 'x.csv')`, [biz])).rejects.toThrow();
    });

    await asUser(db, U1, async () => {
      const d = await call(db, 'analisis_dashboard', '2026-10-01', '2026-10-31');
      expect(Number(d.ringkasan.omzet)).toBe(36000);
    });
  });

  it('pengguna tidak bisa menaikkan dirinya ke Pro atau admin', async () => {
    await asUser(db, U1, async () => {
      const s = await db.query(`update public.subscriptions set paket = 'pro'`);
      expect(s.affectedRows ?? 0).toBe(0);
      await expect(db.query(`update public.profiles set role = 'admin' where id = $1`, [U1])).rejects.toThrow();
    });
  });
});
