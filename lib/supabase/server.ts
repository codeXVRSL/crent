import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

/** Supabase client acting as the signed-in user. All reads respect Row Level Security. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the middleware refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Supabase client with no user session, for public pages (researcher directory and profiles).
 * Everyone sees the same public data, whether or not they are signed in or have entered their two-step code.
 */
export function createPublicClient() {
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
