<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/** Memastikan pengguna punya profil usaha; menyimpan business ke request & mencatat aktivitas harian. */
class EnsureBusiness
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $business = $user?->business;
        if (! $business) {
            abort(403, 'Profil usaha tidak ditemukan.');
        }
        $request->attributes->set('business', $business);
        view()->share('currentBusiness', $business);

        try {
            DB::table('activity_logs')->insertOrIgnore(['user_id' => $user->id, 'tanggal' => now()->toDateString()]);
        } catch (\Throwable) {
            // tidak kritis
        }

        return $next($request);
    }
}
