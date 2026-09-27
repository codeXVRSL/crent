-- Outlier Desk — Row Level Security and public views
-- Every table has RLS on. Writes to money tables happen only through functions (no insert/update policies).

create or replace function is_verified_cre()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cre_profiles c join profiles p on p.id = c.user_id
                  where c.user_id = auth.uid() and c.kyc_status = 'approved' and p.suspended_at is null)
$$;
grant execute on function is_verified_cre() to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'platform_settings','profiles','creator_profiles','cre_profiles','kyc_submissions','niches','cre_niches',
    'portfolio_items','briefs','pitches','pitch_secrets','unlocks','payments','refunds','payout_methods','payouts',
    'ledger_entries','disputes','reviews','threads','messages','flags','notifications','audit_log','webhook_events','waitlist'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "admin_read_all" on %I for select to authenticated using (is_admin())', t);
  end loop;
end $$;

-- settings & taxonomy: readable by everyone
create policy "settings_public_read" on platform_settings for select to anon, authenticated using (true);
create policy "niches_public_read"   on niches            for select to anon, authenticated using (true);
create policy "cre_niches_public_read" on cre_niches      for select to anon, authenticated using (true);
create policy "cre_niches_own_insert"  on cre_niches      for insert to authenticated with check (user_id = auth.uid() and my_role() = 'cre');
create policy "cre_niches_own_delete"  on cre_niches      for delete to authenticated using (user_id = auth.uid());

-- profiles
create policy "profiles_self_read"   on profiles for select to authenticated using (id = auth.uid());
create policy "profiles_self_update" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "creator_self_read"    on creator_profiles for select to authenticated using (user_id = auth.uid());
create policy "creator_self_update"  on creator_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cre_self_read"        on cre_profiles for select to authenticated using (user_id = auth.uid());
create policy "cre_self_update"      on cre_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- KYC: owner can read their own submissions; inserts only via submit_kyc()
create policy "kyc_self_read" on kyc_submissions for select to authenticated using (user_id = auth.uid());

-- portfolio: public when the CRE is verified
create policy "portfolio_public_read" on portfolio_items for select to anon, authenticated
  using (cre_id = auth.uid() or exists (select 1 from cre_profiles c where c.user_id = cre_id and c.kyc_status = 'approved'));
create policy "portfolio_own_insert" on portfolio_items for insert to authenticated with check (cre_id = auth.uid() and my_role() = 'cre');
create policy "portfolio_own_update" on portfolio_items for update to authenticated using (cre_id = auth.uid()) with check (cre_id = auth.uid());
create policy "portfolio_own_delete" on portfolio_items for delete to authenticated using (cre_id = auth.uid());

-- briefs: owner sees all own; verified CREs see funded briefs. Writes via functions only.
create policy "briefs_owner_read" on briefs for select to authenticated using (creator_id = auth.uid());
create policy "briefs_cre_read"   on briefs for select to authenticated
  using (status in ('open','closed','settled') and is_verified_cre());

-- pitches: owner CRE and the brief's creator
create policy "pitches_cre_read"     on pitches for select to authenticated using (cre_id = auth.uid());
create policy "pitches_creator_read" on pitches for select to authenticated
  using (exists (select 1 from briefs b where b.id = brief_id and b.creator_id = auth.uid()));

-- pitch_secrets: THE rule. Owner CRE, or the creator after a non-reversed unlock.
create policy "secrets_cre_read" on pitch_secrets for select to authenticated
  using (exists (select 1 from pitches p where p.id = pitch_id and p.cre_id = auth.uid()));
create policy "secrets_creator_after_unlock" on pitch_secrets for select to authenticated
  using (exists (select 1 from unlocks u where u.pitch_id = pitch_secrets.pitch_id
                   and u.creator_id = auth.uid() and u.status <> 'reversed'));

-- unlocks, payments, refunds, payouts
create policy "unlocks_party_read"  on unlocks  for select to authenticated using (auth.uid() in (creator_id, cre_id));
create policy "payments_payer_read" on payments for select to authenticated using (payer_id = auth.uid());
create policy "refunds_owner_read"  on refunds  for select to authenticated
  using (exists (select 1 from briefs b where b.id = brief_id and b.creator_id = auth.uid()));
create policy "payouts_owner_read"  on payouts  for select to authenticated using (cre_id = auth.uid());

-- payout methods: owner manages; account number stored encrypted
create policy "pm_owner_read"   on payout_methods for select to authenticated using (user_id = auth.uid());
create policy "pm_owner_insert" on payout_methods for insert to authenticated with check (user_id = auth.uid() and my_role() = 'cre');
create policy "pm_owner_delete" on payout_methods for delete to authenticated
  using (user_id = auth.uid() and not exists (select 1 from payouts p where p.method_id = payout_methods.id and p.status in ('requested','processing')));

-- disputes, reviews
create policy "disputes_party_read" on disputes for select to authenticated
  using (exists (select 1 from unlocks u where u.id = unlock_id and auth.uid() in (u.creator_id, u.cre_id)));
create policy "reviews_public_read" on reviews for select to anon, authenticated using (true);

-- messaging
create policy "threads_member_read" on threads for select to authenticated using (auth.uid() in (creator_id, cre_id));
create policy "messages_member_read" on messages for select to authenticated
  using (exists (select 1 from threads t where t.id = thread_id and auth.uid() in (t.creator_id, t.cre_id)));
create policy "messages_member_insert" on messages for insert to authenticated
  with check (sender_id = auth.uid()
              and exists (select 1 from threads t where t.id = thread_id and auth.uid() in (t.creator_id, t.cre_id)));

-- notifications
create policy "notif_own_read"   on notifications for select to authenticated using (user_id = auth.uid());
create policy "notif_own_update" on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- waitlist: anyone may join, nobody may read (except admin)
create policy "waitlist_insert" on waitlist for insert to anon, authenticated with check (true);

-- ---------------------------------------------------------------
-- Public views (run as owner, expose safe columns only)
-- ---------------------------------------------------------------
create view public_profiles as
  select id, role, display_name, handle, country_code, created_at from profiles where suspended_at is null;

create view cre_public_stats as
  select p.cre_id,
         count(*)::int                                                         as pitches_sent,
         count(*) filter (where p.status = 'unlocked')::int                    as pitches_unlocked,
         case when count(*) filter (where p.status <> 'withdrawn') = 0 then null
              else round(100.0 * count(*) filter (where p.status = 'unlocked')
                         / count(*) filter (where p.status <> 'withdrawn'))::int end as unlock_rate_pct
    from pitches p group by p.cre_id;

create view creator_public_stats as
  select b.creator_id,
         count(distinct b.id) filter (where b.status in ('open','closed','settled'))::int as briefs_posted,
         count(p.id)::int                                                    as pitches_received,
         count(u.id)::int                                                    as unlocks_made,
         case when count(p.id) = 0 then null else round(100.0 * count(u.id) / count(p.id))::int end as unlock_rate_pct,
         count(d.id)::int                                                    as disputes_opened
    from briefs b
    left join pitches p  on p.brief_id = b.id and p.status <> 'withdrawn'
    left join unlocks u  on u.pitch_id = p.id
    left join disputes d on d.unlock_id = u.id
   group by b.creator_id;

create view review_stats as
  select reviewee_id, round(avg(rating), 1) as avg_rating, count(*)::int as review_count
    from reviews group by reviewee_id;

create view public_cres as
  select pr.id, pr.display_name, pr.handle, pr.country_code, pr.created_at,
         c.headline, c.bio, c.platforms, c.years_experience, c.accepting_work,
         coalesce(array(select n.name from cre_niches cn join niches n on n.id = cn.niche_id
                         where cn.user_id = pr.id order by n.name), '{}') as niches,
         coalesce(array(select cn.niche_id from cre_niches cn where cn.user_id = pr.id), '{}') as niche_ids,
         s.pitches_sent, s.pitches_unlocked, s.unlock_rate_pct,
         r.avg_rating, coalesce(r.review_count, 0) as review_count
    from profiles pr
    join cre_profiles c on c.user_id = pr.id and c.kyc_status = 'approved'
    left join cre_public_stats s on s.cre_id = pr.id
    left join review_stats r on r.reviewee_id = pr.id
   where pr.suspended_at is null;

create view public_creators as
  select pr.id, pr.display_name, pr.handle, c.brand_name, c.main_platform, c.is_agency,
         coalesce(s.briefs_posted, 0) as briefs_posted, s.unlock_rate_pct, coalesce(s.disputes_opened, 0) as disputes_opened,
         r.avg_rating, coalesce(r.review_count, 0) as review_count
    from profiles pr
    join creator_profiles c on c.user_id = pr.id
    left join creator_public_stats s on s.creator_id = pr.id
    left join review_stats r on r.reviewee_id = pr.id;

-- Balances follow the caller's own RLS on unlocks
create view cre_balances with (security_invoker = true) as
  select cre_id, currency,
         coalesce(sum(net_cents) filter (where status in ('held','disputed')), 0)::int                  as held_cents,
         coalesce(sum(net_cents) filter (where status = 'available' and payout_id is null), 0)::int    as available_cents,
         coalesce(sum(net_cents) filter (where status = 'available' and payout_id is not null), 0)::int as in_payout_cents,
         coalesce(sum(net_cents) filter (where status = 'paid_out'), 0)::int                           as paid_out_cents
    from unlocks group by cre_id, currency;

revoke all on public_profiles, cre_public_stats, creator_public_stats, review_stats, public_cres, public_creators, cre_balances
  from anon, authenticated;
grant select on public_profiles, cre_public_stats, creator_public_stats, review_stats, public_cres, public_creators
  to anon, authenticated;
grant select on cre_balances to authenticated;
