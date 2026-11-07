import 'server-only';
import { getAccount } from '@/lib/session';
import { minStartFor, resolvePeriod, type PeriodQuery } from '@/lib/period';

/** Akun + periode terpilih untuk halaman analisis. Paket Gratis dibatasi 90 hari terakhir dari data. */
export async function loadContext(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const [acc, sp] = await Promise.all([getAccount(), searchParams]);
  const q: PeriodQuery = { periode: str(sp.periode), mulai: str(sp.mulai), selesai: str(sp.selesai) };
  const minStart = acc.isPro ? null : minStartFor(acc.latestDataDate);
  const period = resolvePeriod(q, acc.latestDataDate, minStart);
  return { acc, sp, period, minStart, hasData: acc.latestDataDate !== null };
}

export const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
