import './bootstrap';
import {
    Chart, LineController, BarController, LineElement, BarElement, PointElement, LinearScale, CategoryScale,
    Tooltip, Filler,
} from 'chart.js';

Chart.register(LineController, BarController, LineElement, BarElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

const root = document.documentElement;
const token = (name) => getComputedStyle(root).getPropertyValue(name).trim();
const rupiah = (v) => 'Rp' + Math.round(v).toLocaleString('id-ID');
const compact = (v) => {
    if (Math.abs(v) >= 1e9) return (v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' M';
    if (Math.abs(v) >= 1e6) return (v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';
    if (Math.abs(v) >= 1e3) return (v / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 }) + ' rb';
    return v.toLocaleString('id-ID');
};
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Tema
const themeButtons = document.querySelectorAll('[data-theme-toggle]');
const syncThemeButtons = () => {
    const dark = root.getAttribute('data-theme') === 'dark';
    themeButtons.forEach((b) => {
        b.setAttribute('aria-pressed', dark ? 'true' : 'false');
        b.querySelector('[data-theme-label]').textContent = dark ? 'Tema terang' : 'Tema gelap';
    });
};
themeButtons.forEach((b) => b.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('iu-theme', next); } catch (e) { /* mode privat: abaikan */ }
    syncThemeButtons();
    charts.forEach((c) => c.restyle());
}));
syncThemeButtons();

// Grafik
const charts = [];

function chartColors() {
    return {
        brand: token('--c-brand'), surface: token('--c-surface'), ink: token('--c-ink'),
        muted: token('--c-muted'), grid: token('--c-grid'), line: token('--c-line'),
    };
}

function baseOptions(c) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: reducedMotion ? false : { duration: 250 },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: c.ink, titleColor: c.surface, bodyColor: c.surface,
                padding: 10, cornerRadius: 6, displayColors: false,
                titleFont: { family: token('--font-sans'), weight: '700' }, bodyFont: { family: token('--font-sans') },
            },
        },
        scales: {
            x: { grid: { display: false }, border: { color: c.line }, ticks: { color: c.muted, maxRotation: 0, autoSkipPadding: 16 } },
            y: { beginAtZero: true, border: { display: false }, grid: { color: c.grid }, ticks: { color: c.muted, maxTicksLimit: 5 } },
        },
    };
}

// Tren omzet: satu seri, satu sumbu. Batang bila titiknya sedikit, garis bila banyak.
function trendChart(el) {
    const data = JSON.parse(el.dataset.chart);
    const bar = data.label.length <= 14;
    const build = () => {
        const c = chartColors();
        const opts = baseOptions(c);
        opts.interaction = { mode: 'index', intersect: false };
        opts.plugins.tooltip.callbacks = {
            label: (ctx) => [rupiah(ctx.parsed.y), data.transaksi[ctx.dataIndex].toLocaleString('id-ID') + ' transaksi'],
        };
        opts.scales.y.ticks.callback = (v) => compact(v);
        return {
            type: bar ? 'bar' : 'line',
            data: {
                labels: data.label,
                datasets: [{
                    label: 'Omzet', data: data.omzet,
                    backgroundColor: bar ? c.brand : 'transparent', borderColor: c.brand, borderWidth: 2,
                    borderRadius: bar ? { topLeft: 3, topRight: 3 } : 0, borderSkipped: 'bottom', maxBarThickness: 32,
                    pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: c.brand,
                    pointHoverBorderColor: c.surface, pointHoverBorderWidth: 2, tension: 0.2,
                }],
            },
            options: opts,
        };
    };
    let chart = new Chart(el, build());
    charts.push({ restyle: () => { chart.destroy(); chart = new Chart(el, build()); } });
}

function dayChart(el) {
    const data = JSON.parse(el.dataset.chart);
    const build = () => {
        const c = chartColors();
        const opts = baseOptions(c);
        opts.plugins.tooltip.callbacks = { label: (ctx) => ctx.parsed.y.toLocaleString('id-ID') + ' transaksi per hari' };
        return {
            type: 'bar',
            data: {
                labels: data.label,
                datasets: [{
                    label: 'Rata-rata transaksi per hari', data: data.nilai, backgroundColor: c.brand,
                    borderRadius: { topLeft: 3, topRight: 3 }, borderSkipped: 'bottom', maxBarThickness: 40,
                }],
            },
            options: opts,
        };
    };
    let chart = new Chart(el, build());
    charts.push({ restyle: () => { chart.destroy(); chart = new Chart(el, build()); } });
}

document.querySelectorAll('[data-trend-chart]').forEach(trendChart);
document.querySelectorAll('[data-day-chart]').forEach(dayChart);

// Ringkasan AI
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const aiBox = document.querySelector('[data-ai-summary]');
if (aiBox) {
    const body = aiBox.querySelector('[data-ai-body]');
    const fb = aiBox.querySelector('[data-ai-feedback]');
    const failed = () => {
        body.innerHTML = '<p class="text-sm text-ink-2">Ringkasan belum tersedia. Angka di halaman ini tetap bisa kamu pakai. '
            + '<button type="button" class="font-semibold text-brand underline underline-offset-2" data-ai-retry>Coba lagi</button></p>';
        body.querySelector('[data-ai-retry]').addEventListener('click', load);
    };
    const markFeedback = (v) => {
        fb.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.value === v ? 'true' : 'false'));
        fb.querySelector('[data-thanks]').classList.remove('hidden');
    };
    function load() {
        body.innerHTML = '<p class="text-sm text-muted" role="status">Menyusun ringkasan dari angka di atas…</p>';
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 90000);
        fetch(aiBox.dataset.url, { headers: { Accept: 'application/json' }, signal: ctrl.signal })
            .then((r) => r.json())
            .then((res) => {
                if (res.status !== 'ok') return failed();
                body.innerHTML =
                    '<h3 class="text-sm font-bold">Yang terjadi</h3>'
                    + '<ul class="mt-2 list-disc space-y-2 pl-5 text-sm marker:text-muted">' + res.temuan.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>'
                    + '<h3 class="mt-5 text-sm font-bold">Yang bisa kamu lakukan</h3>'
                    + '<ol class="mt-2 space-y-2 text-sm">' + res.saran.map((t, i) => '<li class="flex gap-2.5"><span class="tabular font-extrabold text-brand">' + (i + 1) + '.</span><span>' + esc(t) + '</span></li>').join('') + '</ol>';
                fb.classList.remove('hidden');
                fb.dataset.periode = res.periode;
                if (res.umpan_balik) markFeedback(res.umpan_balik);
            })
            .catch(failed)
            .finally(() => clearTimeout(timer));
    }
    fb.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        window.axios.post(fb.dataset.url, { periode: fb.dataset.periode, nilai: b.dataset.value }).then(() => markFeedback(b.dataset.value));
    }));
    load();
}

// Chatbot
const chat = document.querySelector('[data-chat]');
if (chat) {
    const openBtn = chat.querySelector('[data-chat-open]');
    const panel = chat.querySelector('[data-chat-panel]');
    const closeBtn = chat.querySelector('[data-chat-close]');
    const resetBtn = chat.querySelector('[data-chat-reset]');
    const log = chat.querySelector('[data-chat-log]');
    const empty = chat.querySelector('[data-chat-empty]');
    const form = chat.querySelector('[data-chat-form]');
    const input = form.querySelector('textarea');
    const submit = form.querySelector('[type=submit]');
    const errorEl = chat.querySelector('[data-chat-error]');
    const periodNote = chat.querySelector('[data-chat-period]');
    const period = JSON.parse(chat.dataset.period || '{}');
    let loaded = false;
    let busy = false;

    const bubble = (role, text, extra = '') => {
        const wrap = document.createElement('div');
        wrap.className = role === 'user' ? 'flex justify-end' : 'flex justify-start';
        const b = document.createElement('div');
        b.className = role === 'user'
            ? 'max-w-[85%] rounded-card rounded-br-sm bg-ink px-3.5 py-2.5 text-sm text-surface'
            : 'max-w-[90%] rounded-card rounded-bl-sm border border-line bg-paper px-3.5 py-2.5 text-sm text-ink';
        // Teks ditampilkan apa adanya (bukan HTML) untuk mencegah injeksi; baris baru dipertahankan.
        b.style.whiteSpace = 'pre-line';
        // Bersihkan sisa markdown dari model: **tebal** dan butir "* " / "- " jadi "• ".
        b.textContent = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^[ \t]*[*-][ \t]+/gm, '• ');
        if (extra) {
            const note = document.createElement('p');
            note.className = 'mt-1.5 text-xs text-muted';
            note.textContent = extra;
            b.appendChild(note);
        }
        wrap.appendChild(b);
        log.appendChild(wrap);
        log.scrollTop = log.scrollHeight;
        return wrap;
    };
    const systemNote = (text, retryQuestion = null) => {
        const p = document.createElement('div');
        p.className = 'rounded-control border border-line bg-warn-soft px-3 py-2 text-sm text-warn-ink';
        p.setAttribute('role', 'alert');
        p.textContent = text + ' ';
        if (retryQuestion) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'font-semibold underline underline-offset-2';
            btn.textContent = 'Kirim ulang';
            btn.addEventListener('click', () => { p.remove(); send(retryQuestion, false); });
            p.appendChild(btn);
        }
        log.appendChild(p);
        log.scrollTop = log.scrollHeight;
    };
    const setBusy = (v) => {
        busy = v;
        submit.disabled = v;
        input.disabled = v;
        chat.querySelectorAll('[data-chat-starter]').forEach((b) => { b.disabled = v; });
    };

    function loadHistory() {
        if (loaded) return;
        loaded = true;
        const loading = document.createElement('p');
        loading.className = 'text-sm text-muted';
        loading.setAttribute('role', 'status');
        loading.textContent = 'Memuat percakapan…';
        log.appendChild(loading);
        fetch(chat.dataset.historyUrl, { headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((res) => {
                loading.remove();
                if (!res.aktif) {
                    empty.hidden = true;
                    systemNote('Fitur tanya data belum aktif karena API AI belum diatur oleh pengelola aplikasi.');
                    setBusy(true);
                    return;
                }
                if (!res.punya_data) {
                    empty.hidden = true;
                    bubble('bot', 'Belum ada data penjualan. Unggah file penjualan dulu di halaman Data penjualan, nanti aku bisa menjawab pertanyaanmu.');
                    return;
                }
                if (res.pesan.length) {
                    empty.hidden = true;
                    resetBtn.hidden = false;
                    res.pesan.forEach((m) => bubble(m.role, m.text, m.role === 'bot' && m.periode ? 'Periode ' + m.periode : ''));
                }
            })
            .catch(() => { loading.remove(); systemNote('Percakapan sebelumnya tidak bisa dimuat.'); });
    }

    function send(question, echo = true) {
        if (busy) return;
        errorEl.classList.add('hidden');
        empty.hidden = true;
        resetBtn.hidden = false;
        if (echo) bubble('user', question);
        setBusy(true);
        const typing = bubble('bot', 'Sedang membaca angka analisis…');
        typing.querySelector('div').classList.add('text-muted');
        typing.setAttribute('role', 'status');
        window.axios.post(chat.dataset.url, { pesan: question, ...period }, { timeout: 60000 })
            .then(({ data }) => {
                typing.remove();
                if (data.periode) periodNote.textContent = 'Menjawab dari periode ' + data.periode + '.';
                if (data.status === 'ok' || data.status === 'tanpa_data') {
                    bubble('bot', data.jawaban);
                } else if (data.status === 'ditolak') {
                    systemNote('Aku belum bisa menjawab ini dengan angka yang pasti dari analisis. Coba tanyakan dengan cara lain.');
                } else if (data.status === 'nonaktif') {
                    systemNote('Fitur tanya data belum aktif karena API AI belum diatur.');
                } else {
                    systemNote('Jawaban gagal dibuat.', question);
                }
            })
            .catch((err) => {
                typing.remove();
                const msg = err.response?.status === 429 ? 'Terlalu banyak pertanyaan. Tunggu sebentar.'
                    : err.response?.data?.message || 'Koneksi bermasalah.';
                systemNote(msg, err.response?.status === 429 ? null : question);
            })
            .finally(() => { setBusy(false); input.focus(); });
    }

    const open = () => {
        panel.hidden = false;
        openBtn.setAttribute('aria-expanded', 'true');
        openBtn.hidden = true;
        loadHistory();
        input.focus();
    };
    const close = () => {
        panel.hidden = true;
        openBtn.hidden = false;
        openBtn.setAttribute('aria-expanded', 'false');
        openBtn.focus();
    };

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    chat.querySelectorAll('[data-chat-starter]').forEach((b) => b.addEventListener('click', () => send(b.textContent.trim())));
    resetBtn.addEventListener('click', () => {
        window.axios.delete(chat.dataset.url).then(() => {
            log.querySelectorAll(':scope > :not([data-chat-empty])').forEach((n) => n.remove());
            empty.hidden = false;
            resetBtn.hidden = true;
            input.focus();
        });
    });
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) {
            errorEl.textContent = 'Tulis pertanyaan dulu.';
            errorEl.classList.remove('hidden');
            input.focus();
            return;
        }
        input.value = '';
        input.style.height = '';
        send(q);
    });
    // Enter mengirim, Shift+Enter baris baru; tinggi kotak mengikuti isi.
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
    });
    input.addEventListener('input', () => { input.style.height = ''; input.style.height = Math.min(input.scrollHeight, 128) + 'px'; });
}

// Progres impor (F2)
const progress = document.querySelector('[data-upload-progress]');
if (progress) {
    const bar = progress.querySelector('[data-bar]');
    const text = progress.querySelector('[data-text]');
    const meter = progress.querySelector('[role=progressbar]');
    const poll = () => fetch(progress.dataset.url, { headers: { Accept: 'application/json' } })
        .then((r) => r.json())
        .then((s) => {
            bar.style.width = s.progres + '%';
            text.textContent = s.progres + '%';
            meter.setAttribute('aria-valuenow', s.progres);
            if (s.selesai) window.location.reload();
            else setTimeout(poll, 1500);
        })
        .catch(() => setTimeout(poll, 3000));
    poll();
}

// Validasi file sebelum unggah (F2)
document.querySelectorAll('input[type=file][data-accept-ext]').forEach((input) => {
    const exts = input.dataset.acceptExt.split(',');
    const form = input.closest('form');
    const msg = form.querySelector('[data-file-error]');
    const submit = form.querySelector('[type=submit]');
    const label = form.querySelector('[data-file-name]');
    input.addEventListener('change', () => {
        const f = input.files[0];
        if (!f) return;
        const ext = f.name.split('.').pop().toLowerCase();
        let err = '';
        if (!exts.includes(ext)) err = 'Format file tidak didukung. Gunakan file .xlsx atau .csv.';
        else if (f.size > 10 * 1024 * 1024) err = 'Ukuran file maksimal 10 MB.';
        if (label) label.textContent = err ? 'Pilih file .xlsx atau .csv' : f.name;
        msg.textContent = err;
        msg.classList.toggle('hidden', !err);
        if (submit) submit.disabled = !!err;
        if (err) input.value = '';
    });
});

// Tombol kirim berubah jadi status proses agar tidak diklik dua kali.
document.querySelectorAll('form[data-busy-label]').forEach((f) => f.addEventListener('submit', () => {
    const b = f.querySelector('[type=submit]');
    if (b && !b.disabled) { setTimeout(() => { b.disabled = true; b.textContent = f.dataset.busyLabel; }, 0); }
}));

// Filter periode
document.querySelectorAll('[data-period-form]').forEach((form) => {
    const sel = form.querySelector('select[name=periode]');
    const custom = form.querySelector('[data-custom]');
    const sync = () => custom.classList.toggle('hidden', sel.value !== 'kustom');
    sel.addEventListener('change', () => { sync(); if (sel.value !== 'kustom') form.submit(); });
    sync();
});

// Menu HP
const toggle = document.querySelector('[data-nav-toggle]');
if (toggle) {
    const nav = document.querySelector('[data-nav]');
    const label = toggle.querySelector('span');
    const setOpen = (open) => {
        nav.classList.toggle('hidden', !open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (label) label.textContent = open ? 'Tutup' : 'Menu';
    };
    toggle.addEventListener('click', () => setOpen(nav.classList.contains('hidden')));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !nav.classList.contains('hidden') && window.innerWidth < 1024) { setOpen(false); toggle.focus(); }
    });
}

// Konfirmasi aksi berbahaya
document.querySelectorAll('form[data-confirm]').forEach((f) => f.addEventListener('submit', (e) => {
    if (!window.confirm(f.dataset.confirm)) e.preventDefault();
}));
