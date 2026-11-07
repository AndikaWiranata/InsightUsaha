import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';

/** Tautan dari email (verifikasi pendaftaran, atur ulang sandi) mendarat di sini. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = url.searchParams.get('lanjut') ?? '/data';
  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/data';
  const sb = await supabaseServer();

  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const { error } = code
    ? await sb.auth.exchangeCodeForSession(code)
    : tokenHash && type ? await sb.auth.verifyOtp({ token_hash: tokenHash, type }) : { error: new Error('tanpa kode') };

  return NextResponse.redirect(new URL(error ? '/masuk?tautan=kedaluwarsa' : target, url.origin));
}
