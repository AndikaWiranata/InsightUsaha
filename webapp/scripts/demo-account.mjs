// Buat (atau setel ulang) akun demo terverifikasi tanpa mengirim email.
// Pakai: node scripts/demo-account.mjs [pro|gratis] [--isi]
//   --isi  unggah data contoh (tests/fixtures/contoh-penjualan.csv) dan isi HPP, agar semua halaman langsung terisi.
// Paket Pro berlaku 1 tahun.
import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, SEC = env.SUPABASE_SECRET_KEY;
const EMAIL = 'demo@insightusaha.id', PASSWORD = 'demo12345';
const paket = process.argv.includes('gratis') ? 'gratis' : 'pro';
const fill = process.argv.includes('--isi');

const api = async (path, init = {}) => {
  const res = await fetch(URL_ + path, { ...init, headers: { apikey: SEC, 'Content-Type': 'application/json', ...init.headers } });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};

const list = await api('/auth/v1/admin/users?per_page=1000');
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
  const end = new Date(Date.now() + 365 * 86400000).toISOString();
  await api(`/rest/v1/subscriptions?business_id=eq.${bid}`, { method: 'PATCH', body: JSON.stringify({ paket: 'pro', berakhir: end }) });
}

if (fill) {
  // Impor lewat fungsi database yang sama dengan aplikasi, atas nama akun demo (RLS berlaku).
  const { cleanRows, dropBlankRows, suggestMapping } = await import('../src/lib/import/parse.ts');
  const sb = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const csv = readFileSync(new URL('../tests/fixtures/contoh-penjualan.csv', import.meta.url), 'utf8');
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const clean = cleanRows(dropBlankRows(parsed.data), suggestMapping(parsed.meta.fields ?? []));
  const r = clean.ringkasan;
  const { data: id, error: e1 } = await sb.rpc('import_start', { p_nama_file: 'contoh-penjualan.csv', p_mode: 'baru', p_mulai: r.tanggal_mulai, p_selesai: r.tanggal_selesai });
  if (e1) throw e1;
  for (let i = 0; i < clean.baris.length; i += 2000) {
    const { error } = await sb.rpc('import_chunk', { p_upload: id, p_rows: clean.baris.slice(i, i + 2000).map((x, j) => ({ no: i + j, ...x })) });
    if (error) throw error;
  }
  const { data: valid, error: e2 } = await sb.rpc('import_finish', { p_upload: id, p_ringkasan: r, p_ditolak: clean.ditolak });
  if (e2) throw e2;

  const hpp = JSON.parse(readFileSync(new URL('../tests/fixtures/hpp.json', import.meta.url), 'utf8'));
  for (const [nama, v] of Object.entries(hpp)) await sb.from('products').update({ hpp: v }).eq('nama', nama);
  console.log(`Data contoh terisi: ${valid} baris, HPP ${Object.keys(hpp).length} menu.`);
}
console.log(`Akun demo siap: ${EMAIL} / ${PASSWORD} (paket ${paket}${paket === 'pro' ? ', berlaku 1 tahun' : ''})`);
