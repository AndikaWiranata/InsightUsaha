'use client';

import { useState } from 'react';
import { readSalesFile } from '@/lib/import/read-file';
import { parseNumber } from '@/lib/import/parse';
import { saveHpp } from './actions';

/** File HPP (kolom nama_produk + hpp) dibaca di browser, dicocokkan ke menu yang ada, lalu disimpan lewat form yang sama. */
export function HppUpload({ products }: { products: { id: number; nama: string }[] }) {
  const [msg, setMsg] = useState<{ tone: 'bad' | 'good'; text: string } | null>(null);

  async function onFile(file?: File) {
    setMsg(null);
    if (!file) return;
    try {
      const t = await readSalesFile(file);
      const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const nameCol = t.kolom.find((c) => ['nama_produk', 'produk'].includes(norm(c)));
      const hppCol = t.kolom.find((c) => norm(c) === 'hpp');
      if (!nameCol || !hppCol) return setMsg({ tone: 'bad', text: 'File HPP harus punya kolom "nama_produk" dan "hpp".' });
      const byName = new Map(products.map((p) => [p.nama.toLowerCase(), p.id]));
      const form = new FormData();
      const unknown: string[] = [];
      for (const r of t.baris) {
        const name = String(r[nameCol] ?? '').replace(/\s+/g, ' ').trim();
        const v = parseNumber(r[hppCol]);
        if (!name || v === null) continue;
        const id = byName.get(name.toLowerCase());
        if (id) form.set(`hpp-${id}`, String(v)); else unknown.push(name);
      }
      if (![...form.keys()].length) return setMsg({ tone: 'bad', text: 'Tidak ada nama menu di file yang cocok dengan menu di data penjualan.' });
      if (unknown.length) setMsg({ tone: 'good', text: `Menu tidak dikenal dilewati: ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? ', …' : ''}.` });
      await saveHpp(form);
    } catch (e) {
      setMsg({ tone: 'bad', text: (e as Error).message });
    }
  }

  return (
    <div className="mt-4 rounded-control border border-dashed border-field p-3">
      <label htmlFor="file_hpp" className="label">Atau unggah file HPP</label>
      <input id="file_hpp" type="file" accept=".csv,.xlsx" onChange={(e) => onFile(e.target.files?.[0])}
             className="block w-full max-w-full text-sm file:mr-3 file:min-h-11 file:rounded-control file:border file:border-field file:bg-surface file:px-3 file:font-semibold file:text-ink" />
      <p className="help">Kolom <code>nama_produk</code> dan <code>hpp</code>. Unduh daftar menu di atas, isi kolom hpp, lalu unggah.</p>
      {msg && <p className={msg.tone === 'bad' ? 'error' : 'help'} role={msg.tone === 'bad' ? 'alert' : 'status'}>{msg.text}</p>}
    </div>
  );
}
