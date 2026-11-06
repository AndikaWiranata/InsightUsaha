@if ($logs->isEmpty())
    <p class="mt-3 text-sm text-muted">Belum ada error tercatat.</p>
@else
    <div class="table-wrap mt-3">
        <table class="table">
            <thead><tr><th>Waktu</th><th>Jenis</th><th>Usaha</th><th>Pesan</th></tr></thead>
            <tbody>
                @foreach ($logs as $log)
                    <tr>
                        <td class="text-sm whitespace-nowrap tabular">{{ $log->created_at?->format('d/m/Y H:i') }}</td>
                        <td><span class="tag border border-line text-ink-2">{{ ['ai' => 'API AI', 'impor' => 'Impor', 'pembayaran' => 'Pembayaran', 'analitik' => 'Analitik'][$log->jenis] ?? $log->jenis }}</span></td>
                        <td class="text-sm tabular">{{ $log->business_id ? '#'.$log->business_id : '–' }}</td>
                        <td class="max-w-xl text-sm text-ink-2">{{ \Illuminate\Support\Str::limit($log->pesan, 220) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>
@endif
