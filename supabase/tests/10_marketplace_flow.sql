-- End-to-end database test of the marketplace flow and its security rules.
-- Each block raises an error if an expectation fails. Run with supabase/tests/run.sh.
\set ON_ERROR_STOP 1
\set QUIET 1

\set admin '00000000-0000-0000-0000-00000000000a'
\set c1    '00000000-0000-0000-0000-0000000000c1'
\set c2    '00000000-0000-0000-0000-0000000000c2'
\set r1    '00000000-0000-0000-0000-0000000000e1'
\set r2    '00000000-0000-0000-0000-0000000000e2'
\set r3    '00000000-0000-0000-0000-0000000000e3'

insert into auth.users(id, email) values
  (:'admin','admin@example.com'), (:'c1','creator1@example.com'), (:'c2','creator2@example.com'),
  (:'r1','cre1@example.com'), (:'r2','cre2@example.com'), (:'r3','cre3@example.com');
update profiles set role = 'admin' where id = :'admin';
\echo '✓ signup creates profiles'

-- ---------- helper: switch user ----------
-- (inline: select set_config(...); set role authenticated;)

-- ---------- roles ----------
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select set_initial_role('creator');
do $$ begin perform set_initial_role('cre'); raise exception 'expected error';
exception when others then if sqlerrm <> 'ROLE_ALREADY_SET' then raise; end if; end $$;
do $$ begin update profiles set role = 'admin' where id = auth.uid(); raise exception 'expected error';
exception when others then if sqlerrm <> 'ROLE_CHANGE_NOT_ALLOWED' then raise; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub', :'c2', false); set role authenticated; select set_initial_role('creator'); reset role;
\echo '✓ roles are set once and cannot be escalated'

-- ---------- CRE onboarding + KYC ----------
do $$
declare u uuid;
begin
  foreach u in array array['00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000e3']::uuid[] loop
    perform set_config('request.jwt.claim.sub', u::text, false);
    set local role authenticated;
    perform set_initial_role('cre');
    insert into cre_niches(user_id, niche_id) select u, id from niches where slug = 'personal-finance';
    insert into portfolio_items(cre_id, platform, title, source_url, source_views, channel_median_views)
    select u, 'tiktok', 'Portfolio find ' || g, 'https://www.tiktok.com/@x/video/' || g, 900000, 60000 from generate_series(1,3) g;
    perform submit_kyc('Juan Dela Cruz', '1995-05-05', '123 Rizal St', 'Naga City', 'Camarines Sur', '4400', 'PH',
                       '09171234567', 'philsys', u || '/front.jpg', u || '/selfie.jpg', null);
    reset role;
  end loop;
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
do $$ begin update cre_profiles set kyc_status = 'approved' where user_id = auth.uid(); raise exception 'expected error';
exception when others then if sqlerrm <> 'NOT_ALLOWED' then raise; end if; end $$;
do $$ begin perform review_kyc(auth.uid(), true, null); raise exception 'expected error';
exception when others then if sqlerrm <> 'NOT_ADMIN' then raise; end if; end $$;
reset role;

select set_config('request.jwt.claim.sub', :'admin', false); set role authenticated;
select review_kyc(:'r1', true, null);
select review_kyc(:'r2', true, null);
reset role;
\echo '✓ KYC: CREs cannot self-approve; admin approves'

-- ---------- Brief 1: $8 x 3 ----------
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select create_brief('Finance TikTok ideas for a coach', repeat('We need proven personal finance ideas. ', 3),
  'tiktok', (select id from niches where slug='personal-finance'), null, null, '{}', 3.0, 365, 800, 3, now() + interval '5 days') as b1 \gset
select total_charge_cents = 2520 and creator_fee_cents = 120 and budget_cents = 2400 as ok from briefs where id = :'b1' \gset
\if :ok \else \echo 'FAIL: brief fee math' \quit \endif
do $$ begin perform create_brief('Contact me please now', repeat('Email me at bob@gmail.com for details. ', 2),
  'tiktok', 1, null, null, '{}', 3.0, null, 800, 3, now() + interval '5 days'); raise exception 'expected error';
exception when others then if sqlerrm <> 'CONTACT_DETAILS_NOT_ALLOWED' then raise; end if; end $$;
select external_id as ext1 from prepare_brief_payment(:'b1', 'mock') \gset
reset role;
\echo '✓ brief created with correct fees (2400 + 120 = 2520 cents)'

-- CRE cannot see an unfunded brief
select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
select count(*) = 0 as ok from briefs where id = :'b1' \gset
\if :ok \else \echo 'FAIL: unfunded brief visible to CRE' \quit \endif
do $$ begin perform mark_payment_paid('x','y',1,'card'); raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
reset role;
\echo '✓ unfunded briefs are hidden; users cannot mark payments paid'

-- webhook (service role)
set role service_role;
do $$ begin perform mark_payment_paid((select external_id from payments limit 1), 'ref', 9999, 'card'); raise exception 'expected error';
exception when others then if sqlerrm <> 'AMOUNT_MISMATCH' then raise; end if; end $$;
select mark_payment_paid(:'ext1', 'prov_1', 2520, 'card') = 'opened' as ok \gset
\if :ok \else \echo 'FAIL: payment did not open brief' \quit \endif
select mark_payment_paid(:'ext1', 'prov_1', 2520, 'card') = 'already_paid' as ok \gset
\if :ok \else \echo 'FAIL: webhook not idempotent' \quit \endif
reset role;
select count(*) = 2 as ok from ledger_entries where brief_id = :'b1' \gset
\if :ok \else \echo 'FAIL: funding ledger' \quit \endif
\echo '✓ payment webhook opens brief once (idempotent, amount checked)'

-- ---------- Pitches ----------
select set_config('request.jwt.claim.sub', :'r3', false); set role authenticated;
select count(*) = 0 as ok from briefs where id = :'b1' \gset
\if :ok \else \echo 'FAIL: unverified CRE sees brief' \quit \endif
reset role;

select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
select count(*) = 1 as ok from briefs where id = :'b1' \gset
\if :ok \else \echo 'FAIL: verified CRE cannot see open brief' \quit \endif
select submit_pitch(:'b1', 'tiktok', 'Talking head + receipts', 38, 'number_list',
  'A month of tracking spending with a surprise category', 1300000, 92000, current_date - 30, '50k-200k',
  'https://www.youtube.com/watch?v=abcdefghijk&t=3', null, 'I tracked every peso I spent for thirty days',
  'Specific number in the hook and visible proof in the first three seconds keeps people watching.',
  repeat('HOOK: say the number. SHOT LIST: receipts on table. ', 3), null) as pa \gset
select submit_pitch(:'b1', 'tiktok', 'Green screen over bank app', 45, 'myth_bust',
  'Why the popular savings rule fails for most young earners', 800000, 50000, current_date - 60, '10k-50k',
  'https://www.tiktok.com/@money/video/7312345678901234567', null, 'Stop using the fifty thirty twenty rule',
  'Contrarian take on a rule everyone knows, backed by a quick calculation on screen.',
  repeat('HOOK: contrarian claim. BEATS: show the math on screen. ', 3), null) as pb \gset
do $$ begin
  perform submit_pitch((select id from briefs limit 1), 'tiktok', 'Low one', 30, 'story',
    'A story about a small win that went unnoticed by most', 100000, 50000, current_date - 5, null,
    'https://www.tiktok.com/@a/video/111', null, 'Something short here', repeat('Reason why it worked. ', 3),
    repeat('Instructions that are long enough. ', 4), null);
  raise exception 'expected error';
exception when others then if sqlerrm <> 'MULTIPLIER_TOO_LOW' then raise; end if; end $$;
reset role;

select set_config('request.jwt.claim.sub', :'r2', false); set role authenticated;
-- same YouTube video in a different URL format → duplicate
do $$ begin
  perform submit_pitch((select id from briefs where title like 'Finance%'), 'tiktok', 'Copycat', 30, 'story',
    'Another angle on tracking a month of expenses closely', 1300000, 92000, current_date - 30, null,
    'https://youtu.be/abcdefghijk', null, 'Different hook words entirely here', repeat('Reason why it worked. ', 3),
    repeat('Instructions that are long enough. ', 4), null);
  raise exception 'expected error';
exception when others then if sqlerrm <> 'DUPLICATE_SOURCE' then raise; end if; end $$;
do $$ begin
  perform submit_pitch((select id from briefs where title like 'Finance%'), 'tiktok', 'Leaky', 30, 'story',
    'DM me on telegram for the full breakdown of this one', 900000, 90000, current_date - 30, null,
    'https://www.tiktok.com/@a/video/222', null, 'A totally different hook line', repeat('Reason why it worked. ', 3),
    repeat('Instructions that are long enough. ', 4), null);
  raise exception 'expected error';
exception when others then if sqlerrm <> 'CONTACT_DETAILS_NOT_ALLOWED' then raise; end if; end $$;
do $$ begin
  perform submit_pitch((select id from briefs where title like 'Finance%'), 'tiktok', 'Giveaway', 30, 'story',
    'Teaser says: nobody tells you this about credit cards', 900000, 90000, current_date - 30, null,
    'https://www.tiktok.com/@a/video/333', null, 'nobody tells you this about credit cards', repeat('Reason why it worked. ', 3),
    repeat('Instructions that are long enough. ', 4), null);
  raise exception 'expected error';
exception when others then if sqlerrm <> 'TEASER_REVEALS_HOOK' then raise; end if; end $$;
select submit_pitch(:'b1', 'tiktok', 'Street interview', 30, 'question',
  'Asking strangers one money question with surprising answers', 2000000, 100000, current_date - 10, '200k-1M',
  'https://www.instagram.com/reel/Cxyz123/', null, 'How much is in your savings right now',
  'Street interviews with a personal question create curiosity and lots of comments.',
  repeat('SHOT LIST: approach, ask, reaction, caption answer. ', 3), null) as pc \gset
select submit_pitch(:'b1', 'tiktok', 'POV skit', 25, 'pov',
  'A relatable skit about payday and where the money goes', 600000, 40000, current_date - 20, null,
  'https://www.youtube.com/shorts/zyxwvutsrqp', null, 'POV you just got paid and it is already gone',
  'Relatable payday pain gets shares and saves from young workers.',
  repeat('SHOT LIST: payday notification, bills appear one by one. ', 3), null) as pd \gset
reset role;
\echo '✓ pitches: verification, duplicate source (URL formats), low score, contact leak, hook leak all blocked'

-- ---------- THE RULE: secrets hidden before unlock ----------
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select (select count(*) from pitches where brief_id = :'b1') = 4 and (select count(*) from pitch_secrets) = 0 as ok \gset
\if :ok \else \echo 'FAIL: creator can read secrets before unlock' \quit \endif
reset role;
select set_config('request.jwt.claim.sub', :'r2', false); set role authenticated;
select count(*) = 2 as ok from pitch_secrets \gset
\if :ok \else \echo 'FAIL: CRE sees other CRE secrets' \quit \endif
reset role;
\echo '✓ locked content invisible to creator before unlock and to other CREs'

-- ---------- Unlocks ----------
select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
select set_config('test.pc', :'pc', false) \gset
do $$ begin perform unlock_pitch(current_setting('test.pc')::uuid); raise exception 'expected error';
exception when others then if sqlerrm <> 'NOT_BRIEF_OWNER' then raise; end if; end $$;
reset role;

select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select unlock_pitch(:'pa') as ua \gset
select count(*) = 1 as ok from pitch_secrets \gset
\if :ok \else \echo 'FAIL: creator cannot read secret after unlock' \quit \endif
do $$ begin perform unlock_pitch((select pitch_id from unlocks limit 1)); raise exception 'expected error';
exception when others then if sqlerrm <> 'PITCH_NOT_AVAILABLE' then raise; end if; end $$;
do $$ begin update unlocks set net_cents = 999999; end $$;
reset role;
select net_cents = 720 and cre_fee_cents = 80 as ok from unlocks where id = :'ua' \gset
\if :ok \else \echo 'FAIL: unlock math or direct update allowed' \quit \endif

select set_config('request.jwt.claim.sub', :'c2', false); set role authenticated;
select count(*) = 0 as ok from pitch_secrets \gset
\if :ok \else \echo 'FAIL: other creator sees unlocked secret' \quit \endif
reset role;

select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select unlock_pitch(:'pb') as ub \gset
select unlock_pitch(:'pc') as uc \gset
reset role;
select status = 'settled' and unlocks_used = 3 as ok from briefs where id = :'b1' \gset
\if :ok \else \echo 'FAIL: brief did not settle at max unlocks' \quit \endif
select status = 'expired' as ok from pitches where id = :'pd' \gset
\if :ok \else \echo 'FAIL: remaining pitch not expired' \quit \endif
\echo '✓ unlock: owner only, once per pitch, 800 → CRE 720 + fee 80, brief auto-closes at max'

-- ---------- Brief 2: close early → refund ----------
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select create_brief('Second brief on side hustles', repeat('Looking for side hustle outliers please. ', 2),
  'tiktok', (select id from niches where slug='personal-finance'), null, null, '{}', 3.0, null, 500, 4, now() + interval '3 days') as b2 \gset
select external_id as ext2 from prepare_brief_payment(:'b2', 'mock') \gset
reset role;
set role service_role; select mark_payment_paid(:'ext2', 'prov_2', 2100, 'card'); reset role;

select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
select submit_pitch(:'b2', 'tiktok', 'Before and after', 40, 'before_after',
  'From zero to first thousand with a weekend side project', 500000, 50000, current_date - 15, null,
  'https://www.tiktok.com/@hustle/video/9990001', null, 'I made my first thousand in six weekends',
  'Clear before and after with a real number people want to reach themselves.',
  repeat('SHOT LIST: show the dashboard, then the weekend setup. ', 3), null) as pe \gset
reset role;
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select unlock_pitch(:'pe') as ue \gset
select close_brief(:'b2') = 1575 as ok \gset
\if :ok \else \echo 'FAIL: refund amount (expected 1500 unused + 75 fee)' \quit \endif
reset role;
set role service_role;
select complete_refund((select id from refunds where brief_id = :'b2'), 'rf_2', true, null);
reset role;
select status = 'settled' as ok from briefs where id = :'b2' \gset
\if :ok \else \echo 'FAIL: brief 2 not settled after refund' \quit \endif
\echo '✓ early close refunds unused budget + its share of the fee (1575 cents)'

-- ---------- Dispute on brief 1 (settled) → creator wins ----------
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select open_dispute(:'ua', 'source_dead', 'The source video link returns a not found page.') as d1 \gset
reset role;
select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
select respond_dispute(:'d1', 'The video was up when I pitched it, here is the screenshot.');
reset role;
select set_config('request.jwt.claim.sub', :'admin', false); set role authenticated;
select resolve_dispute(:'d1', true, 'Source is gone; refunding the creator.');
reset role;
select amount_cents = 840 and fee_part_cents = 40 as ok from refunds where brief_id = :'b1' \gset
\if :ok \else \echo 'FAIL: dispute refund amount' \quit \endif
set role service_role; select complete_refund((select id from refunds where brief_id = :'b1'), 'rf_1', true, null); reset role;
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
-- pa reversed → hidden again; pb, pc, pe still visible
select count(*) = 3 as ok from pitch_secrets \gset
\if :ok \else \echo 'FAIL: secret still visible after reversal' \quit \endif
reset role;
\echo '✓ dispute won by creator: unlock reversed, 800 + 40 fee refunded, secret access removed'

-- ---------- Ledger: every settled escrow nets to zero ----------
select bool_and(bal = 0) as ok from (
  select b.id, coalesce(sum(case when l.credit_account = 'escrow:brief:' || b.id then l.amount_cents else 0 end),0)
             - coalesce(sum(case when l.debit_account  = 'escrow:brief:' || b.id then l.amount_cents else 0 end),0) as bal
    from briefs b left join ledger_entries l on l.brief_id = b.id group by b.id) x \gset
\if :ok \else \echo 'FAIL: escrow does not balance' \quit \endif
do $$ begin update ledger_entries set amount_cents = 1; raise exception 'expected error';
exception when others then if sqlerrm <> 'LEDGER_IS_APPEND_ONLY' then raise; end if; end $$;
\echo '✓ ledger: escrow balances to zero; entries cannot be edited'

-- ---------- Holds and payouts ----------
update unlocks set available_at = now() - interval '1 minute' where status = 'held';
set role service_role; select release_holds() as released \gset
reset role;
select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
select available_cents = 1170 as ok from cre_balances where cre_id = auth.uid() \gset
\if :ok \else \echo 'FAIL: r1 available balance (expected 720 + 450)' \quit \endif
insert into payout_methods(user_id, kind, account_name, account_last4, account_number_enc)
  values (auth.uid(), 'gcash', 'Juan Dela Cruz', '4567', 'enc') returning id as pm \gset
select request_payout(:'pm') as po \gset
do $$ begin perform request_payout((select id from payout_methods limit 1)); raise exception 'expected error';
exception when others then if sqlerrm <> 'PAYOUT_ALREADY_PENDING' then raise; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub', :'admin', false); set role authenticated;
select approve_payout(:'po', 58.5);
reset role;
set role service_role; select complete_payout(:'po', 'po_ref_1', true, null); reset role;
select set_config('request.jwt.claim.sub', :'r1', false); set role authenticated;
select paid_out_cents = 1170 and available_cents = 0 as ok from cre_balances where cre_id = auth.uid() \gset
\if :ok \else \echo 'FAIL: payout did not move balance' \quit \endif
reset role;
select amount_local_cents = 68445 as ok from payouts where id = :'po' \gset
\if :ok \else \echo 'FAIL: PHP conversion' \quit \endif
\echo '✓ holds release; payout of 1170 cents (₱684.45 at 58.5) marks earnings paid'

-- ---------- Messaging ----------
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
select get_or_create_thread(:'b1', :'r1') as t1 \gset
insert into messages(thread_id, sender_id, body) values (:'t1', auth.uid(), 'Love this! Email me at bob@gmail.com or text 0917 123 4567, or @bobcreates on IG');
select body !~ '(gmail|0917|@bob)' and was_masked as ok from messages where thread_id = :'t1' \gset
\if :ok \else \echo 'FAIL: contact details not masked' \quit \endif
reset role;
select count(*) = 1 as ok from flags where kind = 'contact_leak' \gset
\if :ok \else \echo 'FAIL: contact flag missing' \quit \endif
select set_config('request.jwt.claim.sub', :'r2', false); set role authenticated;
do $$ begin insert into messages(thread_id, sender_id, body) values ((select id from threads limit 1), auth.uid(), 'hi');
  raise exception 'expected error';
exception when others then if sqlstate <> '42501' and sqlerrm <> 'NOT_THREAD_MEMBER' then raise; end if; end $$;
select count(*) = 0 as ok from messages \gset
\if :ok \else \echo 'FAIL: outsider reads thread' \quit \endif
reset role;
\echo '✓ chat masks contact details, flags them, and is private to members'

-- ---------- Direct writes are blocked ----------
select set_config('request.jwt.claim.sub', :'c1', false); set role authenticated;
do $$ begin insert into briefs(creator_id,title,description,platform,niche_id,price_per_idea_cents,max_unlocks,creator_fee_bps,cre_fee_bps,creator_fee_cents,total_charge_cents,deadline_at,status)
  values (auth.uid(),'Sneaky free brief', repeat('x',50),'tiktok',1,100,1,0,0,0,100,now()+interval '2 days','open');
  raise exception 'expected error';
exception when others then if sqlstate <> '42501' then raise; end if; end $$;
select count(*) = 0 as ok from ledger_entries \gset
\if :ok \else \echo 'FAIL: user can read ledger' \quit \endif
reset role;
set role anon;
select count(*) = 0 as ok from briefs \gset
\if :ok \else \echo 'FAIL: anon sees briefs' \quit \endif
select count(*) = 2 as ok from public_cres \gset
\if :ok \else \echo 'FAIL: public directory' \quit \endif
reset role;
\echo '✓ users cannot write briefs directly or read the ledger; anonymous visitors see only the public directory'

-- ---------- URL keys and masking helpers ----------
select source_key_from_url('https://www.youtube.com/watch?v=abcdefghijk&t=3')
     = source_key_from_url('https://youtube.com/shorts/abcdefghijk')
   and source_key_from_url('https://youtu.be/abcdefghijk?si=xyz') = source_key_from_url('https://www.youtube.com/watch?v=abcdefghijk')
   and source_key_from_url('https://www.tiktok.com/@a/video/123?lang=en') = source_key_from_url('https://tiktok.com/@b/video/123')
   and source_key_from_url('https://www.instagram.com/reel/Cxyz/?igsh=1') = source_key_from_url('https://instagram.com/p/Cxyz')
   as ok \gset
\if :ok \else \echo 'FAIL: URL normalization' \quit \endif
select not (mask_contacts('This got 1300000 views vs a 92000 median, posted 2026-08-12')).hit
   and (mask_contacts('reach me: juan (at) gmail (dot) com')).hit
   and (mask_contacts('+63 917 123 4567')).hit
   and (mask_contacts('check outlierhub.io/me')).hit as ok \gset
\if :ok \else \echo 'FAIL: masking helper' \quit \endif
\echo '✓ URL keys match across formats; masking ignores view counts'
