"""Cek cepat chatbot lewat HTTP: tombol ada di HTML, riwayat, dan satu pertanyaan. Pakai: python -I chat_check.py"""

import re
import sys

import httpx

sys.stdout.reconfigure(encoding="utf-8")
c = httpx.Client(base_url="http://127.0.0.1:8000", timeout=120)
tok = re.search(r'name="csrf-token" content="([^"]+)"', c.get("/login").text).group(1)
c.post("/login", data={"_token": tok, "email": "demo@insightusaha.id", "password": "demo12345"})

for path in ["/dashboard?periode=30", "/produk?periode=30", "/data"]:
    html = c.get(path).text
    print(f"{path:24s} tombol 'Tanya data': {'ADA' if 'data-chat-open' in html else 'TIDAK ADA'}")

asset = re.search(r'/build/assets/(app-[^"]+\.js)', c.get("/dashboard").text)
js = c.get(f"/build/assets/{asset.group(1)}").text if asset else ""
print("aset JS memuat kode chat:", "data-chat-open" in js, asset.group(1) if asset else "-")

print("riwayat:", c.get("/tanya", headers={"Accept": "application/json"}).json() | {"pesan": "..."})
tok = re.search(r'name="csrf-token" content="([^"]+)"', c.get("/dashboard").text).group(1)
r = c.post("/tanya", json={"pesan": "Menu apa yang paling laku?", "periode": "30"},
           headers={"Accept": "application/json", "X-CSRF-TOKEN": tok})
print("tanya:", r.status_code, r.json().get("status"), (r.json().get("jawaban") or "")[:160])
