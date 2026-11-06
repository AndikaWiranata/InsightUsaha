<x-layouts.guest title="Simulasi pembayaran">
    <p class="rounded-control bg-warn-soft px-3 py-2 text-sm font-semibold text-warn-ink">Mode simulasi: tidak ada uang yang dipotong.</p>
    <h1 class="mt-4 text-2xl font-extrabold tracking-tight">Bayar InsightUsaha Pro</h1>
    <p class="mt-1 text-ink-2">Tagihan <code class="text-sm">{{ $payment->ref_gateway }}</code></p>
    <p class="mt-3 text-3xl font-extrabold tabular">{{ \App\Services\Format::rupiah($payment->jumlah) }}</p>
    <p class="mt-2 text-sm text-muted">Halaman ini menggantikan payment gateway selama MIDTRANS_SERVER_KEY belum diisi.</p>
    <form method="POST" action="{{ route('langganan.simulasi.bayar', $payment->ref_gateway) }}" class="mt-6">
        @csrf
        <fieldset class="space-y-2">
            <legend class="label">Pilih metode untuk mensimulasikan pembayaran berhasil</legend>
            @foreach (['qris' => 'QRIS', 'gopay' => 'GoPay', 'shopeepay' => 'ShopeePay', 'bank_transfer' => 'Virtual account'] as $v => $label)
                <button name="metode" value="{{ $v }}" class="btn-secondary w-full justify-start">{{ $label }}</button>
            @endforeach
        </fieldset>
        <button name="metode" value="batal" class="btn-ghost mt-3 w-full text-bad">Batalkan pembayaran</button>
    </form>
</x-layouts.guest>
