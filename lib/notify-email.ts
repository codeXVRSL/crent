import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';

/** Emails a user by id. Failures are logged, never thrown, so they can't break the main action. */
export async function emailUser(userId: string, subject: string, text: string) {
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(userId);
    if (data?.user?.email) await sendEmail(data.user.email, subject, text);
  } catch (e) {
    console.error('[emailUser]', e);
  }
}
