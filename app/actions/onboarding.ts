'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { PLATFORMS } from '@/lib/constants';

const PLATFORM_VALUES = PLATFORMS.map((p) => p.value) as string[];
// Browsers submit textarea line breaks as CRLF; normalise so length limits match what people see.
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').replace(/\r\n/g, '\n').trim();

export async function setRole(fd: FormData) {
  if (fd.get('role') === 'admin') {
    // Only for emails listed in ADMIN_EMAILS, and only while the account has no role yet.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email || !env.adminEmails.includes(user.email.toLowerCase())) throw new Error('Not allowed.');
    const db = createAdminClient();
    const { data: p } = await db.from('profiles').select('role').eq('id', user.id).single();
    if (p?.role) throw new Error(friendlyError('ROLE_ALREADY_SET'));
    await db.from('profiles').update({ role: 'admin' }).eq('id', user.id);
    redirect('/admin');
  }
  const role = fd.get('role') === 'cre' ? 'cre' : 'creator';
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_initial_role', { p_role: role });
  if (error && !error.message.startsWith('ROLE_ALREADY_SET')) throw new Error(friendlyError(error));
  redirect(role === 'cre' ? '/onboarding/cre' : '/onboarding/creator');
}

export async function saveCreatorProfile(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Please sign in again.' };
  const platform = str(fd, 'main_platform');
  const { error } = await supabase.from('creator_profiles').update({
    brand_name: str(fd, 'brand_name') || null,
    main_platform: PLATFORM_VALUES.includes(platform) ? platform : null,
    channel_url: str(fd, 'channel_url') || null,
    follower_band: str(fd, 'follower_band') || null,
    is_agency: fd.get('is_agency') === 'on',
  }).eq('user_id', user.id);
  if (error) return { ok: false, message: friendlyError(error) };
  const name = str(fd, 'display_name');
  if (name) await supabase.from('profiles').update({ display_name: name.slice(0, 50) }).eq('id', user.id);
  if (fd.get('redirect') === '1') redirect('/dashboard');
  revalidatePath('/settings');
  return { ok: true, message: 'Saved.' };
}

export async function saveCreProfile(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Please sign in again.' };
  const handle = str(fd, 'handle').toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(handle)) return { ok: false, message: 'Handle must be 3–24 characters: lowercase letters, numbers or underscores.' };
  const platforms = fd.getAll('platforms').map(String).filter((p) => PLATFORM_VALUES.includes(p));
  const niches = fd.getAll('niches').map(Number).filter(Boolean);
  if (platforms.length === 0) return { ok: false, message: 'Pick at least one platform.' };
  if (niches.length < 1 || niches.length > 5) return { ok: false, message: 'Pick between 1 and 5 niches.' };
  const bio = str(fd, 'bio');
  const { data: masked } = await supabase.rpc('mask_contacts', { p_text: bio + ' ' + str(fd, 'headline') });
  const m = (Array.isArray(masked) ? masked[0] : masked) as { hit: boolean } | null;
  if (m?.hit) return { ok: false, message: friendlyError('CONTACT_DETAILS_NOT_ALLOWED') };

  const { error: pErr } = await supabase.from('profiles').update({ display_name: str(fd, 'display_name').slice(0, 50), handle }).eq('id', user.id);
  if (pErr) return { ok: false, message: friendlyError(pErr) };
  const years = Number(str(fd, 'years_experience'));
  const { error } = await supabase.from('cre_profiles').update({
    headline: str(fd, 'headline').slice(0, 90) || null,
    bio: bio.slice(0, 1200) || null,
    platforms,
    years_experience: Number.isFinite(years) && years >= 0 && years <= 30 ? years : null,
    accepting_work: fd.get('accepting_work') !== 'off',
  }).eq('user_id', user.id);
  if (error) return { ok: false, message: friendlyError(error) };
  await supabase.from('cre_niches').delete().eq('user_id', user.id);
  const { error: nErr } = await supabase.from('cre_niches').insert(niches.map((niche_id) => ({ user_id: user.id, niche_id })));
  if (nErr) return { ok: false, message: friendlyError(nErr) };
  revalidatePath('/onboarding/cre');
  return { ok: true, message: 'Profile saved.' };
}

export async function addPortfolioItem(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Please sign in again.' };
  const views = Number(str(fd, 'source_views').replace(/[,\s]/g, ''));
  const median = Number(str(fd, 'channel_median_views').replace(/[,\s]/g, ''));
  if (!(views > 0) || !(median > 0)) return { ok: false, message: 'Enter views and median views as whole numbers.' };
  if (views / median < 3) return { ok: false, message: 'Portfolio finds need an outlier score of at least 3×.' };
  const url = str(fd, 'source_url');
  if (!/^https?:\/\//i.test(url)) return { ok: false, message: 'Enter the full link, starting with https://' };
  const { error } = await supabase.from('portfolio_items').insert({
    cre_id: user.id, platform: str(fd, 'platform'), title: str(fd, 'title'),
    niche_id: Number(str(fd, 'niche_id')) || null, source_url: url, source_views: views, channel_median_views: median,
    result_note: str(fd, 'result_note') || null,
  });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath('/onboarding/cre');
  return { ok: true, message: 'Added to your portfolio.' };
}

export async function deletePortfolioItem(fd: FormData) {
  const supabase = await createClient();
  await supabase.from('portfolio_items').delete().eq('id', str(fd, 'id'));
  revalidatePath('/onboarding/cre');
}

export async function submitKyc(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const mobile = str(fd, 'mobile_number').replace(/[\s-]/g, '');
  const { error } = await supabase.rpc('submit_kyc', {
    p_legal_name: str(fd, 'legal_name'),
    p_birth_date: str(fd, 'birth_date'),
    p_address_line: str(fd, 'address_line'),
    p_city: str(fd, 'city'),
    p_province: str(fd, 'province'),
    p_postal_code: str(fd, 'postal_code'),
    p_country_code: 'PH',
    p_mobile_number: mobile,
    p_id_type: str(fd, 'id_type'),
    p_id_front_path: str(fd, 'id_front_path'),
    p_selfie_path: str(fd, 'selfie_path'),
    p_tin: str(fd, 'tin'),
  });
  if (error) {
    if (error.message.includes('birth_date')) return { ok: false, message: 'You must be at least 18 years old.' };
    return { ok: false, message: friendlyError(error) };
  }
  revalidatePath('/onboarding/cre');
  revalidatePath('/dashboard');
  return { ok: true, message: "Submitted. We'll review your verification within 2 business days." };
}
