'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { HOOK_CATEGORIES, PLATFORMS } from '@/lib/constants';
import { failBack } from '@/lib/flash';
import { parseViews, VIEWS_HINT } from '@/lib/parse';

// Browsers submit textarea line breaks as CRLF; normalise so length limits match what people see.
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').replace(/\r\n/g, '\n').trim();

export async function addSwipeItem(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const title = str(fd, 'title');
  const url = str(fd, 'source_url');
  const views = parseViews(str(fd, 'source_views')) ?? 0;
  const median = parseViews(str(fd, 'channel_median_views')) ?? 0;
  const platform = str(fd, 'platform');
  const hook = str(fd, 'hook_category');
  if (title.length < 3) return { ok: false, message: 'Give it a short name (3+ characters).' };
  if (!/^https?:\/\//i.test(url)) return { ok: false, message: 'Enter the full link to the video, starting with https://' };
  if (!(views > 0 && median > 0)) return { ok: false, message: `Check the views and channel median. ${VIEWS_HINT}` };
  if (!PLATFORMS.some((p) => p.value === platform)) return { ok: false, message: 'Pick a platform.' };
  if (hook && !HOOK_CATEGORIES.some((h) => h.value === hook)) return { ok: false, message: 'Pick a hook type.' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Your session ended. Log in again.' };
  const { error } = await supabase.from('swipe_items').insert({
    cre_id: user.id, title, source_url: url, source_views: views, channel_median_views: median, platform,
    niche_id: Number(str(fd, 'niche_id')) || null,
    source_posted_on: str(fd, 'source_posted_on') || null,
    hook_category: hook || null,
    notes: str(fd, 'notes') || null,
  });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath('/swipe');
  return { ok: true, message: 'Saved to your swipe file.' };
}

export async function setSwipeStatus(fd: FormData) {
  const supabase = await createClient();
  const status = str(fd, 'status');
  if (!['saved', 'pitched', 'archived'].includes(status)) return;
  const { error } = await supabase.from('swipe_items').update({ status }).eq('id', str(fd, 'id'));
  if (error) return failBack(error);
  revalidatePath('/swipe');
}

export async function deleteSwipeItem(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from('swipe_items').delete().eq('id', str(fd, 'id'));
  if (error) return failBack(error);
  revalidatePath('/swipe');
}
