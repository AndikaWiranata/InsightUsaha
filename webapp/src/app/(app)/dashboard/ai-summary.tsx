'use client';

import { useEffect, useState } from 'react';

type Res = { status: string; periode?: string; temuan?: string[]; saran?: string[]; umpan_balik?: string | null };

/** Dimuat terpisah agar halaman tetap tampil cepat walau API AI lambat atau gagal (F8). */
export function AiSummary({ query }: { query: string }) {
  // Hasil disimpan bersama kunci permintaannya; hasil untuk periode/percobaan lain dianggap "sedang dimuat".
  const [attempt, setAttempt] = useState(0);
  const key = `${query}#${attempt}`;
  const [state, setState] = useState<{ key: string; res: Res } | null>(null);
  const [fb, setFb] = useState<string | null>(null);
  const res = state?.key === key ? state.res : null;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/ringkasan?${query}`, { signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(90_000)]) })
      .then((r) => r.json()).then((j: Res) => { setState({ key, res: j }); setFb(j.umpan_balik ?? null); })
      .catch((e) => { if (e.name !== 'AbortError' || !ctrl.signal.aborted) setState({ key, res: { status: 'gagal' } }); });
    return () => ctrl.abort();
  }, [query, key]);

  const send = async (nilai: string) => {
    const r = await fetch('/api/ringkasan/umpan-balik', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ periode: res?.periode, nilai }) });
    if (r.ok) setFb(nilai);
  };

  if (!res) return <p className="mt-3 text-sm text-muted" role="status">Menyusun ringkasan dari angka di atas…</p>;
  if (res.status !== 'ok') {
    return (
      <p className="mt-3 text-sm text-ink-2">
        Ringkasan belum tersedia. Angka di halaman ini tetap bisa kamu pakai.{' '}
        <button type="button" className="font-semibold text-brand underline underline-offset-2" onClick={() => setAttempt(attempt + 1)}>Coba lagi</button>
      </p>
    );
  }
  return (
    <div className="mt-3">
      <h3 className="text-sm font-bold">Yang terjadi</h3>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm marker:text-muted">{res.temuan!.map((t) => <li key={t}>{t}</li>)}</ul>
      <h3 className="mt-5 text-sm font-bold">Yang bisa kamu lakukan</h3>
      <ol className="mt-2 space-y-2 text-sm">
        {res.saran!.map((t, i) => <li key={t} className="flex gap-2.5"><span className="font-extrabold text-brand tabular">{i + 1}.</span><span>{t}</span></li>)}
      </ol>
      <div className="mt-5 border-t border-line pt-3" data-ai-feedback>
        <p className="text-sm text-ink-2">Ringkasan ini membantu?</p>
        <div className="mt-2 flex gap-2">
          {[['membantu', 'Membantu'], ['tidak_membantu', 'Tidak membantu']].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={fb === v} onClick={() => send(v)}
                    className="btn-secondary aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-surface">{l}</button>
          ))}
        </div>
        {fb && <p className="mt-2 text-sm text-good" role="status">Terima kasih, masukanmu tercatat.</p>}
      </div>
    </div>
  );
}
