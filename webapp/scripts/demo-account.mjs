// Buat (atau setel ulang) akun demo terverifikasi tanpa mengirim email. Pakai: node scripts/demo-account.mjs [pro|gratis]
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, SEC = env.SUPABASE_SECRET_KEY;
const EMAIL = 'demo@insightusaha.id', PASSWORD = 'demo12345';
const paket = process.argv[2] === 'gratis' ? 'gratis' : 'pro';

const api = async (path, init = {}) => {
  const res = await fetch(URL_ + path, { ...init, headers: { apikey: SEC, 'Content-Type': 'application/json', ...init.headers } });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};

const list = await api('/auth/v1/admin/users?per_page=200');
const old = list.json?.users?.find((u) => u.email === EMAIL);
if (old) await api(`/auth/v1/admin/users/${old.id}`, { method: 'DELETE' });

const created = await api('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({
  email: EMAIL, password: PASSWORD, email_confirm: true,
  user_metadata: { nama: 'Rina', nama_usaha: 'Kedai Kopi Rina', jenis_usaha: 'Kedai kopi' } }) });
if (created.status >= 300) throw new Error(JSON.stringify(created.json));

const biz = await api(`/rest/v1/businesses?select=id&user_id=eq.${created.json.id}`);
const bid = biz.json[0].id;
await api(`/rest/v1/businesses?id=eq.${bid}`, { method: 'PATCH', body: JSON.stringify({ kota: 'Surabaya', onboarding_selesai: true }) });
if (paket === 'pro') {
  const end = new Date(Date.now() + 30 * 86400000).toISOString();
  await api(`/rest/v1/subscriptions?business_id=eq.${bid}`, { method: 'PATCH', body: JSON.stringify({ paket: 'pro', berakhir: end }) });
}
console.log(`Akun demo siap: ${EMAIL} / ${PASSWORD} (paket ${paket}, usaha #${bid})`);
