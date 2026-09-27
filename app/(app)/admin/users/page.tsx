import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm, SubmitButton } from '@/components/form';
import { Button, Input, PageHeader, Pill } from '@/components/ui';
import { fmtDate } from '@/components/status';
import { setSuspended } from '@/app/actions/admin';

export const metadata = { title: 'Users' };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const v = await requireViewer(['admin']);
  const { q } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from('profiles').select('id, display_name, handle, role, suspended_at, suspended_reason, created_at').order('created_at', { ascending: false }).limit(100);
  if (q) query = query.or(`display_name.ilike.%${q.replace(/[%,()]/g, '')}%,handle.ilike.%${q.replace(/[%,()]/g, '')}%`);
  const { data: users } = await query;
  return (
    <>
      <PageHeader eyebrow="Admin" title="Users" />
      <form className="mb-4 flex gap-2"><Input name="q" id="q" defaultValue={q} placeholder="Search name or handle" className="max-w-sm" /><Button type="submit" variant="secondary">Search</Button></form>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b border-line text-left"><th className="label p-3">User</th><th className="label p-3">Role</th><th className="label p-3">Joined</th><th className="label p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="border-b border-line align-top last:border-0">
                <td className="p-3"><strong>{u.display_name}</strong>{u.handle && <div className="text-xs text-muted">@{u.handle}</div>}</td>
                <td className="p-3">{u.role ?? '—'}</td>
                <td className="num p-3">{fmtDate(u.created_at)}</td>
                <td className="p-3">{u.suspended_at ? <Pill tone="bad">Suspended</Pill> : <Pill tone="good">Active</Pill>}{u.suspended_reason && <div className="text-xs text-muted">{u.suspended_reason}</div>}</td>
                <td className="p-3">{u.id !== v.id && (
                  <ActionForm action={setSuspended} className="grid gap-1">
                    <input type="hidden" name="user_id" value={u.id} />
                    <input type="hidden" name="suspend" value={u.suspended_at ? '0' : '1'} />
                    {!u.suspended_at && <Input name="reason" id={`r-${u.id}`} placeholder="Reason" className="text-xs" aria-label="Reason" />}
                    <SubmitButton variant={u.suspended_at ? 'secondary' : 'danger'}>{u.suspended_at ? 'Lift suspension' : 'Suspend'}</SubmitButton>
                  </ActionForm>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
