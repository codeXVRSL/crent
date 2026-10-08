'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { IDEA_STAGES } from '@/lib/constants';
import { failBack } from '@/lib/flash';
import { parseViews, VIEWS_HINT } from '@/lib/parse';
import { manilaToday } from '@/lib/parse';

// Browsers submit textarea line breaks as CRLF; normalise so length limits match what people see.
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').replace(/\r\n/g, '\n').trim();
// Empty → null (not logged yet); otherwise a whole number, or NaN so the check below reports it.
const views = (fd: FormData, k: string) => {
  const s = str(fd, k);
  return s === '' ? null : parseViews(s) ?? NaN;
};

/** Saves an unlocked idea's place on the creator's idea board, and its result once posted. */
export async function saveIdeaTracking(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const stage = str(fd, 'stage');
  if (!IDEA_STAGES.some((s) => s.value === stage)) return { ok: false, message: 'Pick a stage.' };
  const postedUrl = str(fd, 'posted_url');
  if (postedUrl && !/^https?:\/\//i.test(postedUrl)) return { ok: false, message: 'The posted link must start with https://' };
  const resultViews = views(fd, 'result_views');
  const usualViews = views(fd, 'usual_views');
  if ([resultViews, usualViews].some((n) => n != null && !Number.isFinite(n))) return { ok: false, message: `Check the views. ${VIEWS_HINT}` };
  if ((resultViews == null) !== (usualViews == null)) return { ok: false, message: 'Add both the views it got and your usual views, so we can work out the result.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_idea_tracking', {
    p_unlock_id: str(fd, 'unlock_id'),
    p_stage: stage,
    p_board: str(fd, 'board'),
    p_planned_on: str(fd, 'planned_on') || null,
    p_notes: str(fd, 'notes'),
    p_posted_url: postedUrl,
    p_posted_on: str(fd, 'posted_on') || null,
    p_result_views: resultViews,
    p_usual_views: usualViews,
  });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath('/ideas');
  revalidatePath('/unlocks');
  // The card may move to another column, so confirm at the top of the board instead of on the card.
  const q = new URLSearchParams({ saved: resultViews != null ? 'results' : '1' });
  const board = str(fd, 'board_filter');
  if (board) q.set('board', board);
  redirect(`/ideas?${q}`);
}

/** One-click stage change from the board. */
export async function moveIdea(fd: FormData) {
  const supabase = await createClient();
  const unlockId = str(fd, 'unlock_id');
  const { data: cur } = await supabase.from('idea_tracking').select('*').eq('unlock_id', unlockId).maybeSingle();
  const { error } = await supabase.rpc('save_idea_tracking', {
    p_unlock_id: unlockId,
    p_stage: str(fd, 'stage'),
    p_board: cur?.board ?? null,
    p_planned_on: cur?.planned_on ?? null,
    p_notes: cur?.notes ?? null,
    p_posted_url: cur?.posted_url ?? null,
    p_posted_on: cur?.posted_on ?? (str(fd, 'stage') === 'posted' ? manilaToday() : null),
    p_result_views: cur?.result_views ?? null,
    p_usual_views: cur?.usual_views ?? null,
  });
  if (error) return failBack(error);
  revalidatePath('/ideas');
}
