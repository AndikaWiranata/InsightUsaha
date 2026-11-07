import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/masuk', '/daftar', '/lupa-sandi', '/privasi', '/auth', '/api/webhook'];
const isPublic = (path: string) => PUBLIC_PATHS.some((p) => path === p || (p !== '/' && path.startsWith(p + '/')) || path.startsWith('/auth/'));

/** Menyegarkan sesi Supabase di setiap request dan mengarahkan tamu ke halaman masuk. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  if (!data?.claims && !isPublic(path)) {
    if (path.startsWith('/api/')) return NextResponse.json({ message: 'Silakan masuk terlebih dahulu.' }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = '/masuk';
    url.search = `?lanjut=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|csv)$).*)'],
};
