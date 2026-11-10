'use server';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/errors';
import { allow, TOO_MANY } from '@/lib/rate-limit';

export async function sendFeedback(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const message = String(fd.get('message') ?? '').trim();
  const kind = String(fd.get('kind') ?? 'other');
  if (message.length < 5) return { ok: false, message: 'Tell us a bit more (at least 5 characters).' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Please sign in again.' };
  if (!(await allow('feedback', user.id))) return { ok: false, message: TOO_MANY };
  const { error } = await supabase.from('feedback').insert({
    user_id: user.id, kind: ['bug', 'idea', 'confusing', 'other'].includes(kind) ? kind : 'other',
    page: String(fd.get('page') ?? '').slice(0, 300), message: message.slice(0, 4000),
  });
  if (error) return { ok: false, message: 'Could not send. Try again.' };
  return { ok: true, message: 'Thanks! Your feedback was sent to the team.' };
}
