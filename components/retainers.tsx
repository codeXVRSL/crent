import Link from 'next/link';
import { Repeat } from 'lucide-react';
import { ActionForm, SubmitButton } from './form';
import { Button, Card, Field, Pill, Select } from './ui';
import { createRetainer, deleteRetainer, leaveRetainer, setRetainerActive } from '@/app/actions/retainers';
import { formatMoney } from '@/lib/money';
import { manilaToday } from '@/lib/parse';
import { shortDate as day } from './status';

export type Retainer = {
  id: string; cre_id: string; creator_id: string; source_brief_id: string | null; title: string; price_per_idea_cents: number; max_unlocks: number;
  day_of_month: number; next_run_on: string; active: boolean; paused_reason: string | null; last_brief_id: string | null;
};
export const RETAINER_COLUMNS = 'id, cre_id, creator_id, source_brief_id, title, price_per_idea_cents, max_unlocks, day_of_month, next_run_on, active, paused_reason, last_brief_id';

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
const pausedText: Record<string, string> = {
  creator: 'Paused',
  researcher_left: 'Ended: the researcher left',
  researcher_unavailable: 'Paused: researcher unavailable',
  price_out_of_range: 'Paused: price outside current limits',
  creator_suspended: 'Paused',
};

/** On a funded brief: repeat it every month with a researcher the creator saved or unlocked from. */
export function RetainerForm({ briefId, researchers, existing }: {
  briefId: string;
  researchers: { id: string; display_name: string; handle: string }[];
  existing: (Retainer & { handle?: string })[];
}) {
  const today = Number(manilaToday().slice(8, 10));
  return (
    <Card className="grid gap-3 text-sm">
      <span className="label inline-flex items-center gap-1.5"><Repeat className="size-3.5" aria-hidden="true" /> Repeat every month</span>
      {existing.map((r) => {
        const who = r.handle ? `@${r.handle}` : 'your researcher';
        return (
          <p key={r.id} className="text-muted">
            {r.active ? <>Repeats on the {ordinal(r.day_of_month)} with {who}. Next draft {day(r.next_run_on)}.</> : <>{pausedText[r.paused_reason ?? 'creator']} (with {who}).</>}{' '}
            <Link href="/briefs#monthly" className="underline">Manage</Link>
          </p>
        );
      })}
      {researchers.length ? (
        <ActionForm action={createRetainer} className="grid gap-3">
          <input type="hidden" name="brief_id" value={briefId} />
          <p className="text-muted">Each month you get a copy of this brief as a draft to fund, and the researcher is invited the moment it&apos;s live. Nothing is charged until you press Pay.</p>
          <Field label="Researcher" htmlFor="retainer_cre">
            <Select id="retainer_cre" name="cre_id" defaultValue={researchers[0].id}>
              {researchers.map((r) => <option key={r.id} value={r.id}>{r.display_name} (@{r.handle})</option>)}
            </Select>
          </Field>
          <Field label="Day of the month" htmlFor="retainer_day" hint="Manila time. Days 29–31 aren't offered so every month has one.">
            <Select id="retainer_day" name="day_of_month" defaultValue={String(Math.min(today, 28))}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{ordinal(d)}</option>)}
            </Select>
          </Field>
          <SubmitButton variant="secondary" pendingText="Saving…">Repeat monthly</SubmitButton>
        </ActionForm>
      ) : !existing.length && (
        <p className="text-muted">Save a researcher (the heart on their pitch or profile) to repeat this brief with them every month.</p>
      )}
    </Card>
  );
}

/** The creator's monthly briefs, with pause, resume and delete. */
export function RetainerList({ retainers, handles }: { retainers: Retainer[]; handles: Map<string, { handle: string; display_name: string }> }) {
  if (!retainers.length) return null;
  return (
    <section id="monthly" className="mb-8 grid gap-3" aria-labelledby="monthly-h">
      <h2 id="monthly-h" className="text-base font-semibold">Monthly briefs</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {retainers.map((r) => {
          const who = handles.get(r.cre_id);
          return (
            <Card key={r.id} className="grid gap-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{r.title}</span>
                {r.active ? <Pill tone="good" dot>Active</Pill> : <Pill tone="muted">{pausedText[r.paused_reason ?? 'creator']}</Pill>}
              </div>
              <p className="text-muted">
                With {who ? <Link href={`/cres/${who.handle}`} className="underline">@{who.handle}</Link> : 'a researcher'} ·{' '}
                <span className="num">{formatMoney(r.price_per_idea_cents)}</span> × {r.max_unlocks} ideas · on the {ordinal(r.day_of_month)}
                {r.active && <> · next draft {day(r.next_run_on)}</>}
              </p>
              {r.last_brief_id && <Link href={`/briefs/${r.last_brief_id}`} className="text-xs text-accent underline">Latest brief</Link>}
              <div className="flex flex-wrap gap-2">
                {r.paused_reason !== 'researcher_left' && <form action={setRetainerActive}>
                  <input type="hidden" name="id" value={r.id} /><input type="hidden" name="active" value={r.active ? '0' : '1'} />
                  <Button type="submit" size="sm" variant="secondary" aria-label={`${r.active ? 'Pause' : 'Resume'} monthly brief ${r.title}`}>{r.active ? 'Pause' : 'Resume'}</Button>
                </form>}
                <form action={deleteRetainer}>
                  <input type="hidden" name="id" value={r.id} />
                  <Button type="submit" size="sm" variant="ghost" aria-label={`Stop monthly brief ${r.title}`}>Stop repeating</Button>
                </form>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

/** For researchers: the retainers they're on, each with a way to step away. */
export function MyRetainers({ retainers }: { retainers: Pick<Retainer, 'id' | 'title' | 'day_of_month'>[] }) {
  if (!retainers.length) return null;
  return (
    <Card className="mb-6 grid gap-2 text-sm">
      <span className="label inline-flex items-center gap-1.5"><Repeat className="size-3.5" aria-hidden="true" /> Your monthly retainers</span>
      <p className="text-muted">You&apos;re invited to these each month as soon as the creator funds them.</p>
      <ul className="grid gap-2">
        {retainers.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>{r.title} <span className="text-muted">· on the {ordinal(r.day_of_month)}</span></span>
            <form action={leaveRetainer}><input type="hidden" name="id" value={r.id} />
              <Button type="submit" size="sm" variant="ghost" aria-label={`Leave monthly brief ${r.title}`}>Leave</Button></form>
          </li>
        ))}
      </ul>
    </Card>
  );
}
