-- Launch hardening: admin two-step login, rate limits, profile photos. Runs after 10_marketplace_flow.sql.
\set ON_ERROR_STOP 1
\set QUIET 1
\set admin '00000000-0000-0000-0000-00000000000a'
\set c1    '00000000-0000-0000-0000-0000000000c1'
\set c2    '00000000-0000-0000-0000-0000000000c2'

-- ---------- admin two-step login ----------
select set_config('request.jwt.claim.sub', :'admin', false) \gset
select set_config('request.jwt.claims', '{"aal":"aal1"}', false) \gset
set role authenticated;
select not is_admin() as ok \gset
\if :ok \else \echo 'FAIL: admin with password only (aal1) must not have admin powers' \quit \endif
do $$ begin perform review_kyc('00000000-0000-0000-0000-0000000000e3', true, null); raise exception 'expected error';
exception when others then if sqlerrm <> 'NOT_ADMIN' then raise; end if; end $$;
select set_config('request.jwt.claims', '{"aal":"aal2"}', false) \gset
select is_admin() as ok \gset
\if :ok \else \echo 'FAIL: admin with aal2 must have admin powers' \quit \endif
select set_config('request.jwt.claims', '', false) \gset
select not is_admin() as ok \gset
\if :ok \else \echo 'FAIL: missing aal claim must count as aal1' \quit \endif
reset role;
update platform_settings set admin_mfa_required = false where id;
set role authenticated;
select is_admin() as ok \gset
\if :ok \else \echo 'FAIL: break-glass setting should allow aal1 admin' \quit \endif
reset role;
update platform_settings set admin_mfa_required = true where id;
select set_config('request.jwt.claim.sub', :'c1', false) \gset
select set_config('request.jwt.claims', '{"aal":"aal2"}', false) \gset
set role authenticated;
select not is_admin() as ok \gset
\if :ok \else \echo 'FAIL: non-admin with aal2 must not be admin' \quit \endif
reset role;
\echo '✓ admin powers need a two-step (aal2) session; break-glass switch works; non-admins unaffected'

-- ---------- rate limits ----------
set role authenticated;
do $$ begin perform rate_limit_hit('x', 1, 60); raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
do $$ begin perform 1 from rate_limits; raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
reset role;
set role service_role;
select rate_limit_hit('test:a', 2, 60) and rate_limit_hit('test:a', 2, 60) and not rate_limit_hit('test:a', 2, 60)
   and rate_limit_hit('test:b', 2, 60) as ok \gset
\if :ok \else \echo 'FAIL: rate limit should allow 2 hits then block, per key' \quit \endif
do $$ begin perform rate_limit_hit('x', 0, 60); raise exception 'expected error';
exception when others then if sqlerrm <> 'INVALID_RATE_LIMIT' then raise; end if; end $$;
reset role;
insert into rate_limits(key, window_start, hits) values ('old', now() - interval '2 days', 5);
set role service_role;
select purge_rate_limits() >= 1 as ok \gset
\if :ok \else \echo 'FAIL: purge should delete old windows' \quit \endif
reset role;
select not exists (select 1 from rate_limits where key = 'old') and exists (select 1 from rate_limits where key = 'test:a') as ok \gset
\if :ok \else \echo 'FAIL: purge removed the wrong rows' \quit \endif
\echo '✓ rate limits: server-only, per-key counting, old windows purged'

-- ---------- profile photos ----------
select set_config('request.jwt.claim.sub', :'c1', false) \gset
set role authenticated;
update profiles set avatar_path = :'c1' || '/avatar-1.webp' where id = auth.uid();
do $$ begin update profiles set avatar_path = '00000000-0000-0000-0000-0000000000c2/x.png' where id = auth.uid();
raise exception 'expected error'; exception when check_violation then null; end $$;
do $$ begin update profiles set avatar_path = auth.uid()::text || '/x.gif' where id = auth.uid();
raise exception 'expected error'; exception when check_violation then null; end $$;
do $$ begin update profiles set avatar_path = auth.uid()::text || '/../../etc.png' where id = auth.uid();
raise exception 'expected error'; exception when check_violation then null; end $$;
reset role;
set role anon;
select avatar_path = :'c1' || '/avatar-1.webp' as ok from public_profiles where id = :'c1' \gset
\if :ok \else \echo 'FAIL: public_profiles should expose avatar_path' \quit \endif
reset role;
\echo '✓ profile photos: own folder only, safe file names, shown on public profiles'
