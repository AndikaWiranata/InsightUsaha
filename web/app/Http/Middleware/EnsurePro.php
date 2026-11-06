<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePro
{
    public function handle(Request $request, Closure $next): Response
    {
        $business = $request->attributes->get('business') ?? $request->user()?->business;
        if (! $business || ! $business->isPro()) {
            return response()->view('pro-required', ['fitur' => $request->route()?->getName()], 403);
        }

        return $next($request);
    }
}
