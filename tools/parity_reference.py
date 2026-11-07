"""Hasil acuan versi Python untuk dibandingkan dengan fungsi SQL versi Next.js.

Pakai: analytics/.venv/Scripts/python -I tools/parity_reference.py <csv> <keluaran.json> <hpp.json>
"""

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "analytics"))
from app import analysis, parsing  # noqa: E402

csv_path, out_path, hpp_path = sys.argv[1], sys.argv[2], sys.argv[3]
content = pathlib.Path(csv_path).read_bytes()
cleaned = parsing.clean_file(content, "data.csv", parsing.suggest_mapping(parsing.inspect_file(content, "data.csv")["kolom"]))
b = cleaned["baris"]
rows = {
    "tanggal": b["tanggal"], "jam": b["jam"],
    "trx": [f"k|{t}|{k}" if k is not None else f"i|{i}" for i, (t, k) in enumerate(zip(b["tanggal"], b["id_transaksi"]))],
    "punya_kode": [k is not None for k in b["id_transaksi"]],
    "produk": b["nama_produk"], "jumlah": b["jumlah"], "harga": b["harga_satuan"],
}
hpp = json.loads(pathlib.Path(hpp_path).read_text())

periods = {
    "30": {"mulai": "2026-10-02", "selesai": "2026-10-31", "lalu_mulai": "2026-09-02", "lalu_selesai": "2026-10-01"},
    "7": {"mulai": "2026-10-25", "selesai": "2026-10-31", "lalu_mulai": "2026-10-18", "lalu_selesai": "2026-10-24"},
    "90": {"mulai": "2026-08-03", "selesai": "2026-10-31", "lalu_mulai": "2026-05-05", "lalu_selesai": "2026-08-02"},
}
out = {
    "baris": {k: v for k, v in b.items() if k != "hash"},
    "periode": {
        key: analysis.run(["dashboard", "produk", "waktu", "bundling", "menu"], rows, p,
                          {"min_support": 0.01, "min_confidence": 0.30, "hpp": hpp})
        for key, p in periods.items()
    },
    "periode_tanggal": periods,
}
pathlib.Path(out_path).write_text(json.dumps(out, ensure_ascii=False, default=float), encoding="utf-8")
print("ok", len(b["tanggal"]), "baris")
