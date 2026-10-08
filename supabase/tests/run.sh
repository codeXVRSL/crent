#!/usr/bin/env bash
# Runs all migrations and the marketplace test against a throwaway local Postgres database.
# Usage: PGHOST=localhost PGPORT=5432 PGUSER=postgres ./supabase/tests/run.sh
set -uo pipefail
cd "$(dirname "$0")/.."
DB=outlier_test
psql -q -X -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB" || exit 1
psql -q -X -v ON_ERROR_STOP=1 -d $DB -f tests/00_supabase_shim.sql || exit 1
for f in migrations/*.sql; do psql -q -X -v ON_ERROR_STOP=1 -d $DB -f "$f" || exit 1; done
psql -q -X -v ON_ERROR_STOP=1 -d $DB -f seed.sql || exit 1
# The flow tests act as admin without a two-factor token; test 50 turns the requirement back on and checks it.
psql -q -X -d $DB -c "update platform_settings set admin_mfa_required = false" >/dev/null
out=$(psql -X -v ON_ERROR_STOP=1 -d $DB -f tests/10_marketplace_flow.sql 2>&1); status=$?
echo "$out" | grep -E "✓|FAIL|ERROR|CONTEXT|LINE"
if [ $status -ne 0 ] || echo "$out" | grep -q "FAIL"; then echo "DATABASE TESTS FAILED"; exit 1; fi
# Race: two sessions unlock different pitches for the last slot at the same time. Exactly one may win.
psql -q -X -v ON_ERROR_STOP=1 -d $DB -f tests/20_concurrency_setup.sql >/dev/null || { echo "race setup failed"; exit 1; }
P1=$(psql -X -tA -d $DB -c "select p1 from race_ids"); P2=$(psql -X -tA -d $DB -c "select p2 from race_ids")
( psql -X -v ON_ERROR_STOP=1 -v pid=$P1 -d $DB -f tests/race_unlock.sql > /tmp/race1.out 2>&1 ) &
( psql -X -v ON_ERROR_STOP=1 -v pid=$P2 -d $DB -f tests/race_unlock.sql > /tmp/race2.out 2>&1 ) &
wait
OK=$(cat /tmp/race1.out /tmp/race2.out | grep -c UNLOCK_OK)
USED=$(psql -X -tA -d $DB -c "select unlocks_used from briefs b join race_ids r on r.brief_id = b.id")
if [ "$OK" = "1" ] && [ "$USED" = "1" ]; then echo "✓ race: two simultaneous unlocks for the last slot → exactly one succeeds"
else echo "FAIL: race produced $OK successful unlocks, unlocks_used=$USED"; cat /tmp/race1.out /tmp/race2.out; exit 1; fi
out=$(psql -X -v ON_ERROR_STOP=1 -d $DB -f tests/30_creator_researcher_tools.sql 2>&1); status=$?
echo "$out" | grep -E "✓|FAIL|ERROR|CONTEXT|LINE"
if [ $status -ne 0 ] || echo "$out" | grep -q "FAIL"; then echo "DATABASE TESTS FAILED"; exit 1; fi
out=$(psql -X -v ON_ERROR_STOP=1 -d $DB -f tests/40_rate_limits_and_closure.sql 2>&1); status=$?
echo "$out" | grep -E "✓|FAIL|ERROR|CONTEXT|LINE"
if [ $status -ne 0 ] || echo "$out" | grep -q "FAIL"; then echo "DATABASE TESTS FAILED"; exit 1; fi
out=$(psql -X -v ON_ERROR_STOP=1 -d $DB -f tests/50_security.sql 2>&1); status=$?
echo "$out" | grep -E "✓|FAIL|ERROR|CONTEXT|LINE"
if [ $status -ne 0 ] || echo "$out" | grep -q "FAIL"; then echo "DATABASE TESTS FAILED"; exit 1; fi
echo "ALL DATABASE TESTS PASSED"
