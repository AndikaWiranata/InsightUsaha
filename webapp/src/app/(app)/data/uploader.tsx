'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { cleanRows, FIELDS, missingRequired, REQUIRED, suggestMapping, type CleanResult, type Field, type Mapping } from '@/lib/import/parse';
import { FileError, MAX_BYTES, readSalesFile, type Table } from '@/lib/import/read-file';
import * as F from '@/lib/format';
import { Icon } from '@/components/icon';

const LABELS: Record<Field, string> = {
  tanggal: 'Tanggal', jam: 'Jam', id_transaksi: 'ID transaksi', nama_produk: 'Nama produk',
  kategori: 'Kategori', jumlah: 'Jumlah', harga_satuan: 'Harga satuan',
};
const CHUNK = 2000;

type Step =
  | { s: 'pilih' }
  | { s: 'petakan'; file: File; table: Table; mapping: Mapping }
  | { s: 'konflik'; file: File; clean: CleanResult }
  | { s: 'proses'; done: number; total: number }
  | { s: 'hasil'; clean: CleanResult; valid: number; mode: string }
  | { s: 'gagal'; pesan: string };

/** Impor di browser: baca file, cocokkan kolom, bersihkan, lalu kirim bertahap ke Supabase. File tidak dikirim ke server. */
export function Uploader() {
  const [step, setStep] = useState<Step>({ s: 'pilih' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFile(file: File | undefined) {
    setError('');
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) return setError('Format file tidak didukung. Gunakan file .xlsx atau .csv.');
    if (file.size > MAX_BYTES) return setError('Ukuran file maksimal 10 MB.');
    setBusy(true);
    try {
      const table = await readSalesFile(file);
      const mapping = suggestMapping(table.kolom);
      if (missingRequired(mapping).length) setStep({ s: 'petakan', file, table, mapping });
      else await prepare(file, table, mapping);
    } catch (e) {
      setError(e instanceof FileError ? e.message : `File tidak bisa dibaca: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function prepare(file: File, table: Table, mapping: Mapping) {
    const clean = cleanRows(table.baris, mapping);
    if (!clean.baris.length) {
      setStep({ s: 'gagal', pesan: 'Tidak ada baris valid di file ini. Periksa format tanggal, jumlah, dan harga.' });
      return;
    }
    const sb = supabaseBrowser();
    const { tanggal_mulai: a, tanggal_selesai: b } = clean.ringkasan;
    const { count } = await sb.from('transactions').select('id', { count: 'exact', head: true })
      .gte('waktu', a).lt('waktu', nextDay(b!));
    if (count) setStep({ s: 'konflik', file, clean });
    else await upload(file, clean, 'baru');
  }

  async function upload(file: File, clean: CleanResult, mode: string) {
    const sb = supabaseBrowser();
    const total = clean.baris.length;
    setStep({ s: 'proses', done: 0, total });
    const { data: id, error: e1 } = await sb.rpc('import_start', {
      p_nama_file: file.name, p_mode: mode, p_mulai: clean.ringkasan.tanggal_mulai, p_selesai: clean.ringkasan.tanggal_selesai,
    });
    if (e1) return setStep({ s: 'gagal', pesan: e1.message });
    try {
      for (let i = 0; i < total; i += CHUNK) {
        const rows = clean.baris.slice(i, i + CHUNK).map((r, j) => ({ no: i + j, ...r }));
        const { error } = await sb.rpc('import_chunk', { p_upload: id, p_rows: rows });
        if (error) throw new Error(error.message);
        setStep({ s: 'proses', done: Math.min(i + CHUNK, total), total });
      }
      const { data: valid, error } = await sb.rpc('import_finish', { p_upload: id, p_ringkasan: clean.ringkasan, p_ditolak: clean.ditolak });
      if (error) throw new Error(error.message);
      setStep({ s: 'hasil', clean, valid: Number(valid), mode });
      router.refresh();
    } catch (e) {
      await sb.rpc('import_fail', { p_upload: id, p_pesan: (e as Error).message });
      setStep({ s: 'gagal', pesan: `Gagal menyimpan data: ${(e as Error).message}` });
      router.refresh();
    }
  }

  const reset = () => { setStep({ s: 'pilih' }); setError(''); };

  if (step.s === 'petakan') return <MappingForm step={step} onCancel={reset} onSubmit={(m) => prepare(step.file, step.table, m)} />;
  if (step.s === 'konflik') return <ConflictForm step={step} onCancel={reset} onSubmit={(mode) => upload(step.file, step.clean, mode)} />;
  if (step.s === 'proses') {
    const pct = Math.round((step.done / step.total) * 100);
    return (
      <div>
        <div className="flex items-center justify-between"><span className="font-bold" id="progres-label">Menyimpan data…</span><span className="text-muted tabular">{pct}%</span></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-labelledby="progres-label" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 text-sm text-muted">{F.number(step.done)} dari {F.number(step.total)} baris. Jangan tutup tab ini sampai selesai.</p>
      </div>
    );
  }
  if (step.s === 'hasil') return <Result step={step} onAgain={reset} />;
  if (step.s === 'gagal') {
    return (
      <div className="rounded-control border border-bad/40 bg-bad-soft p-4 text-sm text-bad-ink" role="alert">
        <p className="font-bold">Impor gagal</p>
        <p className="mt-1">{step.pesan}</p>
        <button type="button" className="btn-secondary mt-3" onClick={reset}>Pilih file lain</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label htmlFor="file" className="flex min-h-36 flex-col items-center justify-center rounded-card border-2 border-dashed border-field bg-paper px-4 py-6 text-center hover:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink">
        <Icon name="upload" className="h-7 w-7 text-brand" />
        <span className="mt-2 font-bold">{busy ? 'Membaca file…' : 'Pilih file .xlsx atau .csv'}</span>
        <span className="mt-0.5 text-sm text-muted">Maksimal 10 MB atau 50.000 baris</span>
        <input ref={inputRef} id="file" type="file" accept=".csv,.xlsx" className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <details>
        <summary className="text-sm font-semibold text-brand">Kolom apa saja yang dibaca?</summary>
        <ColumnTable />
      </details>
    </div>
  );
}

function nextDay(d: string) {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

function MappingForm({ step, onCancel, onSubmit }: { step: Extract<Step, { s: 'petakan' }>; onCancel: () => void; onSubmit: (m: Mapping) => void }) {
  const [m, setM] = useState<Mapping>(step.mapping);
  const [err, setErr] = useState('');
  const submit = () => {
    const missing = missingRequired(m);
    if (missing.length) return setErr(`Kolom wajib belum dipilih: ${missing.map((f) => LABELS[f]).join(', ')}`);
    const used = Object.values(m).filter(Boolean);
    if (used.length !== new Set(used).size) return setErr('Satu kolom file tidak boleh dipakai untuk dua isian berbeda.');
    onSubmit(m);
  };
  return (
    <div>
      <h3 className="font-bold">Cocokkan kolom file</h3>
      <p className="mt-1 text-sm text-ink-2">Beberapa kolom di <strong className="text-ink">{step.file.name}</strong> tidak dikenali otomatis. Pilih kolom yang berisi tiap data.</p>
      <div className="mt-4 space-y-3">
        {FIELDS.map((f) => {
          const req = REQUIRED.includes(f);
          return (
            <div key={f}>
              <label className="label" htmlFor={`m-${f}`}>{LABELS[f]} <span className="font-normal text-muted">({req ? 'wajib' : 'opsional'})</span></label>
              <select id={`m-${f}`} className="input" value={m[f] ?? ''} onChange={(e) => setM({ ...m, [f]: e.target.value || null })}>
                <option value="">{req ? 'Pilih kolom' : 'Tidak ada'}</option>
                {step.table.kolom.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          );
        })}
      </div>
      <details className="mt-4">
        <summary className="text-sm font-semibold text-brand">Lihat lima baris pertama file</summary>
        <div className="table-wrap mt-2">
          <table className="table">
            <thead><tr>{step.table.kolom.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{step.table.baris.slice(0, 5).map((r, i) => (
              <tr key={i}>{step.table.kolom.map((c) => <td key={c} className="whitespace-nowrap">{String(r[c] ?? '')}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      </details>
      {err && <p className="error mt-3" role="alert">{err}</p>}
      <p className="help mt-3">Tanpa kolom jam, jam ramai hanya per hari. Tanpa nomor transaksi, pasangan menu tidak bisa dihitung.</p>
      <div className="mt-4 flex gap-2">
        <button type="button" className="btn-primary" onClick={submit}>Proses data</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Batal</button>
      </div>
    </div>
  );
}

function ConflictForm({ step, onCancel, onSubmit }: { step: Extract<Step, { s: 'konflik' }>; onCancel: () => void; onSubmit: (mode: string) => void }) {
  const [mode, setMode] = useState('ganti');
  const r = step.clean.ringkasan;
  const opts: [string, string, string][] = [
    ['ganti', 'Ganti data lama', 'Data lama di rentang tanggal ini dihapus, lalu diganti isi file baru. Pilih ini kalau file baru adalah versi yang sudah dibetulkan.'],
    ['gabung', 'Gabungkan', 'Data baru ditambahkan. Baris yang sama persis (nomor transaksi, menu, jumlah, harga) dilewati supaya tidak dobel.'],
  ];
  return (
    <div>
      <h3 className="font-bold">Sudah ada data di tanggal yang sama</h3>
      <p className="mt-1 text-sm text-ink-2">
        File <strong className="text-ink">{step.file.name}</strong> berisi data {F.date(r.tanggal_mulai)} – {F.date(r.tanggal_selesai)}.
        Sebagian tanggal itu sudah terisi dari unggahan sebelumnya.
      </p>
      <fieldset className="mt-4 space-y-3">
        <legend className="label">Mau diapakan?</legend>
        {opts.map(([v, t, d]) => (
          <label key={v} className="flex gap-3 rounded-card border border-line bg-surface p-4 hover:border-field has-[:checked]:border-2 has-[:checked]:border-ink">
            <input type="radio" name="mode" value={v} checked={mode === v} onChange={() => setMode(v)} className="mt-1 h-4 w-4 accent-[var(--c-ink)]" />
            <span><span className="block font-bold">{t}</span><span className="text-sm text-ink-2">{d}</span></span>
          </label>
        ))}
      </fieldset>
      <div className="mt-4 flex gap-2">
        <button type="button" className="btn-primary" onClick={() => onSubmit(mode)}>Lanjutkan</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Batalkan unggahan</button>
      </div>
    </div>
  );
}

function Result({ step, onAgain }: { step: Extract<Step, { s: 'hasil' }>; onAgain: () => void }) {
  const r = step.clean.ringkasan;
  const skipped = r.jumlah_baris_valid - step.valid;
  return (
    <div>
      <p className="text-lg font-bold"><span className="stabilo">{F.number(step.valid)} baris</span> masuk, data {F.date(r.tanggal_mulai)} sampai {F.date(r.tanggal_selesai)}.</p>
      <dl className="mt-4 grid gap-2 border-t border-line pt-3 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-2"><dt className="text-muted">Ditolak</dt><dd className={`font-bold tabular ${r.jumlah_baris_ditolak ? 'text-bad' : ''}`}>{F.number(r.jumlah_baris_ditolak)} baris</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted">Duplikat dihapus</dt><dd className="font-bold tabular">{F.number(r.duplikat_dihapus + Math.max(skipped, 0))} baris</dd></div>
      </dl>
      <ul className="mt-3 space-y-1 text-sm text-ink-2">
        <li>{r.punya_jam ? 'Ada kolom jam: tabel hari × jam tersedia.' : 'Tidak ada kolom jam: jam ramai hanya ditampilkan per hari.'}</li>
        <li>{r.punya_id_transaksi ? 'Ada nomor transaksi: pasangan menu bisa dihitung.' : 'Tidak ada nomor transaksi: pasangan menu tidak bisa dihitung.'}</li>
      </ul>
      {r.jumlah_baris_ditolak > 0 && (
        <details className="mt-3">
          <summary className="text-sm font-semibold text-brand">Lihat baris yang dilewati</summary>
          <ul className="mt-2 flex flex-wrap gap-2">
            {Object.entries(r.alasan_ditolak).map(([k, n]) => <li key={k} className="tag bg-bad-soft text-bad-ink">{k}: {F.number(n)}</li>)}
          </ul>
          <div className="table-wrap mt-2 max-h-60 overflow-y-auto">
            <table className="table"><thead><tr><th>Baris ke-</th><th>Alasan</th></tr></thead>
              <tbody>{step.clean.ditolak.map((d) => <tr key={d.baris}><td className="tabular">{d.baris}</td><td>{d.alasan}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <a href="/dashboard" className="btn-primary">Lihat ringkasan penjualan</a>
        <button type="button" className="btn-secondary" onClick={onAgain}>Unggah file lain</button>
      </div>
    </div>
  );
}

function ColumnTable() {
  const rows: [string, string, boolean, string][] = [
    ['tanggal', '2026-10-01', true, 'Semua analisis'], ['jam', '08:15', false, 'Jam ramai'], ['id_transaksi', 'TRX001', false, 'Pasangan menu'],
    ['nama_produk', 'Kopi Susu', true, 'Analisis menu'], ['kategori', 'Minuman', false, 'Pengelompokan'],
    ['jumlah', '2', true, 'Jumlah terjual'], ['harga_satuan', '18000', true, 'Omzet dan untung'],
  ];
  return (
    <>
      <div className="table-wrap mt-3">
        <table className="table">
          <thead><tr><th>Kolom</th><th>Contoh</th><th>Perlu?</th><th>Dipakai untuk</th></tr></thead>
          <tbody>{rows.map(([c, ex, req, use]) => (
            <tr key={c}><td><code className="text-sm">{c}</code></td><td className="text-ink-2">{ex}</td>
              <td className={req ? 'font-bold' : 'text-muted'}>{req ? 'Wajib' : 'Opsional'}</td><td className="text-ink-2">{use}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <p className="help mt-2">Nama kolom berbeda? Tidak masalah, kamu bisa mencocokkan kolomnya setelah memilih file.</p>
    </>
  );
}
