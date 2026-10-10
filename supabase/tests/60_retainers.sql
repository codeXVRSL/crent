-- Retainers: a funded brief repeats monthly as a draft; paying it invites the researcher. Fresh users.
\set ON_ERROR_STOP 1
\set QUIET 1
\set c6 '00000000-0000-0000-0000-0000000000c6'
\set c7 '00000000-0000-0000-0000-0000000000c7'
\set r6 '00000000-0000-0000-0000-0000000000e6'
\set r7 '00000000-0000-0000-0000-0000000000e7'
\set r8 '00000000-0000-0000-0000-0000000000e8'

insert into auth.users(id, email) values (:'c6','c6@example.com'), (:'c7','c7@example.com'), (:'r6','r6@example.com'), (:'r7','r7@example.com'), (:'r8','r8@example.com');
update profiles set role = 'creator' where id in (:'c6', :'c7');
update profiles set role = 'cre' where id in (:'r6', :'r7', :'r8');
insert into cre_profiles(user_id, kyc_status) values (:'r6', 'approved'), (:'r7', 'pending'), (:'r8', 'approved')
  on conflict (user_id) do update set kyc_status = excluded.kyc_status;

-- next date helper
select case when retainer_next_date(15, '2026-10-10') = '2026-10-15' and retainer_next_date(15, '2026-10-15') = '2026-11-15'
             and retainer_next_date(1, '2026-12-31') = '2027-01-01' and retainer_next_date(28, '2027-01-30') = '2027-02-28'
  then '✓ next run date: later this month, else next month (across years)' else 'FAIL: retainer_next_date' end;

-- A funded brief to repeat.
select set_config('request.jwt.claim.sub', :'c6', false); set role authenticated;
select create_brief('Monthly money reels', 'Find me outliers about budgeting for young families in the Philippines.', 'tiktok',
  (select id from niches limit 1), null, null, '{}', 5, 30, 800, 2, now() + interval '7 days') as rb \gset
select set_config('my.rb', :'rb', false) \gset
do $$ begin perform create_retainer(current_setting('my.rb')::uuid, '00000000-0000-0000-0000-0000000000e6', 5); raise exception 'FAIL: retainer from an unpaid draft';
exception when others then if sqlerrm <> 'RETAINER_NEEDS_FUNDED_BRIEF' then raise; end if; end $$;
\echo '✓ a retainer needs a brief that was funded'
select external_id as ext from prepare_brief_payment(:'rb', 'mock') \gset
reset role;
set role service_role; select mark_payment_paid(:'ext', 'p', (select total_charge_cents from briefs where id = :'rb'), 'card'); reset role;

select set_config('request.jwt.claim.sub', :'c6', false); set role authenticated;
do $$ begin perform create_retainer(current_setting('my.rb')::uuid, '00000000-0000-0000-0000-0000000000e7', 5); raise exception 'FAIL: unverified researcher';
exception when others then if sqlerrm <> 'CRE_NOT_FOUND' then raise; end if; end $$;
do $$ begin perform create_retainer(current_setting('my.rb')::uuid, '00000000-0000-0000-0000-0000000000e6', 31); raise exception 'FAIL: day 31';
exception when others then if sqlerrm <> 'RETAINER_DAY_OUT_OF_RANGE' then raise; end if; end $$;
\echo '✓ only verified researchers and days 1–28'
do $$ begin perform create_retainer(current_setting('my.rb')::uuid, '00000000-0000-0000-0000-0000000000e8', 5); raise exception 'FAIL: stranger researcher';
exception when others then if sqlerrm <> 'RETAINER_NEEDS_RELATIONSHIP' then raise; end if; end $$;
\echo '✓ only researchers the creator saved or unlocked from'
select toggle_favorite_cre(:'r6', true);
select create_retainer(:'rb', :'r6', 5) as rid \gset
select set_config('my.rid', :'rid', false) \gset
do $$ begin perform create_retainer(current_setting('my.rb')::uuid, '00000000-0000-0000-0000-0000000000e6', 9); raise exception 'FAIL: duplicate';
exception when others then if sqlerrm <> 'RETAINER_EXISTS' then raise; end if; end $$;
select case when deadline_days = 7 and price_per_idea_cents = 800 and max_unlocks = 2 and next_run_on > (now() at time zone 'Asia/Manila')::date
  then '✓ retainer copies the brief (7-day window) and starts next time the day comes round' else 'FAIL: retainer copy ' || deadline_days end
  from retainers where id = :'rid';
reset role;

-- Other people can't see or change it.
select set_config('request.jwt.claim.sub', :'c7', false); set role authenticated;
select case when (select count(*) from retainers) = 0 then '✓ other creators cannot see a retainer' else 'FAIL: retainer visible' end;
do $$ begin perform set_retainer_active(current_setting('my.rid')::uuid, false); raise exception 'FAIL: other creator paused it';
exception when others then if sqlerrm <> 'RETAINER_NOT_FOUND' then raise; end if; end $$;
do $$ begin perform delete_retainer(current_setting('my.rid')::uuid); raise exception 'FAIL: other creator deleted it';
exception when others then if sqlerrm <> 'RETAINER_NOT_FOUND' then raise; end if; end $$;
do $$ begin perform run_retainers(); raise exception 'FAIL: user ran the job';
exception when insufficient_privilege then null; end $$;
do $$ declare n int; begin
  insert into retainers(creator_id, cre_id, title, description, platform, min_multiplier, price_per_idea_cents, max_unlocks, deadline_days, day_of_month, next_run_on)
  values (auth.uid(), '00000000-0000-0000-0000-0000000000e6', 'x', 'x', 'tiktok', 5, 100, 1, 1, 1, current_date);
  raise exception 'FAIL: direct insert allowed';
exception when insufficient_privilege then null; when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
\echo '✓ other creators cannot pause, delete, insert or run retainers'
reset role;
select set_config('request.jwt.claim.sub', :'r6', false); set role authenticated;
select case when (select count(*) from retainers) = 1 then '✓ the researcher can see their retainer' else 'FAIL: researcher cannot see retainer' end;
reset role;
select case when exists (select 1 from notifications where user_id = :'r6' and kind = 'retainer_started') then '✓ researcher is told about the retainer' else 'FAIL: no notice' end;

-- The job: not due yet → nothing. Due → a draft, creator notified, next month scheduled.
set role service_role;
select case when (select count(*) from run_retainers()) = 0 then '✓ job does nothing before the day' else 'FAIL: ran early' end;
reset role;
update retainers set next_run_on = (now() at time zone 'Asia/Manila')::date where id = :'rid';
set role service_role;
select brief_id as nb, total_charge_cents as charge from run_retainers() \gset
reset role;
select case when b.status = 'draft' and b.retainer_id = :'rid' and b.title = 'Monthly money reels' and b.price_per_idea_cents = 800
             and b.deadline_at > now() + interval '14 days'
             and :charge = b.total_charge_cents and r.last_brief_id = b.id and r.next_run_on > (now() at time zone 'Asia/Manila')::date
  then '✓ due retainer makes a draft copy and schedules next month' else 'FAIL: draft ' || b.status end
  from briefs b, retainers r where b.id = :'nb' and r.id = :'rid';
select case when exists (select 1 from notifications where user_id = :'c6' and kind = 'retainer_draft' and link = '/briefs/' || :'nb')
  then '✓ creator is told the draft is ready to fund' else 'FAIL: no draft notice' end;
set role service_role;
select case when (select count(*) from run_retainers()) = 0 then '✓ running twice the same day makes nothing more' else 'FAIL: duplicate draft' end;
reset role;

-- Unpaid draft from last month: no pile-up.
update retainers set next_run_on = (now() at time zone 'Asia/Manila')::date where id = :'rid';
set role service_role; select count(*) as made from run_retainers() \gset
reset role;
select case when :made = 0 and (select count(*) from briefs where retainer_id = :'rid') = 1 and (select next_run_on from retainers where id = :'rid') > (now() at time zone 'Asia/Manila')::date
  then '✓ an unpaid draft is not followed by another one' else 'FAIL: drafts piled up' end;

-- Paying it invites the researcher.
select set_config('request.jwt.claim.sub', :'c6', false); set role authenticated;
select external_id as ext2 from prepare_brief_payment(:'nb', 'mock') \gset
reset role;
set role service_role; select mark_payment_paid(:'ext2', 'p2', :charge, 'card'); reset role;
select case when (select deadline_at from briefs where id = :'nb') between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour'
  then '✓ the pitching window starts when the monthly brief goes live' else 'FAIL: deadline not reset' end;
select case when exists (select 1 from brief_invites where brief_id = :'nb' and cre_id = :'r6')
             and exists (select 1 from notifications where user_id = :'r6' and kind = 'brief_invite' and link = '/briefs/' || :'nb')
  then '✓ paying the monthly brief invites the researcher' else 'FAIL: no invite' end;

-- Pause / resume by the creator.
select set_config('request.jwt.claim.sub', :'c6', false); set role authenticated;
select set_retainer_active(:'rid', false);
select case when not active and paused_reason = 'creator' then '✓ creator can pause' else 'FAIL: pause' end from retainers where id = :'rid';
select set_retainer_active(:'rid', true);
select case when active and paused_reason is null and next_run_on > (now() at time zone 'Asia/Manila')::date then '✓ creator can resume' else 'FAIL: resume' end from retainers where id = :'rid';
reset role;

-- Researcher loses verification → the job pauses the retainer and tells the creator.
update cre_profiles set kyc_status = 'rejected' where user_id = :'r6';
update retainers set next_run_on = (now() at time zone 'Asia/Manila')::date where id = :'rid';
set role service_role; select count(*) as made2 from run_retainers() \gset
reset role;
select case when :made2 = 0 and not active and paused_reason = 'researcher_unavailable'
             and exists (select 1 from notifications where user_id = :'c6' and kind = 'retainer_paused')
  then '✓ unavailable researcher pauses the retainer and the creator is told' else 'FAIL: not paused' end from retainers where id = :'rid';
update cre_profiles set kyc_status = 'approved' where user_id = :'r6';

-- A monthly copy counts as the original: no second retainer with the same researcher from it.
select set_config('request.jwt.claim.sub', :'c6', false); set role authenticated;
select set_config('my.nb', :'nb', false) \gset
do $$ begin perform create_retainer(current_setting('my.nb')::uuid, '00000000-0000-0000-0000-0000000000e6', 9); raise exception 'FAIL: duplicate via copy';
exception when others then if sqlerrm <> 'RETAINER_EXISTS' then raise; end if; end $$;
\echo '✓ a monthly copy is treated as the brief it repeats'
reset role;

-- The researcher can leave; the creator is told and can't restart it with them.
select set_config('request.jwt.claim.sub', :'c6', false); set role authenticated; select set_retainer_active(:'rid', true); reset role;
select set_config('request.jwt.claim.sub', :'r8', false); set role authenticated;
do $$ begin perform leave_retainer(current_setting('my.rid')::uuid); raise exception 'FAIL: other researcher left it';
exception when others then if sqlerrm <> 'RETAINER_NOT_FOUND' then raise; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub', :'r6', false); set role authenticated; select leave_retainer(:'rid'); reset role;
select case when not active and paused_reason = 'researcher_left'
             and (select count(*) from notifications where user_id = :'c6' and kind = 'retainer_paused') = 2
  then '✓ the researcher can leave a retainer and the creator is told' else 'FAIL: leave' end from retainers where id = :'rid';
select set_config('request.jwt.claim.sub', :'c6', false); set role authenticated;
do $$ begin perform set_retainer_active(current_setting('my.rid')::uuid, true); raise exception 'FAIL: restarted after researcher left';
exception when others then if sqlerrm <> 'RETAINER_RESEARCHER_LEFT' then raise; end if; end $$;
\echo '✓ a retainer the researcher left cannot be restarted'
reset role;
update retainers set active = true, paused_reason = null where id = :'rid';

-- Closing the account ends retainers; deleting works for the owner.
update profiles set suspended_at = now(), suspended_reason = 'account_closed' where id = :'r6';
select case when not active then '✓ closing an account ends its retainers' else 'FAIL: still active after close' end from retainers where id = :'rid';
select set_config('request.jwt.claim.sub', :'c6', false); set role authenticated;
select delete_retainer(:'rid');
select case when (select count(*) from retainers) = 0 and (select retainer_id from briefs where id = :'nb') is null
  then '✓ creator can delete a retainer; its briefs stay' else 'FAIL: delete' end;
reset role;

-- Admin weekly trends: admins only, 12 Manila weeks, counted in the database.
select set_config('request.jwt.claim.sub', :'c6', false); set role authenticated;
do $$ begin perform admin_weekly_trends(12); raise exception 'FAIL: creator read admin trends';
exception when others then if sqlerrm <> 'NOT_ADMIN' then raise; end if; end $$;
\echo '✓ weekly trends are admin-only'
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false); set role authenticated;
select case when count(*) = 12 and max(week_start) = date_trunc('week', now() at time zone 'Asia/Manila')::date
             and extract(isodow from min(week_start)) = 1
             and (select funded_cents from admin_weekly_trends(12) order by week_start desc limit 1)
                 >= (select coalesce(sum(amount_cents), 0) from payments where paid_at >= date_trunc('week', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila' and status = 'paid')
  then '✓ weekly trends: 12 Monday weeks ending this week, with this week''s payments' else 'FAIL: trends ' || count(*) end
  from admin_weekly_trends(12);
reset role;
