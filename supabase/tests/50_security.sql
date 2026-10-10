-- Security fixes: admin two-factor in the database, hidden source_key, suspended accounts, payout default,
-- dispute resolution ledger. Runs after 40 and reuses its users.
\set ON_ERROR_STOP 1
\set QUIET 1
\set admin '00000000-0000-0000-0000-00000000000a'
\set c2 '00000000-0000-0000-0000-0000000000c2'
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set r1 '00000000-0000-0000-0000-0000000000e1'
\set r2 '00000000-0000-0000-0000-0000000000e2'

-- ---------- admin powers need aal2 ----------
update platform_settings set admin_mfa_required = true;
select set_config('request.jwt.claim.sub', :'admin', false);
select set_config('request.jwt.claims', '{"aal":"aal1"}', false);
set role authenticated;
do $$ begin
  perform update_settings(500, 1000, 72, 300, 3.0, 1000); raise exception 'FAIL: admin with a password-only token changed settings';
exception when others then if sqlerrm = 'NOT_ADMIN' then raise notice '✓ admin functions refuse a password-only (aal1) token'; else raise; end if; end $$;
select case when (select count(*) from kyc_submissions) = 0 then '✓ ID submissions hidden from an aal1 admin token' else 'FAIL: aal1 admin can read ID submissions' end;
reset role;
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);
set role authenticated;
select case when is_admin() then '✓ the same admin after the authenticator code (aal2) is admin' else 'FAIL: aal2 admin refused' end;
reset role;
select set_config('request.jwt.claims', '', false);
update platform_settings set admin_mfa_required = false;

-- ---------- source_key is not readable ----------
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
do $$ begin
  perform source_key from pitches limit 1; raise exception 'FAIL: creator can read source_key';
exception when insufficient_privilege then raise notice '✓ source_key cannot be read by signed-in users'; end $$;
select case when (select count(*) from pitches) > 0 then '✓ the other pitch columns are still readable' else 'FAIL: pitches unreadable' end;
reset role;

-- ---------- suspended accounts ----------
select b.id as sb, p.cre_id as scre from briefs b join pitches p on p.brief_id = b.id where b.creator_id = :'c1' limit 1 \gset
select set_config('my.sb', :'sb', false), set_config('my.scre', :'scre', false) \gset
update profiles set suspended_at = now(), suspended_reason = 'test' where id = :'c1';
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
do $$ begin
  perform get_or_create_thread(current_setting('my.sb')::uuid, current_setting('my.scre')::uuid);
  raise exception 'FAIL: suspended creator could start a conversation';
exception when others then if sqlerrm = 'ACCOUNT_SUSPENDED' then raise notice '✓ suspended accounts cannot start conversations'; else raise; end if; end $$;
reset role;
update profiles set suspended_at = null, suspended_reason = null where id = :'c1';

-- A suspended researcher's pitch can't be unlocked.
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select create_brief('Security test brief', repeat('Ideas for a security test brief, nothing more. ', 2),
  'tiktok', (select id from niches where slug='personal-finance'), null, null, '{}', 3.0, null, 600, 2, now() + interval '5 days') as sbr \gset
select external_id as sext from prepare_brief_payment(:'sbr', 'mock') \gset
reset role;
set role service_role; select mark_payment_paid(:'sext', 'prov_s1', (select total_charge_cents from briefs where id = :'sbr'), 'card'); reset role;
select set_config('request.jwt.claim.sub', :'r2', false); set role authenticated;
select submit_pitch(:'sbr', 'tiktok', 'Talking head', 40, 'story',
  'A short story about the first payday and what went wrong after', 900000, 60000, current_date - 15, null,
  'https://www.tiktok.com/@sec/video/7400000000000000051', null, 'My first payday went wrong in the funniest way',
  'A relatable mistake with real numbers keeps people watching to the end.',
  repeat('HOOK: the payslip. BEATS: each purchase, then the empty wallet. ', 3), null) as spitch \gset
reset role;
select set_config('my.spitch', :'spitch', false) \gset
update profiles set suspended_at = now(), suspended_reason = 'test' where id = :'r2';
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
do $$ begin
  perform unlock_pitch(current_setting('my.spitch')::uuid); raise exception 'FAIL: unlocked a suspended researcher''s pitch';
exception when others then if sqlerrm = 'CRE_SUSPENDED' then raise notice '✓ a suspended researcher''s pitch cannot be unlocked'; else raise; end if; end $$;
reset role;
update profiles set suspended_at = null, suspended_reason = null where id = :'r2';

-- ---------- default payout method ----------
insert into payout_methods(user_id, kind, account_name, account_last4, account_number_enc, is_default)
values (:'r1', 'gcash', 'Rina Test', '1111', 'x', true), (:'r1', 'maya', 'Rina Test', '2222', 'y', true);
select id as pm2 from payout_methods where user_id = :'r1' and account_last4 = '2222' \gset
select set_config('my.pm2', :'pm2', false) \gset
select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
select make_default_payout_method(:'pm2');
reset role;
select case when (select count(*) from payout_methods where user_id = :'r1' and is_default) = 1
             and (select is_default from payout_methods where id = :'pm2') then '✓ exactly one default payout method after switching' else 'FAIL: default payout method' end;
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
do $$ begin
  perform make_default_payout_method(current_setting('my.pm2')::uuid); raise exception 'FAIL: changed someone else''s payout method';
exception when others then if sqlerrm = 'NOT_FOUND' then raise notice '✓ cannot change another person''s payout method'; else raise; end if; end $$;
reset role;

-- ---------- dispute resolved for the researcher after the hold ended keeps the ledger balanced ----------
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select unlock_pitch(:'spitch') as sunl \gset
select open_dispute(:'sunl', 'source_dead', 'The numbers in this pitch do not match the source video at all.');
reset role;
update unlocks set available_at = now() - interval '1 hour' where id = :'sunl';
select set_config('request.jwt.claim.sub', :'admin', false); set role authenticated;
select resolve_dispute((select id from disputes where unlock_id = :'sunl'), false, 'The pitch matches the source; researcher keeps it.');
reset role;
select case when (select status from unlocks where id = :'sunl') = 'available'
             and (select count(*) from ledger_entries where unlock_id = :'sunl' and kind = 'hold_release') = 1
        then '✓ late dispute win for the researcher releases the hold with its ledger entry' else 'FAIL: hold_release missing after late dispute resolution' end;

-- ---------- Philippine-friendly checks ----------
select case when not (mask_contacts('Budgeting with GCash and PayPal for new grads')).hit then '✓ payment app names are allowed as topics' else 'FAIL: GCash topic blocked' end;
select case when (mask_contacts('message me on telegram or call 0917 123 4567')).hit then '✓ phone numbers and messaging apps are still caught' else 'FAIL: contact details not caught' end;
select case when (select proconfig::text from pg_proc where proname = 'submit_pitch') like '%Asia/Manila%' then '✓ pitch dates are checked against the Philippine date' else 'FAIL: submit_pitch not on Manila time' end;

-- ---------- researcher brief alerts ----------
update cre_profiles set alert_min_price_cents = 50000 where user_id = :'r1';           -- only $500+ briefs
update cre_profiles set alert_platforms = '{youtube_shorts}' where user_id = :'r2';     -- only YouTube Shorts
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select create_brief('Alert filter brief A', repeat('Checking that alert filters stop notifications. ', 2),
  'tiktok', (select id from niches where slug='personal-finance'), null, null, '{}', 3.0, null, 600, 1, now() + interval '5 days') as ab \gset
select external_id as aext from prepare_brief_payment(:'ab', 'mock') \gset
reset role;
set role service_role; select mark_payment_paid(:'aext', 'prov_a', (select total_charge_cents from briefs where id = :'ab'), 'card'); reset role;
select case when not exists (select 1 from notifications where kind = 'new_brief' and link = '/briefs/' || :'ab' and user_id in (:'r1', :'r2'))
        then '✓ alert filters: below the price floor or on another platform, no notification' else 'FAIL: filtered researcher was notified' end;
update cre_profiles set alert_min_price_cents = 0, alert_platforms = '{}' where user_id in (:'r1', :'r2');
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select create_brief('Alert filter brief B', repeat('Checking that cleared filters notify again. ', 2),
  'tiktok', (select id from niches where slug='personal-finance'), null, null, '{}', 3.0, null, 600, 1, now() + interval '5 days') as bb \gset
select external_id as bext from prepare_brief_payment(:'bb', 'mock') \gset
reset role;
set role service_role; select mark_payment_paid(:'bext', 'prov_b', (select total_charge_cents from briefs where id = :'bb'), 'card'); reset role;
select case when (select count(*) from notifications where kind = 'new_brief' and link = '/briefs/' || :'bb' and user_id in (:'r1', :'r2')) = 2
        then '✓ alert filters cleared: both researchers notified again' else 'FAIL: notifications after clearing filters: ' || (select count(*) from notifications where kind = 'new_brief' and link = '/briefs/' || :'bb' and user_id in (:'r1', :'r2')) end;

-- ---------- request a variation ----------
select set_config('my.sunl', :'sunl', false) \gset
select set_config('request.jwt.claim.sub', :'r2', false); set role authenticated;
do $$ begin
  perform request_variation(current_setting('my.sunl')::uuid, 'Researchers cannot ask themselves for one.'); raise exception 'FAIL: researcher requested a variation';
exception when others then if sqlerrm = 'UNLOCK_NOT_FOUND' then raise notice '✓ only the creator who unlocked can ask for a variation'; else raise; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select request_variation(:'sunl', 'Could you give me a hook for a Taglish audience? Email me at x@y.com');
do $$ begin
  perform request_variation(current_setting('my.sunl')::uuid, 'And another one please, a second time.'); raise exception 'FAIL: second variation allowed';
exception when others then if sqlerrm = 'VARIATION_ALREADY_REQUESTED' then raise notice '✓ one variation per unlock'; else raise; end if; end $$;
reset role;
select case when (select note from variation_requests where unlock_id = :'sunl') like '%[hidden]%' then '✓ contact details in the request are hidden' else 'FAIL: request not masked' end;
select set_config('request.jwt.claim.sub', :'r2', false); set role authenticated;
select answer_variation(:'sunl', 'Alt hook: "Ang sweldo ko, saan napunta?" then show the receipt pile.');
do $$ begin
  perform answer_variation(current_setting('my.sunl')::uuid, 'Trying to answer twice should fail here.'); raise exception 'FAIL: answered twice';
exception when others then if sqlerrm = 'VARIATION_ALREADY_ANSWERED' then raise notice '✓ answered once'; else raise; end if; end $$;
reset role;
select case when exists (select 1 from notifications where user_id = :'c1' and kind = 'variation_answered') then '✓ creator notified of the answer' else 'FAIL: no notification' end;
select set_config('request.jwt.claim.sub', :'c2', false); set role authenticated;
select case when (select count(*) from variation_requests) = 0 then '✓ other users cannot read variation requests' else 'FAIL: variation request leaked' end;
reset role;

-- ---------- response time ----------
select id as rt from threads where creator_id = :'c1' limit 1 \gset
select cre_id as rtc from threads where id = :'rt' \gset
delete from messages where thread_id = :'rt';
insert into messages(thread_id, sender_id, body) values (:'rt', :'c1', 'Hi, a question about your pitch'), (:'rt', :'rtc', 'Sure, ask away');
-- the insert trigger stamps now(); backdate afterwards to simulate a two-hour reply
update messages set created_at = now() - interval '10 hours' where thread_id = :'rt' and sender_id = :'c1';
update messages set created_at = now() - interval '8 hours' where thread_id = :'rt' and sender_id = :'rtc';
select case when (select median_reply_hours from cre_response_stats where cre_id = :'rtc') = 2.0 then '✓ response time: 2.0 hours from first question to first reply'
            else 'FAIL: response time ' || coalesce((select median_reply_hours::text from cre_response_stats where cre_id = :'rtc'), 'null') end;
set role anon;
select case when (select count(*) from cre_response_stats) >= 1 then '✓ response time is public (aggregate only)' else 'FAIL: anon cannot read response stats' end;
reset role;
