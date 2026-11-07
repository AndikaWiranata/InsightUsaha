'use client';

import { useEffect, useRef } from 'react';
import { BarController, BarElement, CategoryScale, Chart, LinearScale, LineController, LineElement, PointElement, Tooltip,
  type ChartConfiguration, type TooltipItem } from 'chart.js';
import * as F from '@/lib/format';

Chart.register(LineController, BarController, LineElement, BarElement, PointElement, LinearScale, CategoryScale, Tooltip);

const token = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const compact = (v: number) =>
  Math.abs(v) >= 1e9 ? `${F.number(v / 1e9, 1)} M` : Math.abs(v) >= 1e6 ? `${F.number(v / 1e6, 1)} jt`
    : Math.abs(v) >= 1e3 ? `${F.number(v / 1e3)} rb` : F.number(v);

type Build = () => ConstructorParameters<typeof Chart>[1];

/**
 * Gambar grafik; digambar ulang saat datanya berubah (pindah periode/kelompok tanpa muat ulang halaman)
 * dan saat tema berganti agar warna mengikuti token tema. `key` mewakili isi data.
 */
function useChart(build: Build, key: string) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let chart = new Chart(ref.current!, build());
    const redraw = () => { chart.destroy(); chart = new Chart(ref.current!, build()); };
    // Ukuran wadah bisa berubah setelah tata letak selesai (mis. di HP); paksa Chart.js mengukur ulang.
    const resize = new ResizeObserver(() => chart.resize());
    resize.observe(ref.current!.parentElement!);
    window.addEventListener('iu-theme', redraw);
    return () => { resize.disconnect(); window.removeEventListener('iu-theme', redraw); chart.destroy(); };
    // `build` dibuat ulang setiap render; isi datanya sudah diwakili `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ref;
}

function base(tooltipLabel: (y: number, i: number) => string | string[], yTick?: (v: number) => string) {
  const c = { brand: token('--c-brand'), ink: token('--c-ink'), surface: token('--c-surface'), muted: token('--c-muted'), grid: token('--c-grid'), line: token('--c-line') };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    c,
    options: {
      responsive: true, maintainAspectRatio: false, animation: reduced ? (false as const) : { duration: 250 },
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.ink, titleColor: c.surface, bodyColor: c.surface, padding: 10, cornerRadius: 6, displayColors: false,
          callbacks: { label: (ctx: TooltipItem<'bar' | 'line'>) => tooltipLabel(Number(ctx.parsed.y), ctx.dataIndex) },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { color: c.line }, ticks: { color: c.muted, maxRotation: 0, autoSkipPadding: 16 } },
        y: { beginAtZero: true, border: { display: false }, grid: { color: c.grid }, ticks: { color: c.muted, maxTicksLimit: 5, ...(yTick ? { callback: (v: string | number) => yTick(Number(v)) } : {}) } },
      },
    },
  };
}

/** Tren omzet: satu seri, satu sumbu. Batang bila titiknya sedikit, garis bila banyak. */
export function TrendChart({ labels, omzet, transaksi, ariaLabel }: { labels: string[]; omzet: number[]; transaksi: number[]; ariaLabel: string }) {
  const bar = labels.length <= 14;
  const ref = useChart(() => {
    const { c, options } = base((y, i) => [F.rupiah(y), `${F.number(transaksi[i])} transaksi`], compact);
    return {
      type: bar ? 'bar' : 'line',
      data: { labels, datasets: [{
        label: 'Omzet', data: omzet, backgroundColor: bar ? c.brand : 'transparent', borderColor: c.brand, borderWidth: 2,
        borderRadius: bar ? { topLeft: 3, topRight: 3 } : 0, borderSkipped: 'bottom', maxBarThickness: 32,
        pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: c.brand, pointHoverBorderColor: c.surface, pointHoverBorderWidth: 2, tension: 0.2,
      }] },
      options,
    } as ChartConfiguration;
  }, JSON.stringify([labels, omzet]));
  return <div className="relative mt-4 h-64"><canvas ref={ref} role="img" aria-label={ariaLabel} data-trend-chart data-points={labels.length} /></div>;
}

export function DayChart({ labels, values }: { labels: string[]; values: number[] }) {
  const ref = useChart(() => {
    const { c, options } = base((y) => `${F.number(y, 1)} transaksi per hari`);
    return {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Rata-rata transaksi per hari', data: values, backgroundColor: c.brand,
        borderRadius: { topLeft: 3, topRight: 3 }, borderSkipped: 'bottom', maxBarThickness: 40 }] },
      options,
    } as ChartConfiguration;
  }, JSON.stringify([labels, values]));
  return <div className="relative mt-4 h-56"><canvas ref={ref} role="img" aria-label="Grafik rata-rata transaksi per hari. Angkanya ada di tabel di bawah." /></div>;
}
