import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, LinkButton, PageHeader, Pill } from '@/components/ui';
import { fmtDate, UnlockStatus } from '@/components/status';
import { withdrawPitch } from '@/app/actions/pitches';
import { formatMultiplier } from '@/lib/outlier';
import { formatMoney } from '@/lib/money';
import { passReasonLabel, stageLabel } from '@/lib/constants';

export const metadata = { title: 'My pitches' };

const label: Record<string, { t: 'neutral' | 'good' | 'muted' | 'bad'; l: string }> = {
  submitted: { t: 'neutral', l: 'Waiting' }, unlocked: { t: 'good', l: 'Unlocked' }, expired: { t: 'muted', l: 'Not unlocked' },
  withdrawn: { t: 'muted', l: 'Withdrawn' }, refunded: { t: 'bad', l: 'Refunded after dispute' },
};

export default async function Pitches() {
  const v = await requireViewer(['cre']);
  const supabase = await createClient();
  const [{ data: pitches }, { data: unlocks }, { data: results }, { data: feedback }] = await Promise.all([
    supabase.from('pitches').select('id, brief_id, status, multiplier, format_label, submitted_at, briefs(title, status)').eq('cre_id', v.id).order('submitted_at', { ascending: false }),
    supabase.from('unlocks').select('pitch_id, status, net_cents, currency, available_at').eq('cre_id', v.id),
    supabase.from('cre_idea_results').select('pitch_id, stage, result_multiple'),
    supabase.from('pitch_feedback').select('pitch_id, reason, note'),
  ]);
  const uMap = new Map((unlocks ?? []).map((u) => [u.pitch_id, u]));
  const rMap = new Map((results ?? []).map((r) => [r.pitch_id, r]));
  const fMap = new Map((feedback ?? []).map((f) => [f.pitch_id, f]));
  const logged = (results ?? []).filter((r) => r.result_multiple != null);
  const avg = logged.length ? Math.round((logged.reduce((a, r) => a + Number(r.result_multiple), 0) / logged.length) * 10) / 10 : null;
  return (
    <>
      <PageHeader title="My pitches" description={avg != null
        ? <>Creators logged results for {logged.length} of your ideas. On average they got <strong className="num text-ink">{formatMultiplier(avg)}</strong> their usual views.</>
        : 'When a creator posts one of your ideas and logs the views, the result shows up here and on your public profile.'} />
      {!pitches?.length ? (
        <EmptyState title="No pitches yet" action={<LinkButton href="/briefs">Browse open briefs</LinkButton>}>Pitch on an open brief and it shows up here.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
          <table className="w-full min-w-[860px] text-sm">
            <thead><tr className="border-b border-line text-left">
              <th className="label p-3">Brief</th><th className="label p-3">Idea</th><th className="label p-3">Status</th><th className="label p-3">Creator result</th><th className="label p-3">Earning</th><th className="label p-3">Sent</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {pitches.map((p) => {
                const u = uMap.get(p.id);
                const s = label[p.status] ?? { t: 'neutral', l: p.status };
                return (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="p-3"><Link href={`/briefs/${p.brief_id}`} className="font-semibold hover:text-accent">{(p.briefs as unknown as { title: string } | null)?.title}</Link></td>
                    <td className="p-3"><span className="num">{formatMultiplier(p.multiplier)}</span> · {p.format_label}</td>
                    <td className="p-3"><Pill tone={s.t}>{s.l}</Pill>
                      {fMap.get(p.id) && p.status === 'submitted' && (
                        <div className="mt-1 max-w-56 text-xs text-muted" title={fMap.get(p.id)!.note ?? undefined}>Passed: {passReasonLabel(fMap.get(p.id)!.reason)}{fMap.get(p.id)!.note ? ` · “${fMap.get(p.id)!.note}”` : ''}</div>
                      )}</td>
                    <td className="p-3">{(() => {
                      const r = rMap.get(p.id);
                      if (!r) return p.status === 'unlocked' ? <span className="text-xs text-muted">Not posted yet</span> : '—';
                      if (r.result_multiple != null) return <Pill tone={Number(r.result_multiple) >= 1 ? 'good' : 'warn'}><span className="num">{formatMultiplier(r.result_multiple)} their usual</span></Pill>;
                      return <span className="text-xs text-muted">{stageLabel(r.stage)}</span>;
                    })()}</td>
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
