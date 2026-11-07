// Tampilkan 5 log error terbaru dari Supabase (untuk memeriksa kegagalan AI/impor). Pakai: node scripts/ai-errors.mjs
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/error_logs?select=jenis,pesan,created_at&order=id.desc&limit=5`,
  { headers: { apikey: env.SUPABASE_SECRET_KEY } });
for (const l of await res.json()) console.log(`${l.created_at.slice(11, 19)} [${l.jenis}] ${l.pesan.slice(0, 220)}`);
