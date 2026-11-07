// Uji klik nyata di Edge headless (Chrome DevTools Protocol): login, unggah file contoh, semua halaman, chatbot,
// tema, HP 360 px, keyboard, dan error konsol. Pakai: node scripts/clickthrough.mjs [folder-screenshot]
// Butuh server berjalan (next start) dan akun demo (node scripts/demo-account.mjs pro).
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:3000';
const PORT = 9336;
const OUT = process.argv[2] ?? mkdtempSync(join(tmpdir(), 'iu-next-'));
const SAMPLE = resolve('tests/fixtures/contoh-penjualan.csv');
mkdirSync(OUT, { recursive: true });

const results = [];
const consoleErrors = [];
const record = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'edge-'))}`, 'about:blank'], { stdio: 'ignore' });
let ws;
try {
  let targets;
  for (let i = 0; i < 60 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { await sleep(250); } }
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails.exception?.description?.slice(0, 200) ?? 'exception');
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon/.test(m.params.entry.url ?? '')) consoleErrors.push(`${m.params.entry.text.slice(0, 160)} ${m.params.entry.url ?? ''}`);
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
  const waitFor = async (expr, ms = 60000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await js(expr)) return true; await sleep(400); } return false; };
  const go = async (path, settle = 1200) => { await send('Page.navigate', { url: BASE + path }); await sleep(settle); await waitFor("document.readyState === 'complete'", 20000); };
  const shot = async (name) => { const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64')); };
  const viewport = (w, h, mobile) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  const key = async (k) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code: k, windowsVirtualKeyCode: { Escape: 27, Tab: 9, Enter: 13 }[k] ?? 0 }); };
  const setValue = (sel, v) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const proto = el.tagName === 'SELECT' ? HTMLSelectElement : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); })()`);

  for (const d of ['Runtime.enable', 'Log.enable', 'Page.enable', 'DOM.enable']) await send(d);
  await viewport(1280, 900, false);

  // Publik
  await go('/');
  record('Landing: tanpa em dash', await js("!document.body.innerText.includes('\\u2014')"));
  record('Landing: satu h1, lang=id, title', await js("document.querySelectorAll('h1').length === 1 && document.documentElement.lang === 'id' && !!document.title"));
  await js("localStorage.setItem('iu-theme','light')"); await go('/');
  record('Tema terang: latar kertas krem', await js("getComputedStyle(document.body).backgroundColor === 'rgb(246, 241, 231)'"));
  await js("[...document.querySelectorAll('button')].find(b => b.innerText.includes('Tema gelap')).click()");
  await sleep(300);
  record('Tombol tema: pindah ke gelap', await js("document.documentElement.dataset.theme === 'dark'"));
  await go('/');
  record('Tema gelap tersimpan setelah muat ulang', await js("document.documentElement.dataset.theme === 'dark' && getComputedStyle(document.body).backgroundColor === 'rgb(21, 18, 15)'"));
  await shot('landing-gelap');
  await js("localStorage.setItem('iu-theme','light')");
  await go('/dashboard');
  record('Tamu yang membuka dashboard diarahkan ke /masuk', await js("location.pathname === '/masuk'"));

  await go('/daftar');
  await js("document.querySelector('form').requestSubmit()");
  await waitFor("document.querySelectorAll('.error').length >= 3", 15000);
  record('Daftar: form kosong menampilkan validasi', await js("document.querySelectorAll('.error').length >= 3"), `${await js("document.querySelectorAll('.error').length")} pesan`);
  await setValue('#nama', 'Rina'); await setValue('#email', 'demo@insightusaha.id'); await setValue('#password', 'rahasia123');
  await setValue('#password_confirmation', 'rahasia123'); await setValue('#nama_usaha', 'Kedai'); await setValue('#jenis_usaha', 'Kedai kopi');
  await js("document.querySelector('form').requestSubmit()");
  await waitFor("document.body.innerText.includes('sudah terdaftar')", 20000);
  record('Daftar: email terdaftar ditolak dengan pesan jelas', await js("document.body.innerText.includes('Email ini sudah terdaftar')"));

  await go('/masuk');
  await setValue('#email', 'demo@insightusaha.id'); await setValue('#password', 'salah-sekali');
  await js("document.querySelector('form').requestSubmit()");
  await waitFor("document.body.innerText.includes('Email atau kata sandi salah')", 20000);
  record('Masuk: sandi salah menampilkan pesan', await js("document.body.innerText.includes('Email atau kata sandi salah')"));
  await setValue('#password', 'demo12345');
  await js("document.querySelector('form').requestSubmit()");
  await waitFor("location.pathname === '/dashboard'", 20000);
  record('Masuk: berhasil ke /dashboard', await js("location.pathname === '/dashboard'"));

  // Data: hapus data lama demo lalu unggah file contoh lewat browser.
  await go('/data', 2000);
  await js(`(() => { const dt = new DataTransfer(); dt.items.add(new File(['x'], 'laporan.pdf', { type: 'application/pdf' }));
    const i = document.getElementById('file'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor("document.querySelector('[role=alert]')?.innerText.includes('Format file tidak didukung')", 5000);
  record('Data: file .pdf ditolak sebelum diunggah', await js("document.body.innerText.includes('Format file tidak didukung')"));
  const { root } = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#file' });
  const t0 = Date.now();
  await send('DOM.setFileInputFiles', { nodeId, files: [SAMPLE] });
  const done = await waitFor("document.body.innerText.includes('Lihat ringkasan penjualan') || document.body.innerText.includes('Impor gagal') || !!document.querySelector('input[name=mode]')", 120000);
  if (await js("!!document.querySelector('input[name=mode]')")) {
    record('Data: unggah ulang di rentang yang sama menanyakan ganti/gabung', true);
    await js("[...document.querySelectorAll('button')].find(b => b.innerText === 'Lanjutkan').click()");
    await waitFor("document.body.innerText.includes('Lihat ringkasan penjualan') || document.body.innerText.includes('Impor gagal')", 120000);
  }
  const imported = await js("document.body.innerText.match(/([\\d.]+) baris masuk/)?.[1] ?? ''");
  record('Data: file contoh 13.746 baris terimpor lewat browser', done && imported === '13.743', `${imported} baris masuk, ${((Date.now() - t0) / 1000).toFixed(1)} detik`);
  record('Data: 2 baris rusak dilaporkan, bukan menggagalkan impor', await js("/Ditolak\\s*2 baris/.test(document.body.innerText)"));
  await shot('data-hasil');

  // Dashboard: angka harus sama dengan hasil versi Python untuk file contoh yang sama.
  const py = JSON.parse(readFileSync(resolve('tests/fixtures/python-reference.json'), 'utf8')).periode['30'].dashboard.ringkasan;
  const idr = (n) => 'Rp' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const trxText = py.transaksi.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  await go('/dashboard?periode=30', 2500);
  const omzet = await js("document.querySelector('main .stabilo')?.innerText");
  record('Dashboard: omzet 30 hari sama dengan versi Python', omzet === idr(py.omzet), `${omzet}, Python ${idr(py.omzet)}`);
  record('Dashboard: jumlah transaksi sama dengan versi Python', await js(`document.body.innerText.includes(${JSON.stringify(trxText)})`), trxText);
  record('Dashboard: grafik tren tergambar', await js("(() => { const c = document.querySelector('[data-trend-chart]'); return !!c && c.width > 0; })()"));
  const aiBox = "document.getElementById('ai-title')?.closest('section')?.innerText ?? ''";
  const ai = await waitFor(`(${aiBox}).includes('Yang terjadi') || (${aiBox}).includes('Ringkasan belum tersedia')`, 90000);
  record('Dashboard: ringkasan AI dimuat', ai && await js(`(${aiBox}).includes('Yang terjadi')`), (await js(aiBox)).split('\n')[2]?.slice(0, 90));
  if (await js("!!document.querySelector('[data-ai-feedback] button')")) {
    await js("document.querySelector('[data-ai-feedback] button').click()");
    record('Ringkasan: umpan balik tersimpan', await waitFor("document.querySelector('[data-ai-feedback] button')?.getAttribute('aria-pressed') === 'true'", 15000));
  }
  await js("[...document.querySelectorAll('[role=group] a')].find(a => a.innerText === 'Minggu').click()");
  await waitFor("document.getElementById('tren-title')?.innerText.includes('minggu')", 20000);
  await sleep(800);
  // 30 hari per minggu = 5-6 titik; masih 30 titik berarti grafik lama tidak digambar ulang.
  const points = await js("Number(document.querySelector('[data-trend-chart]')?.dataset.points)");
  record('Dashboard: kelompok Minggu mengganti grafik', points > 0 && points <= 6, `${points} titik`);
  await setValue('#periode', '7');
  record('Filter periode: 7 hari memuat ulang halaman', await waitFor("location.search.includes('periode=7')", 20000));
  await shot('dashboard');

  // Chatbot
  await go('/dashboard?periode=30', 2000);
  await js("document.querySelector('[data-chat-open]').click()");
  await sleep(300);
  record('Chat: tombol Tanya data membuka panel', await js("!!document.getElementById('chat-panel')"));
  record('Chat: fokus pindah ke kotak tanya', await js("document.activeElement?.id === 'chat-input'"));
  await js("[...document.querySelectorAll('#chat-panel button')].find(b => b.innerText === 'Mulai ulang')?.click()");
  await js("document.querySelector('#chat-panel [type=submit]').click()");
  record('Chat: kirim kosong menampilkan validasi', await js("document.querySelector('#chat-panel .error')?.innerText === 'Tulis pertanyaan dulu.'"));
  await js("document.querySelector('[data-chat-starter]').click()");
  const answered = await waitFor("[...document.querySelectorAll('#chat-panel .justify-start')].some(e => !e.innerText.includes('Sedang membaca')) || !!document.querySelector('#chat-panel [role=alert]')", 60000);
  const answer = await js("[...document.querySelectorAll('#chat-panel .justify-start')].pop()?.innerText ?? document.querySelector('#chat-panel [role=alert]')?.innerText");
  const topUnit = py.produk_terlaris.unit.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  record('Chat: pertanyaan contoh dijawab dengan angka analisis', answered && (answer ?? '').includes(topUnit), (answer ?? '').slice(0, 100));
  await shot('chat');
  await go('/produk?periode=30', 2000);
  await js("document.querySelector('[data-chat-open]').click()");
  record('Chat: riwayat tetap ada di halaman lain', await waitFor("document.querySelectorAll('#chat-panel .justify-start, #chat-panel .justify-end').length >= 2", 5000));
  await js("document.getElementById('chat-panel').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
  await sleep(200);
  record('Chat: Escape menutup panel dan fokus kembali ke tombol', await js("!document.getElementById('chat-panel') && document.activeElement === document.querySelector('[data-chat-open]')"));

  // Halaman lain
  await js("[...document.querySelectorAll('main nav a')].find(a => a.innerText.startsWith('Naik')).click()");
  await waitFor("location.search.includes('label=Naik')", 15000); await sleep(800);
  record('Produk: saring Naik hanya menampilkan menu naik', await js("[...document.querySelectorAll('tbody tr td:nth-child(5)')].every(td => td.innerText.includes('Naik'))"));
  for (const [path, check, label] of [
    ['/waktu?periode=30', "document.querySelectorAll('table.border-separate td[style]').length > 50", 'Jam ramai: heatmap terisi'],
    ['/bundling?periode=90', "document.querySelectorAll('main .stabilo').length === 1", 'Bundling: pasangan terkuat ditampilkan'],
    ['/menu?periode=30', "!!document.querySelector('main svg[role=img]') || document.body.innerText.includes('Isi HPP')", 'Klasifikasi menu: peta atau ajakan isi HPP'],
    ['/laporan', "!!document.querySelector('a[href*=\"/laporan/cetak\"]')", 'Laporan: tautan laporan ada'],
    ['/langganan', "!!document.querySelector('main form button')", 'Langganan: tombol bayar ada'],
    ['/pengaturan', "document.querySelectorAll('main form').length >= 3", 'Pengaturan: 3 form ada'],
  ]) { await go(path, 2500); record(label, Boolean(await js(check))); }
  await go('/laporan/cetak?periode=30', 4000);
  record('Laporan cetak: berisi ringkasan dan tabel', await waitFor("document.body.innerText.includes('Laporan penjualan') && document.querySelectorAll('table').length >= 3", 60000));
  const pdf = await send('Page.printToPDF', { printBackground: true });
  record('Laporan: bisa disimpan sebagai PDF', (pdf.data?.length ?? 0) > 10000, `${Math.round((pdf.data?.length ?? 0) * 0.75 / 1024)} KB`);
  if (pdf.data) writeFileSync(join(OUT, 'laporan.pdf'), Buffer.from(pdf.data, 'base64'));

  // Keyboard
  await go('/dashboard?periode=30', 2000);
  await key('Tab');
  record("Keyboard: Tab pertama ke 'Lewati ke konten'", await js("document.activeElement?.innerText === 'Lewati ke konten'"));
  record('Keyboard: indikator fokus terlihat', await js("getComputedStyle(document.activeElement).outlineStyle !== 'none'"));
  record('Kursor pointer pada tombol', await js("getComputedStyle(document.querySelector('[data-chat-open]')).cursor === 'pointer'"));

  // HP 360 px, dua tema
  await viewport(360, 780, true);
  for (const theme of ['light', 'dark']) {
    await js(`localStorage.setItem('iu-theme','${theme}')`);
    for (const path of ['/', '/masuk', '/dashboard?periode=30', '/produk?periode=30', '/waktu?periode=30', '/bundling?periode=90', '/menu?periode=30', '/data', '/langganan', '/pengaturan', '/laporan']) {
      await go(path, 1800);
      const sw = await js('document.documentElement.scrollWidth'), cw = await js('document.documentElement.clientWidth');
      const wide = sw > cw ? await js(`[...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1
        && !e.closest('.overflow-x-auto, .table-wrap') && !(e.parentElement && e.parentElement.getBoundingClientRect().right > innerWidth + 1))
        .slice(0, 3).map(e => e.tagName + '.' + String(e.className.baseVal ?? e.className).slice(0, 60)).join(' ; ')`) : '';
      record(`HP 360px ${theme}: ${path} tanpa geser samping`, sw <= cw, `${sw}/${cw}${wide ? ' ' + wide : ''}`);
    }
    await go('/dashboard?periode=30', 2000);
    await js("document.querySelector('[data-nav-toggle]').click()");
    await sleep(200);
    record(`HP ${theme}: tombol Menu membuka navigasi`, await js("getComputedStyle(document.getElementById('nav-utama')).display !== 'none'"));
    await key('Escape'); await sleep(200);
    record(`HP ${theme}: Escape menutup navigasi`, await js("getComputedStyle(document.getElementById('nav-utama')).display === 'none'"));
    const small = await js("[...document.querySelectorAll('main a.btn-primary, main button, [data-chat-open], [data-nav-toggle]')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43).map(e => e.innerText.trim() || e.getAttribute('aria-label')).slice(0, 5)");
    record(`HP ${theme}: target sentuh tombol minimal 44px`, !small.length, small.join(', '));
    await shot(`hp-dashboard-${theme}`);
  }
  await js("localStorage.setItem('iu-theme','light')");
} finally {
  ws?.close();
  edge.kill();
}
const errs = consoleErrors.filter((e) => e.trim());
record('Konsol browser tanpa error', !errs.length, errs.slice(0, 3).join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} lulus. Screenshot: ${OUT}`);
process.exit(0);
