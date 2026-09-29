-- Idea board, pitch shortlist/feedback, saved researchers, invites, swipe file.
-- Runs after 10_marketplace_flow.sql and reuses its users (c1, c2 creators; r1, r2 verified CREs; r3 unverified).
\set ON_ERROR_STOP 1
\set QUIET 1

\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c2 '00000000-0000-0000-0000-0000000000c2'
\set r1 '00000000-0000-0000-0000-0000000000e1'
\set r2 '00000000-0000-0000-0000-0000000000e2'
\set r3 '00000000-0000-0000-0000-0000000000e3'

-- ---------- setup: a fresh funded brief with three pitches, one unlocked ----------
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select create_brief('Budgeting ideas for new grads', repeat('Proven budgeting ideas for people in their first job. ', 2),
  'tiktok', (select id from niches where slug='personal-finance'), null, null, '{}', 3.0, null, 600, 3, now() + interval '5 days') as tb \gset
select external_id as text1 from prepare_brief_payment(:'tb', 'mock') \gset
reset role;
set role service_role; select mark_payment_paid(:'text1', 'prov_t1', (select total_charge_cents from briefs where id = :'tb'), 'card'); reset role;

select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
select submit_pitch(:'tb', 'tiktok', 'Talking head + spreadsheet', 40, 'number_list',
  'A first-paycheck plan that splits money into three buckets', 900000, 60000, current_date - 15, '50k-200k',
  'https://www.tiktok.com/@grad/video/7400000000000000001', null, 'Here is exactly what I did with my first paycheck',
  'A concrete, copyable plan with real numbers makes people save the video for later.',
  repeat('HOOK: show the paycheck. SHOT LIST: split into buckets on screen. ', 3), null) as tp1 \gset
select submit_pitch(:'tb', 'tiktok', 'Street quiz', 30, 'question',
  'Quizzing new grads on one money fact most people get wrong', 700000, 50000, current_date - 20, '10k-50k',
  'https://www.tiktok.com/@grad/video/7400000000000000002', null, 'Can you guess what a credit score actually measures',
  'Quiz format invites viewers to answer in the comments before the reveal.',
  repeat('SHOT LIST: approach, ask, reaction, reveal on screen. ', 3), null) as tp2 \gset
reset role;
select set_config('request.jwt.claim.sub', :'r2', false); set role authenticated;
select submit_pitch(:'tb', 'tiktok', 'Green screen', 35, 'myth_bust',
  'The emergency fund advice that does not fit a first job', 800000, 40000, current_date - 10, null,
  'https://www.tiktok.com/@grad/video/7400000000000000003', null, 'Six months of expenses is terrible advice for you',
  'Contrarian take on a rule people repeat without thinking about entry-level pay.',
  repeat('HOOK: contrarian line. BEATS: do the math on screen. ', 3), null) as tp3 \gset
reset role;
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select unlock_pitch(:'tp1') as tu1 \gset
reset role;

-- ---------- shortlist and pass-with-feedback ----------
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select set_pitch_shortlist(:'tp2', true);
select set_pitch_shortlist(:'tp2', true); -- idempotent
select count(*) = 1 as ok from pitch_shortlist \gset
\if :ok \else \echo 'FAIL: shortlist' \quit \endif
select pass_pitch(:'tp3', 'seen_it', 'I already filmed this, email me at a@b.com');
select note not like '%@b.com%' as ok from pitch_feedback where pitch_id = :'tp3' \gset
\if :ok \else \echo 'FAIL: pass note not masked' \quit \endif
select set_config('test.tp1', :'tp1', false) \gset
do $$ begin perform pass_pitch(current_setting('test.tp1')::uuid, 'other', null); raise exception 'expected error';
exception when others then if sqlerrm <> 'PITCH_NOT_AVAILABLE' then raise; end if; end $$;
reset role;

select set_config('request.jwt.claim.sub', :'c2', false); set role authenticated;
select set_config('test.tp2', :'tp2', false) \gset
do $$ begin perform set_pitch_shortlist(current_setting('test.tp2')::uuid, true); raise exception 'expected error';
exception when others then if sqlerrm <> 'PITCH_NOT_FOUND' then raise; end if; end $$;
select count(*) = 0 as ok from pitch_feedback \gset
\if :ok \else \echo 'FAIL: other creator sees feedback' \quit \endif
reset role;

select set_config('request.jwt.claim.sub', :'r2', false); set role authenticated;
select (select count(*) from pitch_feedback where pitch_id = :'tp3') = 1 and (select count(*) from pitch_shortlist) = 0 as ok \gset
\if :ok \else \echo 'FAIL: researcher feedback visibility' \quit \endif
select count(*) = 1 as ok from notifications where kind = 'pitch_passed' \gset
\if :ok \else \echo 'FAIL: pass notification' \quit \endif
reset role;
select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
select count(*) = 0 as ok from pitch_feedback \gset
\if :ok \else \echo 'FAIL: feedback leaked to another researcher' \quit \endif
reset role;
\echo '✓ pitch shortlist is private; pass feedback reaches only that researcher, contact details masked'

-- ---------- idea board and results ----------
select set_config('request.jwt.claim.sub', :'c2', false); set role authenticated;
select set_config('test.tu1', :'tu1', false) \gset
do $$ begin perform save_idea_tracking(current_setting('test.tu1')::uuid, 'filming', null, null, null, null, null, null, null);
  raise exception 'expected error';
exception when others then if sqlerrm <> 'UNLOCK_NOT_FOUND' then raise; end if; end $$;
reset role;

select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select save_idea_tracking(:'tu1', 'scripting', 'March batch', current_date + 3, 'Film with the new mic', null, null, null, null);
select save_idea_tracking(:'tu1', 'posted', 'March batch', null, 'Film with the new mic',
  'https://www.tiktok.com/@me/video/1', current_date, 150000, 50000);
select stage = 'posted' and result_multiple = 3.0 as ok from idea_tracking where unlock_id = :'tu1' \gset
\if :ok \else \echo 'FAIL: idea tracking save' \quit \endif
do $$ begin perform save_idea_tracking(current_setting('test.tu1')::uuid, 'posted', null, null, null, null, null, 100, 0);
  raise exception 'expected error';
exception when others then if sqlerrm <> 'INVALID_VIEWS' then raise; end if; end $$;
reset role;

select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
select (select count(*) from idea_tracking) = 0 as ok \gset
\if :ok \else \echo 'FAIL: researcher can read private idea board' \quit \endif
select result_multiple = 3.0 and stage = 'posted' as ok from cre_idea_results where unlock_id = :'tu1' \gset
\if :ok \else \echo 'FAIL: researcher cannot see own result' \quit \endif
select count(*) = 1 as ok from notifications where kind = 'idea_result' \gset
\if :ok \else \echo 'FAIL: result notification' \quit \endif
reset role;
select set_config('request.jwt.claim.sub', :'r2', false); set role authenticated;
select count(*) = 0 as ok from cre_idea_results \gset
\if :ok \else \echo 'FAIL: results leaked to another researcher' \quit \endif
reset role;
set role anon;
select results_logged = 1 and avg_result_multiple = 3.0 and hits = 1 and unlocks_total >= 1 as ok
  from public_cres where id = :'r1' \gset
\if :ok \else \echo 'FAIL: public track record' \quit \endif
select count(*) = 0 as ok from information_schema.columns where table_name = 'cre_idea_results' and column_name in ('posted_url','notes') \gset
\if :ok \else \echo 'FAIL: result view exposes private fields' \quit \endif
reset role;
\echo '✓ idea board is private to the creator; researchers see only stage and result; public track record updates'

-- ---------- saved researchers and invites ----------
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select toggle_favorite_cre(:'r2', true);
select count(*) = 1 as ok from favorite_cres \gset
\if :ok \else \echo 'FAIL: favorite' \quit \endif
select set_config('test.r3', :'r3', false) \gset
do $$ begin perform toggle_favorite_cre(current_setting('test.r3')::uuid, true); raise exception 'expected error';
exception when others then if sqlerrm <> 'CRE_NOT_FOUND' then raise; end if; end $$;
select invite_to_brief(:'tb', :'r2');
select invite_to_brief(:'tb', :'r2'); -- second invite is a no-op
reset role;

select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
select set_config('test.r2', :'r2', false) \gset
do $$ begin perform toggle_favorite_cre(current_setting('test.r2')::uuid, true); raise exception 'expected error';
exception when others then if sqlerrm <> 'NOT_CREATOR' then raise; end if; end $$;
select count(*) = 0 as ok from brief_invites \gset
\if :ok \else \echo 'FAIL: invite visible to another researcher' \quit \endif
reset role;
select set_config('request.jwt.claim.sub', :'c2', false); set role authenticated;
select set_config('test.tb', :'tb', false) \gset
do $$ begin perform invite_to_brief(current_setting('test.tb')::uuid, current_setting('test.r2')::uuid); raise exception 'expected error';
exception when others then if sqlerrm <> 'BRIEF_NOT_FOUND' then raise; end if; end $$;
select count(*) = 0 as ok from favorite_cres \gset
\if :ok \else \echo 'FAIL: favorites visible to another creator' \quit \endif
reset role;
select set_config('request.jwt.claim.sub', :'r2', false); set role authenticated;
select (select count(*) from brief_invites where brief_id = :'tb') = 1
   and (select count(*) from notifications where kind = 'brief_invite') = 1 as ok \gset
\if :ok \else \echo 'FAIL: invite not delivered once' \quit \endif
reset role;
\echo '✓ saved researchers and invites: creator-only, verified researchers only, one notification per invite'

-- ---------- swipe file ----------
select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
insert into swipe_items(cre_id, platform, title, source_url, source_views, channel_median_views)
values (auth.uid(), 'tiktok', 'Paycheck split', 'https://www.tiktok.com/@x/video/9', 500000, 50000);
select multiplier = 10.0 as ok from swipe_items \gset
\if :ok \else \echo 'FAIL: swipe multiplier' \quit \endif
reset role;
select set_config('request.jwt.claim.sub', :'r2', false); set role authenticated;
select count(*) = 0 as ok from swipe_items \gset
\if :ok \else \echo 'FAIL: swipe file visible to another researcher' \quit \endif
do $$ begin
  insert into swipe_items(cre_id, platform, title, source_url, source_views, channel_median_views)
  values ('00000000-0000-0000-0000-0000000000e1', 'tiktok', 'Sneaky', 'https://x.com/1', 10, 1);
  raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
reset role;
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
do $$ begin
  insert into swipe_items(cre_id, platform, title, source_url, source_views, channel_median_views)
  values (auth.uid(), 'tiktok', 'Creator try', 'https://x.com/2', 10, 1);
  raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
reset role;
\echo '✓ swipe file is private to each researcher'
