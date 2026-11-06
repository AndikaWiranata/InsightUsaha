<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Events\Registered;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function showRegister()
    {
        return view('auth.register', ['jenisUsaha' => Business::JENIS_USAHA]);
    }

    public function register(Request $request)
    {
        $data = $request->validate([
            'nama' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'nama_usaha' => ['required', 'string', 'max:150'],
            'jenis_usaha' => ['required', Rule::in(Business::JENIS_USAHA)],
        ], [
            'email.unique' => 'Email ini sudah terdaftar. Silakan masuk atau gunakan fitur lupa kata sandi.',
        ]);

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'nama' => $data['nama'],
                'email' => Str::lower($data['email']),
                'password' => $data['password'],
                'role' => 'owner',
            ]);
            $business = $user->business()->create([
                'nama_usaha' => $data['nama_usaha'],
                'jenis_usaha' => $data['jenis_usaha'],
            ]);
            Subscription::create(['business_id' => $business->id, 'paket' => 'gratis', 'status' => 'aktif', 'mulai' => now()]);

            return $user;
        });

        event(new Registered($user));
        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->route('verification.notice');
    }

    public function showLogin()
    {
        return view('auth.login');
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $key = 'login:'.Str::lower($credentials['email']).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            $seconds = RateLimiter::availableIn($key);
            throw ValidationException::withMessages([
                'email' => "Terlalu banyak percobaan masuk. Coba lagi dalam {$seconds} detik.",
            ]);
        }

        $credentials['email'] = Str::lower($credentials['email']);
        if (! Auth::attempt($credentials, $request->boolean('ingat'))) {
            RateLimiter::hit($key, 60);
            throw ValidationException::withMessages(['email' => 'Email atau kata sandi salah.']);
        }

        RateLimiter::clear($key);
        $request->session()->regenerate();

        return redirect()->intended(Auth::user()->isAdmin() ? route('admin') : route('dashboard'));
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('home');
    }

    public function showForgot()
    {
        return view('auth.forgot');
    }

    public function sendReset(Request $request)
    {
        $request->validate(['email' => ['required', 'email']]);
        Password::sendResetLink(['email' => Str::lower($request->input('email'))]);

        // Pesan sama untuk email terdaftar/tidak agar tidak membocorkan daftar pengguna.
        return back()->with('status', 'Jika email terdaftar, tautan atur ulang kata sandi sudah kami kirim. Cek kotak masuk kamu.');
    }

    public function showReset(Request $request, string $token)
    {
        return view('auth.reset', ['token' => $token, 'email' => $request->query('email')]);
    }

    public function reset(Request $request)
    {
        $request->validate([
            'token' => ['required'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset(
            ['email' => Str::lower($request->input('email'))] + $request->only('password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => Hash::make($password), 'remember_token' => Str::random(60)])->save();
                event(new PasswordReset($user));
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return redirect()->route('login')->with('status', 'Kata sandi berhasil diubah. Silakan masuk.');
        }

        return back()->withErrors(['email' => 'Tautan atur ulang tidak valid atau sudah kedaluwarsa.']);
    }

    public function verifyNotice(Request $request)
    {
        if ($request->user()->hasVerifiedEmail()) {
            return redirect()->route('dashboard');
        }

        return view('auth.verify');
    }

    public function verify(EmailVerificationRequest $request)
    {
        $request->fulfill();

        return redirect()->route('onboarding')->with('status', 'Email berhasil diverifikasi.');
    }

    public function resendVerification(Request $request)
    {
        $request->user()->sendEmailVerificationNotification();

        return back()->with('status', 'Tautan verifikasi baru sudah dikirim ke email kamu.');
    }
}
