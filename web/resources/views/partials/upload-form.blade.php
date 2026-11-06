<form method="POST" action="{{ route('data.unggah') }}" enctype="multipart/form-data" class="space-y-3" data-busy-label="Mengunggah…">
    @csrf
    <label for="file" class="flex min-h-36 flex-col items-center justify-center rounded-card border-2 border-dashed border-field bg-paper px-4 py-6 text-center hover:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink">
        <x-icon name="upload" class="h-7 w-7 text-brand" />
        <span class="mt-2 font-bold" data-file-name>Pilih file .xlsx atau .csv</span>
        <span class="mt-0.5 text-sm text-muted">Maksimal 10 MB atau 50.000 baris</span>
        <input id="file" type="file" name="file" accept=".csv,.xlsx" data-accept-ext="csv,xlsx" class="sr-only" required>
    </label>
    <p class="error hidden" data-file-error role="alert"></p>
    @error('file')<p class="error" role="alert">{{ $message }}</p>@enderror
    <button type="submit" class="btn-primary w-full">Unggah dan proses</button>
</form>
