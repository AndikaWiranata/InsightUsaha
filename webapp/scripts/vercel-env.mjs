// Tulis variabel dari .env.local ke file siap-tempel untuk Vercel (Settings → Environment Variables → Import .env).
// Pakai: node scripts/vercel-env.mjs   → membuat .env.vercel (diabaikan git). Isinya tidak dicetak ke layar.
import { readFileSync, writeFileSync } from 'node:fs';

const KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
  'GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_FALLBACK_MODEL', 'MIDTRANS_SERVER_KEY', 'MIDTRANS_PRODUCTION', 'CRON_SECRET',
];
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));

const lines = [];
for (const k of KEYS) {
  const v = env[k] ?? '';
  lines.push(`${k}=${v}`);
  const shown = !v ? '(kosong)' : k.startsWith('NEXT_PUBLIC_') || /MODEL|PRODUCTION/.test(k) ? v : `${v.length} karakter, disembunyikan`;
  console.log(`${k.padEnd(38)} ${shown}`);
}
writeFileSync(new URL('../.env.vercel', import.meta.url), lines.join('\n') + '\n');
console.log('\nDitulis ke webapp/.env.vercel. Jangan di-commit; hapus setelah diimpor ke Vercel.');
