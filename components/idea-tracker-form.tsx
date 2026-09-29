'use client';
import { ActionForm, SubmitButton } from './form';
import { Field, Input, Select, Textarea } from './ui';
import { saveIdeaTracking } from '@/app/actions/ideas';
import { IDEA_STAGES } from '@/lib/constants';

export type Tracking = {
  stage: string; board: string | null; planned_on: string | null; notes: string | null; posted_url: string | null;
  posted_on: string | null; result_views: number | null; usual_views: number | null; result_multiple: number | string | null;
};

/** Stage, schedule, notes and results for one unlocked idea. Private to the creator. */
export function IdeaTrackerForm({ unlockId, t, boards, boardFilter }: { unlockId: string; t?: Tracking | null; boards: string[]; boardFilter?: string }) {
  const id = (k: string) => `${k}-${unlockId}`;
  return (
    <ActionForm action={saveIdeaTracking} className="grid gap-3">
      <input type="hidden" name="unlock_id" value={unlockId} />
      {boardFilter && <input type="hidden" name="board_filter" value={boardFilter} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Stage" htmlFor={id('stage')}>
          <Select id={id('stage')} name="stage" defaultValue={t?.stage ?? 'saved'}>
            {IDEA_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label="Board" htmlFor={id('board')} hint="e.g. March batch">
          <Input id={id('board')} name="board" maxLength={40} defaultValue={t?.board ?? ''} list={id('boards')} />
          <datalist id={id('boards')}>{boards.map((b) => <option key={b} value={b} />)}</datalist>
        </Field>
        <Field label="Film or post on" htmlFor={id('planned_on')}>
          <Input id={id('planned_on')} name="planned_on" type="date" defaultValue={t?.planned_on ?? ''} />
        </Field>
      </div>
      <Field label="Notes (only you see these)" htmlFor={id('notes')}>
        <Textarea id={id('notes')} name="notes" maxLength={2000} rows={2} defaultValue={t?.notes ?? ''} placeholder="Location, props, your own twist on the hook…" />
      </Field>
      <fieldset className="grid gap-3 rounded-xl border border-line p-3">
        <legend className="label px-1">After you post</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Link to your video" htmlFor={id('posted_url')}>
            <Input id={id('posted_url')} name="posted_url" type="url" maxLength={500} defaultValue={t?.posted_url ?? ''} placeholder="https://" />
          </Field>
          <Field label="Posted on" htmlFor={id('posted_on')}>
            <Input id={id('posted_on')} name="posted_on" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={t?.posted_on ?? ''} />
          </Field>
          <Field label="Views it got" htmlFor={id('result_views')}>
            <Input id={id('result_views')} name="result_views" inputMode="numeric" defaultValue={t?.result_views ?? ''} />
          </Field>
          <Field label="Your usual views" htmlFor={id('usual_views')} hint="Your channel's median per video.">
            <Input id={id('usual_views')} name="usual_views" inputMode="numeric" defaultValue={t?.usual_views ?? ''} />
          </Field>
        </div>
        <p className="text-xs text-muted">The researcher sees only the stage and the result (views ÷ your usual). Never your link or notes.</p>
      </fieldset>
      <div><SubmitButton size="sm">Save</SubmitButton></div>
    </ActionForm>
  );
}
