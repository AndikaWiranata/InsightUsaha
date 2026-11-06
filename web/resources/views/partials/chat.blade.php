{{--
    Chatbot "Tanya data". Satu-satunya panel yang mengambang di atas konten, jadi satu-satunya yang memakai bayangan
    (penanda elevasi, DESIGN.md). Jawaban hanya dari hasil analisis periode yang sedang dibuka.
--}}
<div data-chat
     data-url="{{ route('chat.kirim') }}"
     data-history-url="{{ route('chat.riwayat') }}"
     data-period="{{ json_encode((object) request()->only(['periode', 'mulai', 'selesai'])) }}">
    <button type="button" data-chat-open
            class="fixed right-4 bottom-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-surface hover:bg-ink-2 sm:right-6 sm:bottom-6"
            aria-haspopup="dialog" aria-controls="chat-panel" aria-expanded="false">
        <x-icon name="chat" class="h-5 w-5" />
        Tanya data
    </button>

    <section id="chat-panel" data-chat-panel role="dialog" aria-modal="false" aria-labelledby="chat-title" hidden
             class="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col border-t border-line bg-surface shadow-[0_-8px_30px_rgb(0_0_0/0.18)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[min(600px,calc(100dvh-3rem))] sm:w-100 sm:rounded-card sm:border">
        <header class="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div>
                <h2 id="chat-title" class="font-bold">Tanya data penjualanmu</h2>
                <p class="text-sm text-muted" data-chat-period>Jawaban dari hasil analisis periode yang sedang kamu buka.</p>
            </div>
            <div class="flex shrink-0 gap-1">
                <button type="button" data-chat-reset class="btn-ghost px-2 text-sm" hidden>Mulai ulang</button>
                <button type="button" data-chat-close class="btn-ghost px-2" aria-label="Tutup panel tanya data">
                    <x-icon name="close" />
                </button>
            </div>
        </header>

        <div data-chat-log class="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite" aria-relevant="additions">
            <div data-chat-empty>
                <p class="text-sm text-ink-2">Tanya apa saja soal penjualanmu, misalnya:</p>
                <ul class="mt-3 space-y-2" data-chat-starters>
                    @foreach (['Menu apa yang paling laku bulan ini?', 'Produk mana yang penjualannya turun?', 'Kapan waktu paling sepi untuk promo?', 'Paket bundling apa yang cocok aku buat?'] as $q)
                        <li><button type="button" data-chat-starter class="w-full rounded-control border border-line px-3 py-2.5 text-left text-sm hover:border-field hover:bg-paper">{{ $q }}</button></li>
                    @endforeach
                </ul>
            </div>
        </div>

        <form data-chat-form class="border-t border-line p-3" novalidate>
            <label for="chat-input" class="sr-only">Pertanyaan</label>
            <div class="flex items-end gap-2">
                <textarea id="chat-input" name="pesan" rows="1" maxlength="500" required
                          class="input max-h-32 resize-none" placeholder="Tulis pertanyaan…"></textarea>
                <button type="submit" class="btn-primary shrink-0 px-3" aria-label="Kirim pertanyaan">
                    <x-icon name="send" />
                </button>
            </div>
            <p class="mt-1.5 text-xs text-muted">Angka di jawaban diambil dari analisis. Data transaksi mentah tidak dikirim ke AI.</p>
            <p class="error hidden" data-chat-error role="alert"></p>
        </form>
    </section>
</div>
