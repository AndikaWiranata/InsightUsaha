// Cek skema di Supabase sungguhan: pendaftaran membuat profil/usaha/langganan, RLS memisahkan data, fungsi analisis jalan.
// Pakai: node scripts/verify-supabase.mjs   (membaca .env.local; akun uji dihapus lagi di akhir)
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SEC = env.SUPABASE_SECRET_KEY;

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}${detail ? `  (${detail})` : ''}`); };

async function api(path, { key = PUB, token, method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(URL_ + path, {
    method,
    headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

const stamp = Date.now();
const users = [];
async function makeUser(label, usaha) {
  const email = `uji-${label}-${stamp}@insightusaha.test`;
  const password = `Uji-${stamp}-pass`;
  const c = await api('/auth/v1/admin/users', { key: SEC, method: 'POST',
    body: { email, password, email_confirm: true, user_metadata: { nama: `Uji ${label}`, nama_usaha: usaha, jenis_usaha: 'Kedai kopi' } } });
  if (c.status >= 300) throw new Error(`buat user gagal: ${c.status} ${JSON.stringify(c.json)}`);
  users.push(c.json.id);
  const s = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  if (!s.json?.access_token) throw new Error(`login gagal: ${s.status} ${JSON.stringify(s.json)}`);
  return { id: c.json.id, token: s.json.access_token };
}

try {
  const a = await makeUser('a', 'Kedai Uji A');
  const b = await makeUser('b', 'Warung Uji B');

  const bizA = await api('/rest/v1/businesses?select=id,nama_usaha,subscriptions(paket)', { token: a.token });
  // subscriptions unik per usaha, jadi PostgREST mengembalikannya sebagai objek tunggal.
  check('Daftar: usaha + langganan Gratis dibuat otomatis', bizA.status === 200 && bizA.json[0]?.nama_usaha === 'Kedai Uji A'
    && bizA.json[0]?.subscriptions?.paket === 'gratis', JSON.stringify(bizA.json));
  const prof = await api('/rest/v1/profiles?select=nama,role', { token: a.token });
  check('Daftar: profil dibuat dengan role owner', prof.json?.[0]?.role === 'owner');
  const idA = bizA.json[0].id;

  // Data penjualan kecil untuk usaha A, lewat fungsi impor (cara yang dipakai aplikasi).
  const rpc = (fn, body, token) => api(`/rest/v1/rpc/${fn}`, { token, method: 'POST', body });
  const row = (no, produk, jumlah, harga) => ({ no, tanggal: '2026-10-10', jam: '09:00', id_transaksi: 'T1', nama_produk: produk,
    kategori: null, jumlah, harga_satuan: harga, hash: `2026-10-10|09:00|T1|${produk.toLowerCase()}|${jumlah}|${harga}.0` });
  const start = await rpc('import_start', { p_nama_file: 'uji.csv', p_mode: 'baru', p_mulai: '2026-10-10', p_selesai: '2026-10-10' }, a.token);
  const chunk = await rpc('import_chunk', { p_upload: start.json, p_rows: [row(0, 'Kopi', 2, 18000), row(1, 'Roti', 1, 22000)] }, a.token);
  const finish = await rpc('import_finish', { p_upload: start.json, p_ringkasan: { jumlah_baris_valid: 2, jumlah_baris_ditolak: 0 }, p_ditolak: [] }, a.token);
  check('Impor lewat fungsi database (start, chunk, finish)', start.status === 200 && chunk.json === 2 && finish.json === 2,
    `HTTP ${start.status}/${chunk.status}/${finish.status}, baris ${finish.json}`);
  const direct = await api('/rest/v1/uploads', { token: a.token, method: 'POST', body: { business_id: idA, nama_file: 'langsung.csv' } });
  check('Menulis tabel unggahan langsung ditolak (harus lewat fungsi impor)', direct.status >= 400, `HTTP ${direct.status}`);
  const chunkB = await rpc('import_chunk', { p_upload: start.json, p_rows: [row(5, 'Racun', 1, 1)] }, b.token);
  check('Pengguna B tidak bisa menyisipkan baris ke unggahan A', chunkB.status >= 400, `HTTP ${chunkB.status}`);

  const dA = await api('/rest/v1/rpc/analisis_dashboard', { token: a.token, method: 'POST', body: { d_start: '2026-10-01', d_end: '2026-10-31' } });
  check('Fungsi analisis jalan untuk pengguna A', Number(dA.json?.ringkasan?.omzet) === 58000 && Number(dA.json?.ringkasan?.transaksi) === 1,
    `omzet=${dA.json?.ringkasan?.omzet}`);

  // Pemisahan data.
  const seeB = await api('/rest/v1/transactions?select=id', { token: b.token });
  check('RLS: pengguna B tidak melihat transaksi A', seeB.status === 200 && seeB.json.length === 0, `${seeB.json?.length} baris`);
  const dB = await api('/rest/v1/rpc/analisis_dashboard', { token: b.token, method: 'POST', body: { d_start: '2026-10-01', d_end: '2026-10-31' } });
  check('RLS: analisis pengguna B tidak memuat data A', Number(dB.json?.ringkasan?.omzet) === 0, `omzet=${dB.json?.ringkasan?.omzet}`);
  const injB = await api('/rest/v1/uploads', { token: b.token, method: 'POST', body: { business_id: idA, nama_file: 'sisip.csv' } });
  check('RLS: pengguna B tidak bisa menulis ke usaha A', injB.status >= 400, `HTTP ${injB.status}`);
  const delB = await api(`/rest/v1/products?business_id=eq.${idA}`, { token: b.token, method: 'DELETE', headers: { Prefer: 'return=representation' } });
  check('RLS: pengguna B tidak bisa menghapus produk A', Array.isArray(delB.json) && delB.json.length === 0);
  const pro = await api(`/rest/v1/subscriptions?business_id=eq.${idA}`, { token: a.token, method: 'PATCH',
    headers: { Prefer: 'return=representation' }, body: { paket: 'pro' } });
  const after = await api(`/rest/v1/subscriptions?select=paket&business_id=eq.${idA}`, { key: SEC });
  check('RLS: pengguna tidak bisa menaikkan dirinya ke Pro', after.json?.[0]?.paket === 'gratis',
    `PATCH HTTP ${pro.status} ${JSON.stringify(pro.json)}; paket sekarang ${after.json?.[0]?.paket}`);

  const anon = await api('/rest/v1/rpc/analisis_dashboard', { method: 'POST', body: { d_start: '2026-10-01', d_end: '2026-10-31' } });
  check('Pengunjung tanpa login tidak bisa memanggil analisis', anon.status >= 400, `HTTP ${anon.status}`);
} catch (e) {
  check('Skrip berjalan tanpa error', false, e.message);
} finally {
  for (const id of users) await api(`/auth/v1/admin/users/${id}`, { key: SEC, method: 'DELETE' });
  console.log(`\n${results.filter(Boolean).length}/${results.length} lulus. Akun uji dihapus: ${users.length}.`);
}
