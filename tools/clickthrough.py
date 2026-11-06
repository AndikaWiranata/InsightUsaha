"""Uji klik nyata di Edge headless (CDP): kontrol, tema, chatbot, HP 360px, error konsol.

Pakai (server, queue, analytics berjalan): python -I clickthrough.py <folder-screenshot>
"""

import base64
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import time

import httpx
from websockets.sync.client import connect

sys.stdout.reconfigure(encoding="utf-8")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE = "http://127.0.0.1:8000"
PORT = 9334
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp())
OUT.mkdir(parents=True, exist_ok=True)

results: list[tuple[str, bool, str]] = []
console_errors: list[str] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(f"{'LULUS' if ok else 'GAGAL'}  {name}" + (f"  ({detail})" if detail else ""))


profile = tempfile.mkdtemp()
proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", f"--remote-debugging-port={PORT}",
                         f"--user-data-dir={profile}", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(60):
        try:
            targets = httpx.get(f"http://127.0.0.1:{PORT}/json").json()
            break
        except Exception:
            time.sleep(0.25)
    ws_url = next(t["webSocketDebuggerUrl"] for t in targets if t["type"] == "page")
    ws = connect(ws_url, max_size=100_000_000).__enter__()
    counter = [0]

    def send(method, params=None, timeout=60):
        counter[0] += 1
        my = counter[0]
        ws.send(json.dumps({"id": my, "method": method, "params": params or {}}))
        end = time.time() + timeout
        while time.time() < end:
            m = json.loads(ws.recv(timeout=timeout))
            if m.get("method") == "Runtime.exceptionThrown":
                console_errors.append(m["params"]["exceptionDetails"].get("exception", {}).get("description", "exception")[:200])
            elif m.get("method") == "Runtime.consoleAPICalled" and m["params"]["type"] == "error":
                console_errors.append(" ".join(str(a.get("value", a.get("description", ""))) for a in m["params"]["args"])[:200])
            elif m.get("method") == "Log.entryAdded" and m["params"]["entry"]["level"] == "error":
                e = m["params"]["entry"]
                if "favicon" not in e.get("url", ""):
                    console_errors.append(f"{e.get('text', '')[:160]} {e.get('url', '')}")
            if m.get("id") == my:
                return m.get("result", {})
        raise TimeoutError(method)

    def js(expr, wait=True):
        r = send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": wait})
        return r.get("result", {}).get("value")

    def go(path, settle=1.5):
        send("Page.navigate", {"url": BASE + path})
        time.sleep(settle)
        for _ in range(40):
            if js("document.readyState") == "complete":
                break
            time.sleep(0.2)

    def wait_for(expr, timeout=60):
        end = time.time() + timeout
        while time.time() < end:
            if js(expr):
                return True
            time.sleep(0.4)
        return False

    def shot(name):
        data = send("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True})["data"]
        (OUT / f"{name}.png").write_bytes(base64.b64decode(data))

    def viewport(w, h, mobile):
        send("Emulation.setDeviceMetricsOverride", {"width": w, "height": h, "deviceScaleFactor": 1, "mobile": mobile})

    def key(k, code=None):
        for t in ("keyDown", "keyUp"):
            send("Input.dispatchKeyEvent", {"type": t, "key": k, "code": code or k,
                                            "windowsVirtualKeyCode": {"Escape": 27, "Tab": 9, "Enter": 13}.get(k, 0)})

    send("Runtime.enable")
    send("Log.enable")
    send("Page.enable")
    viewport(1280, 900, False)

    # Publik
    go("/")
    record("Landing: tanpa em dash", js("!document.body.innerText.includes('\\u2014')"))
    record("Landing: satu h1, lang=id, title", js("document.querySelectorAll('h1').length===1 && document.documentElement.lang==='id' && !!document.title"))
    js("document.querySelector('a[href=\"#harga\"]').click()")
    time.sleep(0.5)
    record("Landing: tautan Harga menggulir ke #harga", js("location.hash==='#harga' && scrollY > 500"), f"scrollY={js('Math.round(scrollY)')}")

    # Tema: mulai dari terang (bawaan perangkat headless bisa gelap), lalu klik tombol.
    js("localStorage.setItem('iu-theme','light')")
    go("/")
    shot("landing-terang")
    record("Tema terang: latar kertas krem", js("getComputedStyle(document.body).backgroundColor==='rgb(246, 241, 231)'"))
    js("document.querySelector('[data-theme-toggle]').click()")
    record("Tombol tema: pindah ke gelap", js("document.documentElement.dataset.theme==='dark'"))
    record("Tombol tema: label & aria-pressed ikut berubah",
           js("(()=>{const b=document.querySelector('[data-theme-toggle]');return b.getAttribute('aria-pressed')==='true' && b.innerText.includes('terang')})()"))
    go("/")
    record("Tema gelap tersimpan setelah muat ulang", js("document.documentElement.dataset.theme==='dark'"))
    record("Tema gelap: latar benar-benar gelap", js("getComputedStyle(document.body).backgroundColor==='rgb(21, 18, 15)'"))
    shot("landing-gelap")
    js("document.querySelector('[data-theme-toggle]').click()")
    record("Tombol tema: kembali ke terang", js("document.documentElement.dataset.theme==='light'"))

    # Daftar: validasi kosong
    go("/register")
    js("document.querySelector('form[action$=\"/register\"]').submit()")
    time.sleep(2)
    record("Daftar: form kosong menampilkan validasi", js("document.querySelectorAll('.error').length >= 3"), f"{js('document.querySelectorAll(\".error\").length')} pesan")

    # Login: salah lalu benar
    go("/login")
    js("document.getElementById('email').value='demo@insightusaha.id';document.getElementById('password').value='salah';document.querySelector('form[action$=\"/login\"]').submit()")
    time.sleep(2)
    record("Login: sandi salah menampilkan pesan", js("document.body.innerText.includes('Email atau kata sandi salah')"))
    js("document.getElementById('password').value='demo12345';document.querySelector('form[action$=\"/login\"]').submit()")
    time.sleep(3)
    record("Login: berhasil masuk ke /dashboard", js("location.pathname==='/dashboard'"))

    # Dashboard
    go("/dashboard?periode=30", 2)
    record("Dashboard: stabilo pada omzet (satu titik fokus)", js("document.querySelectorAll('main .stabilo').length===1"))
    record("Dashboard: grafik tren tergambar", js("(()=>{const c=document.querySelector('[data-trend-chart]');return !!c && c.width>0})()"))
    ok = wait_for("!!document.querySelector('[data-ai-body] ol')", 60)
    record("Dashboard: ringkasan AI dimuat", ok)
    js("document.querySelector('[data-ai-feedback] button[data-value=membantu]').click()")
    time.sleep(1.5)
    record("Ringkasan: tombol 'Membantu' tersimpan", js("document.querySelector('[data-ai-feedback] button[data-value=membantu]').getAttribute('aria-pressed')==='true'"))
    href = js("[...document.querySelectorAll('[role=group] a')].find(a=>a.innerText.trim()==='Minggu').href")
    go(href.replace(BASE, ""), 2)
    record("Dashboard: kelompok 'Minggu' mengganti grafik", js("document.getElementById('tren-title').innerText.includes('minggu')"))
    js("document.querySelector('details summary').click()")
    record("Dashboard: 'Lihat angkanya dalam tabel' membuka tabel", js("document.querySelector('details').open"))
    js("const s=document.getElementById('periode'); s.value='7'; s.dispatchEvent(new Event('change'))")
    time.sleep(2.5)
    record("Filter periode: 7 hari memuat ulang halaman", js("location.search.includes('periode=7')"))
    js("const s=document.getElementById('periode'); s.value='kustom'; s.dispatchEvent(new Event('change'))")
    record("Filter periode: 'Rentang kustom' memunculkan tanggal", js("!document.querySelector('[data-custom]').classList.contains('hidden')"))
    shot("dashboard-terang")

    # Chatbot
    go("/dashboard?periode=30", 2)
    js("document.querySelector('[data-chat-open]').click()")
    time.sleep(0.5)
    record("Chat: tombol 'Tanya data' membuka panel", js("!document.querySelector('[data-chat-panel]').hidden"))
    record("Chat: fokus pindah ke kotak tanya", js("document.activeElement.id==='chat-input'"))
    wait_for("!document.querySelector('[data-chat-log]').innerText.includes('Memuat percakapan')", 10)
    if js("!document.querySelector('[data-chat-reset]').hidden"):
        js("document.querySelector('[data-chat-reset]').click()")
        time.sleep(1)
    js("document.querySelector('[data-chat-form] [type=submit]').click()")
    record("Chat: kirim kosong menampilkan validasi", js("!document.querySelector('[data-chat-error]').classList.contains('hidden')"))
    js("document.querySelector('[data-chat-starter]').click()")
    record("Chat: status memuat tampil saat menunggu", js("document.querySelector('[data-chat-log]').innerText.includes('Sedang membaca')"))
    ok = wait_for("document.querySelectorAll('[data-chat-log] > .flex.justify-start').length>=1 && !document.querySelector('[data-chat-log]').innerText.includes('Sedang membaca')", 60)
    answer = js("(()=>{const b=[...document.querySelectorAll('[data-chat-log] > .flex.justify-start')].pop();return b?b.innerText:''})()")
    note = js("(()=>{const n=document.querySelector('[data-chat-log] [role=alert]');return n?n.innerText:''})()")
    record("Chat: pertanyaan contoh dijawab", bool(ok and answer), (answer or note or "")[:90])
    input_q = "Hari apa paling sepi dan promo apa yang cocok?"
    js(f"const t=document.getElementById('chat-input'); t.value={json.dumps(input_q)}; t.dispatchEvent(new Event('input'))")
    key("Enter")
    time.sleep(0.3)
    ok = wait_for("document.querySelectorAll('[data-chat-log] > .flex.justify-start').length>=2 && !document.querySelector('[data-chat-log]').innerText.includes('Sedang membaca')", 60)
    answer2 = js("(()=>{const b=[...document.querySelectorAll('[data-chat-log] > .flex.justify-start')].pop();return b?b.innerText:''})()")
    record("Chat: Enter mengirim pertanyaan ketikan dan dijawab", bool(ok), (answer2 or "")[:90])
    shot("chat-terbuka")
    go("/produk?periode=30", 2)
    js("document.querySelector('[data-chat-open]').click()")
    ok = wait_for("document.querySelectorAll('[data-chat-log] > .flex').length>=4", 10)
    record("Chat: riwayat tetap ada di halaman lain", ok)
    js("document.querySelector('[data-chat-panel]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
    record("Chat: Escape menutup panel & fokus kembali ke tombol",
           js("document.querySelector('[data-chat-panel]').hidden && document.activeElement===document.querySelector('[data-chat-open]')"))

    # Halaman lain
    js("[...document.querySelectorAll('nav[aria-label] a')].find(a=>a.innerText.startsWith('Naik')).click()")
    time.sleep(2)
    record("Produk: saring 'Naik' hanya menampilkan menu naik",
           js("[...document.querySelectorAll('tbody tr td:nth-child(5)')].every(td=>td.innerText.includes('Naik'))"))
    for path, check, label in [
        ("/waktu?periode=30", "document.querySelectorAll('table.border-separate td[style]').length>50", "Jam ramai: heatmap terisi"),
        ("/bundling?periode=90", "document.querySelectorAll('main .stabilo').length===1", "Bundling: pasangan terkuat ditampilkan"),
        ("/menu?periode=30", "!!document.querySelector('main svg[role=img]') || document.body.innerText.includes('Isi HPP')", "Klasifikasi menu: peta atau ajakan isi HPP"),
        ("/laporan", "!!document.querySelector('a[href*=\"/laporan/pdf\"]')", "Laporan: tombol unduh PDF ada"),
        ("/data", "!!document.querySelector('input[type=file]')", "Data: form unggah ada"),
        ("/langganan", "!!document.querySelector('form[action$=\"/langganan/bayar\"]')", "Langganan: tombol bayar ada"),
        ("/pengaturan", "document.querySelectorAll('form').length>=3", "Pengaturan: 3 form ada"),
    ]:
        go(path, 2)
        record(label, bool(js(check)))
    pdf = httpx.Client(base_url=BASE, cookies={c["name"]: c["value"] for c in send("Network.getCookies")["cookies"]}, timeout=120)
    r = pdf.get("/laporan/pdf?periode=30")
    record("Laporan: PDF terunduh", r.status_code == 200 and r.headers.get("content-type") == "application/pdf", f"{len(r.content)} byte")

    # Data: file salah format ditolak sebelum diunggah (validasi klien)
    go("/data", 2)
    js("""(()=>{const i=document.getElementById('file');const dt=new DataTransfer();dt.items.add(new File(['x'],'laporan.pdf',{type:'application/pdf'}));i.files=dt.files;i.dispatchEvent(new Event('change'))})()""")
    record("Data: file .pdf ditolak sebelum diunggah",
           js("!document.querySelector('[data-file-error]').classList.contains('hidden') && document.querySelector('form[action$=\"/data\"] [type=submit]').disabled"))

    # Keyboard: Tab pertama ke "Lewati ke konten", fokus terlihat
    go("/dashboard?periode=30", 2)
    key("Tab")
    record("Keyboard: Tab pertama ke 'Lewati ke konten'", js("document.activeElement.innerText==='Lewati ke konten'"))
    record("Keyboard: indikator fokus terlihat", js("getComputedStyle(document.activeElement).outlineStyle!=='none'"))
    record("Kursor pointer pada tombol", js("getComputedStyle(document.querySelector('[data-chat-open]')).cursor==='pointer'"))

    # HP 360px, dua tema
    viewport(360, 780, True)
    for theme in ("light", "dark"):
        js(f"localStorage.setItem('iu-theme','{theme}')")
        for path in ["/", "/dashboard?periode=30", "/produk?periode=30", "/waktu?periode=30", "/bundling?periode=90",
                     "/menu?periode=30", "/data", "/langganan", "/pengaturan", "/laporan"]:
            go(path, 1.8)
            sw, cw = js("document.documentElement.scrollWidth"), js("document.documentElement.clientWidth")
            record(f"HP 360px {theme}: {path} tanpa geser samping", sw <= cw, f"{sw}/{cw}")
        go("/dashboard?periode=30", 2)
        js("document.querySelector('[data-nav-toggle]').click()")
        record(f"HP {theme}: tombol Menu membuka navigasi", js("!document.querySelector('[data-nav]').classList.contains('hidden')"))
        key("Escape")
        record(f"HP {theme}: Escape menutup navigasi", js("document.querySelector('[data-nav]').classList.contains('hidden')"))
        small = js("[...document.querySelectorAll('main a.btn-primary, main button, [data-chat-open], [data-nav-toggle]')].filter(e=>e.offsetParent && e.getBoundingClientRect().height<43).map(e=>e.innerText.trim()||e.getAttribute('aria-label')).slice(0,5)")
        record(f"HP {theme}: target sentuh tombol >= 44px", not small, ", ".join(small or []))
        shot(f"hp-dashboard-{theme}")
        js("document.querySelector('[data-chat-open]').click()")
        time.sleep(1.5)
        shot(f"hp-chat-{theme}")
        js("document.querySelector('[data-chat-close]').click()")
    js("localStorage.setItem('iu-theme','light')")
finally:
    proc.terminate()

errs = [e for e in console_errors if e.strip()]
record("Konsol browser tanpa error", not errs, " | ".join(errs[:3]))
failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} lulus. Screenshot: {OUT}")
