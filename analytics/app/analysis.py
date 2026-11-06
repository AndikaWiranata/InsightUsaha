"""Analisis penjualan: dashboard (F3), produk naik/turun (F4), pola waktu (F5),
bundling Apriori (F6), dan Menu Engineering (F7).

Masukan baris berformat kolom (dict of lists) dengan kunci:
    tanggal (YYYY-MM-DD), jam (HH:MM | None), trx (id transaksi internal),
    punya_kode (bool: transaksi berasal dari kolom id_transaksi), produk, jumlah, harga
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules

HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

LABEL_NAIK = "Naik"
LABEL_TURUN = "Turun"
LABEL_STABIL = "Stabil"
LABEL_BARU = "Produk Baru"
MIN_UNIT_LABEL = 5


# Utilitas

def to_frame(rows: dict[str, list[Any]]) -> pd.DataFrame:
    cols = ["tanggal", "jam", "trx", "punya_kode", "produk", "jumlah", "harga"]
    df = pd.DataFrame({c: rows.get(c, []) for c in cols})
    if df.empty:
        return pd.DataFrame({c: pd.Series(dtype="object") for c in cols}).assign(
            jumlah=pd.Series(dtype="int64"), harga=pd.Series(dtype="float64"), omzet=pd.Series(dtype="float64"),
            tgl=pd.Series(dtype="object"),
        )
    df["jumlah"] = pd.to_numeric(df["jumlah"]).astype("int64")
    df["harga"] = pd.to_numeric(df["harga"]).astype("float64")
    df["omzet"] = df["jumlah"] * df["harga"]
    df["tgl"] = pd.to_datetime(df["tanggal"]).dt.date
    df["punya_kode"] = df["punya_kode"].astype(bool)
    return df


def between(df: pd.DataFrame, start: date, end: date) -> pd.DataFrame:
    if df.empty:
        return df
    return df[(df["tgl"] >= start) & (df["tgl"] <= end)]


def pct_change(cur: float, prev: float) -> float | None:
    """(periode ini − periode lalu) / periode lalu × 100%."""
    if prev == 0:
        return None
    return round((cur - prev) / prev * 100, 1)


def _d(s: str | date) -> date:
    return s if isinstance(s, date) else date.fromisoformat(s)


def fmt_tgl(d: date) -> str:
    return f"{d.day} {BULAN[d.month - 1]} {d.year}"


# F3 Dashboard

def _summary(df: pd.DataFrame) -> dict[str, Any]:
    omzet = float(df["omzet"].sum()) if not df.empty else 0.0
    transaksi = int(df["trx"].nunique()) if not df.empty else 0
    top = None
    if not df.empty:
        g = df.groupby("produk").agg(unit=("jumlah", "sum"), omzet=("omzet", "sum")).reset_index()
        g = g.sort_values(["unit", "omzet", "produk"], ascending=[False, False, True])
        r = g.iloc[0]
        top = {"nama": r["produk"], "unit": int(r["unit"]), "omzet": float(r["omzet"])}
    return {
        "omzet": round(omzet, 2),
        "transaksi": transaksi,
        "rata_rata_transaksi": round(omzet / transaksi, 2) if transaksi else 0.0,
        "unit_terjual": int(df["jumlah"].sum()) if not df.empty else 0,
        "produk_terlaris": top,
    }


def _buckets(start: date, end: date, granularity: str) -> list[tuple[date, date, str]]:
    out: list[tuple[date, date, str]] = []
    if granularity == "bulanan":
        cur = start.replace(day=1)
        while cur <= end:
            nxt = (cur.replace(day=28) + timedelta(days=4)).replace(day=1)
            out.append((max(cur, start), min(nxt - timedelta(days=1), end), f"{BULAN[cur.month - 1]} {cur.year}"))
            cur = nxt
    elif granularity == "mingguan":
        cur = start - timedelta(days=start.weekday())  # Senin
        while cur <= end:
            b_end = cur + timedelta(days=6)
            s = max(cur, start)
            out.append((s, min(b_end, end), f"{s.day} {BULAN[s.month - 1]}"))
            cur = b_end + timedelta(days=1)
    else:
        cur = start
        while cur <= end:
            out.append((cur, cur, f"{cur.day} {BULAN[cur.month - 1]}"))
            cur += timedelta(days=1)
    return out


def auto_granularity(start: date, end: date) -> str:
    days = (end - start).days + 1
    if days <= 45:
        return "harian"
    if days <= 180:
        return "mingguan"
    return "bulanan"


def dashboard(df: pd.DataFrame, period: dict[str, str], granularity: str | None = None) -> dict[str, Any]:
    start, end = _d(period["mulai"]), _d(period["selesai"])
    pstart, pend = _d(period["lalu_mulai"]), _d(period["lalu_selesai"])
    cur, prev = between(df, start, end), between(df, pstart, pend)
    s_cur, s_prev = _summary(cur), _summary(prev)

    top_change = None
    if s_cur["produk_terlaris"]:
        name = s_cur["produk_terlaris"]["nama"]
        prev_units = int(prev.loc[prev["produk"] == name, "jumlah"].sum()) if not prev.empty else 0
        top_change = pct_change(s_cur["produk_terlaris"]["unit"], prev_units)

    gran = granularity if granularity in ("harian", "mingguan", "bulanan") else auto_granularity(start, end)
    daily = cur.groupby("tgl").agg(omzet=("omzet", "sum")) if not cur.empty else pd.DataFrame(columns=["omzet"])
    trx_daily = cur.groupby("tgl")["trx"].nunique() if not cur.empty else pd.Series(dtype="int64")
    labels, omzet_series, trx_series = [], [], []
    for b_start, b_end, label in _buckets(start, end, gran):
        mask = (daily.index >= b_start) & (daily.index <= b_end) if len(daily) else []
        labels.append(label)
        omzet_series.append(round(float(daily.loc[mask, "omzet"].sum()), 2) if len(daily) else 0.0)
        if not cur.empty:
            sub = cur[(cur["tgl"] >= b_start) & (cur["tgl"] <= b_end)]
            trx_series.append(int(sub["trx"].nunique()))
        else:
            trx_series.append(0)
    del trx_daily

    return {
        "periode": period,
        "ringkasan": s_cur,
        "ringkasan_lalu": s_prev,
        "perubahan": {
            "omzet": pct_change(s_cur["omzet"], s_prev["omzet"]),
            "transaksi": pct_change(s_cur["transaksi"], s_prev["transaksi"]),
            "rata_rata_transaksi": pct_change(s_cur["rata_rata_transaksi"], s_prev["rata_rata_transaksi"]),
            "produk_terlaris_unit": top_change,
        },
        "tren": {"granularitas": gran, "label": labels, "omzet": omzet_series, "transaksi": trx_series},
        "hari_berdata": int(cur["tgl"].nunique()) if not cur.empty else 0,
    }


# F4 Produk naik dan turun

def product_label(cur_units: int, prev_units: int) -> tuple[str | None, float | None]:
    change = pct_change(cur_units, prev_units)
    if cur_units < MIN_UNIT_LABEL and prev_units < MIN_UNIT_LABEL:
        return None, change  # terlalu sedikit, tidak diberi label
    if prev_units == 0:
        return LABEL_BARU, None
    if change is not None and change > 10:
        return LABEL_NAIK, change
    if change is not None and change < -10:
        return LABEL_TURUN, change
    return LABEL_STABIL, change


def products(df: pd.DataFrame, period: dict[str, str]) -> dict[str, Any]:
    start, end = _d(period["mulai"]), _d(period["selesai"])
    pstart, pend = _d(period["lalu_mulai"]), _d(period["lalu_selesai"])
    cur, prev = between(df, start, end), between(df, pstart, pend)
    g_cur = cur.groupby("produk").agg(unit=("jumlah", "sum"), omzet=("omzet", "sum")) if not cur.empty else None
    g_prev = prev.groupby("produk").agg(unit=("jumlah", "sum"), omzet=("omzet", "sum")) if not prev.empty else None
    names = sorted(set(g_cur.index if g_cur is not None else []) | set(g_prev.index if g_prev is not None else []))

    items = []
    for name in names:
        cu = int(g_cur.loc[name, "unit"]) if g_cur is not None and name in g_cur.index else 0
        pu = int(g_prev.loc[name, "unit"]) if g_prev is not None and name in g_prev.index else 0
        co = float(g_cur.loc[name, "omzet"]) if g_cur is not None and name in g_cur.index else 0.0
        po = float(g_prev.loc[name, "omzet"]) if g_prev is not None and name in g_prev.index else 0.0
        label, change = product_label(cu, pu)
        items.append({
            "nama": name, "unit": cu, "unit_lalu": pu, "omzet": round(co, 2), "omzet_lalu": round(po, 2),
            "perubahan": change, "label": label,
        })
    items.sort(key=lambda x: (-x["unit"], -x["unit_lalu"], x["nama"]))
    count = {lbl: sum(1 for i in items if i["label"] == lbl) for lbl in (LABEL_NAIK, LABEL_STABIL, LABEL_TURUN, LABEL_BARU)}
    count["Tanpa label"] = sum(1 for i in items if i["label"] is None)

    def ranked(lbl: str, reverse: bool) -> list[dict[str, Any]]:
        sel = [i for i in items if i["label"] == lbl and i["perubahan"] is not None]
        return sorted(sel, key=lambda x: x["perubahan"], reverse=reverse)[:5]

    return {
        "periode": period,
        "produk": items,
        "jumlah_label": count,
        "naik_teratas": ranked(LABEL_NAIK, True),
        "turun_teratas": ranked(LABEL_TURUN, False),
        "baru": [i for i in items if i["label"] == LABEL_BARU][:5],
    }


# F5 Pola waktu ramai

def time_pattern(df: pd.DataFrame, period: dict[str, str]) -> dict[str, Any]:
    start, end = _d(period["mulai"]), _d(period["selesai"])
    cur = between(df, start, end)
    # Jumlah kemunculan tiap hari dalam periode (untuk rata-rata per hari).
    occurrences = [0] * 7
    d = start
    while d <= end:
        occurrences[d.weekday()] += 1
        d += timedelta(days=1)

    if cur.empty:
        return {"periode": period, "punya_jam": False, "kosong": True, "per_hari": [], "heatmap": None,
                "tersibuk": [], "tersepi": []}

    trx = cur.drop_duplicates("trx")[["trx", "tgl", "jam"]].copy()
    trx["hari"] = [t.weekday() for t in trx["tgl"]]
    per_day_counts = trx.groupby("hari")["trx"].count()
    omzet_day = cur.assign(hari=[t.weekday() for t in cur["tgl"]]).groupby("hari")["omzet"].sum()
    per_day = []
    for h in range(7):
        n = int(per_day_counts.get(h, 0))
        per_day.append({
            "hari": HARI[h], "transaksi": n,
            "rata_rata_transaksi": round(n / occurrences[h], 1) if occurrences[h] else 0.0,
            "omzet": round(float(omzet_day.get(h, 0.0)), 2),
        })

    with_hour = trx[trx["jam"].notna() & (trx["jam"] != "")]
    has_hour = len(with_hour) > 0 and len(with_hour) >= 0.5 * len(trx)
    result: dict[str, Any] = {"periode": period, "punya_jam": bool(has_hour), "kosong": False, "per_hari": per_day}

    if has_hour:
        with_hour = with_hour.assign(j=[int(str(x)[:2]) for x in with_hour["jam"]])
        grid = with_hour.groupby(["hari", "j"])["trx"].count()
        hours = sorted(with_hour["j"].unique().tolist())
        hours = list(range(min(hours), max(hours) + 1))
        matrix = [[int(grid.get((h, j), 0)) for j in hours] for h in range(7)]
        slots = [(matrix[h][k], h, hours[k]) for h in range(7) for k in range(len(hours))]
        busy = sorted([s for s in slots if s[0] > 0], key=lambda s: (-s[0], s[1], s[2]))[:3]
        quiet = sorted([s for s in slots if s[0] > 0], key=lambda s: (s[0], s[1], s[2]))[:3]
        to_dict = lambda s: {"hari": HARI[s[1]], "jam": f"{s[2]:02d}.00–{s[2] + 1:02d}.00", "transaksi": s[0]}
        result.update({
            "heatmap": {"hari": HARI, "jam": [f"{j:02d}" for j in hours], "nilai": matrix},
            "tersibuk": [to_dict(s) for s in busy],
            "tersepi": [to_dict(s) for s in quiet],
        })
    else:
        days = [p for p in per_day if p["transaksi"] > 0]
        busy = sorted(days, key=lambda p: (-p["rata_rata_transaksi"], HARI.index(p["hari"])))[:3]
        quiet = sorted(days, key=lambda p: (p["rata_rata_transaksi"], HARI.index(p["hari"])))[:3]
        result.update({
            "heatmap": None,
            "tersibuk": [{"hari": p["hari"], "jam": None, "transaksi": p["transaksi"]} for p in busy],
            "tersepi": [{"hari": p["hari"], "jam": None, "transaksi": p["transaksi"]} for p in quiet],
        })
    return result


# F6 Bundling (Apriori)

def basket_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """One-hot transaksi × produk (hanya transaksi yang punya ID transaksi)."""
    sub = df[df["punya_kode"]]
    if sub.empty:
        return pd.DataFrame()
    m = pd.crosstab(sub["trx"], sub["produk"]).gt(0)
    m.columns.name = None
    return m


def bundling(df: pd.DataFrame, period: dict[str, str], min_support: float = 0.01,
             min_confidence: float = 0.30, max_rules: int = 50) -> dict[str, Any]:
    start, end = _d(period["mulai"]), _d(period["selesai"])
    cur = between(df, start, end)
    base = {"periode": period, "min_support": min_support, "min_confidence": min_confidence, "aturan": []}

    if cur.empty:
        return {**base, "status": "kosong", "pesan": "Belum ada data penjualan pada periode ini."}
    if not cur["punya_kode"].any():
        return {**base, "status": "tanpa_id",
                "pesan": "Data Anda tidak memiliki kolom ID transaksi, sehingga sistem tidak bisa tahu produk mana "
                         "yang dibeli bersamaan. Ekspor ulang data dari aplikasi kasir dengan kolom nomor "
                         "transaksi/struk (id_transaksi) agar rekomendasi bundling bisa dibuat."}

    m = basket_matrix(cur)
    n_trx = int(len(m))
    multi = int((m.sum(axis=1) >= 2).sum())
    base.update({"jumlah_transaksi": n_trx, "transaksi_multi_produk": multi})
    if n_trx < 10 or multi == 0:
        return {**base, "status": "kurang_data",
                "pesan": "Transaksi dengan lebih dari satu produk masih terlalu sedikit untuk mencari pola "
                         "bundling. Coba pilih periode yang lebih panjang."}

    freq = apriori(m, min_support=min_support, use_colnames=True, max_len=2)
    if freq.empty or freq["itemsets"].map(len).max() < 2:
        return {**base, "status": "tidak_ada_aturan",
                "pesan": "Belum ditemukan pasangan produk yang sering dibeli bersamaan dengan pengaturan saat ini. "
                         "Coba turunkan minimum support atau confidence di pengaturan lanjutan."}
    rules = association_rules(freq, num_itemsets=n_trx, metric="confidence", min_threshold=min_confidence)
    rules = rules[rules["lift"] > 1].sort_values(["lift", "confidence", "support"], ascending=False)
    out = []
    for r in rules.head(max_rules).itertuples(index=False):
        a = sorted(r.antecedents)[0]
        c = sorted(r.consequents)[0]
        conf_pct = round(float(r.confidence) * 100)
        out.append({
            "jika": a, "maka": c,
            "support": round(float(r.support), 4),
            "confidence": round(float(r.confidence), 4),
            "lift": round(float(r.lift), 3),
            "jumlah_transaksi_bersama": int(round(float(r.support) * n_trx)),
            "kalimat": f"{conf_pct}% pembeli {a} juga membeli {c}",
        })
    if not out:
        return {**base, "status": "tidak_ada_aturan",
                "pesan": "Belum ditemukan pasangan produk yang sering dibeli bersamaan dengan pengaturan saat ini. "
                         "Coba turunkan minimum support atau confidence di pengaturan lanjutan."}
    return {**base, "status": "ok", "pesan": None, "aturan": out}


# F7 Menu Engineering

SARAN_MENU = {
    "Star": "Pertahankan kualitas dan porsinya, taruh di posisi paling terlihat di menu, jangan didiskon besar.",
    "Plowhorse": "Laris tapi untungnya tipis. Naikkan harga sedikit, kurangi biaya bahan, atau paketkan dengan menu "
                 "bermargin tinggi.",
    "Puzzle": "Untungnya besar tapi kurang laku. Promosikan, beri rekomendasi dari kasir, atau ganti nama/foto "
              "agar lebih menarik.",
    "Dog": "Kurang laku dan untungnya kecil. Pertimbangkan untuk dihapus, diganti, atau dirombak resepnya.",
}


def menu_engineering(df: pd.DataFrame, period: dict[str, str], hpp: dict[str, float | None]) -> dict[str, Any]:
    start, end = _d(period["mulai"]), _d(period["selesai"])
    cur = between(df, start, end)
    if cur.empty:
        return {"periode": period, "status": "kosong", "produk": [], "belum_lengkap": [],
                "pesan": "Belum ada data penjualan pada periode ini."}
    g = cur.groupby("produk").agg(unit=("jumlah", "sum"), omzet=("omzet", "sum")).reset_index()
    complete, incomplete = [], []
    for r in g.itertuples(index=False):
        cost = hpp.get(r.produk)
        if cost is None:
            incomplete.append({"nama": r.produk, "unit": int(r.unit), "status": "belum lengkap"})
            continue
        price = float(r.omzet) / int(r.unit)
        complete.append({"nama": r.produk, "unit": int(r.unit), "omzet": round(float(r.omzet), 2),
                         "harga_rata_rata": round(price, 2), "hpp": float(cost),
                         "margin_per_unit": round(price - float(cost), 2),
                         "margin_total": round((price - float(cost)) * int(r.unit), 2)})

    base = {"periode": period, "belum_lengkap": sorted(incomplete, key=lambda x: -x["unit"]), "saran": SARAN_MENU}
    if not complete:
        return {**base, "status": "hpp_kosong", "produk": [],
                "pesan": "Isi HPP (harga pokok) produk terlebih dahulu di halaman Produk agar menu bisa diklasifikasi."}

    n = len(complete)
    total_units = sum(p["unit"] for p in complete)
    total_margin = sum(p["margin_total"] for p in complete)
    pop_threshold = 0.7 * (1 / n)
    margin_threshold = total_margin / total_units  # rata-rata margin tertimbang
    for p in complete:
        p["popularitas"] = round(p["unit"] / total_units, 4)
        popular = p["unit"] / total_units >= pop_threshold
        high = p["margin_per_unit"] >= margin_threshold
        p["kategori"] = ("Star" if high else "Plowhorse") if popular else ("Puzzle" if high else "Dog")
    complete.sort(key=lambda x: (-x["unit"], x["nama"]))
    return {**base, "status": "ok", "pesan": None, "produk": complete,
            "batas_popularitas": round(pop_threshold, 4), "batas_margin": round(margin_threshold, 2),
            "jumlah_menu": n,
            "jumlah_kategori": {k: sum(1 for p in complete if p["kategori"] == k) for k in SARAN_MENU}}


# Pintu masuk

def run(kinds: list[str], rows: dict[str, list[Any]], period: dict[str, str],
        params: dict[str, Any] | None = None) -> dict[str, Any]:
    params = params or {}
    df = to_frame(rows)
    out: dict[str, Any] = {}
    for k in kinds:
        if k == "dashboard":
            out[k] = dashboard(df, period, params.get("granularitas"))
        elif k == "produk":
            out[k] = products(df, period)
        elif k == "waktu":
            out[k] = time_pattern(df, period)
        elif k == "bundling":
            out[k] = bundling(df, period, float(params.get("min_support", 0.01)),
                              float(params.get("min_confidence", 0.30)))
        elif k == "menu":
            out[k] = menu_engineering(df, period, params.get("hpp") or {})
        else:
            raise ValueError(f"Jenis analisis tidak dikenal: {k}")
    return out
