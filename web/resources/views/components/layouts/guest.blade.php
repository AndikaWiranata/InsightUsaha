@props(['title' => null])
<x-layouts.base :title="$title">
    <div class="flex min-h-screen flex-col px-4 py-6">
        <header class="mx-auto flex w-full max-w-md items-center justify-between">
            <x-logo />
            <x-theme-toggle />
        </header>
        <main id="konten" class="mx-auto mt-6 w-full max-w-md flex-1 sm:mt-12">
            <div class="card sm:p-7">
                {{ $slot }}
            </div>
        </main>
        <footer class="mx-auto mt-8 w-full max-w-md text-sm text-muted">
            <a href="{{ route('privasi') }}">Kebijakan privasi</a>
        </footer>
    </div>
</x-layouts.base>
