<x-layouts.app title="Belum ada data">
    <div class="max-w-xl py-6 sm:py-12">
        <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Belum ada data penjualan</h1>
        <p class="mt-3 text-lg text-ink-2">Unggah file penjualan pertamamu (Excel atau CSV). Halaman ini akan terisi otomatis setelah file selesai diproses.</p>
        <div class="mt-6 flex flex-col gap-2 sm:flex-row">
            <a href="{{ route('data') }}" class="btn-primary">Unggah file penjualan</a>
            <a href="{{ route('data.template') }}" class="btn-secondary"><x-icon name="download" class="h-4 w-4" /> Unduh template CSV</a>
        </div>
    </div>
</x-layouts.app>
