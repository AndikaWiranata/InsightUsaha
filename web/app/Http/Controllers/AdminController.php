<?php

namespace App\Http\Controllers;

use App\Models\AiSummary;
use App\Models\ErrorLog;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\User;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** F11 Panel admin. */
class AdminController extends Controller
{
    public function index(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $users = User::query()
            ->where('role', 'owner')
            ->with(['business.subscription'])
            ->addSelect(['jumlah_unggahan' => DB::table('uploads')
                ->join('businesses', 'businesses.id', '=', 'uploads.business_id')
                ->whereColumn('businesses.user_id', 'users.id')
                ->selectRaw('count(*)')])
            ->when($q !== '', fn ($query) => $query->where(function ($w) use ($q) {
                // whereLike: tidak peka huruf besar/kecil di SQLite maupun PostgreSQL (Supabase, memakai ILIKE).
                $w->whereLike('email', "%{$q}%")->orWhereLike('nama', "%{$q}%")
                    ->orWhereHas('business', fn ($b) => $b->whereLike('nama_usaha', "%{$q}%"));
            }))
            ->latest('id')
            ->paginate(20)
            ->withQueryString();

        $totalOwners = User::where('role', 'owner')->count();
        $activeWeek = DB::table('activity_logs')->where('tanggal', '>=', now()->subDays(6)->toDateString())
            ->distinct()->count('user_id');
        $paid = Subscription::where('paket', 'pro')->where('status', 'aktif')->where('berakhir', '>', now())->count();
        $revenue = (int) Payment::where('status', 'lunas')->where('dibayar_pada', '>=', now()->startOfMonth())->sum('jumlah');
        $activated = DB::table('uploads')->where('status', 'selesai')->distinct()->count('business_id');
        $feedback = AiSummary::whereNotNull('umpan_balik')->select('umpan_balik', DB::raw('count(*) as n'))
            ->groupBy('umpan_balik')->pluck('n', 'umpan_balik');
        $helpfulTotal = (int) $feedback->sum();

        return view('admin.index', [
            'users' => $users,
            'q' => $q,
            'stats' => [
                'pengguna' => $totalOwners,
                'aktif_mingguan' => $activeWeek,
                'berbayar' => $paid,
                'pendapatan' => $revenue,
                'aktivasi' => $totalOwners ? round($activated / $totalOwners * 100) : 0,
                'membantu' => $helpfulTotal ? round(($feedback['membantu'] ?? 0) / $helpfulTotal * 100) : null,
                'umpan_balik' => $helpfulTotal,
            ],
            'logs' => ErrorLog::latest('id')->limit(30)->get(),
        ]);
    }

    public function logs(Request $request)
    {
        $jenis = $request->query('jenis');

        return view('admin.logs', [
            'logs' => ErrorLog::when(in_array($jenis, ['impor', 'ai', 'pembayaran', 'analitik'], true), fn ($q) => $q->where('jenis', $jenis))
                ->latest('id')->paginate(50)->withQueryString(),
            'jenis' => $jenis,
        ]);
    }

    public function updateSubscription(Request $request, User $user, PaymentService $payments)
    {
        abort_if($user->isAdmin() || ! $user->business, 404);
        $data = $request->validate(['aksi' => ['required', 'in:pro,gratis']]);
        $sub = $payments->subscriptionFor($user->business);
        $data['aksi'] === 'pro' ? $payments->activatePro($sub) : $payments->downgrade($sub);

        return back()->with('status', 'Langganan '.$user->email.' diperbarui.');
    }
}
