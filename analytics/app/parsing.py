"""Membaca, memetakan, dan membersihkan file penjualan (F2)."""

from __future__ import annotations

import hashlib
import io
import math
import re
from collections import Counter
from datetime import date, datetime, time, timedelta
from typing import Any

import pandas as pd

FIELDS = ["tanggal", "jam", "id_transaksi", "nama_produk", "kategori", "jumlah", "harga_satuan"]
REQUIRED = ["tanggal", "nama_produk", "jumlah", "harga_satuan"]
MAX_ROWS = 50_000
MAX_REJECT_DETAIL = 500

SYNONYMS: dict[str, list[str]] = {
    "tanggal": ["tanggal", "tgl", "date", "tanggal_transaksi", "tgl_transaksi", "waktu", "tanggal_penjualan"],
    "jam": ["jam", "time", "pukul", "jam_transaksi", "waktu_transaksi"],
    "id_transaksi": [
        "id_transaksi", "no_transaksi", "nomor_transaksi", "kode_transaksi", "no_struk", "nomor_struk",
        "receipt", "receipt_number", "receipt_no", "invoice", "no_invoice", "order_id", "transaction_id",
        "id_order", "no_nota", "nota",
    ],
    "nama_produk": [
        "nama_produk", "produk", "nama_item", "item", "item_name", "menu", "nama_menu", "product",
        "product_name", "nama_barang", "barang",
    ],
    "kategori": ["kategori", "category", "kategori_produk", "jenis"],
    "jumlah": ["jumlah", "qty", "quantity", "kuantitas", "jumlah_terjual", "banyak", "jml", "item_sold"],
    "harga_satuan": ["harga_satuan", "harga", "price", "unit_price", "harga_jual", "harga_per_item", "harga_item"],
}

HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]


class FileError(Exception):
    """Kesalahan yang membuat seluruh file tidak bisa dibaca (pesan untuk pengguna)."""


# ---------------------------------------------------------------------------
# Membaca file
# ---------------------------------------------------------------------------

def _decode(content: bytes) -> str:
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    raise FileError("File CSV tidak bisa dibaca. Simpan ulang file dengan encoding UTF-8.")


def _detect_delimiter(text: str) -> str:
    header = text.splitlines()[0] if text else ""
    counts = {d: header.count(d) for d in (",", ";", "\t", "|")}
    best = max(counts, key=counts.get)
    return best if counts[best] > 0 else ","


def read_table(content: bytes, filename: str) -> pd.DataFrame:
    name = (filename or "").lower()
    try:
        if name.endswith(".csv"):
            text = _decode(content)
            if not text.strip():
                raise FileError("File kosong.")
            df = pd.read_csv(
                io.StringIO(text),
                sep=_detect_delimiter(text),
                dtype=str,
                keep_default_na=False,
                skip_blank_lines=True,
            )
        elif name.endswith(".xlsx"):
            df = pd.read_excel(io.BytesIO(content), dtype=object, engine="openpyxl")
        else:
            raise FileError("Format file tidak didukung. Gunakan file .xlsx atau .csv.")
    except FileError:
        raise
    except Exception as exc:  # noqa: BLE001 - pesan ramah untuk pengguna
        raise FileError(f"File tidak bisa dibaca: {exc}") from exc

    df.columns = [str(c).strip() for c in df.columns]
    # Buang baris yang seluruh kolomnya kosong.
    blank = df.apply(lambda col: col.map(_is_blank)).all(axis=1)
    df = df[~blank].reset_index(drop=True)
    return df


def _is_blank(v: Any) -> bool:
    if v is None:
        return True
    if isinstance(v, float) and math.isnan(v):
        return True
    if v is pd.NaT:
        return True
    return isinstance(v, str) and v.strip() == ""


def _norm_header(h: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(h).strip().lower()).strip("_")


def suggest_mapping(columns: list[str]) -> dict[str, str | None]:
    normalized = {_norm_header(c): c for c in columns}
    mapping: dict[str, str | None] = {}
    used: set[str] = set()
    for field in FIELDS:
        found = None
        for syn in SYNONYMS[field]:
            col = normalized.get(syn)
            if col is not None and col not in used:
                found = col
                break
        mapping[field] = found
        if found:
            used.add(found)
    return mapping


def validate_mapping(mapping: dict[str, Any], columns: list[str]) -> dict[str, str | None]:
    clean: dict[str, str | None] = {}
    for field in FIELDS:
        col = mapping.get(field) if mapping else None
        clean[field] = col if col in columns else None
    return clean


def missing_required(mapping: dict[str, str | None]) -> list[str]:
    return [f for f in REQUIRED if not mapping.get(f)]


# ---------------------------------------------------------------------------
# Parser nilai
# ---------------------------------------------------------------------------

_EXCEL_EPOCH = datetime(1899, 12, 30)
_RE_ISO = re.compile(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2})[:.](\d{2})(?::(\d{2}))?)?")
_RE_DMY = re.compile(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+(\d{1,2})[:.](\d{2})(?::(\d{2}))?)?")
_RE_TIME = re.compile(r"^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?")


def parse_date(v: Any) -> tuple[date | None, tuple[int, int] | None]:
    """Mengembalikan (tanggal, (jam, menit) jika ada)."""
    if _is_blank(v):
        return None, None
    if isinstance(v, (pd.Timestamp, datetime)):
        dt = v.to_pydatetime() if isinstance(v, pd.Timestamp) else v
        t = (dt.hour, dt.minute) if (dt.hour or dt.minute) else None
        return dt.date(), t
    if isinstance(v, date):
        return v, None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        if 20000 < float(v) < 80000:  # nomor seri tanggal Excel
            dt = _EXCEL_EPOCH + timedelta(days=float(v))
            t = (dt.hour, dt.minute) if (dt.hour or dt.minute) else None
            return dt.date(), t
        return None, None
    s = str(v).strip()
    m = _RE_ISO.match(s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    else:
        m = _RE_DMY.match(s)
        if not m:
            return None, None
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    try:
        result = date(y, mo, d)
    except ValueError:
        return None, None
    t = None
    if m.group(4) is not None:
        hh, mm = int(m.group(4)), int(m.group(5))
        if 0 <= hh < 24 and 0 <= mm < 60 and (hh or mm):
            t = (hh, mm)
    return result, t


def parse_time(v: Any) -> tuple[int, int] | None:
    if _is_blank(v):
        return None
    if isinstance(v, time):
        return v.hour, v.minute
    if isinstance(v, (pd.Timestamp, datetime)):
        return v.hour, v.minute
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        f = float(v)
        if 0 <= f < 1:  # pecahan hari Excel
            minutes = round(f * 24 * 60)
            return (minutes // 60) % 24, minutes % 60
        return None
    s = str(v).strip()
    m = _RE_TIME.match(s)
    if not m:
        # Mungkin format "2026-10-01 08:15"
        _, t = parse_date(s)
        return t
    hh, mm = int(m.group(1)), int(m.group(2))
    if 0 <= hh < 24 and 0 <= mm < 60:
        return hh, mm
    return None


def parse_number(v: Any) -> float | None:
    if _is_blank(v):
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else f
    s = str(v).strip()
    s = re.sub(r"(?i)^(rp\.?|idr)", "", s).strip().replace(" ", "")
    if re.fullmatch(r"-?\d{1,3}(\.\d{3})+(,\d+)?", s):  # 18.000 atau 1.250,50
        s = s.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"-?\d{1,3}(,\d{3})+(\.\d+)?", s):  # 18,000.00
        s = s.replace(",", "")
    elif re.fullmatch(r"-?\d+,\d+", s):  # 2,5
        s = s.replace(",", ".")
    elif not re.fullmatch(r"-?\d+(\.\d+)?", s):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def normalize_name(v: Any) -> str | None:
    if _is_blank(v):
        return None
    s = re.sub(r"\s+", " ", str(v)).strip()
    if not s:
        return None
    return " ".join(w[:1].upper() + w[1:].lower() for w in s.split(" "))


def normalize_code(v: Any) -> str | None:
    if _is_blank(v):
        return None
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    s = str(v).strip()
    return s or None


# ---------------------------------------------------------------------------
# Inspeksi & pembersihan
# ---------------------------------------------------------------------------

def _preview_value(v: Any) -> str:
    if _is_blank(v):
        return ""
    if isinstance(v, (pd.Timestamp, datetime)):
        return v.strftime("%Y-%m-%d %H:%M") if (v.hour or v.minute) else v.strftime("%Y-%m-%d")
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def inspect_file(content: bytes, filename: str, mapping: dict[str, Any] | None = None) -> dict[str, Any]:
    df = read_table(content, filename)
    columns = list(df.columns)
    if not columns:
        raise FileError("File tidak memiliki baris judul kolom.")
    if len(df) > MAX_ROWS:
        raise FileError(f"File berisi {len(df):,} baris. Batas maksimal 50.000 baris.".replace(",", "."))

    final_mapping = validate_mapping(mapping, columns) if mapping else suggest_mapping(columns)
    missing = missing_required(final_mapping)

    result: dict[str, Any] = {
        "kolom": columns,
        "pratinjau": [[_preview_value(v) for v in row] for row in df.head(5).itertuples(index=False)],
        "pemetaan": final_mapping,
        "kolom_wajib_kurang": missing,
        "jumlah_baris": int(len(df)),
        "tanggal_mulai": None,
        "tanggal_selesai": None,
    }
    if not missing:
        dates = [d for d, _ in (parse_date(v) for v in df[final_mapping["tanggal"]]) if d is not None]
        if dates:
            result["tanggal_mulai"] = min(dates).isoformat()
            result["tanggal_selesai"] = max(dates).isoformat()
    return result


def clean_file(content: bytes, filename: str, mapping: dict[str, Any]) -> dict[str, Any]:
    df = read_table(content, filename)
    columns = list(df.columns)
    mapping = validate_mapping(mapping, columns)
    missing = missing_required(mapping)
    if missing:
        raise FileError("Kolom wajib belum dipetakan: " + ", ".join(missing))
    if len(df) > MAX_ROWS:
        raise FileError(f"File berisi {len(df):,} baris. Batas maksimal 50.000 baris.".replace(",", "."))

    def col(field: str) -> list[Any]:
        c = mapping.get(field)
        return list(df[c]) if c else [None] * len(df)

    c_tanggal, c_jam, c_id = col("tanggal"), col("jam"), col("id_transaksi")
    c_produk, c_kategori = col("nama_produk"), col("kategori")
    c_jumlah, c_harga = col("jumlah"), col("harga_satuan")

    out: dict[str, list[Any]] = {k: [] for k in
                                 ("tanggal", "jam", "id_transaksi", "nama_produk", "kategori", "jumlah",
                                  "harga_satuan", "hash")}
    rejected: list[dict[str, Any]] = []
    reason_counts: Counter[str] = Counter()
    seen: set[str] = set()
    duplicates = 0
    invalid_time = 0

    def reject(row_no: int, reason: str) -> None:
        reason_counts[reason] += 1
        if len(rejected) < MAX_REJECT_DETAIL:
            rejected.append({"baris": row_no, "alasan": reason})

    for i in range(len(df)):
        row_no = i + 2  # +1 header, +1 berbasis 1 seperti di Excel
        d, t_from_date = parse_date(c_tanggal[i])
        if d is None:
            reject(row_no, "Tanggal kosong atau tidak valid")
            continue
        produk = normalize_name(c_produk[i])
        if produk is None:
            reject(row_no, "Nama produk kosong")
            continue
        qty = parse_number(c_jumlah[i])
        if qty is None or not float(qty).is_integer() or qty <= 0:
            reject(row_no, "Jumlah harus angka bulat lebih dari 0")
            continue
        harga = parse_number(c_harga[i])
        if harga is None or harga < 0:
            reject(row_no, "Harga satuan kosong atau tidak valid")
            continue

        t = None
        if mapping.get("jam"):
            t = parse_time(c_jam[i])
            if t is None and not _is_blank(c_jam[i]):
                invalid_time += 1
        if t is None:
            t = t_from_date
        jam = f"{t[0]:02d}:{t[1]:02d}" if t else None
        kode = normalize_code(c_id[i])
        kategori = normalize_name(c_kategori[i])
        qty_i = int(qty)
        harga_r = round(float(harga), 2)

        key = f"{d.isoformat()}|{jam or ''}|{kode or ''}|{produk.lower()}|{qty_i}|{harga_r}"
        row_hash = hashlib.sha1(key.encode("utf-8")).hexdigest()
        # Duplikat hanya dihapus bila ada ID transaksi; tanpa ID, dua baris sama bisa
        # memang dua penjualan berbeda.
        if kode is not None:
            if row_hash in seen:
                duplicates += 1
                continue
            seen.add(row_hash)

        out["tanggal"].append(d.isoformat())
        out["jam"].append(jam)
        out["id_transaksi"].append(kode)
        out["nama_produk"].append(produk)
        out["kategori"].append(kategori)
        out["jumlah"].append(qty_i)
        out["harga_satuan"].append(harga_r)
        out["hash"].append(row_hash)

    valid = len(out["tanggal"])
    return {
        "baris": out,
        "ditolak": rejected,
        "ringkasan": {
            "jumlah_baris_file": int(len(df)),
            "jumlah_baris_valid": valid,
            "jumlah_baris_ditolak": int(sum(reason_counts.values())),
            "alasan_ditolak": dict(reason_counts),
            "duplikat_dihapus": duplicates,
            "jam_tidak_valid": invalid_time,
            "tanggal_mulai": min(out["tanggal"]) if valid else None,
            "tanggal_selesai": max(out["tanggal"]) if valid else None,
            "punya_jam": any(j is not None for j in out["jam"]),
            "punya_id_transaksi": any(k is not None for k in out["id_transaksi"]),
        },
    }


def read_simple_table(content: bytes, filename: str, limit: int = 5000) -> dict[str, Any]:
    """Untuk file HPP: kembalikan kolom dan baris apa adanya (sebagai teks)."""
    df = read_table(content, filename)
    return {
        "kolom": list(df.columns),
        "baris": [[_preview_value(v) for v in row] for row in df.head(limit).itertuples(index=False)],
    }
