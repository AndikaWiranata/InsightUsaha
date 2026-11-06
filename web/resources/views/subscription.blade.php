@php use App\Services\Format; @endphp
<x-layouts.app title="Langganan">
    <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Langganan</h1>
    <div class="mt-6"><x-flash /></div>

    <section class="card sm:p-7" aria-labelledby="paket-title">
        <h2 id="paket-title" class="text-sm font-semibold text-muted">Paket aktif</h2>
        <p class="mt-1 text-3xl font-extrabold tracking-tight">{{ $isPro ? 'Pro' : 'Gratis' }}</p>
        @if ($isPro)
            <p class="mt-2 text-ink-2">Berlaku sampai <strong class="text-ink">{{ Format::date($sub->berakhir) }}</strong>.
                Pengingat dikirim 3 hari sebelumnya. Kalau tidak diperpanjang, akun turun ke Gratis dan datamu tetap tersimpan.</p>
        @else
            <p class="mt-2 text-ink-2">1 unggahan per bulan, data 3 bulan terakhir, ringkasan omzet dan menu naik/turun.</p>
        @endif

        <div class="mt-6 grid gap-6 border-t border-line pt-6 md:grid-cols-[1.4fr_1fr] md:items-start">
            <div>
                <h3 class="font-bold">{{ $isPro ? 'Perpanjang Pro' : 'Upgrade ke Pro' }}: <span class="tabular">Rp49.000</span> per bulan</h3>
                <ul class="mt-3 space-y-1.5 text-ink-2">
                    <li>Unggahan tanpa batas dan seluruh riwayat data</li>
                    <li>Jam ramai, pasangan menu, klasifikasi menu</li>
                    <li>Ringkasan, saran, dan tanya jawab soal datamu</li>
                    <li>Laporan PDF</li>
                </ul>
            </div>
            <form method="POST" action="{{ route('langganan.bayar') }}" data-busy-label="Membuat tagihan…">
                @csrf
                <button class="btn-primary w-full">{{ $isPro ? 'Bayar perpanjangan 1 bulan' : 'Bayar dan aktifkan Pro' }}</button>
                <p class="help text-center">QRIS, GoPay, ShopeePay, atau virtual account</p>
                @if ($simulated)
                    <p class="mt-2 rounded-control bg-warn-soft px-3 py-2 text-sm text-warn-ink">Mode simulasi: payment gateway belum diatur, pembayaran tidak sungguhan.</p>
                @endif
            </form>
        </div>
    </section>

    <section class="card mt-5" aria-labelledby="riwayat-bayar">
        <h2 id="riwayat-bayar" class="font-bold">Riwayat pembayaran</h2>
        @if ($payments->isEmpty())
            <p class="mt-3 text-sm text-muted">Belum ada pembayaran.</p>
        @else
            <div class="table-wrap mt-3">
                <table class="table">
                    <thead><tr><th>Tanggal</th><th>No. tagihan</th><th>Metode</th><th class="text-right">Jumlah</th><th>Status</th></tr></thead>
                    <tbody>
                        @foreach ($payments as $p)
                            @php $cls = ['lunas' => 'bg-good-soft text-good-ink', 'gagal' => 'bg-bad-soft text-bad-ink', 'kedaluwarsa' => 'border border-line text-muted'][$p->status] ?? 'bg-warn-soft text-warn-ink'; @endphp
                            <tr>
                                <td class="whitespace-nowrap">{{ Format::date($p->created_at) }}</td>
                                <td><code class="text-sm">{{ $p->ref_gateway }}</code></td>
                                <td>{{ $p->metode ? strtoupper(str_replace('_', ' ', $p->metode)) : '–' }}</td>
                                <td class="text-right tabular">{{ Format::rupiah($p->jumlah) }}</td>
                                <td>
                                    <span class="tag {{ $cls }}">{{ ucfirst($p->status) }}</span>
                                    @if ($p->status === 'menunggu' && $p->url_pembayaran)
                                        <a href="{{ $p->url_pembayaran }}" class="ml-2 text-sm">Lanjutkan bayar</a>
                                    @endif
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        @endif
    </section>
</x-layouts.app>
