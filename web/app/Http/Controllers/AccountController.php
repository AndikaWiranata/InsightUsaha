<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Services\ImportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/** Onboarding & pengaturan (profil, kata sandi, hapus akun). */
class AccountController extends Controller
{
    private function business(Request $request): Business
    {
        return $request->attributes->get('business');
    }

    private function profileRules(): array
    {
        return [
            'nama_usaha' => ['required', 'string', 'max:150'],
            'kota' => ['nullable', 'string', 'max:100'],
            'jenis_usaha' => ['required', Rule::in(Business::JENIS_USAHA)],
            'jam_buka' => ['nullable', 'date_format:H:i'],
            'jam_tutup' => ['nullable', 'date_format:H:i'],
        ];
    }

    public function onboarding(Request $request)
    {
        $business = $this->business($request);
        $step = (int) $request->query('langkah', 1);

        return view('onboarding', [
            'business' => $business,
            'step' => max(1, min(3, $step)),
            'jenisUsaha' => Business::JENIS_USAHA,
        ]);
    }

    public function saveOnboarding(Request $request)
    {
        $business = $this->business($request);
        $business->update($request->validate($this->profileRules()));

        return redirect()->route('onboarding', ['langkah' => 2]);
    }

    public function finishOnboarding(Request $request)
    {
        $this->business($request)->update(['onboarding_selesai' => true]);

        return redirect()->route('dashboard');
    }

    public function settings(Request $request)
    {
        return view('settings', [
            'business' => $this->business($request),
            'user' => $request->user(),
            'jenisUsaha' => Business::JENIS_USAHA,
        ]);
    }

    public function saveProfile(Request $request)
    {
        $user = $request->user();
        $data = $request->validate($this->profileRules() + ['nama' => ['required', 'string', 'max:100']]);
        $user->update(['nama' => $data['nama']]);
        unset($data['nama']);
        $this->business($request)->update($data);

        return back()->with('status', 'Profil berhasil disimpan.');
    }

    public function savePassword(Request $request)
    {
        $request->validate([
            'password_lama' => ['required', 'current_password'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], ['password_lama.current_password' => 'Kata sandi lama salah.']);
        $request->user()->update(['password' => $request->input('password')]);

        return back()->with('status', 'Kata sandi berhasil diubah.');
    }

    /** Hapus akun beserta seluruh datanya (UU PDP). */
    public function destroy(Request $request, ImportService $import)
    {
        $request->validate(['password_hapus' => ['required', 'current_password']],
            ['password_hapus.current_password' => 'Kata sandi salah.', 'password_hapus.required' => 'Masukkan kata sandi untuk konfirmasi.']);
        $user = $request->user();
        $business = $user->business;

        // Logout dulu: logout menyimpan remember token baru, yang akan membuat ulang baris user bila dilakukan setelah delete.
        Auth::logout();

        DB::transaction(function () use ($user, $business, $import) {
            if ($business) {
                $import->deleteAllData($business);
                Storage::disk('local')->deleteDirectory('uploads/'.$business->id);
            }
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $user->delete(); // cascade: businesses, subscriptions, payments, dll.
        });

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('home')->with('status', 'Akun dan seluruh data kamu sudah dihapus.');
    }
}
