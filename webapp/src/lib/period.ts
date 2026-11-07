import * as F from './format';

/**
 * Periode analisis. Preset dihitung mundur dari tanggal data terakhir (bukan hari ini),
 * karena data yang diunggah UMKM sering berhenti beberapa hari sebelum tanggal unggah.
 */
export const PRESETS: Record<string, string> = { '7': '7 hari', '30': '30 hari', '90': '3 bulan', kustom: 'Rentang kustom' };

export type Period = { start: string; end: string; preset: string };
export type PeriodQuery = { periode?: string; mulai?: string; selesai?: string };

const toDate = (s: string) => new Date(s + 'T00:00:00Z');
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(new Date(toDate(s).getTime() + n * 86400000));
const valid = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toDate(s).getTime());

export function resolvePeriod(q: PeriodQuery, latestDataDate: string | null, minStart: string | null): Period {
  const anchor = latestDataDate ?? iso(new Date());
  let preset = q.periode ?? '30';
  let start: string, end: string;
  if (preset === 'kustom' && valid(q.mulai) && valid(q.selesai)) {
    [start, end] = q.mulai <= q.selesai ? [q.mulai, q.selesai] : [q.selesai, q.mulai];
    if (days({ start, end, preset }) > 366) start = addDays(end, -365);
  } else {
    const n = ['7', '30', '90'].includes(preset) ? Number(preset) : 30;
    preset = String(n);
    end = anchor;
    start = addDays(end, -(n - 1));
  }
  if (minStart && start < minStart) {
    start = minStart;
    if (end < start) end = start;
  }
  return { start, end, preset };
}

export const days = (p: Period) => Math.round((toDate(p.end).getTime() - toDate(p.start).getTime()) / 86400000) + 1;
export const previous = (p: Period) => ({ start: addDays(p.start, -days(p)), end: addDays(p.start, -1) });
export const key = (p: Period) => `${p.start}_${p.end}`;
export const label = (p: Period) => `${F.date(p.start)} – ${F.date(p.end)}`;
export const previousLabel = (p: Period) => { const q = previous(p); return `${F.date(q.start)} – ${F.date(q.end)}`; };
export const query = (p: Period): Record<string, string> =>
  p.preset === 'kustom' ? { periode: 'kustom', mulai: p.start, selesai: p.end } : { periode: p.preset };
export const minStartFor = (latest: string | null) => (latest ? addDays(latest, -89) : null);
