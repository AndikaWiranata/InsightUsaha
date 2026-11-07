// Uji alur masuk nyata di Edge headless: admin harus ke panel admin, pemilik usaha ke ringkasan.
// Pakai: node scripts/check-roles.mjs <sandi-admin> <sandi-demo>   (server harus berjalan di port 3000)
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'http://127.0.0.1:3000';
const [adminPass, demoPass] = process.argv.slice(2);
if (!adminPass || !demoPass) { console.error('Pakai: node scripts/check-roles.mjs <sandi-admin> <sandi-demo>'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, total = 0;
const record = (name, pass, detail = '') => { total++; if (pass) ok++; console.log(`${pass ? 'LULUS' : 'GAGAL'}  ${name}${detail ? `  (${detail})` : ''}`); };

async function session(port) {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'edge-'))}`, 'about:blank'], { stdio: 'ignore' });
  let t; for (let i = 0; i < 60 && !t; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(250); } }
  const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const p = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m.result); p.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const go = async (path) => { await send('Page.navigate', { url: BASE + path }); await sleep(2500); };
  const login = async (email, password) => {
    await go('/masuk');
    await js(`(() => { const set = (s, v) => { const el = document.querySelector(s);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
      set('#email', ${JSON.stringify(email)}); set('#password', ${JSON.stringify(password)}); document.querySelector('form').requestSubmit(); })()`);
    await sleep(5000);
  };
  return { js, go, login, close: () => { ws.close(); edge.kill(); } };
}

const admin = await session(9340);
try {
  await admin.login('admin@insightusaha.id', adminPass);
  record('Admin: setelah masuk langsung ke /admin', await admin.js('location.pathname') === '/admin', await admin.js('location.pathname'));
  record('Admin: halaman berisi Panel admin dan statistik', await admin.js("document.body.innerText.includes('Panel admin') && document.body.innerText.includes('Pengguna terdaftar')"),
    await admin.js("document.querySelector('main')?.innerText.slice(0, 160).replace(/\\s+/g, ' ')"));
  // textContent, bukan innerText: di layar sempit menu samping terlipat sehingga teksnya tersembunyi.
  record('Admin: persentase unggah data tidak lebih dari 100%', await admin.js("(() => { const m = document.querySelector('main').innerText.match(/Sudah unggah data\\s+(\\d+)%/); return !!m && Number(m[1]) <= 100; })()"));
  record('Admin: akun demo tampil di tabel pengguna', await admin.js("[...document.querySelectorAll('tbody tr')].some((tr) => tr.textContent.includes('demo@insightusaha.id') && tr.textContent.includes('Pro'))"));
  record('Admin: menu tanpa Ringkasan/Paket Gratis', await admin.js("const h = document.querySelector('header').textContent; !h.includes('Ringkasan') && !h.includes('Paket Gratis') && h.includes('Admin sistem')"));
  record('Admin: tombol Tanya data tidak tampil', await admin.js("!document.querySelector('[data-chat-open]')"));
  await admin.go('/dashboard');
  record('Admin: membuka /dashboard dialihkan ke /admin', await admin.js('location.pathname') === '/admin', await admin.js('location.pathname'));
} finally { admin.close(); }

const owner = await session(9341);
try {
  await owner.login('demo@insightusaha.id', demoPass);
  record('Pemilik: setelah masuk ke /dashboard', await owner.js('location.pathname') === '/dashboard',
    await owner.js("location.pathname + ' ' + (document.querySelector('[role=alert]')?.innerText ?? '')"));
  record('Pemilik: paket Pro dan tombol Tanya data tampil', await owner.js("document.querySelector('header').textContent.includes('Paket Pro') && !!document.querySelector('[data-chat-open]')"));
  await owner.go('/admin');
  record('Pemilik: /admin tidak menampilkan data admin', await owner.js("!document.body.innerText.includes('Pengguna terdaftar')"));
} finally { owner.close(); }

// Demo baru saja membuka dashboard, jadi harus terhitung aktif di panel admin.
const admin2 = await session(9342);
try {
  await admin2.login('admin@insightusaha.id', adminPass);
  const aktif = await admin2.js("Number(document.querySelector('main').innerText.match(/Aktif 7 hari terakhir\\s+(\\d+)/)?.[1] ?? 0)");
  record('Admin: demo terhitung aktif 7 hari terakhir', aktif >= 1, `aktif = ${aktif}`);
} finally { admin2.close(); }
console.log(`\n${ok}/${total} lulus.`);
process.exit(0);
