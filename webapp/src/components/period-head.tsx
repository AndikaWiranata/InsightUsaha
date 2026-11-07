import { PeriodFilter } from './client';
import { PageTitle } from './ui';
import { label, previousLabel, type Period } from '@/lib/period';

export function PeriodHead({ title, sub, period, minStart }: { title: string; sub?: string; period: Period; minStart: string | null }) {
  return (
    <PageTitle title={title} sub={sub}>
      <PeriodFilter preset={period.preset} start={period.start} end={period.end} minStart={minStart} />
      <p className="mt-2 text-sm text-muted">
        {label(period)}, dibanding {previousLabel(period)}.{minStart ? ' Paket Gratis menampilkan 3 bulan terakhir.' : ''}
      </p>
    </PageTitle>
  );
}
