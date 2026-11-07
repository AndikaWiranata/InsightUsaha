'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from './icon';

type Msg = { role: 'user' | 'bot' | 'note'; text: string; retry?: string };
const STARTERS = ['Menu apa yang paling laku bulan ini?', 'Produk mana yang penjualannya turun?', 'Kapan waktu paling sepi untuk promo?', 'Paket bundling apa yang cocok aku buat?'];
const STORE = 'iu-chat';

/** Bersihkan sisa markdown dari model: **tebal** dan butir "* " / "- " menjadi "• ". */
const tidy = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^[ \t]*[*-][ \t]+/gm, '• ');

/** Chatbot "Tanya data" (F12). Riwayat disimpan di sessionStorage tab ini (12 pesan terakhir). */
export function Chat() {
  const qs = useSearchParams();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');
  const [periodNote, setPeriodNote] = useState('Jawaban dari hasil analisis periode yang sedang kamu buka.');
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);

  const [loaded, setLoaded] = useState(false);
  // Riwayat dibaca saat panel pertama kali dibuka (panel selalu tertutup di render awal).
  const openPanel = () => {
    if (!loaded) {
      try { setMsgs(JSON.parse(sessionStorage.getItem(STORE) ?? '[]')); } catch {}
      setLoaded(true);
    }
    setOpen(true);
  };
  useEffect(() => {
    if (!loaded) return;
    try { sessionStorage.setItem(STORE, JSON.stringify(msgs.filter((m) => m.role !== 'note').slice(-12))); } catch {}
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [msgs, loaded]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const close = () => { setOpen(false); setTimeout(() => openRef.current?.focus(), 0); };

  async function send(question: string, echo = true) {
    if (busy) return;
    setErr('');
    const history = msgs.filter((m) => m.role !== 'note').slice(-12).map((m) => ({ role: m.role, text: m.text }));
    if (echo) setMsgs((m) => [...m, { role: 'user', text: question }]);
    setBusy(true);
    try {
      const r = await fetch('/api/tanya', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pesan: question, riwayat: history, periode: qs.get('periode'), mulai: qs.get('mulai'), selesai: qs.get('selesai') }),
        signal: AbortSignal.timeout(60_000),
      });
      const d = await r.json().catch(() => ({}));
      if (d.periode) setPeriodNote(`Menjawab dari periode ${d.periode}.`);
      if (r.status === 429) setMsgs((m) => [...m, { role: 'note', text: 'Terlalu banyak pertanyaan. Tunggu sebentar.' }]);
      else if (d.status === 'ok' || d.status === 'tanpa_data') setMsgs((m) => [...m, { role: 'bot', text: tidy(d.jawaban) }]);
      else if (d.status === 'ditolak') setMsgs((m) => [...m, { role: 'note', text: 'Aku belum bisa menjawab ini dengan angka yang pasti dari analisis. Coba tanyakan dengan cara lain.' }]);
      else if (d.status === 'nonaktif') setMsgs((m) => [...m, { role: 'note', text: 'Fitur tanya data belum aktif karena API AI belum diatur.' }]);
      else setMsgs((m) => [...m, { role: 'note', text: d.pesan ?? 'Jawaban gagal dibuat.', retry: question }]);
    } catch {
      setMsgs((m) => [...m, { role: 'note', text: 'Koneksi bermasalah.', retry: question }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  const submit = () => {
    const q = input.trim();
    if (!q) { setErr('Tulis pertanyaan dulu.'); inputRef.current?.focus(); return; }
    setInput('');
    send(q);
  };

  return (
    <div data-chat>
      {!open && (
        <button ref={openRef} type="button" onClick={openPanel} aria-haspopup="dialog" aria-controls="chat-panel" aria-expanded={false} data-chat-open
                className="fixed right-4 bottom-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-surface hover:bg-ink-2 sm:right-6 sm:bottom-6">
          <Icon name="chat" /> Tanya data
        </button>
      )}
      {open && (
        // Satu-satunya panel yang mengambang di atas konten, jadi satu-satunya yang memakai bayangan (DESIGN.md).
        <section id="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title" onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
                 className="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col border-t border-line bg-surface shadow-[0_-8px_30px_rgb(0_0_0/0.18)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[min(600px,calc(100dvh-3rem))] sm:w-100 sm:rounded-card sm:border">
          <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 id="chat-title" className="font-bold">Tanya data penjualanmu</h2>
              <p className="text-sm text-muted">{periodNote}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              {msgs.length > 0 && <button type="button" className="btn-ghost px-2 text-sm" onClick={() => { setMsgs([]); inputRef.current?.focus(); }}>Mulai ulang</button>}
              <button type="button" className="btn-ghost px-2" onClick={close} aria-label="Tutup panel tanya data"><Icon name="close" /></button>
            </div>
          </header>
          <div ref={logRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite" aria-relevant="additions">
            {msgs.length === 0 && (
              <div>
                <p className="text-sm text-ink-2">Tanya apa saja soal penjualanmu, misalnya:</p>
                <ul className="mt-3 space-y-2">
                  {STARTERS.map((q) => (
                    <li key={q}><button type="button" disabled={busy} onClick={() => send(q)} data-chat-starter
                                        className="w-full rounded-control border border-line px-3 py-2.5 text-left text-sm hover:border-field hover:bg-paper">{q}</button></li>
                  ))}
                </ul>
              </div>
            )}
            {msgs.map((m, i) => m.role === 'note' ? (
              <div key={i} className="rounded-control border border-line bg-warn-soft px-3 py-2 text-sm text-warn-ink" role="alert">
                {m.text}{' '}
                {m.retry && <button type="button" className="font-semibold underline underline-offset-2" onClick={() => { setMsgs((x) => x.filter((_, j) => j !== i)); send(m.retry!, false); }}>Kirim ulang</button>}
              </div>
            ) : (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`whitespace-pre-line text-sm ${m.role === 'user'
                  ? 'max-w-[85%] rounded-card rounded-br-sm bg-ink px-3.5 py-2.5 text-surface'
                  : 'max-w-[90%] rounded-card rounded-bl-sm border border-line bg-paper px-3.5 py-2.5 text-ink'}`}>{m.text}</div>
              </div>
            ))}
            {busy && <div className="flex justify-start" role="status"><div className="rounded-card border border-line bg-paper px-3.5 py-2.5 text-sm text-muted">Sedang membaca angka analisis…</div></div>}
          </div>
          <form className="border-t border-line p-3" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <label htmlFor="chat-input" className="sr-only">Pertanyaan</label>
            <div className="flex items-end gap-2">
              <textarea ref={inputRef} id="chat-input" rows={1} maxLength={500} value={input} disabled={busy} placeholder="Tulis pertanyaan…"
                        className="input max-h-32 resize-none" onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
              <button type="submit" disabled={busy} className="btn-primary shrink-0 px-3" aria-label="Kirim pertanyaan"><Icon name="send" /></button>
            </div>
            <p className="mt-1.5 text-xs text-muted">Angka di jawaban diambil dari analisis. Data transaksi mentah tidak dikirim ke AI.</p>
            {err && <p className="error" role="alert">{err}</p>}
          </form>
        </section>
      )}
    </div>
  );
}
