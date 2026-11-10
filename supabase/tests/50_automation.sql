-- The n8n admin role: reads what the admin workflows need, writes only alert log + flags. Runs last.
\set ON_ERROR_STOP 1
\set QUIET 1
do $$ begin if not exists (select 1 from pg_roles where rolname = 'n8n_admin_test') then
  create role n8n_admin_test nologin in role outlier_automation; end if; end $$;
set role n8n_admin_test;
select (select count(*) from briefs) > 0 and (select count(*) from pitch_secrets) > 0 and (select count(*) from ledger_entries) > 0 as ok \gset
\if :ok \else \echo 'FAIL: automation role should read briefs, pitch secrets and the ledger' \quit \endif
insert into admin_alert_log(kind, entity_id) values ('test', 'x') on conflict do nothing;
insert into flags(kind, subject_user, entity_type, entity_id, excerpt)
  values ('other', '00000000-0000-0000-0000-0000000000e1', 'pitch', 'x', 'automation test');
do $$ begin update briefs set title = 'hacked'; raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
do $$ begin delete from ledger_entries; raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
do $$ begin perform 1 from payout_methods; raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
reset role;
set role authenticated;
do $$ begin perform 1 from admin_alert_log; raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
reset role;
\echo '✓ n8n automation role: reads admin data, writes only alert log and flags; cannot change money, briefs or see payout details'
