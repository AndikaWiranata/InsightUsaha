<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\DataController;
use App\Http\Controllers\InsightController;
use App\Http\Controllers\SubscriptionController;
use Illuminate\Support\Facades\Route;

// ---- Publik ----
Route::view('/', 'landing')->name('home');
Route::view('/privasi', 'privacy')->name('privasi');

Route::middleware('guest')->group(function () {
    Route::get('/register', [AuthController::class, 'showRegister'])->name('register');
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/forgot', [AuthController::class, 'showForgot'])->name('password.request');
    Route::post('/forgot', [AuthController::class, 'sendReset'])->middleware('throttle:5,1')->name('password.email');
    Route::get('/reset-password/{token}', [AuthController::class, 'showReset'])->name('password.reset');
    Route::post('/reset-password', [AuthController::class, 'reset'])->name('password.update');
});

// Webhook payment gateway (dikecualikan dari CSRF di bootstrap/app.php).
Route::post('/webhook/pembayaran', [SubscriptionController::class, 'webhook'])->name('webhook.pembayaran');

// ---- Pengguna ----
Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::get('/email/verifikasi', [AuthController::class, 'verifyNotice'])->name('verification.notice');
    Route::get('/email/verifikasi/{id}/{hash}', [AuthController::class, 'verify'])->middleware('signed')->name('verification.verify');
    Route::post('/email/verifikasi/kirim', [AuthController::class, 'resendVerification'])->middleware('throttle:3,1')->name('verification.send');

    Route::middleware(['verified', 'admin'])->prefix('admin')->group(function () {
        Route::get('/', [AdminController::class, 'index'])->name('admin');
        Route::get('/log', [AdminController::class, 'logs'])->name('admin.logs');
        Route::post('/pengguna/{user}/langganan', [AdminController::class, 'updateSubscription'])->name('admin.langganan');
    });

    Route::middleware(['verified', 'business'])->group(function () {
        Route::get('/onboarding', [AccountController::class, 'onboarding'])->name('onboarding');
        Route::post('/onboarding', [AccountController::class, 'saveOnboarding'])->name('onboarding.simpan');
        Route::post('/onboarding/selesai', [AccountController::class, 'finishOnboarding'])->name('onboarding.selesai');

        Route::get('/dashboard', [InsightController::class, 'dashboard'])->name('dashboard');
        Route::get('/dashboard/ringkasan-ai', [InsightController::class, 'aiSummary'])->name('ai.ringkasan');
        Route::post('/dashboard/ringkasan-ai/umpan-balik', [InsightController::class, 'aiFeedback'])->name('ai.umpan-balik');

        Route::get('/tanya', [ChatController::class, 'history'])->name('chat.riwayat');
        Route::post('/tanya', [ChatController::class, 'send'])->middleware('throttle:20,1')->name('chat.kirim');
        Route::delete('/tanya', [ChatController::class, 'reset'])->name('chat.reset');

        Route::get('/produk', [InsightController::class, 'products'])->name('produk');
        Route::post('/produk/hpp', [InsightController::class, 'saveHpp'])->name('produk.hpp');
        Route::post('/produk/hpp/unggah', [InsightController::class, 'uploadHpp'])->name('produk.hpp.unggah');
        Route::get('/produk/hpp/template', [InsightController::class, 'hppTemplate'])->name('produk.hpp.template');
        Route::get('/waktu', [InsightController::class, 'time'])->name('waktu');

        Route::middleware('pro')->group(function () {
            Route::get('/bundling', [InsightController::class, 'bundling'])->name('bundling');
            Route::post('/bundling/pengaturan', [InsightController::class, 'saveBundlingSettings'])->name('bundling.pengaturan');
            Route::get('/menu', [InsightController::class, 'menu'])->name('menu');
            Route::get('/laporan', [InsightController::class, 'report'])->name('laporan');
            Route::get('/laporan/pdf', [InsightController::class, 'reportPdf'])->name('laporan.pdf');
        });

        Route::get('/data', [DataController::class, 'index'])->name('data');
        Route::get('/data/template', [DataController::class, 'template'])->name('data.template');
        Route::post('/data', [DataController::class, 'store'])->middleware('throttle:20,1')->name('data.unggah');
        Route::get('/data/{id}', [DataController::class, 'show'])->whereNumber('id')->name('data.show');
        Route::get('/data/{id}/status', [DataController::class, 'status'])->whereNumber('id')->name('data.status');
        Route::get('/data/{id}/pemetaan', [DataController::class, 'mapping'])->whereNumber('id')->name('data.mapping');
        Route::post('/data/{id}/pemetaan', [DataController::class, 'saveMapping'])->whereNumber('id')->name('data.mapping.simpan');
        Route::get('/data/{id}/konflik', [DataController::class, 'conflict'])->whereNumber('id')->name('data.conflict');
        Route::post('/data/{id}/konflik', [DataController::class, 'resolveConflict'])->whereNumber('id')->name('data.conflict.simpan');
        Route::delete('/data/{id}', [DataController::class, 'destroy'])->whereNumber('id')->name('data.hapus');
        Route::delete('/data', [DataController::class, 'destroyAll'])->name('data.hapus-semua');

        Route::get('/langganan', [SubscriptionController::class, 'index'])->name('langganan');
        Route::post('/langganan/bayar', [SubscriptionController::class, 'checkout'])->name('langganan.bayar');
        Route::get('/langganan/simulasi/{ref}', [SubscriptionController::class, 'simulate'])->name('langganan.simulasi');
        Route::post('/langganan/simulasi/{ref}', [SubscriptionController::class, 'simulatePay'])->name('langganan.simulasi.bayar');

        Route::get('/pengaturan', [AccountController::class, 'settings'])->name('pengaturan');
        Route::post('/pengaturan/profil', [AccountController::class, 'saveProfile'])->name('pengaturan.profil');
        Route::post('/pengaturan/sandi', [AccountController::class, 'savePassword'])->name('pengaturan.sandi');
        Route::delete('/pengaturan/akun', [AccountController::class, 'destroy'])->name('pengaturan.hapus-akun');
    });
});
