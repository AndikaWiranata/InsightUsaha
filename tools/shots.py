"""Screenshot halaman untuk cek visual. Login via httpx, lalu teruskan cookie sesi ke Edge headless lewat CDP-less trick:
kita pakai URL login otomatis tidak tersedia, jadi cookie dimasukkan melalui file profil sementara tidak praktis.
Pendekatan sederhana: Edge headless dengan --remote-debugging tidak diperlukan; kita render HTML halaman yang sudah login
ke file lokal yang menunjuk aset absolut, lalu screenshot file tersebut."""

import pathlib
import re
import subprocess
import sys

import httpx

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE = "http://127.0.0.1:8000"
out = pathlib.Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)

c = httpx.Client(base_url=BASE, timeout=120)
r = c.get("/login")
tok = re.search(r'name="csrf-token" content="([^"]+)"', r.text).group(1)
c.post("/login", data={"_token": tok, "email": "demo@insightusaha.id", "password": "demo12345"})

pages = {"landing": "/", "dashboard": "/dashboard?periode=30", "produk": "/produk?periode=30", "waktu": "/waktu?periode=30",
         "bundling": "/bundling?periode=90", "data": "/data"}
for name, url in pages.items():
    html = (httpx.get(BASE + url, timeout=120).text if name == "landing" else c.get(url).text)
    html = html.replace('href="/', f'href="{BASE}/').replace('src="/', f'src="{BASE}/')
    html = re.sub(r'(href|src)="http://127\.0\.0\.1:8000', r'\1="' + BASE, html)
    # Disajikan dari origin yang sama (public/_shot) agar module script Vite bisa dimuat.
    served = pathlib.Path(__file__).resolve().parent.parent / "web" / "public" / "_shot"
    served.mkdir(exist_ok=True)
    f = served / f"{name}.html"
    f.write_text(html, encoding="utf-8")
    for w, suffix in ((1280, "desktop"), (390, "hp")):
        png = out / f"{name}-{suffix}.png"
        subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--window-size={w},2000",
                        "--virtual-time-budget=4000", f"--screenshot={png}", f"{BASE}/_shot/{name}.html"], check=False,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
        print(png, png.exists())
