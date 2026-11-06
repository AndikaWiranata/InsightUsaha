@if (session('status'))
    <div class="mb-4 flex items-start gap-2 rounded-control border border-good/40 bg-good-soft px-4 py-3 text-sm text-good-ink" role="status">
        <x-icon name="check" class="mt-0.5 h-4 w-4 shrink-0" />
        <span>{{ session('status') }}</span>
    </div>
@endif
@if ($errors->any() && ! ($hideErrors ?? false))
    <div class="mb-4 flex items-start gap-2 rounded-control border border-bad/40 bg-bad-soft px-4 py-3 text-sm text-bad-ink" role="alert">
        <x-icon name="alert" class="mt-0.5 h-4 w-4 shrink-0" />
        <ul class="space-y-0.5">
            @foreach ($errors->all() as $e)
                <li>{{ $e }}</li>
            @endforeach
        </ul>
    </div>
@endif
