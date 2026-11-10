import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { buildCsp, makeNonce } from '@/lib/csp';

const APP_PREFIXES = ['/dashboard', '/briefs', '/pitches', '/unlocks', '/wallet', '/billing', '/messages',
  '/notifications', '/settings', '/disputes', '/onboarding', '/pay', '/admin'];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // A fresh nonce per request; Next.js reads it from the request's CSP header and stamps its own scripts.
  const nonce = makeNonce();
  const csp = buildCsp(nonce, { supabaseUrl: url, dev: process.env.NODE_ENV !== 'production' });
  request.headers.set('x-nonce', nonce);
  request.headers.set('content-security-policy', csp);
  const withCsp = (res: NextResponse) => { res.headers.set('Content-Security-Policy', csp); return res; };
  const next = () => NextResponse.next({ request: { headers: request.headers } });

  let response = next();
  if (!url || !key) return withCsp(response);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!user && APP_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = `?next=${encodeURIComponent(path)}`;
    return withCsp(NextResponse.redirect(login));
  }
  return withCsp(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
};
