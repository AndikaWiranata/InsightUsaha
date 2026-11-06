"""Test acceptance criteria F2–F7 pada dataset uji kecil yang bisa dihitung manual."""

from __future__ import annotations

import io

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from mlxtend.frequent_patterns import apriori, association_rules

from app import analysis, parsing
from app.main import app

client = TestClient(app)

CSV = """tanggal,jam,id_transaksi,nama_produk,kategori,jumlah,harga_satuan
2026-10-01,08:15,TRX001,Kopi Susu Gula Aren,Minuman,2,18000
2026-10-01,08:15,TRX001,Croissant,Makanan,1,22000
2026-10-01,09:40,TRX002,Americano,Minuman,1,15000
2026-10-01,09:40,TRX002,americano ,Minuman,1,15000
,10:00,TRX003,Americano,Minuman,1,15000
2026-13-40,10:00,TRX004,Americano,Minuman,1,15000
2026-10-02,10:00,TRX005,Americano,Minuman,abc,15000
2026-10-02,10:30,TRX006,Croissant,Makanan,1,22000
,,,,,,
2026-10-01,08:15,TRX001,Croissant,Makanan,1,22000
"""


def clean(csv: str = CSV, mapping=None):
    content = csv.encode()
    mapping = mapping or parsing.suggest_mapping(list(pd.read_csv(io.StringIO(csv)).columns))
    return parsing.clean_file(content, "data.csv", mapping)


# F2
def test_rejects_non_csv_xlsx_files():
    r = client.post("/inspect", files={"file": ("data.pdf", b"%PDF", "application/pdf")})
    assert r.status_code == 422
    assert ".xlsx" in r.json()["detail"]


def test_invalid_rows_are_skipped_and_reported_not_fatal():
    res = clean()
    s = res["ringkasan"]
    # Baris valid: TRX001 x2, TRX002 x2 (americano dinormalisasi; jumlah/harga sama -> duplikat), TRX006
    assert s["jumlah_baris_valid"] == 4
    assert s["duplikat_dihapus"] == 2
    assert s["jumlah_baris_ditolak"] == 3
    assert s["alasan_ditolak"]["Tanggal kosong atau tidak valid"] == 2
    assert s["alasan_ditolak"]["Jumlah harus angka bulat lebih dari 0"] == 1
    assert {r["baris"] for r in res["ditolak"]} == {6, 7, 8}
    assert s["tanggal_mulai"] == "2026-10-01" and s["tanggal_selesai"] == "2026-10-02"


def test_product_names_are_normalized():
    res = clean()
    assert set(res["baris"]["nama_produk"]) == {"Kopi Susu Gula Aren", "Croissant", "Americano"}


def test_mapping_suggestion_and_custom_columns():
    csv = "Tgl,Nama Menu,Qty,Harga\n01/10/2026,Es Teh,3,\"5.000\"\n"
    m = parsing.suggest_mapping(["Tgl", "Nama Menu", "Qty", "Harga"])
    assert m["tanggal"] == "Tgl" and m["nama_produk"] == "Nama Menu"
    assert m["jumlah"] == "Qty" and m["harga_satuan"] == "Harga"
    res = parsing.clean_file(csv.encode(), "x.csv", m)
    assert res["baris"]["tanggal"] == ["2026-10-01"]
    assert res["baris"]["harga_satuan"] == [5000.0]


def test_missing_required_columns_reported():
    info = parsing.inspect_file(b"a,b\n1,2\n", "x.csv")
    assert set(info["kolom_wajib_kurang"]) == set(parsing.REQUIRED)


def test_xlsx_is_supported():
    buf = io.BytesIO()
    pd.DataFrame({"tanggal": pd.to_datetime(["2026-10-01"]), "nama_produk": ["Kopi"], "jumlah": [2],
                  "harga_satuan": [10000]}).to_excel(buf, index=False)
    res = parsing.clean_file(buf.getvalue(), "x.xlsx", parsing.suggest_mapping(
        ["tanggal", "nama_produk", "jumlah", "harga_satuan"]))
    assert res["ringkasan"]["jumlah_baris_valid"] == 1
    assert res["baris"]["tanggal"] == ["2026-10-01"]


# helpers
def rows(records):
    """records: (tanggal, jam, trx, produk, jumlah, harga[, punya_kode])"""
    out = {k: [] for k in ("tanggal", "jam", "trx", "punya_kode", "produk", "jumlah", "harga")}
    for r in records:
        out["tanggal"].append(r[0]); out["jam"].append(r[1]); out["trx"].append(r[2])
        out["produk"].append(r[3]); out["jumlah"].append(r[4]); out["harga"].append(r[5])
        out["punya_kode"].append(r[6] if len(r) > 6 else True)
    return out


PERIOD = {"mulai": "2026-10-08", "selesai": "2026-10-14", "lalu_mulai": "2026-10-01", "lalu_selesai": "2026-10-07"}


# F3
def test_dashboard_matches_manual_calculation():
    data = rows([
        ("2026-10-02", "08:00", 1, "Kopi", 2, 10000),   # periode lalu: omzet 20.000, 1 trx
        ("2026-10-08", "08:00", 2, "Kopi", 3, 10000),   # periode ini
        ("2026-10-08", "08:00", 2, "Roti", 1, 15000),
        ("2026-10-09", "12:00", 3, "Kopi", 1, 10000),
    ])
    d = analysis.run(["dashboard"], data, PERIOD)["dashboard"]
    s = d["ringkasan"]
    # Manual: omzet = 30.000 + 15.000 + 10.000 = 55.000; transaksi = 2; rata2 = 27.500
    assert s["omzet"] == 55000
    assert s["transaksi"] == 2
    assert s["rata_rata_transaksi"] == 27500
    assert s["produk_terlaris"]["nama"] == "Kopi" and s["produk_terlaris"]["unit"] == 4
    assert d["perubahan"]["omzet"] == 175.0       # (55.000-20.000)/20.000
    assert d["perubahan"]["transaksi"] == 100.0
    assert d["perubahan"]["produk_terlaris_unit"] == 100.0  # 4 vs 2 unit
    assert d["tren"]["granularitas"] == "harian"
    assert len(d["tren"]["label"]) == 7
    assert d["tren"]["omzet"][0] == 45000 and d["tren"]["omzet"][1] == 10000


# F4
def test_product_change_formula_and_labels():
    data = rows(
        [("2026-10-02", None, i, "Naik", 1, 1000) for i in range(10)]
        + [("2026-10-09", None, 100 + i, "Naik", 1, 1000) for i in range(15)]      # +50%
        + [("2026-10-02", None, 200 + i, "Turun", 1, 1000) for i in range(20)]
        + [("2026-10-09", None, 300 + i, "Turun", 1, 1000) for i in range(10)]     # -50%
        + [("2026-10-02", None, 400 + i, "Stabil", 1, 1000) for i in range(10)]
        + [("2026-10-09", None, 500 + i, "Stabil", 1, 1000) for i in range(10)]    # 0%
        + [("2026-10-09", None, 600 + i, "Baru", 1, 1000) for i in range(6)]       # baru
        + [("2026-10-02", None, 700, "Sedikit", 2, 1000), ("2026-10-09", None, 701, "Sedikit", 4, 1000)]
    )
    p = {i["nama"]: i for i in analysis.run(["produk"], data, PERIOD)["produk"]["produk"]}
    assert p["Naik"]["perubahan"] == pytest.approx((15 - 10) / 10 * 100) and p["Naik"]["label"] == "Naik"
    assert p["Turun"]["perubahan"] == -50.0 and p["Turun"]["label"] == "Turun"
    assert p["Stabil"]["label"] == "Stabil"
    assert p["Baru"]["label"] == "Produk Baru"
    assert p["Sedikit"]["label"] is None  # < 5 unit di kedua periode
    assert p["Sedikit"]["perubahan"] == 100.0


# F5
def test_heatmap_with_hours():
    data = rows([("2026-10-12", "08:10", i, "Kopi", 1, 1000) for i in range(5)]
                + [("2026-10-12", "13:00", 10, "Kopi", 1, 1000)])
    w = analysis.run(["waktu"], data, PERIOD)["waktu"]
    assert w["punya_jam"] is True
    assert w["heatmap"]["hari"][0] == "Senin"
    assert w["tersibuk"][0] == {"hari": "Senin", "jam": "08.00–09.00", "transaksi": 5}


def test_heatmap_falls_back_to_per_day_without_hours():
    data = rows([("2026-10-12", None, i, "Kopi", 1, 1000) for i in range(5)]
                + [("2026-10-13", None, 10, "Kopi", 1, 1000)])
    w = analysis.run(["waktu"], data, PERIOD)["waktu"]
    assert w["punya_jam"] is False and w["heatmap"] is None
    assert len(w["per_hari"]) == 7
    assert w["tersibuk"][0]["hari"] == "Senin"


# F6
def _basket_data():
    import random
    rnd = random.Random(7)
    recs, trx = [], 0
    menu = ["Kopi Susu", "Croissant", "Americano", "Teh", "Donat"]
    for _ in range(300):
        trx += 1
        k = rnd.sample(menu, rnd.randint(1, 3))
        if "Croissant" in k and "Kopi Susu" not in k and rnd.random() < 0.7:
            k.append("Kopi Susu")
        for item in k:
            recs.append(("2026-10-10", "09:00", trx, item, 1, 10000))
    return rows(recs)


def test_bundling_matches_mlxtend():
    data = _basket_data()
    b = analysis.run(["bundling"], data, PERIOD, {"min_support": 0.01, "min_confidence": 0.3})["bundling"]
    assert b["status"] == "ok"

    df = pd.DataFrame({"trx": data["trx"], "produk": data["produk"]})
    m = pd.crosstab(df["trx"], df["produk"]).gt(0)
    freq = apriori(m, min_support=0.01, use_colnames=True, max_len=2)
    ref = association_rules(freq, num_itemsets=len(m), metric="confidence", min_threshold=0.3)
    ref = ref[ref["lift"] > 1]
    expected = {(next(iter(r.antecedents)), next(iter(r.consequents))): r for r in ref.itertuples()}

    got = {(r["jika"], r["maka"]): r for r in b["aturan"]}
    assert set(got) == set(expected)
    for key, r in got.items():
        assert r["support"] == pytest.approx(expected[key].support, abs=1e-4)
        assert r["confidence"] == pytest.approx(expected[key].confidence, abs=1e-4)
        assert r["lift"] == pytest.approx(expected[key].lift, abs=1e-3)
    lifts = [r["lift"] for r in b["aturan"]]
    assert lifts == sorted(lifts, reverse=True)
    assert all(l > 1 for l in lifts)
    assert "pembeli" in b["aturan"][0]["kalimat"] and "juga membeli" in b["aturan"][0]["kalimat"]


def test_bundling_without_transaction_id_explains_instead_of_error():
    data = rows([("2026-10-10", None, i, "Kopi", 1, 1000, False) for i in range(20)])
    b = analysis.run(["bundling"], data, PERIOD)["bundling"]
    assert b["status"] == "tanpa_id"
    assert "ID transaksi" in b["pesan"]


# F7
def test_menu_engineering_classification_and_missing_hpp():
    data = rows(
        [("2026-10-10", None, i, "A", 1, 20000) for i in range(40)]      # populer, margin 12.000
        + [("2026-10-10", None, 100 + i, "B", 1, 10000) for i in range(40)]  # populer, margin 2.000
        + [("2026-10-10", None, 200 + i, "C", 1, 30000) for i in range(5)]   # tidak populer, margin 20.000
        + [("2026-10-10", None, 300 + i, "D", 1, 8000) for i in range(5)]    # tidak populer, margin 1.000
        + [("2026-10-10", None, 400 + i, "E", 1, 8000) for i in range(5)]    # tanpa HPP
    )
    hpp = {"A": 8000, "B": 8000, "C": 10000, "D": 7000}
    m = analysis.run(["menu"], data, PERIOD, {"hpp": hpp})["menu"]
    cat = {p["nama"]: p["kategori"] for p in m["produk"]}
    assert cat == {"A": "Star", "B": "Plowhorse", "C": "Puzzle", "D": "Dog"}
    assert [p["nama"] for p in m["belum_lengkap"]] == ["E"]
    assert m["belum_lengkap"][0]["status"] == "belum lengkap"
    assert m["batas_popularitas"] == pytest.approx(0.7 / 4, abs=1e-4)
    total_margin = 40 * 12000 + 40 * 2000 + 5 * 20000 + 5 * 1000
    assert m["batas_margin"] == pytest.approx(total_margin / 90, abs=0.01)


def test_analyze_endpoint():
    data = rows([("2026-10-10", "09:00", 1, "Kopi", 1, 1000)])
    r = client.post("/analyze", json={"jenis": ["dashboard", "produk"], "periode": PERIOD, "baris": data})
    assert r.status_code == 200
    assert r.json()["dashboard"]["ringkasan"]["omzet"] == 1000
