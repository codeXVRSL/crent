import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, LinkButton, PageHeader, Pill } from '@/components/ui';
import { fmtDate, UnlockStatus } from '@/components/status';
import { withdrawPitch } from '@/app/actions/pitches';
import { formatMultiplier } from '@/lib/outlier';
import { formatMoney } from '@/lib/money';

export const metadata = { title: 'My pitches' };

const label: Record<string, { t: 'neutral' | 'good' | 'muted' | 'bad'; l: string }> = {
  submitted: { t: 'neutral', l: 'Waiting' }, unlocked: { t: 'good', l: 'Unlocked' }, expired: { t: 'muted', l: 'Not unlocked' },
  withdrawn: { t: 'muted', l: 'Withdrawn' }, refunded: { t: 'bad', l: 'Refunded after dispute' },
};

export default async function Pitches() {
  const v = await requireViewer(['cre']);
  const supabase = await createClient();
  const [{ data: pitches }, { data: unlocks }] = await Promise.all([
    supabase.from('pitches').select('id, brief_id, status, multiplier, format_label, submitted_at, briefs(title, status)').eq('cre_id', v.id).order('submitted_at', { ascending: false }),
    supabase.from('unlocks').select('pitch_id, status, net_cents, currency, available_at').eq('cre_id', v.id),
  ]);
  const uMap = new Map((unlocks ?? []).map((u) => [u.pitch_id, u]));
  return (
    <>
      <PageHeader title="My pitches" />
      {!pitches?.length ? (
        <EmptyState title="No pitches yet" action={<LinkButton href="/briefs">Browse open briefs</LinkButton>}>Pitch on an open brief and it shows up here.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-line text-left">
              <th className="label p-3">Brief</th><th className="label p-3">Idea</th><th className="label p-3">Status</th><th className="label p-3">Earning</th><th className="label p-3">Sent</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {pitches.map((p) => {
                const u = uMap.get(p.id);
                const s = label[p.status] ?? { t: 'neutral', l: p.status };
                return (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="p-3"><Link href={`/briefs/${p.brief_id}`} className="font-semibold hover:text-accent">{(p.briefs as unknown as { title: string } | null)?.title}</Link></td>
                    <td className="p-3"><span className="num">{formatMultiplier(p.multiplier)}</span> · {p.format_label}</td>
                    <td className="p-3"><Pill tone={s.t}>{s.l}</Pill></td>
                    <td className="num p-3">{u ? <span className="flex items-center gap-2">{formatMoney(u.net_cents, u.currency)} <UnlockStatus status={u.status} /></span> : '—'}</td>
                    <td className="num p-3">{fmtDate(p.submitted_at)}</td>
                    <td className="p-3">{p.status === 'submitted' && (
                      <form action={withdrawPitch}><input type="hidden" name="pitch_id" value={p.id} /><button className="text-xs text-bad">Withdraw</button></form>
                    )}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
