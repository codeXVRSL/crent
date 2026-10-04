import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/form';
import { Card, EmptyState, Input, Notice, PageHeader, Pill } from '@/components/ui';

import { reviewKyc } from '@/app/actions/admin';
import { ID_TYPES, platformLabel } from '@/lib/constants';
import { compactViews, formatMultiplier } from '@/lib/outlier';
import { When } from '@/components/when';

export const metadata = { title: 'Verifications' };

export default async function AdminKyc({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  await requireViewer(['admin']);
  const { done } = await searchParams;
  const supabase = await createClient();
  const { data: pending } = await supabase.from('cre_profiles').select('user_id, headline, platforms').eq('kyc_status', 'pending');
  const ids = (pending ?? []).map((p) => p.user_id);
  const [{ data: subs }, { data: profiles }, { data: portfolio }] = ids.length ? await Promise.all([
    supabase.from('kyc_submissions').select('*').in('user_id', ids).order('submitted_at', { ascending: false }),
    supabase.from('profiles').select('id, display_name, handle').in('id', ids),
    supabase.from('portfolio_items').select('cre_id, title, platform, source_url, source_views, channel_median_views, multiplier').in('cre_id', ids),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];

  // latest submission per user, with short-lived image links
  const latest = new Map<string, NonNullable<typeof subs>[number]>();
  for (const s of subs ?? []) if (!latest.has(s.user_id)) latest.set(s.user_id, s);
  const items = await Promise.all([...latest.values()].sort((a, b) => a.submitted_at.localeCompare(b.submitted_at)).map(async (s) => {
    const { data: signed } = await supabase.storage.from('kyc').createSignedUrls([s.id_front_path, s.selfie_path], 300);
    return { s, front: signed?.[0]?.signedUrl, selfie: signed?.[1]?.signedUrl };
  }));
  const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <>
      <PageHeader eyebrow="Admin" title="Verifications" description="Oldest first. Image links expire after 5 minutes; reload to refresh them." />
      {done === 'approved' && <div className="mb-4"><Notice tone="good">Approved. The researcher has been notified and can pitch now.</Notice></div>}
      {done === 'rejected' && <div className="mb-4"><Notice tone="good">Rejected with your reason. The researcher has been told what to fix.</Notice></div>}
      {items.length === 0 ? <EmptyState title="No verifications waiting" /> : (
        <div className="grid gap-6">
          {items.map(({ s, front, selfie }) => {
            const p = pMap.get(s.user_id);
            const age = Math.floor((Date.now() - new Date(s.birth_date).getTime()) / (365.25 * 86_400_000));
            return (
              <Card key={s.id} className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><strong>{p?.display_name}</strong> <span className="text-muted">@{p?.handle}</span></div>
                  <span className="text-xs text-muted">Submitted <When iso={s.submitted_at} /></span>
                </div>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div><dt className="label">Legal name</dt><dd>{s.legal_name}</dd></div>
                  <div><dt className="label">Age</dt><dd className="num">{age} ({s.birth_date})</dd></div>
                  <div><dt className="label">Address</dt><dd>{s.address_line}, {s.city}, {s.province} {s.postal_code}</dd></div>
                  <div><dt className="label">Mobile</dt><dd className="num">{s.mobile_number}</dd></div>
                  <div><dt className="label">ID type</dt><dd>{ID_TYPES.find((t) => t.value === s.id_type)?.label}</dd></div>
                  {s.tin && <div><dt className="label">TIN</dt><dd className="num">{s.tin}</dd></div>}
                </dl>
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* eslint-disable @next/next/no-img-element -- short-lived signed URLs, not optimizable */}
                  {front && <a href={front} target="_blank" rel="noopener noreferrer"><img src={front} alt="ID front" className="max-h-64 rounded border border-line object-contain" /></a>}
                  {selfie && <a href={selfie} target="_blank" rel="noopener noreferrer"><img src={selfie} alt="Selfie with ID" className="max-h-64 rounded border border-line object-contain" /></a>}
                </div>
                <div className="grid gap-1 text-sm">
                  <span className="label">Portfolio</span>
                  {(portfolio ?? []).filter((x) => x.cre_id === s.user_id).map((x) => (
                    <a key={x.source_url} href={x.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                      {x.title} · {platformLabel(x.platform)} · <span className="num">{compactViews(x.source_views)}/{compactViews(x.channel_median_views)} = {formatMultiplier(x.multiplier)}</span>
                    </a>
                  ))}
                </div>
                <ul className="flex flex-wrap gap-2 text-xs"><Pill>Name matches ID?</Pill><Pill>Selfie matches ID?</Pill><Pill>18 or older?</Pill><Pill>Portfolio links real?</Pill></ul>
                <ActionForm action={reviewKyc} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input type="hidden" name="user_id" value={s.user_id} />
                  <Input name="reason" id={`reason-${s.id}`} placeholder="Reason (required to reject), e.g. ID photo is blurry" aria-label="Reason" />
                  <button name="decision" value="approve" className="rounded-md bg-good px-4 py-2 text-sm font-semibold text-white">Approve</button>
                  <button name="decision" value="reject" className="rounded-md bg-bad px-4 py-2 text-sm font-semibold text-white">Reject</button>
                </ActionForm>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
