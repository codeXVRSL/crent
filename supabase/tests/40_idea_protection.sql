-- Idea protection and repeat business. Runs after 30_hardening.sql.
\set ON_ERROR_STOP 1
\set QUIET 1
\set admin '00000000-0000-0000-0000-00000000000a'
\set c1    '00000000-0000-0000-0000-0000000000c1'
\set r1    '00000000-0000-0000-0000-0000000000e1'
\set r2    '00000000-0000-0000-0000-0000000000e2'
select set_config('request.jwt.claims', '{"aal":"aal2"}', false) \gset
delete from auth.mfa_factors;

-- helper: c1 creates and funds a $5 x 2 brief, returns its id
create or replace function pg_temp.funded_brief(p_title text, p_invited uuid default null) returns uuid language plpgsql as $$
declare v uuid; ext text;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
  set local role authenticated;
  v := create_brief(p_title, repeat('We need proven short-form ideas for this. ', 2), 'tiktok',
                    (select id from niches where slug = 'personal-finance'), null, null, '{}', 3.0, 365, 500, 2,
                    now() + interval '5 days', p_invited);
  select external_id into ext from prepare_brief_payment(v, 'mock');
  reset role;
  set local role service_role;
  perform mark_payment_paid(ext, 'prov_' || v, 1050, 'card');
  reset role;
  return v;
end $$;
-- helper: researcher pitches with a unique source and the given views/median
create or replace function pg_temp.pitch(p_cre uuid, p_brief uuid, p_tag text, p_views bigint, p_median bigint) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform set_config('request.jwt.claim.sub', p_cre::text, false);
  set local role authenticated;
  v := submit_pitch(p_brief, 'tiktok', 'Talking head ' || p_tag, 37, 'number_list',
         'An angle about money habits that young workers relate to ' || p_tag, p_views, p_median, current_date - 47, '50k-200k',
         'https://www.tiktok.com/@src/video/' || (floor(random() * 1e15))::bigint, null, 'Hook line number ' || p_tag || ' here',
         'Specific numbers and visible proof early keep people watching to the end.', repeat('SHOT LIST: show the receipts. ', 4), null);
  reset role;
  return v;
end $$;

begin;
-- ---------- locked cards are rounded; exact after unlock ----------
select pg_temp.funded_brief('Rounded cards test') as b \gset
select pg_temp.pitch(:'r1', :'b', 'A', 1347221, 92345) as pa \gset
select set_config('request.jwt.claim.sub', :'c1', false) \gset
set role authenticated;
select source_views = 1300000 and channel_median_views = 92000 and duration_seconds = 35
   and source_posted_on = date_trunc('month', current_date - 47)::date and is_locked and multiplier = 14.6 as ok
  from creator_pitch_cards where id = :'pa' \gset
\if :ok \else \echo 'FAIL: locked card should show rounded views, month and length' \quit \endif
select count(*) = 0 as ok from pitches where id = :'pa' \gset
\if :ok \else \echo 'FAIL: creator must not read exact numbers from the raw pitches table' \quit \endif
select unlock_pitch(:'pa') \gset
select source_views = 1347221 and duration_seconds = 37 and source_posted_on = current_date - 47 and not is_locked as ok
  from creator_pitch_cards where id = :'pa' \gset
\if :ok \else \echo 'FAIL: unlocked card should show exact numbers' \quit \endif
reset role;
select set_config('request.jwt.claim.sub', :'r2', false) \gset
set role authenticated;
select count(*) = 0 as ok from creator_pitch_cards \gset
\if :ok \else \echo 'FAIL: researchers must not read creators pitch cards' \quit \endif
reset role;
set role anon;
do $$ begin perform 1 from creator_pitch_cards; raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
reset role;
\echo '✓ locked cards: views to 2 figures, month only, length to 5s; exact after unlock; nobody else can read them'

-- ---------- closing early with pitches but no unlocks unlocks the top pitch ----------
select pg_temp.funded_brief('Early close test') as b2 \gset
select pg_temp.pitch(:'r1', :'b2', 'low', 400000, 100000) as low \gset
select pg_temp.pitch(:'r2', :'b2', 'top', 900000, 50000) as top \gset
select set_config('request.jwt.claim.sub', :'c1', false) \gset
set role authenticated;
select close_brief(:'b2') as refunded \gset
reset role;
select (select status from pitches where id = :'top') = 'unlocked'
   and (select status from pitches where id = :'low') = 'expired'
   and (select unlocks_used from briefs where id = :'b2') = 1
   and (select creator_id from unlocks where pitch_id = :'top') = :'c1'
   and (select net_cents from unlocks where pitch_id = :'top') = 450
   and :refunded = 525
   and exists (select 1 from notifications where user_id = :'c1' and kind = 'pitch_auto_unlocked')
   and exists (select 1 from notifications where user_id = :'r2' and kind = 'pitch_unlocked') as ok \gset
\if :ok \else \echo 'FAIL: early close should unlock the top pitch (r2), pay it, and refund the rest (525)' \quit \endif
select coalesce(sum(case when credit_account = 'escrow:brief:' || :'b2' then amount_cents else 0 end), 0)
     - coalesce(sum(case when debit_account  = 'escrow:brief:' || :'b2' then amount_cents else 0 end), 0) = 500 as ok
  from ledger_entries where brief_id = :'b2' \gset
\if :ok \else \echo 'FAIL: escrow should hold exactly the 500 refund still to send' \quit \endif
\echo '✓ close early with pitches and no unlocks → top pitch unlocked and paid, rest refunded'

-- ---------- deadline close does the same; admin close does not ----------
select pg_temp.funded_brief('Deadline test') as b3 \gset
select pg_temp.pitch(:'r1', :'b3', 'D', 700000, 70000) as pd \gset
update briefs set deadline_at = now() - interval '1 minute' where id = :'b3';
set role service_role;
select close_expired_briefs() \gset
reset role;
select (select status from pitches where id = :'pd') = 'unlocked' as ok \gset
\if :ok \else \echo 'FAIL: deadline close should unlock the only pitch' \quit \endif
select pg_temp.funded_brief('Admin close test') as b4 \gset
select pg_temp.pitch(:'r1', :'b4', 'E', 700000, 70000) as pe \gset
select set_config('request.jwt.claim.sub', :'admin', false) \gset
set role authenticated;
select close_brief(:'b4') \gset
reset role;
select (select status from pitches where id = :'pe') = 'expired' and (select unlocks_used from briefs where id = :'b4') = 0 as ok \gset
\if :ok \else \echo 'FAIL: admin close must not auto-unlock' \quit \endif
\echo '✓ deadline close also unlocks the top pitch; admin closes are exempt'

-- ---------- no pitches, already unlocked, or setting off → normal refund ----------
select pg_temp.funded_brief('No pitches test') as b5 \gset
select set_config('request.jwt.claim.sub', :'c1', false) \gset
set role authenticated;
select close_brief(:'b5') = 1050 as ok \gset
reset role;
\if :ok \else \echo 'FAIL: brief with no pitches should refund everything' \quit \endif
select pg_temp.funded_brief('Already unlocked test') as b6 \gset
select pg_temp.pitch(:'r1', :'b6', 'F', 700000, 70000) as pf \gset
select pg_temp.pitch(:'r2', :'b6', 'G', 900000, 70000) as pg \gset
select set_config('request.jwt.claim.sub', :'c1', false) \gset
set role authenticated;
select unlock_pitch(:'pf') \gset
select close_brief(:'b6') \gset
reset role;
select (select status from pitches where id = :'pg') = 'expired' as ok \gset
\if :ok \else \echo 'FAIL: no extra unlock when the creator already unlocked one' \quit \endif
update platform_settings set guarantee_first_unlock = false where id;
select pg_temp.funded_brief('Setting off test') as b7 \gset
select pg_temp.pitch(:'r1', :'b7', 'H', 700000, 70000) as ph \gset
select set_config('request.jwt.claim.sub', :'c1', false) \gset
set role authenticated;
select close_brief(:'b7') \gset
reset role;
select (select status from pitches where id = :'ph') = 'expired' as ok \gset
\if :ok \else \echo 'FAIL: guarantee switched off should not auto-unlock' \quit \endif
update platform_settings set guarantee_first_unlock = true where id;
\echo '✓ no auto-unlock without pitches, after a manual unlock, or when switched off'

-- ---------- private briefs (work with a researcher again) ----------
delete from notifications where kind in ('new_brief', 'private_brief');
select pg_temp.funded_brief('Private brief test', :'r1'::uuid) as bp \gset
select (select count(*) from notifications where kind = 'private_brief' and user_id = :'r1') = 1
   and (select count(*) from notifications where kind = 'new_brief' and link = '/briefs/' || :'bp') = 0 as ok \gset
\if :ok \else \echo 'FAIL: private brief should notify only the invited researcher' \quit \endif
select set_config('request.jwt.claim.sub', :'r2', false) \gset
set role authenticated;
select count(*) = 0 as ok from briefs where id = :'bp' \gset
\if :ok \else \echo 'FAIL: other researchers must not see a private brief' \quit \endif
reset role;
do $$ begin perform pg_temp.pitch('00000000-0000-0000-0000-0000000000e2', (select id from briefs where title = 'Private brief test'), 'X', 700000, 70000);
  raise exception 'expected error';
exception when others then if sqlerrm <> 'BRIEF_NOT_FOUND' then raise; end if; end $$;
select set_config('request.jwt.claim.sub', :'r1', false) \gset
set role authenticated;
select count(*) = 1 as ok from briefs where id = :'bp' \gset
\if :ok \else \echo 'FAIL: invited researcher should see the private brief' \quit \endif
reset role;
select pg_temp.pitch(:'r1', :'bp', 'P', 700000, 70000) is not null as ok \gset
\if :ok \else \echo 'FAIL: invited researcher should be able to pitch' \quit \endif
do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
  perform create_brief('Invite a creator', repeat('Not a researcher at all here. ', 2), 'tiktok', 1, null, null, '{}', 3.0, null,
                       500, 2, now() + interval '5 days', '00000000-0000-0000-0000-0000000000c2');
  raise exception 'expected error';
exception when others then if sqlerrm <> 'INVITED_CRE_NOT_AVAILABLE' then raise; end if; end $$;
\echo '✓ private briefs: only the invited researcher is notified, sees and can pitch; invitee must be a verified researcher'

-- ---------- repeated off-platform attempts ----------
delete from flags where kind = 'contact_leak';
select id as th from threads where creator_id = :'c1' and cre_id = :'r1' limit 1 \gset
select set_config('request.jwt.claim.sub', :'r1', false) \gset
set role authenticated;
insert into messages(thread_id, sender_id, body) values (:'th', :'r1', 'email me at rico@gmail.com');
insert into messages(thread_id, sender_id, body) values (:'th', :'r1', 'or whatsapp 0917 123 4567');
reset role;
select count(*) = 0 as ok from notifications where kind = 'policy_warning' and user_id = :'r1' \gset
\if :ok \else \echo 'FAIL: no warning before the third attempt' \quit \endif
set role authenticated;
insert into messages(thread_id, sender_id, body) values (:'th', :'r1', 'find me @rico.research on ig');
reset role;
select (select count(*) from notifications where kind = 'policy_warning' and user_id = :'r1') = 1
   and (select count(*) from notifications where kind = 'circumvention_risk' and user_id = :'admin') = 1
   and (select count(*) from flags where kind = 'contact_leak' and subject_user = :'r1') = 3 as ok \gset
\if :ok \else \echo 'FAIL: third attempt should warn the sender and alert admins once' \quit \endif
set role authenticated;
insert into messages(thread_id, sender_id, body) values (:'th', :'r1', 'rico@gmail.com again');
reset role;
select count(*) = 1 as ok from notifications where kind = 'circumvention_risk' and user_id = :'admin' \gset
\if :ok \else \echo 'FAIL: admins should be alerted once, not on every attempt' \quit \endif
\echo '✓ third attempt to share contact details in 30 days warns the sender and alerts admins once'
rollback;
