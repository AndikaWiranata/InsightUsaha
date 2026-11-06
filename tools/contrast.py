"""Cek kontras WCAG token warna (terang & gelap). Pakai: python -I contrast.py"""

import sys

sys.stdout.reconfigure(encoding="utf-8")


def lum(h: str) -> float:
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a: str, b: str) -> float:
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


THEMES = {
    "terang": {
        "paper": "#F6F1E7", "surface": "#FFFCF6", "ink": "#221C17", "ink-2": "#4A4037", "muted": "#675D52",
        "line": "#DDD3C3", "field": "#8C8072", "brand": "#7A4521", "stabilo": "#F4C542",
        "good": "#2D6A2F", "good-soft": "#E3EFDC", "good-on-soft": "#22551F",
        "bad": "#A3341C", "bad-soft": "#F6E0D8", "bad-on-soft": "#7F2614",
        "warn-soft": "#F7EBC8", "warn-on-soft": "#664700", "btn": "#221C17", "btn-text": "#FFFCF6",
        "heat": ["#F3E6D3", "#E8CFAE", "#D9B184", "#C38E5A", "#975F2F", "#7D4C22", "#55321A"],
        "heat-text": ["#221C17", "#221C17", "#221C17", "#221C17", "#FFFCF6", "#FFFCF6", "#FFFCF6"],
    },
    "gelap": {
        "paper": "#15120F", "surface": "#1E1A16", "ink": "#F3EDE4", "ink-2": "#D3C9BB", "muted": "#ABA092",
        "line": "#3A322A", "field": "#857868", "brand": "#E0A46B", "stabilo": "#7A5A12",
        "good": "#86C686", "good-soft": "#1E3220", "good-on-soft": "#B3E0AF",
        "bad": "#F29379", "bad-soft": "#3D1F16", "bad-on-soft": "#F7BCA9",
        "warn-soft": "#3A2F12", "warn-on-soft": "#EBD28F", "btn": "#F3EDE4", "btn-text": "#15120F",
        "heat": ["#2E261F", "#4B3828", "#6B4B2D", "#8E6236", "#B47E46", "#D69D5E", "#F0C48B"],
        "heat-text": ["#F3EDE4", "#F3EDE4", "#F3EDE4", "#F3EDE4", "#15120F", "#15120F", "#15120F"],
    },
}

fail = 0
for name, t in THEMES.items():
    checks = [
        ("ink / paper", t["ink"], t["paper"], 4.5), ("ink / surface", t["ink"], t["surface"], 4.5),
        ("ink-2 / paper", t["ink-2"], t["paper"], 4.5), ("ink-2 / surface", t["ink-2"], t["surface"], 4.5),
        ("muted / paper", t["muted"], t["paper"], 4.5), ("muted / surface", t["muted"], t["surface"], 4.5),
        ("good / surface", t["good"], t["surface"], 4.5), ("bad / surface", t["bad"], t["surface"], 4.5),
        ("good-on-soft", t["good-on-soft"], t["good-soft"], 4.5), ("bad-on-soft", t["bad-on-soft"], t["bad-soft"], 4.5),
        ("warn-on-soft", t["warn-on-soft"], t["warn-soft"], 4.5), ("tombol utama", t["btn-text"], t["btn"], 4.5),
        ("ink / stabilo", t["ink"], t["stabilo"], 4.5),
        ("garis grafik / surface (non-teks)", t["brand"], t["surface"], 3.0),
        ("batas input / surface (non-teks)", t["field"], t["surface"], 3.0),
    ]
    for i, (bg, fg) in enumerate(zip(t["heat"], t["heat-text"])):
        checks.append((f"heatmap langkah {i + 1}", fg, bg, 4.5))
    print(f"== {name}")
    for label, fg, bg, need in checks:
        r = ratio(fg, bg)
        ok = r >= need
        fail += not ok
        print(f"  {'OK  ' if ok else 'GAGAL'} {label:36s} {r:5.2f} (min {need})")
print("SEMUA LULUS" if not fail else f"{fail} GAGAL")
