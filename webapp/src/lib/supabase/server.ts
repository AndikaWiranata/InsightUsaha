import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { connection } from 'next/server';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/** Klien atas nama pengguna yang sedang masuk; RLS berlaku. Buat baru di setiap request. */
export async function supabaseServer() {
  // Sesi bergantung waktu (token kedaluwarsa), jadi tandai render ini sebagai per-request sebelum klien membaca jam.
  await connection();
  const store = await cookies();
  return createServerClient(URL_, PUB, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // Komponen server tidak boleh menulis cookie; penyegaran sesi sudah ditangani proxy.ts.
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {}
      },
    },
  });
}

/** Klien dengan secret key: melewati RLS. Hanya untuk admin, webhook, dan log error. */
export function supabaseAdmin() {
  return createClient(URL_, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}
