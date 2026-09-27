import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type Role = 'creator' | 'cre' | 'admin';
export type Viewer = {
  id: string;
  email: string;
  role: Role | null;
  displayName: string;
  handle: string | null;
  suspended: boolean;
  kycStatus: 'not_started' | 'pending' | 'approved' | 'rejected' | null;
  kycRejectReason: string | null;
  unreadCount: number;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: cre }, { count }] = await Promise.all([
    supabase.from('profiles').select('role, display_name, handle, suspended_at').eq('id', user.id).single(),
    supabase.from('cre_profiles').select('kyc_status, kyc_reject_reason').eq('user_id', user.id).maybeSingle(),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null),
  ]);
  return {
    id: user.id,
    email: user.email ?? '',
    role: (profile?.role as Role) ?? null,
    displayName: profile?.display_name ?? '',
    handle: profile?.handle ?? null,
    suspended: !!profile?.suspended_at,
    kycStatus: cre?.kyc_status ?? null,
    kycRejectReason: cre?.kyc_reject_reason ?? null,
    unreadCount: count ?? 0,
  };
});

/** Use at the top of app pages. Redirects if not signed in, no role yet, suspended, or wrong role. */
export async function requireViewer(roles?: Role[]): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect('/login');
  if (v.suspended) redirect('/suspended');
  if (!v.role) redirect('/onboarding');
  if (roles && !roles.includes(v.role)) redirect('/dashboard');
  return v;
}
