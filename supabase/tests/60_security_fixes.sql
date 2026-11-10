-- Fixes from the pre-launch security audit. Runs after 50_automation.sql on the same database.
\set ON_ERROR_STOP 1
\set QUIET 1
\set admin '00000000-0000-0000-0000-00000000000a'
\set c1    '00000000-0000-0000-0000-0000000000c1'
\set r1    '00000000-0000-0000-0000-0000000000e1'
select set_config('request.jwt.claims', '{"aal":"aal2"}', false) \gset

-- A payment event without an amount is refused.
insert into payments(brief_id, payer_id, provider, external_id, currency, amount_cents)
  select id, creator_id, 'xendit', 'sec_test_pay', 'USD', 500 from briefs limit 1;
set role service_role;
do $$ begin perform mark_payment_paid('sec_test_pay', 'ref_sec', null, 'card'); raise exception 'expected error';
exception when others then if sqlerrm <> 'AMOUNT_REQUIRED' then raise; end if; end $$;
reset role;
select status = 'pending' as ok from payments where external_id = 'sec_test_pay' \gset
\if :ok \else \echo 'FAIL: payment without amount was marked paid' \quit \endif
\echo '✓ payments: an event with no amount is refused'

-- A CRE who has been paid before can't withdraw to a brand-new account for 72 hours.
select count(*) > 0 as ok from payouts where cre_id = :'r1' and status = 'paid' \gset
\if :ok \else \echo 'FAIL: fixture expects r1 to have a past payout' \quit \endif
select set_config('request.jwt.claims', json_build_object('aal','aal2','amr',json_build_array(json_build_object('method','password','timestamp',extract(epoch from now())::bigint)))::text, false) \gset
select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
insert into payout_methods(user_id, kind, account_name, account_last4, account_number_enc)
  values (auth.uid(), 'gcash', 'Someone Else', '9999', 'enc') returning id as newpm \gset
do $$ begin perform request_payout((select id from payout_methods where account_last4 = '9999')); raise exception 'expected error';
exception when others then if sqlerrm <> 'PAYOUT_METHOD_TOO_NEW' then raise; end if; end $$;
reset role;
\echo '✓ payouts: new account after a past payout waits 72 hours'

-- FX typo guard on approval.
insert into payouts(cre_id, method_id, amount_cents, currency) values (:'r1', :'newpm', 100, 'USD') returning id as po2 \gset
select set_config('request.jwt.claim.sub', :'admin', false); set role authenticated;
do $$ begin perform approve_payout((select id from payouts where status = 'requested' and amount_cents = 100 limit 1), 5850);
  raise exception 'expected error';
exception when others then if sqlerrm <> 'FX_RATE_OUT_OF_RANGE' then raise; end if; end $$;
reset role;
delete from payouts where id = :'po2';
\echo '✓ payouts: an out-of-range exchange rate is refused'

-- Links must be https; rows with old http links are upgraded so status changes keep working.
select id as bx from briefs order by id limit 1 \gset
alter table briefs drop constraint briefs_example_urls_https;
update briefs set example_urls = array['http://youtube.com/x'] where id = :'bx';
update briefs set example_urls = coalesce(array(select to_https(e) from unnest(example_urls) e), '{}') where not all_https(example_urls);
alter table briefs add constraint briefs_example_urls_https check (all_https(example_urls));
select example_urls = array['https://youtube.com/x'] as ok from briefs where id = :'bx' \gset
\if :ok \else \echo 'FAIL: http link not upgraded' \quit \endif
update briefs set status = status where id = :'bx';
do $$ begin update creator_profiles set channel_url = 'javascript:alert(1)' where user_id = '00000000-0000-0000-0000-0000000000c1';
  raise exception 'expected error';
exception when check_violation then null; end $$;
do $$ begin update briefs set example_urls = array['https://ok.example', 'data:text/html,x'] where id = (select id from briefs limit 1);
  raise exception 'expected error';
exception when check_violation then null; end $$;
update briefs set example_urls = array['https://www.tiktok.com/@a/video/1'] where id = (select id from briefs limit 1);
\echo '✓ links: non-https links are refused'

-- Public views hide admins; private uploads are capped per person.
set role anon;
select count(*) = 0 as ok from public_profiles where id = :'admin' \gset
\if :ok \else \echo 'FAIL: admin listed in public profiles' \quit \endif
reset role;
insert into storage.objects(bucket_id, name) select 'kyc', :'r1' || '/id' || g || '.jpg' from generate_series(1, 10) g;
select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
do $$ begin insert into storage.objects(bucket_id, name) values ('kyc', auth.uid()::text || '/id11.jpg'); raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
reset role;
-- Older uploads fall out of the 24-hour window.
update storage.objects set created_at = now() - interval '2 days' where bucket_id = 'kyc';
select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
insert into storage.objects(bucket_id, name) values ('kyc', auth.uid()::text || '/id12.jpg');
reset role;
\echo '✓ public views hide admins; ID-photo uploads capped at 10 per day per person'

-- The n8n role sees only the ID-check columns it needs, and can see stuck webhooks without payloads.
set role n8n_admin_test;
select count(*) >= 0 as ok from (select user_id, submitted_at from kyc_submissions) k \gset
do $$ begin perform legal_name from kyc_submissions; raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
select count(*) >= 0 as ok from (select id, type, error from webhook_events where processed_at is null) w \gset
do $$ begin perform payload from webhook_events; raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
reset role;
\echo '✓ n8n role: no ID names or webhook payloads; sees stuck webhooks'
