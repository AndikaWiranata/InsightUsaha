"""Uji ringkasan AI lewat aplikasi yang berjalan: python -I ai_check.py"""

import json
import re
import sys
import time

import httpx

sys.stdout.reconfigure(encoding="utf-8")

c = httpx.Client(base_url="http://127.0.0.1:8000", timeout=180)
tok = re.search(r'name="csrf-token" content="([^"]+)"', c.get("/login").text).group(1)
c.post("/login", data={"_token": tok, "email": "demo@insightusaha.id", "password": "demo12345"})

for p in ["30", "7"]:
    t0 = time.time()
    r = c.get(f"/dashboard/ringkasan-ai?periode={p}", headers={"Accept": "application/json"})
    print(f"periode {p} hari: HTTP {r.status_code}, {time.time() - t0:.1f}s")
    print(json.dumps(r.json(), ensure_ascii=False, indent=1))

t0 = time.time()
r = c.get("/dashboard/ringkasan-ai?periode=30", headers={"Accept": "application/json"})
print(f"panggilan ulang (dari cache): {time.time() - t0:.2f}s, status {r.json()['status']}")
