-- Rate limiting and self-service account closure. Runs after 30 and reuses its users.
\set ON_ERROR_STOP 1
\set QUIET 1
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c2 '00000000-0000-0000-0000-0000000000c2'
\set r1 '00000000-0000-0000-0000-0000000000e1'
\set r2 '00000000-0000-0000-0000-0000000000e2'
\set r3 '00000000-0000-0000-0000-0000000000e3'
\set r9 '00000000-0000-0000-0000-0000000000e9'
\set admin '00000000-0000-0000-0000-00000000000a'

-- ---------- rate limits ----------
reset role; set role service_role;
select case when bool_and(rate_limit_hit('t:a', 3, 60)) then '✓ rate limit: first 3 hits allowed' else 'FAIL: early hit refused' end
  from generate_series(1, 3);
select case when rate_limit_hit('t:a', 3, 60) = false then '✓ rate limit: 4th hit refused' else 'FAIL: 4th hit allowed' end;
update rate_limits set window_start = now() - interval '2 minutes' where key = 't:a';
select case when rate_limit_hit('t:a', 3, 60) then '✓ rate limit: new window allows again' else 'FAIL: window did not reset' end;
select case when rate_limit_hit('t:b', 3, 60) then '✓ rate limit: keys are independent' else 'FAIL: other key refused' end;
update rate_limits set window_start = now() - interval '2 days' where key = 't:b';
select prune_rate_limits() as pruned \gset
select case when :pruned = 1 and not exists (select 1 from rate_limits where key = 't:b') then '✓ prune removes day-old rows' else 'FAIL: prune' end;
reset role;
do $$ begin
  set role authenticated;
  begin perform rate_limit_hit('t:c', 1, 1); raise exception 'FAIL: authenticated could call rate_limit_hit';
  exception when insufficient_privilege then raise notice '✓ rate_limit_hit is service-role only'; end;
  reset role;
end $$;

-- ---------- account closure blockers ----------
-- c1 still has an open brief (from test 30) → refused
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
do $$ begin
  perform close_my_account(); raise exception 'FAIL: creator with open brief could close';
exception when others then
  if sqlerrm = 'BRIEF_OPEN' then raise notice '✓ close refused while a brief is live (BRIEF_OPEN)'; else raise; end if;
end $$;
reset role;
-- r1 has an unlocked pitch whose earnings are held → refused
select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
do $$ begin
  perform close_my_account(); raise exception 'FAIL: researcher with held earnings could close';
exception when others then
  if sqlerrm = 'EARNINGS_PENDING' then raise notice '✓ close refused while earnings are pending (EARNINGS_PENDING)'; else raise; end if;
end $$;
reset role;
-- admin → refused
select set_config('request.jwt.claim.sub', :'admin', false); set role authenticated;
do $$ begin
  perform close_my_account(); raise exception 'FAIL: admin could close';
exception when others then
  if sqlerrm = 'ADMIN_CANNOT_CLOSE' then raise notice '✓ admins cannot self-close'; else raise; end if;
end $$;
reset role;

-- ---------- a clean researcher closes: pitches withdrawn, personal data scrubbed, ledger untouched ----------
-- r9: a fresh verified researcher with one waiting pitch on c1's open brief, a saved item and a notification.
insert into auth.users(id, email) values (:'r9', 'cre9@example.com');
select set_config('request.jwt.claim.sub', :'r9', false); set role authenticated; select set_initial_role('cre'); reset role;
update cre_profiles set kyc_status = 'approved' where user_id = :'r9';
select id as tb from briefs where creator_id = :'c1' and status = 'open' order by created_at desc limit 1 \gset
select set_config('request.jwt.claim.sub', :'r9', false); set role authenticated;
select submit_pitch(:'tb', 'tiktok', 'Vlog', 45, 'story',
  'A day of spending tracked to the peso, with the surprise at the end', 500000, 30000, current_date - 12, null,
  'https://www.tiktok.com/@grad/video/7400000000000000009', null, 'I tracked every peso for a day and the total shocked me',
  'A relatable running total keeps people watching to see the final number.',
  repeat('HOOK: show wallet. BEATS: each purchase on screen with running total. ', 3), null);
insert into swipe_items (cre_id, platform, title, source_url, source_views, channel_median_views) values (:'r9', 'tiktok', 'Keep this one', 'https://www.tiktok.com/@x/video/1', 100000, 5000);
reset role;
insert into notifications (user_id, kind, title, body, link) values (:'r9', 'system', 'hi', 'there', '/');
select count(*) as ledger_before from ledger_entries \gset
select count(*) as submitted_before from pitches where cre_id = :'r9' and status = 'submitted' \gset
select set_config('request.jwt.claim.sub', :'r9', false); set role authenticated;
select close_my_account();
reset role;
select case when (select display_name from profiles where id = :'r9') = 'Deleted user'
             and (select handle from profiles where id = :'r9') is null
             and (select suspended_reason from profiles where id = :'r9') = 'account_closed'
        then '✓ profile anonymised and locked' else 'FAIL: profile not scrubbed' end;
select case when not exists (select 1 from pitches where cre_id = :'r9' and status = 'submitted') and :submitted_before > 0
        then '✓ waiting pitches withdrawn' else 'FAIL: pitches still submitted (' || :submitted_before || ' before)' end;
select case when not exists (select 1 from swipe_items where cre_id = :'r9') and not exists (select 1 from notifications where user_id = :'r9')
             and not exists (select 1 from payout_methods where user_id = :'r9' and account_number_enc <> '') and not exists (select 1 from kyc_submissions where user_id = :'r9')
        then '✓ saved items, notifications and ID submissions deleted; payout numbers erased' else 'FAIL: personal rows remain' end;
select case when (select count(*) from ledger_entries) = :ledger_before then '✓ ledger untouched' else 'FAIL: ledger changed' end;
select case when exists (select 1 from audit_log where action = 'account.close' and entity_id = :'r9') then '✓ closure audited' else 'FAIL: no audit row' end;
select case when not exists (select 1 from public_cres where id = :'r9') then '✓ closed researcher no longer listed publicly' else 'FAIL: still in public_cres' end;
