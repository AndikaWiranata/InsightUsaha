"""Membuat dataset contoh kedai kopi (±90 hari) untuk uji coba InsightUsaha."""

import csv
import random
import sys
from datetime import date, timedelta

rnd = random.Random(42)
MENU = [
    ("Kopi Susu Gula Aren", "Minuman", 18000, 30), ("Americano", "Minuman", 15000, 14),
    ("Cappuccino", "Minuman", 22000, 12), ("Es Teh Manis", "Minuman", 8000, 10),
    ("Matcha Latte", "Minuman", 25000, 6), ("Croissant", "Makanan", 22000, 10),
    ("Roti Bakar", "Makanan", 17000, 8), ("Donat Gula", "Makanan", 9000, 7),
    ("Pisang Goreng", "Makanan", 12000, 5), ("Nasi Goreng", "Makanan", 25000, 4),
]
HOUR_W = {7: 6, 8: 10, 9: 8, 10: 5, 11: 4, 12: 7, 13: 6, 14: 3, 15: 4, 16: 6, 17: 7, 18: 6, 19: 8, 20: 7, 21: 3}
out = sys.argv[1] if len(sys.argv) > 1 else "contoh-penjualan.csv"
start = date(2026, 8, 1)
trx = 0
with open(out, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["tanggal", "jam", "id_transaksi", "nama_produk", "kategori", "jumlah", "harga_satuan"])
    for d in range(92):
        day = start + timedelta(days=d)
        n = rnd.randint(70, 110) + (35 if day.weekday() >= 5 else 0)
        for _ in range(n):
            trx += 1
            hour = rnd.choices(list(HOUR_W), weights=list(HOUR_W.values()))[0]
            jam = f"{hour:02d}:{rnd.randint(0, 59):02d}"
            weights = [m[3] * (1 + d / 60 if m[0] == "Matcha Latte" else 1) * (1 - d / 140 if m[0] == "Roti Bakar" else 1) for m in MENU]
            items = {rnd.choices(MENU, weights=weights)[0]}
            if rnd.random() < 0.45:
                items.add(rnd.choices(MENU, weights=weights)[0])
            names = {m[0] for m in items}
            if "Croissant" in names and rnd.random() < 0.6:
                items.add(MENU[0])
            if "Pisang Goreng" in names and rnd.random() < 0.5:
                items.add(MENU[3])
            for m in items:
                qty = 1 if rnd.random() < 0.85 else 2
                w.writerow([day.isoformat(), jam, f"TRX{trx:06d}", m[0], m[1], qty, m[2]])
    # beberapa baris rusak untuk menguji validasi
    w.writerow(["2026-13-01", "10:00", "TRXBAD1", "Americano", "Minuman", 1, 15000])
    w.writerow(["2026-10-30", "10:00", "TRXBAD2", "Americano", "Minuman", "dua", 15000])
print(out, trx, "transaksi")
