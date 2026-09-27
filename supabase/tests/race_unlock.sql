\set QUIET 1
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true) \gset
set local role authenticated;
select pg_sleep(0.5) \gset
select unlock_pitch(:'pid') \gset
select pg_sleep(1) \gset
commit;
\echo 'UNLOCK_OK'
