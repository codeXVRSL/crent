'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';

/**
 * Live chat: listens for new messages in this thread over Supabase Realtime and re-renders the page.
 * Row Level Security still decides who receives each message. Pair with a slow AutoRefresh as a fallback.
 */
export function LiveThread({ threadId }: { threadId: string }) {
  const router = useRouter();
  useEffect(() => {
    const sb = createBrowserSupabase();
    const channel = sb
      .channel(`thread:${threadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        () => router.refresh())
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [threadId, router]);
  return null;
}
