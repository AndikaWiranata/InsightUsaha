// Format angka dan tanggal gaya Indonesia. Dipakai juga oleh fakta ringkasan AI, jadi bentuk teksnya harus stabil.

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function number(v: number | string | null | undefined, decimals = 0): string {
  const n = Number(v ?? 0);
  const fixed = Math.abs(n).toFixed(decimals);
  const [i, d] = fixed.split('.');
  return (n < 0 && Number(fixed) !== 0 ? '-' : '') + group(i) + (d ? ',' + d : '');
}

export const rupiah = (v: number | string | null | undefined) => 'Rp' + number(Math.round(Number(v ?? 0)));

/** Persentase dengan tanda: +12,5% / −3% / 0%. Satu desimal hanya bila tidak bulat. */
export function percent(v: number | string | null | undefined, sign = true): string {
  if (v === null || v === undefined) return '–';
  const n = Number(v);
  const abs = Math.abs(n);
  const s = number(abs, Number.isInteger(abs) ? 0 : 1) + '%';
  if (!sign) return s;
  return (n > 0 ? '+' : n < 0 ? '−' : '') + s;
}

export function date(d: string | Date | null | undefined): string {
  if (!d) return '–';
  const [y, m, day] = (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10)).split('-').map(Number);
  return `${day} ${BULAN[m - 1]} ${y}`;
}

/** Label sumbu tren: "1 Okt" untuk harian/mingguan, "Okt 2026" untuk bulanan. */
export function trendLabel(s: string): string {
  const [y, m, d] = s.split('-').map(Number);
  return d ? `${d} ${BULAN[m - 1]}` : `${BULAN[m - 1]} ${y}`;
}
