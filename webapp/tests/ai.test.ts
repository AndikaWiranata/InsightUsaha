// F8/F12: pengecekan angka jawaban AI dan fakta agregat (sama dengan tes versi Laravel).
import { describe, expect, it } from 'vitest';
import { allowedNumbers, foreignNumbers, leakedFieldNames } from '@/lib/ai/numbers';
import { buildFacts } from '@/lib/ai/facts';
import * as F from '@/lib/format';

describe('pengecekan angka AI', () => {
  const facts = {
    omzet_teks: 'Rp1.250.000', perubahan_omzet_teks: '+12,5%', waktu_tersibuk: ['Sabtu jam 08.00–09.00'],
    produk_terlaris: { nama: 'Kopi', unit_teks: '120 unit' },
  };
  const allowed = allowedNumbers(facts);

  it('menerima angka yang ada di fakta', () => {
    expect(foreignNumbers(['Omzet kamu Rp1.250.000, naik +12,5%.', 'Kopi terjual 120 unit, paling ramai Sabtu jam 08.00–09.00.'], allowed)).toEqual([]);
  });

  it('menolak jawaban yang menyalin nama field, bukan nilainya', () => {
    expect(leakedFieldNames(['Omzet kamu mencapai omzet_teks dengan perubahan_omzet_teks.'])).toEqual(['omzet_teks', 'perubahan_omzet_teks']);
    expect(leakedFieldNames(['Omzet kamu Rp1.250.000, naik +12,5%.'])).toEqual([]);
  });

  it('menolak angka karangan', () => {
    expect(new Set(foreignNumbers(['Omzet kamu Rp1.300.000 dan naik 15%.', 'Diskon 20% di jam sepi.'], allowed)))
      .toEqual(new Set(['1300000', '15', '20']));
  });
});

describe('fakta agregat', () => {
  it('hanya angka ringkasan, tanpa baris atau kode transaksi', () => {
    const ringkasan = { omzet: 1000, transaksi: 2, rata_rata_transaksi: 500, unit_terjual: 3, produk_terlaris: null };
    const facts = buildFacts({
      dashboard: { ringkasan, ringkasan_lalu: ringkasan, perubahan: { omzet: 10, transaksi: null, rata_rata_transaksi: null, produk_terlaris_unit: null },
                   tren: { granularitas: 'harian', label: [], omzet: [], transaksi: [] } },
      produk: { produk: [], jumlah_label: {}, naik_teratas: [], turun_teratas: [], baru: [] },
    }, { start: '2026-10-01', end: '2026-10-07', preset: '7' });
    const json = JSON.stringify(facts);
    expect(json).not.toContain('TRX');
    expect(facts['Omzet']).toBe('Rp1.000');
    expect(facts['Perubahan omzet']).toBe('+10%');
    // Kunci berupa kata biasa, bukan nama_field yang bisa tersalin ke jawaban.
    expect(Object.keys(facts).some((k) => /_/.test(k))).toBe(false);
  });
});

describe('format Indonesia', () => {
  it('rupiah, angka, persen, tanggal', () => {
    expect(F.rupiah(90237000)).toBe('Rp90.237.000');
    expect(F.number(83.5, 1)).toBe('83,5');
    expect(F.percent(-0.1)).toBe('−0,1%');
    expect(F.percent(25.9)).toBe('+25,9%');
    expect(F.date('2026-10-02')).toBe('2 Okt 2026');
  });
});
