// Impor lewat fungsi database (F2): kiriman bertahap, mode ganti/gabung, kuota Gratis, dan larangan menulis tabel langsung.
import { beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, call, createUser, freshDb } from './db';

const U1 = '00000000-0000-0000-0000-000000000001';
const U2 = '00000000-0000-0000-0000-000000000002';
let db: PGlite;
let biz: number;

type Row = { no: number; tanggal: string; jam: string | null; id_transaksi: string | null; nama_produk: string;
  kategori: string | null; jumlah: number; harga_satuan: number; hash: string };
const r = (no: number, tanggal: string, kode: string | null, produk: string, jumlah = 1, harga = 10000, jam: string | null = '08:00'): Row =>
  ({ no, tanggal, jam, id_transaksi: kode, nama_produk: produk, kategori: null, jumlah, harga_satuan: harga,
     hash: `${tanggal}|${jam ?? ''}|${kode ?? ''}|${produk.toLowerCase()}|${jumlah}|${harga}.0` });

async function importRows(uid: string, rows: Row[], mode = 'baru', chunk = 1000) {
  return asUser(db, uid, async () => {
    const dates = rows.map((x) => x.tanggal).sort();
    const id = await call<number>(db, 'import_start', 'jual.csv', mode, dates[0], dates[dates.length - 1]);
    for (let i = 0; i < rows.length; i += chunk) await call(db, 'import_chunk', id, JSON.stringify(rows.slice(i, i + chunk)));
    const valid = await call<number>(db, 'import_finish', id, JSON.stringify({ jumlah_baris_valid: rows.length, jumlah_baris_ditolak: 1 }), '[]');
    return { id: Number(id), valid };
  });
}

const count = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0].n);

beforeEach(async () => {
  db = await freshDb();
  biz = await createUser(db, U1, { nama_usaha: 'Kedai Rina' });
  await db.query(`update public.subscriptions set paket = 'pro', berakhir = now() + interval '30 days' where business_id = $1`, [biz]);
});

describe('import', () => {
  it('struk yang terbagi ke dua kiriman tetap satu transaksi', async () => {
    const rows = [r(2, '2026-10-01', 'T1', 'Kopi'), r(3, '2026-10-01', 'T1', 'Roti'), r(4, '2026-10-01', null, 'Kopi'), r(5, '2026-10-01', null, 'Kopi')];
    const { valid } = await importRows(U1, rows, 'baru', 1);
    expect(Number(valid)).toBe(4);
    expect(await count('select count(*) n from public.transactions')).toBe(3); // T1 + dua baris tanpa kode
    expect(await count(`select count(*) n from public.products where business_id = ${biz}`)).toBe(2);
  });

  it('mode gabung melewati baris yang sama persis; mode ganti mengganti data di rentang yang sama', async () => {
    const rows = [r(2, '2026-10-01', 'T1', 'Kopi'), r(3, '2026-10-02', 'T2', 'Roti')];
    await importRows(U1, rows);
    const merged = await importRows(U1, [...rows, r(4, '2026-10-02', 'T3', 'Teh')], 'gabung');
    expect(Number(merged.valid)).toBe(1);
    expect(await count('select count(*) n from public.transaction_items')).toBe(3);

    await importRows(U1, [r(2, '2026-10-01', 'X1', 'Kopi', 5)], 'ganti');
    // Hanya tanggal 1 Okt yang diganti; transaksi 2 Okt tetap.
    expect(await count(`select count(*) n from public.transactions where waktu::date = '2026-10-01'`)).toBe(1);
    expect(await count(`select count(*) n from public.transactions where waktu::date = '2026-10-02'`)).toBe(2);
  });

  it('paket Gratis hanya 1 unggahan per bulan', async () => {
    await db.query(`update public.subscriptions set paket = 'gratis' where business_id = $1`, [biz]);
    await importRows(U1, [r(2, '2026-10-01', 'T1', 'Kopi')]);
    await expect(importRows(U1, [r(2, '2026-10-05', 'T9', 'Kopi')])).rejects.toThrow(/1 unggahan per bulan/);
  });

  it('menulis tabel langsung ditolak; impor dan hapus hanya untuk usaha sendiri', async () => {
    const { id } = await importRows(U1, [r(2, '2026-10-01', 'T1', 'Kopi')]);
    await createUser(db, U2, {});
    await asUser(db, U2, async () => {
      await expect(db.query(`insert into public.uploads (business_id, nama_file) values ($1, 'x')`, [biz])).rejects.toThrow();
      await expect(call(db, 'import_chunk', id, JSON.stringify([r(9, '2026-10-01', 'Z', 'Racun')]))).rejects.toThrow(/tidak ditemukan/);
      await call(db, 'hapus_unggahan', id);
    });
    expect(await count('select count(*) n from public.transactions')).toBe(1);
    await asUser(db, U1, async () => {
      await expect(db.query(`insert into public.uploads (business_id, nama_file) values ($1, 'x')`, [biz])).rejects.toThrow();
      await call(db, 'hapus_unggahan', id);
    });
    expect(await count('select count(*) n from public.transactions')).toBe(0);
  });

  it('jumlah baris masuk dihitung dari database dan versi data naik', async () => {
    const before = await count(`select versi_data n from public.businesses where id = ${biz}`);
    const { id } = await importRows(U1, [r(2, '2026-10-01', 'T1', 'Kopi'), r(3, '2026-10-01', 'T1', 'Roti')]);
    const up = (await db.query<any>('select status, jumlah_baris_valid, jumlah_baris_ditolak from public.uploads where id = $1', [id])).rows[0];
    expect(up).toEqual({ status: 'selesai', jumlah_baris_valid: 2, jumlah_baris_ditolak: 1 });
    expect(await count(`select versi_data n from public.businesses where id = ${biz}`)).toBe(before + 1);
  });
});
