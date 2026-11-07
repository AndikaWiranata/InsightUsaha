// Buat (atau setel ulang) akun admin terverifikasi. Pakai: node scripts/admin-account.mjs [email] [kata-sandi]
// Bawaan: admin@insightusaha.id / admin12345. Ganti kata sandinya sebelum aplikasi dipakai orang lain.
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, SEC = env.SUPABASE_SECRET_KEY;
const email = (process.argv[2] ?? 'admin@insightusaha.id').toLowerCase();
const password = process.argv[3] ?? 'admin12345';
if (password.length < 8) throw new Error('Kata sandi minimal 8 karakter.');

const api = async (path, init = {}) => {
  const res = await fetch(URL_ + path, { ...init, headers: { apikey: SEC, 'Content-Type': 'application/json', ...init.headers } });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};

const list = await api('/auth/v1/admin/users?per_page=1000');
let user = list.json?.users?.find((u) => u.email === email);
if (user) {
  await api(`/auth/v1/admin/users/${user.id}`, { method: 'PUT', body: JSON.stringify({ password, email_confirm: true }) });
} else {
  const c = await api('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({
    email, password, email_confirm: true, user_metadata: { nama: 'Admin', nama_usaha: 'Tim InsightUsaha', jenis_usaha: 'Lainnya' } }) });
  if (c.status >= 300) throw new Error(JSON.stringify(c.json));
  user = c.json;
}
// Peran admin hanya bisa diubah dengan secret key; RLS menolak pengguna yang mencoba menaikkan perannya sendiri.
const r = await api(`/rest/v1/profiles?id=eq.${user.id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ role: 'admin' }) });
if (r.json?.[0]?.role !== 'admin') throw new Error(`Gagal memberi peran admin: ${JSON.stringify(r.json)}`);
console.log(`Akun admin siap: ${email} / ${password}`);
