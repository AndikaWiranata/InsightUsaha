<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Layanan analitik Python (FastAPI).
    'analytics' => [
        'url' => env('ANALYTICS_URL', 'http://127.0.0.1:8001'),
        'token' => env('ANALYTICS_TOKEN', ''),
    ],

    // API LLM untuk ringkasan AI (F8). Hanya data agregat yang dikirim.
    'ai' => [
        'provider' => env('AI_PROVIDER', 'gemini'), // gemini | anthropic
    ],

    'gemini' => [
        'key' => env('GEMINI_API_KEY', ''),
        'model' => env('GEMINI_MODEL', 'gemini-2.5-flash'),
    ],

    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY', ''),
        'model' => env('ANTHROPIC_MODEL', 'claude-opus-5-5'),
    ],

    // Payment gateway (Midtrans Snap). Kosongkan server_key untuk mode simulasi lokal.
    'midtrans' => [
        'server_key' => env('MIDTRANS_SERVER_KEY', ''),
        'production' => (bool) env('MIDTRANS_PRODUCTION', false),
    ],

];
