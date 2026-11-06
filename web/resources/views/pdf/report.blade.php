@php
    use App\Services\Format;
    $d = $r['dashboard']; $s = $d['ringkasan']; $c = $d['perubahan'];
    $p = $r['produk']; $w = $r['waktu']; $b = $r['bundling']; $m = $r['menu'];
    $pct = fn ($v) => $v === null ? 'belum ada pembanding' : Format::percent($v).' vs periode lalu';
    $trend = $d['tren'];
    $maxOmzet = max($trend['omzet'] ?: [0]) ?: 1;
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Laporan {{ $business->nama_usaha }}</title>
<style>
    @page { margin: 28px 32px; }
    body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #221C17; }
    h1 { font-size: 18px; margin: 0; }
    h2 { font-size: 12px; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #DDD3C3; }
    .muted { color: #675D52; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 9px; font-weight: bold; color: #675D52; border-bottom: 1px solid #DDD3C3; padding: 4px; }
    td { padding: 4px; border-bottom: 1px solid #EDE5D8; vertical-align: top; }
    .r { text-align: right; }
    .cards td { width: 25%; border: 1px solid #DDD3C3; padding: 8px; }
    .big { font-size: 14px; font-weight: bold; }
    .bar { background: #7A4521; height: 8px; }
    .good { color: #2D6A2F; } .bad { color: #A3341C; }
    .ai { background: #F6F1E7; border-left: 3px solid #F4C542; padding: 8px 10px; }
    ul { margin: 4px 0; padding-left: 14px; } li { margin-bottom: 2px; }
</style>
</head>
<body>
    <table><tr>
        <td style="border:0;padding:0">
            <h1>Laporan Penjualan</h1>
            <div>{{ $business->nama_usaha }}{{ $business->kota ? ' · '.$business->kota : '' }}</div>
        </td>
        <td style="border:0;padding:0" class="r muted">
            Periode {{ $period->label() }}<br>Pembanding {{ $period->previousLabel() }}<br>Dibuat {{ Format::date(now()) }}
        </td>
    </tr></table>

    <h2>Ringkasan</h2>
    <table class="cards"><tr>
        <td><div class="muted">Total omzet</div><div class="big">{{ Format::rupiah($s['omzet']) }}</div><div class="muted">{{ $pct($c['omzet']) }}</div></td>
        <td><div class="muted">Jumlah transaksi</div><div class="big">{{ Format::number($s['transaksi']) }}</div><div class="muted">{{ $pct($c['transaksi']) }}</div></td>
        <td><div class="muted">Rata-rata transaksi</div><div class="big">{{ Format::rupiah($s['rata_rata_transaksi']) }}</div><div class="muted">{{ $pct($c['rata_rata_transaksi']) }}</div></td>
        <td><div class="muted">Produk terlaris</div><div class="big">{{ $s['produk_terlaris']['nama'] ?? '–' }}</div><div class="muted">{{ isset($s['produk_terlaris']) ? Format::number($s['produk_terlaris']['unit']).' unit' : '' }}</div></td>
    </tr></table>

    <h2>Ringkasan & saran AI</h2>
    @if ($summary && $summary->status === 'ok')
        <div class="ai">
            <strong>Temuan utama</strong>
            <ul>@foreach ($summary->isi_json['temuan'] as $t)<li>{{ $t }}</li>@endforeach</ul>
            <strong>Saran tindakan</strong>
            <ol style="margin:4px 0;padding-left:14px">@foreach ($summary->isi_json['saran'] as $t)<li>{{ $t }}</li>@endforeach</ol>
        </div>
    @else
        <p class="muted">Ringkasan belum tersedia.</p>
    @endif

    <h2>Tren omzet ({{ $trend['granularitas'] }})</h2>
    <table>
        <thead><tr><th style="width:18%">Periode</th><th>Omzet</th><th class="r" style="width:18%">Rupiah</th><th class="r" style="width:12%">Transaksi</th></tr></thead>
        <tbody>
            @foreach ($trend['label'] as $i => $label)
                <tr>
                    <td>{{ $label }}</td>
                    <td><div class="bar" style="width: {{ max(0.5, $trend['omzet'][$i] / $maxOmzet * 100) }}%"></div></td>
                    <td class="r">{{ Format::rupiah($trend['omzet'][$i]) }}</td>
                    <td class="r">{{ Format::number($trend['transaksi'][$i]) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <h2>Produk naik & turun</h2>
    <table>
        <thead><tr><th>Produk</th><th class="r">Periode ini</th><th class="r">Periode lalu</th><th class="r">Perubahan</th><th>Label</th></tr></thead>
        <tbody>
            @foreach (array_slice($p['produk'], 0, 25) as $row)
                <tr>
                    <td>{{ $row['nama'] }}</td>
                    <td class="r">{{ Format::number($row['unit']) }}</td>
                    <td class="r">{{ Format::number($row['unit_lalu']) }}</td>
                    <td class="r {{ ($row['perubahan'] ?? 0) > 0 ? 'good' : (($row['perubahan'] ?? 0) < 0 ? 'bad' : '') }}">{{ Format::percent($row['perubahan']) }}</td>
                    <td>{{ $row['label'] ?? 'Data sedikit' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
    @if (count($p['produk']) > 25)<p class="muted">Menampilkan 25 dari {{ count($p['produk']) }} produk terlaris.</p>@endif

    @if (! ($w['kosong'] ?? true))
        <h2>Pola waktu ramai</h2>
        <table><tr>
            <td style="width:50%;border:0"><strong>Tersibuk</strong><ul>@foreach ($w['tersibuk'] as $x)<li>{{ $x['hari'] }}{{ $x['jam'] ? ' '.$x['jam'] : '' }}: {{ Format::number($x['transaksi']) }} transaksi</li>@endforeach</ul></td>
            <td style="width:50%;border:0"><strong>Tersepi</strong><ul>@foreach ($w['tersepi'] as $x)<li>{{ $x['hari'] }}{{ $x['jam'] ? ' '.$x['jam'] : '' }}: {{ Format::number($x['transaksi']) }} transaksi</li>@endforeach</ul></td>
        </tr></table>
    @endif

    <h2>Rekomendasi bundling</h2>
    @if ($b['status'] === 'ok')
        <table>
            <thead><tr><th>Saran</th><th class="r">Support</th><th class="r">Confidence</th><th class="r">Lift</th></tr></thead>
            <tbody>
                @foreach (array_slice($b['aturan'], 0, 10) as $a)
                    <tr><td>{{ $a['kalimat'] }}</td><td class="r">{{ Format::number($a['support'] * 100, 1) }}%</td><td class="r">{{ Format::number($a['confidence'] * 100, 1) }}%</td><td class="r">{{ Format::number($a['lift'], 2) }}</td></tr>
                @endforeach
            </tbody>
        </table>
    @else
        <p class="muted">{{ $b['pesan'] }}</p>
    @endif

    <h2>Klasifikasi menu</h2>
    @if ($m['status'] === 'ok')
        <table>
            <thead><tr><th>Menu</th><th class="r">Popularitas</th><th class="r">Margin/porsi</th><th>Kategori</th></tr></thead>
            <tbody>
                @foreach ($m['produk'] as $x)
                    <tr><td>{{ $x['nama'] }}</td><td class="r">{{ Format::number($x['popularitas'] * 100, 1) }}%</td><td class="r">{{ Format::rupiah($x['margin_per_unit']) }}</td><td>{{ $x['kategori'] }}</td></tr>
                @endforeach
            </tbody>
        </table>
    @else
        <p class="muted">{{ $m['pesan'] }}</p>
    @endif

    <p class="muted" style="margin-top:18px">Dibuat otomatis oleh InsightUsaha.</p>
</body>
</html>
