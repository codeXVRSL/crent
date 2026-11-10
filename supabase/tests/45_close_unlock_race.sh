#!/usr/bin/env bash
# Race: the creator unlocks the top pitch while the deadline job closes the same brief. Must not deadlock;
# exactly one unlock happens either way. Called by run.sh with $DB set.
set -uo pipefail
DB=${DB:-outlier_test}
psql -q -X -v ON_ERROR_STOP=1 -d $DB -c "create table if not exists public.race2_ids(brief uuid, pitch uuid)" >/dev/null || exit 1
psql -q -X -v ON_ERROR_STOP=1 -d $DB >/tmp/race2setup.out 2>&1 <<'SQL' || { echo "FAIL: race setup"; cat /tmp/race2setup.out; exit 1; }
truncate public.race2_ids;
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);
do $$
declare v uuid; ext text; p uuid;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
  set local role authenticated;
  v := create_brief('Race close vs unlock', repeat('We need proven short-form ideas for this. ', 2), 'tiktok',
        (select id from niches where slug = 'personal-finance'), null, null, '{}', 3.0, 365, 500, 3, now() + interval '5 days', null);
  select external_id into ext from prepare_brief_payment(v, 'mock');
  reset role; set local role service_role;
  perform mark_payment_paid(ext, 'prov_race2_' || v, 1575, 'card');
  reset role;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
  set local role authenticated;
  p := submit_pitch(v, 'tiktok', 'Race pitch', 30, 'story', 'A race condition angle for money habits today',
        900000, 50000, current_date - 10, null, 'https://www.tiktok.com/@r/video/999000111', null, 'Race hook line here',
        'Specific numbers and visible proof early keep people watching.', repeat('SHOT LIST: show it. ', 5), null);
  reset role;
  insert into public.race2_ids values (v, p);
  update briefs set deadline_at = now() - interval '1 minute' where id = v;
end $$;
SQL
B=$(psql -X -tA -d $DB -c "select brief from race2_ids"); P=$(psql -X -tA -d $DB -c "select pitch from race2_ids")
# Hold the brief's lock for 2 seconds so both sessions below queue up and truly collide.
( psql -X -d $DB -c "begin; select 1 from briefs where id = '$B' for update; select pg_sleep(2); commit;" > /tmp/race2h.out 2>&1 ) &
sleep 0.5
# The deadline job queues for the brief first; the creator's unlock arrives second (the order that deadlocked).
( psql -X -d $DB -c "set role service_role; select close_expired_briefs();" > /tmp/race2b.out 2>&1 ) &
sleep 0.3
( psql -X -d $DB -c "select set_config('request.jwt.claims','{\"aal\":\"aal2\"}',false); select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false); set role authenticated; select unlock_pitch('$P');" > /tmp/race2a.out 2>&1 ) &
wait
if grep -qi deadlock /tmp/race2a.out /tmp/race2b.out; then echo "FAIL: deadlock between close and unlock"; cat /tmp/race2a.out /tmp/race2b.out; exit 1; fi
N=$(psql -X -tA -d $DB -c "select count(*) from unlocks where brief_id = '$B'")
S=$(psql -X -tA -d $DB -c "select status from briefs where id = '$B'")
if [ "$N" = "1" ] && [ "$S" = "closed" ]; then echo "✓ race: deadline close vs creator unlock on the same pitch → no deadlock, exactly one unlock"
else echo "FAIL: race produced $N unlocks, brief $S"; cat /tmp/race2a.out /tmp/race2b.out; exit 1; fi
