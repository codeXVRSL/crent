'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { emailUser } from '@/lib/notify-email';
import { env } from '@/lib/env';
import { failBack } from '@/lib/flash';
import { parseViews, VIEWS_HINT } from '@/lib/parse';

// Browsers submit textarea line breaks as CRLF; normalise so length limits match what people see.
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').replace(/\r\n/g, '\n').trim();
const num = (fd: FormData, k: string) => Number(str(fd, k).replace(/[,\s]/g, ''));

export async function submitPitch(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const briefId = str(fd, 'brief_id');
  const sourceViews = parseViews(str(fd, 'source_views'));
  const medianViews = parseViews(str(fd, 'channel_median_views'));
  if (!sourceViews || !medianViews) return { ok: false, message: `Check the video views and channel median. ${VIEWS_HINT}` };
  if (!str(fd, 'source_posted_on')) return { ok: false, message: 'Add the date the source video was posted.' };
  const supabase = await createClient();
  const { data: pitchId, error } = await supabase.rpc('submit_pitch', {
    p_brief_id: briefId,
    p_platform: str(fd, 'platform'),
    p_format_label: str(fd, 'format_label'),
    p_duration_seconds: num(fd, 'duration_seconds') || null,
    p_hook_category: str(fd, 'hook_category'),
    p_teaser: str(fd, 'teaser'),
    p_source_views: sourceViews,
    p_channel_median_views: medianViews,
    p_source_posted_on: str(fd, 'source_posted_on'),
    p_source_channel_size_band: str(fd, 'source_channel_size_band') || null,
    p_source_url: str(fd, 'source_url'),
    p_source_channel_url: str(fd, 'source_channel_url'),
    p_hook_text: str(fd, 'hook_text'),
    p_why_it_worked: str(fd, 'why_it_worked'),
    p_instructions: str(fd, 'instructions'),
    p_adaptation_notes: str(fd, 'adaptation_notes'),
  });
  if (error) return { ok: false, message: friendlyError(error) };
  const proofPath = str(fd, 'proof_path');
  if (proofPath && pitchId) {
    const { error: pe } = await supabase.rpc('attach_pitch_proof', { p_pitch_id: pitchId, p_path: proofPath });
    if (pe) console.error('[attach proof]', pe.message);
  }
  const swipeId = str(fd, 'swipe_id');
  if (swipeId) await supabase.from('swipe_items').update({ status: 'pitched' }).eq('id', swipeId);

  const { data: brief } = await supabase.from('briefs').select('creator_id, title').eq('id', briefId).single();
  if (brief) {
    await emailUser(brief.creator_id, `New pitch on ${brief.title}`,
      `A verified researcher pitched an idea on your brief. See the proof and decide whether to unlock it:\n${env.appUrl}/briefs/${briefId}`);
  }
  redirect(`/briefs/${briefId}?pitched=1`);
}

export async function withdrawPitch(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('withdraw_pitch', { p_pitch_id: str(fd, 'pitch_id') });
  if (error) return failBack(error);
  revalidatePath('/pitches');
}

export async function unlockPitch(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const pitchId = str(fd, 'pitch_id');
  const supabase = await createClient();
  const { error } = await supabase.rpc('unlock_pitch', { p_pitch_id: pitchId });
  if (error) return { ok: false, message: friendlyError(error) };
  const { data: p } = await supabase.from('pitches').select('cre_id, brief_id').eq('id', pitchId).single();
  if (p) {
    await emailUser(p.cre_id, 'Your pitch was unlocked',
      `A creator unlocked your pitch. Your earning becomes available after the 72-hour hold.\n${env.appUrl}/pitches`);
    revalidatePath(`/briefs/${p.brief_id}`);
  }
  return { ok: true, message: 'Unlocked.' };
}

export async function toggleShortlist(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_pitch_shortlist', { p_pitch_id: str(fd, 'pitch_id'), p_on: str(fd, 'on') === '1' });
  if (error) return failBack(error);
  revalidatePath(`/briefs/${str(fd, 'brief_id')}`);
}

export async function passPitch(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('pass_pitch', {
    p_pitch_id: str(fd, 'pitch_id'), p_reason: str(fd, 'reason'), p_note: str(fd, 'note').slice(0, 400),
  });
  if (error) return { ok: false, message: friendlyError(error) };
  // The pitch leaves the "To review" list, so confirm at the top of the page instead of on the card.
  redirect(`/briefs/${str(fd, 'brief_id')}?passed=1`);
}

export async function unpassPitch(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('unpass_pitch', { p_pitch_id: str(fd, 'pitch_id') });
  if (error) return failBack(error);
  revalidatePath(`/briefs/${str(fd, 'brief_id')}`);
}
