"""Cek overflow horizontal tiap halaman pada lebar 360px (emulasi HP via Chrome DevTools Protocol)."""

import json
import re
import subprocess
import tempfile
import time

import httpx

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE = "http://127.0.0.1:8000"
PORT = 9333

# Login untuk mengambil cookie sesi.
c = httpx.Client(base_url=BASE, timeout=120)
tok = re.search(r'name="csrf-token" content="([^"]+)"', c.get("/login").text).group(1)
c.post("/login", data={"_token": tok, "email": "demo@insightusaha.id", "password": "demo12345"})
cookies = [{"name": k, "value": v, "domain": "127.0.0.1", "path": "/"} for k, v in c.cookies.items()]

profile = tempfile.mkdtemp()
proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", f"--remote-debugging-port={PORT}",
                         f"--user-data-dir={profile}", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            targets = httpx.get(f"http://127.0.0.1:{PORT}/json").json()
            break
        except Exception:
            time.sleep(0.2)
    ws_url = next(t["webSocketDebuggerUrl"] for t in targets if t["type"] == "page")

    from websockets.sync.client import connect  # type: ignore

    with connect(ws_url, max_size=50_000_000) as ws:
        msg_id = 0

        def send(method, params=None):
            global msg_id
            msg_id += 1
            ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
            while True:
                m = json.loads(ws.recv())
                if m.get("id") == msg_id:
                    return m.get("result", {})

        send("Network.enable")
        send("Network.setCookies", {"cookies": cookies})
        send("Emulation.setDeviceMetricsOverride", {"width": 360, "height": 800, "deviceScaleFactor": 2, "mobile": True})
        for url in ["/", "/dashboard?periode=30", "/produk?periode=30", "/waktu?periode=30", "/bundling?periode=90",
                    "/menu?periode=30", "/data", "/langganan", "/pengaturan", "/laporan", "/login", "/register"]:
            send("Page.navigate", {"url": BASE + url})
            time.sleep(2.5)
            r = send("Runtime.evaluate", {"expression": "JSON.stringify({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, "
                     "wide: [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.right > innerWidth + 1 && !e.closest('.overflow-x-auto, .table-wrap'); }).slice(0,3).map(e => e.tagName + '.' + (e.className.baseVal ?? e.className).toString().slice(0,60))})",
                     "returnByValue": True})
            info = json.loads(r["result"]["value"])
            status = "OK" if info["sw"] <= info["cw"] else "OVERFLOW"
            print(f"{url:28s} {status:8s} scrollWidth={info['sw']} clientWidth={info['cw']} {info['wide'] if status != 'OK' else ''}")
finally:
    proc.terminate()
