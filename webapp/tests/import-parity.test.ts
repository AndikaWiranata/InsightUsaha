// Jalur impor yang dipakai aplikasi (pembersih TypeScript + import_chunk per 2000 baris) harus menghasilkan
// angka yang sama dengan versi Python pada file contoh lengkap.
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import { cleanRows, dropBlankRows, suggestMapping, type Cell } from '@/lib/import/parse';
import { asUser, call, createUser, freshDb } from './db';

const U = '00000000-0000-0000-0000-0000000000bb';
const ref = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'python-reference.json'), 'utf8'));

it('impor bertahap file contoh menghasilkan dashboard yang sama dengan Python', async () => {
  const db = await freshDb();
  await createUser(db, U, { nama_usaha: 'Kedai' });
  const csv = readFileSync(join(__dirname, 'fixtures', 'contoh-penjualan.csv'), 'utf8');
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  const clean = cleanRows(dropBlankRows(parsed.data as Record<string, Cell>[]), suggestMapping(parsed.meta.fields ?? []));

  await asUser(db, U, async () => {
    const r = clean.ringkasan;
    const id = await call(db, 'import_start', 'contoh.csv', 'baru', r.tanggal_mulai, r.tanggal_selesai);
    for (let i = 0; i < clean.baris.length; i += 2000) {
      const rows = clean.baris.slice(i, i + 2000).map((x, j) => ({ no: i + j, ...x }));
      await call(db, 'import_chunk', id, JSON.stringify(rows));
    }
    const valid = await call(db, 'import_finish', id, JSON.stringify(r), '[]');
    expect(Number(valid)).toBe(ref.baris.tanggal.length);

    for (const k of Object.keys(ref.periode)) {
      const p = ref.periode_tanggal[k];
      const d = await call<any>(db, 'analisis_dashboard', p.mulai, p.selesai);
      const py = ref.periode[k].dashboard;
      expect(Number(d.ringkasan.omzet), `omzet periode ${k}`).toBe(py.ringkasan.omzet);
      expect(Number(d.ringkasan.transaksi), `transaksi periode ${k}`).toBe(py.ringkasan.transaksi);
      expect(d.tren.omzet.map(Number), `tren periode ${k}`).toEqual(py.tren.omzet);
    }
  });
}, 600_000);
