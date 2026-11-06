<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ isset($title) ? $title.' · ' : '' }}InsightUsaha</title>
    <script>
        // Terapkan tema sebelum render agar tidak berkedip. Urutan: pilihan pengguna, lalu setelan perangkat.
        (function () {
            var t = null;
            try { t = localStorage.getItem('iu-theme'); } catch (e) {}
            if (t !== 'light' && t !== 'dark') {
                t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            document.documentElement.setAttribute('data-theme', t);
        })();
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen">
    <a href="#konten" class="sr-only z-50 rounded-control bg-ink px-3 py-2 text-surface focus:not-sr-only focus:fixed focus:top-2 focus:left-2">Lewati ke konten</a>
    {{ $slot }}
</body>
</html>
