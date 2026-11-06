<div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div>
        <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">{{ $heading }}</h1>
        @isset($sub)<p class="mt-1 text-ink-2">{{ $sub }}</p>@endisset
    </div>
    <div class="md:text-right">@include('partials.period-filter')</div>
</div>
<div class="mt-6"><x-flash /></div>
@if ($error)
    <div class="mb-4 flex items-start gap-2 rounded-control border border-line bg-warn-soft px-4 py-3 text-sm text-warn-ink" role="alert">
        <x-icon name="alert" class="mt-0.5 h-4 w-4 shrink-0" /><span>{{ $error }}</span>
    </div>
@endif
