import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Pengganti minimal skema auth Supabase untuk tes lokal: auth.uid() membaca setelan sesi 'test.uid'.
const AUTH_STUB = `
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create role authenticated;
`;

export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  const dir = join(__dirname, '..', 'supabase', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  // Tes berjalan sebagai role biasa agar RLS benar-benar berlaku (superuser melewati RLS).
  await db.exec(`
    grant usage on schema public, auth to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant execute on all functions in schema public, auth to authenticated;
  `);
  return db;
}

export async function createUser(db: PGlite, uid: string, meta: Record<string, string> = {}): Promise<number> {
  await db.query('insert into auth.users (id, raw_user_meta_data) values ($1, $2)', [uid, JSON.stringify(meta)]);
  const r = await db.query<{ id: number }>('select id from public.businesses where user_id = $1', [uid]);
  return Number(r.rows[0].id);
}

/** Jalankan kueri sebagai pengguna tertentu, dengan RLS aktif. */
export async function asUser<T>(db: PGlite, uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set test.uid = '${uid}'; set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role; reset test.uid;');
  }
}

export type SaleRow = { tanggal: string; jam: string | null; kode: string | null; produk: string; jumlah: number; harga: number };

/** Masukkan baris penjualan sebagai satu unggahan (dikelompokkan per tanggal+kode, tanpa kode = 1 baris 1 transaksi). */
export async function insertSales(db: PGlite, businessId: number, rows: SaleRow[]): Promise<void> {
  const up = await db.query<{ id: number }>(
    `insert into public.uploads (business_id, nama_file, status) values ($1, 'uji.csv', 'selesai') returning id`, [businessId]);
  const uploadId = Number(up.rows[0].id);

  const names = [...new Set(rows.map((r) => r.produk))];
  const pr = await db.query<{ id: number; nama: string }>(
    `insert into public.products (business_id, nama) select $1, unnest($2::text[]) returning id, nama`, [businessId, names]);
  const pid = new Map(pr.rows.map((r) => [r.nama, Number(r.id)]));

  const groups = new Map<string, SaleRow[]>();
  rows.forEach((r, i) => {
    const key = r.kode !== null ? `k|${r.tanggal}|${r.kode}` : `r|${i}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  });

  const trxValues: unknown[] = [];
  const firsts = [...groups.values()].map((g) => g[0]);
  firsts.forEach((f) => trxValues.push(f.kode, `${f.tanggal} ${f.jam ?? '00:00'}:00`, f.jam !== null));
  const CHUNK = 2000;
  const trxIds: number[] = [];
  for (let s = 0; s < firsts.length; s += CHUNK) {
    const part = firsts.slice(s, s + CHUNK);
    const params: unknown[] = [];
    const tuples = part.map((f, j) => {
      params.push(f.kode, `${f.tanggal} ${f.jam ?? '00:00'}:00`, f.jam !== null);
      return `(${businessId}, ${uploadId}, $${j * 3 + 1}, $${j * 3 + 2}::timestamp, $${j * 3 + 3}::boolean)`;
    });
    const r = await db.query<{ id: number }>(
      `insert into public.transactions (business_id, upload_id, kode_transaksi, waktu, punya_jam) values ${tuples.join(',')} returning id`, params);
    trxIds.push(...r.rows.map((x) => Number(x.id)));
  }

  const items: [number, number, number, number][] = [];
  [...groups.values()].forEach((g, gi) => g.forEach((r) => items.push([trxIds[gi], pid.get(r.produk)!, r.jumlah, r.harga])));
  for (let s = 0; s < items.length; s += CHUNK) {
    const part = items.slice(s, s + CHUNK);
    await db.query(
      `insert into public.transaction_items (transaction_id, product_id, jumlah, harga_satuan)
       select * from unnest($1::bigint[], $2::bigint[], $3::int[], $4::numeric[])`,
      [part.map((x) => x[0]), part.map((x) => x[1]), part.map((x) => x[2]), part.map((x) => x[3])]);
  }
  void trxValues;
}

export async function call<T = any>(db: PGlite, fn: string, ...args: unknown[]): Promise<T> {
  const ph = args.map((_, i) => `$${i + 1}`).join(', ');
  const r = await db.query<{ r: T }>(`select public.${fn}(${ph}) as r`, args);
  return r.rows[0].r;
}
