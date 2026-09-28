import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const pages = ['', '/pricing', '/for-cres', '/cres', '/help', '/legal/terms', '/legal/privacy', '/legal/refunds'].map((p) => ({
    url: `${base}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.6,
  }));
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await sb.from('public_cres').select('handle').limit(1000);
    return [...pages, ...(data ?? []).map((c) => ({ url: `${base}/cres/${c.handle}`, changeFrequency: 'weekly' as const, priority: 0.5 }))];
  } catch {
    return pages;
  }
}
