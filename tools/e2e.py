"""Uji alur nyata: login -> (opsional) unggah -> tunggu impor -> buka semua halaman.

Pakai: python -I e2e.py [file.csv]
"""

import re
import sys
import time

import httpx

BASE = "http://127.0.0.1:8000"
c = httpx.Client(base_url=BASE, follow_redirects=False, timeout=180)


def token(html: str) -> str:
    return re.search(r'name="csrf-token" content="([^"]+)"', html).group(1)


r = c.get("/login")
r = c.post("/login", data={"_token": token(r.text), "email": "demo@insightusaha.id", "password": "demo12345"})
print("login", r.status_code, r.headers.get("location"))

if len(sys.argv) > 1:
    t = token(c.get("/data").text)
    t0 = time.time()
    with open(sys.argv[1], "rb") as f:
        r = c.post("/data", data={"_token": t}, files={"file": ("contoh-penjualan.csv", f, "text/csv")})
    loc = r.headers.get("location", "")
    print("unggah", r.status_code, loc)
    uid = re.search(r"/data/(\d+)", loc).group(1)
    while True:
        s = c.get(f"/data/{uid}/status").json()
        if s["selesai"]:
            break
        time.sleep(1)
    print("impor", s["status"], f"{time.time() - t0:.1f} detik")

for url in ["/dashboard?periode=30", "/dashboard?periode=90&granularitas=mingguan", "/produk?periode=30",
            "/produk?periode=30&label=Naik", "/waktu?periode=30", "/bundling?periode=90", "/menu?periode=30",
            "/laporan", "/langganan", "/pengaturan", "/data"]:
    t1 = time.time()
    r = c.get(url)
    err = re.search(r"Analisis belum bisa ditampilkan[^<]*", r.text)
    print(f"{url:45s} {r.status_code} {time.time() - t1:5.2f}s", err.group(0) if err else "")

r = c.get("/dashboard/ringkasan-ai?periode=30", headers={"Accept": "application/json"})
print("ringkasan-ai", r.status_code, r.text[:160])
r = c.get("/laporan/pdf?periode=30")
print("pdf", r.status_code, r.headers.get("content-type"), len(r.content), "byte")
