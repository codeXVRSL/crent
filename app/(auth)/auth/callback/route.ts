import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/dashboard';
  // Same-site paths only: reject //host and /\host, which browsers treat as another site.
  const safe = next.startsWith('/') && !/^\/[\/\\]/.test(next) ? next : '/dashboard';
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(safe, url.origin));
}
