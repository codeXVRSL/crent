import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, LinkButton, PageHeader, Pill } from '@/components/ui';
import { FavoriteButton } from '@/components/favorite-button';
import { InviteForm } from '@/components/invite-form';
import { LevelBadge, TrackRecordLine, type PublicCre } from '@/components/track-record';

export const metadata = { title: 'Saved researchers' };

export default async function Favorites() {
  const v = await requireViewer(['creator']);
  const supabase = await createClient();
  const [{ data: favs }, { data: briefs }] = await Promise.all([
    supabase.from('favorite_cres').select('cre_id, created_at').eq('creator_id', v.id).order('created_at', { ascending: false }),
    supabase.from('briefs').select('id, title').eq('creator_id', v.id).eq('status', 'open').gt('deadline_at', new Date().toISOString()).order('opened_at', { ascending: false }),
  ]);
  const ids = (favs ?? []).map((f) => f.cre_id);
  const briefIds = (briefs ?? []).map((b) => b.id);
  const [{ data: cres }, { data: invites }] = await Promise.all([
    ids.length ? supabase.from('public_cres').select('*').in('id', ids) : Promise.resolve({ data: [] as PublicCre[] }),
    ids.length && briefIds.length ? supabase.from('brief_invites').select('brief_id, cre_id').in('brief_id', briefIds) : Promise.resolve({ data: [] as { brief_id: string; cre_id: string }[] }),
  ]);
  const cMap = new Map(((cres ?? []) as PublicCre[]).map((c) => [c.id, c]));

  return (
    <>
      <PageHeader title="Saved researchers" description="Researchers you want to work with again. Invite them to a live brief and they get notified right away, even outside their usual niches.">
        <LinkButton href="/cres" variant="secondary">Browse the directory</LinkButton>
      </PageHeader>
      {!ids.length ? (
        <EmptyState title="No saved researchers yet" action={<LinkButton href="/cres">Find researchers</LinkButton>}>
          Tap “Save researcher” on a profile or on a pitch you liked. Repeat work with researchers who know your style is the fastest way to good ideas.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {ids.map((id) => {
            const c = cMap.get(id);
            if (!c) return null; // no longer verified or suspended
            return (
              <div key={id} className="grid content-start gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/cres/${c.handle}`} className="font-semibold hover:text-accent">{c.display_name}</Link>
                    <div className="text-xs text-muted">@{c.handle}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <LevelBadge cre={c} />
                    <FavoriteButton creId={c.id} saved back="/favorites" compact />
                  </div>
                </div>
                {c.headline && <p className="text-sm">{c.headline}</p>}
                <div className="flex flex-wrap gap-1">{c.niches.slice(0, 4).map((n) => <Pill key={n}>{n}</Pill>)}{!c.accepting_work && <Pill tone="muted">Not taking new work</Pill>}</div>
                <TrackRecordLine cre={c} />
                <InviteForm creId={c.id} briefs={briefs ?? []} invited={(invites ?? []).filter((i) => i.cre_id === c.id).map((i) => i.brief_id)} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
