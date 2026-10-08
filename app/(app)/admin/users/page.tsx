import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm, SubmitButton } from '@/components/form';
import { Button, Input, Notice, PageHeader, Pill, Select } from '@/components/ui';
import { fmtDate } from '@/components/status';
import { setSuspended } from '@/app/actions/admin';

export const metadata = { title: 'Users' };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; show?: string; done?: string }> }) {
  const v = await requireViewer(['admin']);
  const { q, show, done } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from('profiles').select('id, display_name, handle, role, suspended_at, suspended_reason, created_at').order('created_at', { ascending: false }).limit(100);
  if (show === 'creator' || show === 'cre') query = query.eq('role', show);
  if (show === 'suspended') query = query.not('suspended_at', 'is', null).neq('suspended_reason', 'account_closed');
  if (q) query = query.or(`display_name.ilike.%${q.replace(/[%,()]/g, '')}%,handle.ilike.%${q.replace(/[%,()]/g, '')}%`);
  const { data: users } = await query;
  return (
    <>
      <PageHeader eyebrow="Admin" title="Users" />
      {done === 'suspended' && <div className="mb-4"><Notice tone="good">User suspended.</Notice></div>}
      {done === 'lifted' && <div className="mb-4"><Notice tone="good">Suspension lifted.</Notice></div>}
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" id="q" defaultValue={q} placeholder="Search name or handle" aria-label="Search name or handle" className="max-w-sm" />
        <Select name="show" defaultValue={show ?? ''} aria-label="Show" className="w-auto">
          <option value="">Everyone</option><option value="creator">Creators</option><option value="cre">Researchers</option><option value="suspended">Suspended</option>
        </Select>
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b border-line text-left"><th className="label p-3">User</th><th className="label p-3">Role</th><th className="label p-3">Joined</th><th className="label p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="border-b border-line align-top last:border-0">
                <td className="p-3"><strong>{u.display_name}</strong>{u.handle && <div className="text-xs text-muted">@{u.handle}</div>}</td>
                <td className="p-3">{u.role ?? '—'}</td>
                <td className="num p-3">{fmtDate(u.created_at)}</td>
                <td className="p-3">{u.suspended_reason === 'account_closed' ? <Pill tone="muted">Closed</Pill> : u.suspended_at ? <Pill tone="bad">Suspended</Pill> : <Pill tone="good">Active</Pill>}{u.suspended_reason && u.suspended_reason !== 'account_closed' && <div className="text-xs text-muted">{u.suspended_reason}</div>}</td>
                <td className="p-3">{u.id !== v.id && u.suspended_reason !== 'account_closed' && (u.suspended_at ? (
                  <ActionForm action={setSuspended}>
                    <input type="hidden" name="user_id" value={u.id} /><input type="hidden" name="suspend" value="0" /><input type="hidden" name="q" value={q ?? ''} />
                    <SubmitButton variant="secondary" size="sm">Lift suspension</SubmitButton>
                  </ActionForm>
                ) : (
                  // Two steps on purpose: a one-click red button on every row is too easy to hit by mistake.
                  <details className="group">
                    <summary className="cursor-pointer list-none text-xs font-medium text-muted hover:text-bad">Suspend…</summary>
                    <ActionForm action={setSuspended} className="mt-2 grid gap-1">
                      <input type="hidden" name="user_id" value={u.id} /><input type="hidden" name="suspend" value="1" /><input type="hidden" name="q" value={q ?? ''} />
                      <Input name="reason" id={`r-${u.id}`} placeholder="Reason (kept in the audit log)" className="text-xs" aria-label="Reason" required minLength={5} />
                      <SubmitButton variant="danger" size="sm">Suspend</SubmitButton>
                    </ActionForm>
                  </details>
                ))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
