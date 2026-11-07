// Skenario F2 sama dengan analytics/tests/test_analysis.py, ditambah kesetaraan dengan Python pada file contoh.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import { cleanRows, dropBlankRows, missingRequired, parseDate, parseNumber, suggestMapping, type Cell } from '@/lib/import/parse';

function fromCsv(text: string) {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: true });
  const baris = dropBlankRows(res.data as Record<string, Cell>[]);
  return { kolom: res.meta.fields ?? [], baris };
}

const CSV = `tanggal,jam,id_transaksi,nama_produk,kategori,jumlah,harga_satuan
2026-10-01,08:15,TRX001,Kopi Susu Gula Aren,Minuman,2,18000
2026-10-01,08:15,TRX001,Croissant,Makanan,1,22000
2026-10-01,09:40,TRX002,Americano,Minuman,1,15000
2026-10-01,09:40,TRX002,americano ,Minuman,1,15000
,10:00,TRX003,Americano,Minuman,1,15000
2026-13-40,10:00,TRX004,Americano,Minuman,1,15000
2026-10-02,10:00,TRX005,Americano,Minuman,abc,15000
2026-10-02,10:30,TRX006,Croissant,Makanan,1,22000
,,,,,,
2026-10-01,08:15,TRX001,Croissant,Makanan,1,22000
`;

describe('F2 pembersihan data', () => {
  it('baris tidak valid dilewati dan dilaporkan, bukan menggagalkan impor', () => {
    const t = fromCsv(CSV);
    const res = cleanRows(t.baris, suggestMapping(t.kolom));
    const s = res.ringkasan;
    expect(s.jumlah_baris_valid).toBe(4);
    expect(s.duplikat_dihapus).toBe(2);
    expect(s.jumlah_baris_ditolak).toBe(3);
    expect(s.alasan_ditolak['Tanggal kosong atau tidak valid']).toBe(2);
    expect(s.alasan_ditolak['Jumlah harus angka bulat lebih dari 0']).toBe(1);
    expect(new Set(res.ditolak.map((r) => r.baris))).toEqual(new Set([6, 7, 8]));
    expect([s.tanggal_mulai, s.tanggal_selesai]).toEqual(['2026-10-01', '2026-10-02']);
  });

  it('nama produk diseragamkan', () => {
    const t = fromCsv(CSV);
    const res = cleanRows(t.baris, suggestMapping(t.kolom));
    expect(new Set(res.baris.map((r) => r.nama_produk))).toEqual(new Set(['Kopi Susu Gula Aren', 'Croissant', 'Americano']));
  });

  it('pemetaan kolom dengan nama berbeda dan format Indonesia', () => {
    const m = suggestMapping(['Tgl', 'Nama Menu', 'Qty', 'Harga']);
    expect([m.tanggal, m.nama_produk, m.jumlah, m.harga_satuan]).toEqual(['Tgl', 'Nama Menu', 'Qty', 'Harga']);
    const res = cleanRows([{ Tgl: '01/10/2026', 'Nama Menu': 'Es Teh', Qty: '3', Harga: '5.000' }], m);
    expect(res.baris[0].tanggal).toBe('2026-10-01');
    expect(res.baris[0].harga_satuan).toBe(5000);
  });

  it('kolom wajib yang kurang dilaporkan', () => {
    expect(new Set(missingRequired(suggestMapping(['a', 'b'])))).toEqual(new Set(['tanggal', 'nama_produk', 'jumlah', 'harga_satuan']));
  });

  it('nilai dari Excel (tanggal Date dan nomor seri) dibaca benar', () => {
    expect(parseDate(new Date(Date.UTC(2026, 9, 1)))).toEqual(['2026-10-01', null]);
    expect(parseDate(46296)).toEqual(['2026-10-01', null]);
    expect(parseNumber('Rp18.000')).toBe(18000);
    expect(parseNumber('1.250,50')).toBe(1250.5);
    expect(parseNumber('18,000.00')).toBe(18000);
  });
});

describe('kesetaraan dengan Python pada file contoh', () => {
  it('baris hasil pembersihan sama persis dengan versi Python', () => {
    const ref = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'python-reference.json'), 'utf8')).baris;
    const t = fromCsv(readFileSync(join(__dirname, 'fixtures', 'contoh-penjualan.csv'), 'utf8'));
    const res = cleanRows(t.baris, suggestMapping(t.kolom));
    expect(res.baris.length).toBe(ref.tanggal.length);
    for (const f of ['tanggal', 'jam', 'id_transaksi', 'nama_produk', 'kategori', 'jumlah', 'harga_satuan'] as const) {
      expect(res.baris.map((r) => r[f])).toEqual(ref[f]);
    }
    expect(res.ringkasan.jumlah_baris_ditolak).toBe(2);
  });
});
