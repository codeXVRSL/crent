import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { friendlyError } from '@/lib/errors';

/**
 * For plain form actions (no inline result): sends the person back to the page they were on with the
 * reason in ?error=, which <ErrorFlash> shows at the top. Better than the crash page a thrown error gives.
 */
export async function failBack(err: unknown, fallback = '/dashboard'): Promise<never> {
  const h = await headers();
  let path = fallback;
  try {
    const ref = new URL(h.get('referer') ?? '');
    if (ref.host === h.get('host')) path = ref.pathname + ref.search;
  } catch { /* no or foreign referer: use the fallback */ }
  const url = new URL(path, 'http://local');
  url.searchParams.set('error', friendlyError(err).slice(0, 300));
  redirect(url.pathname + url.search);
}
