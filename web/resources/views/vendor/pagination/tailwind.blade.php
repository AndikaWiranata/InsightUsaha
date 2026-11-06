@if ($paginator->hasPages())
    <nav role="navigation" aria-label="Halaman" class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-muted">
            Menampilkan <span class="font-semibold text-ink tabular">{{ $paginator->firstItem() }}</span>–<span class="font-semibold text-ink tabular">{{ $paginator->lastItem() }}</span>
            dari <span class="font-semibold text-ink tabular">{{ $paginator->total() }}</span>
        </p>
        <ul class="flex flex-wrap items-center gap-1">
            <li>
                @if ($paginator->onFirstPage())
                    <span class="btn-secondary opacity-50" aria-disabled="true">Sebelumnya</span>
                @else
                    <a href="{{ $paginator->previousPageUrl() }}" rel="prev" class="btn-secondary">Sebelumnya</a>
                @endif
            </li>
            @foreach ($elements as $element)
                @if (is_string($element))
                    <li><span class="px-2 text-muted">{{ $element }}</span></li>
                @endif
                @if (is_array($element))
                    @foreach ($element as $page => $url)
                        <li class="hidden sm:block">
                            @if ($page == $paginator->currentPage())
                                <span aria-current="page" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control bg-ink px-3 text-sm font-bold text-surface tabular">{{ $page }}</span>
                            @else
                                <a href="{{ $url }}" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-3 text-sm font-semibold text-ink-2 tabular hover:bg-line/60" aria-label="Halaman {{ $page }}">{{ $page }}</a>
                            @endif
                        </li>
                    @endforeach
                @endif
            @endforeach
            <li>
                @if ($paginator->hasMorePages())
                    <a href="{{ $paginator->nextPageUrl() }}" rel="next" class="btn-secondary">Berikutnya</a>
                @else
                    <span class="btn-secondary opacity-50" aria-disabled="true">Berikutnya</span>
                @endif
            </li>
        </ul>
    </nav>
@endif
