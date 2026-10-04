-- Outlier Desk — login/sign-up rate limiting and self-service account closure.

-- ---------------------------------------------------------------
-- Rate limits. Counted in the database so they work on serverless hosting with no Redis.
-- Called with the service role from server actions (see lib/rate-limit.ts).
-- ---------------------------------------------------------------
create table rate_limits (
  key          text primary key,            -- e.g. 'login:ip:1.2.3.4' or 'login:email:a@b.c'
  window_start timestamptz not null default now(),
  hits         integer not null default 0
);
alter table rate_limits enable row level security;   -- no policies: service role only

-- Returns true when the call is allowed, false when the limit for this window is exhausted.
create or replace function rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare r rate_limits;
begin
  insert into rate_limits(key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rate_limits.hits + 1 end,
        window_start = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now() else rate_limits.window_start end
  returning * into r;
  return r.hits <= p_limit;
end $$;
revoke execute on function rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function rate_limit_hit(text, int, int) to service_role;

-- Housekeeping, run by the scheduled job.
create or replace function prune_rate_limits()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from rate_limits where window_start < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function prune_rate_limits() from public, anon, authenticated;
grant execute on function prune_rate_limits() to service_role;

-- ---------------------------------------------------------------
-- Account closure. The person asks from Settings; the database refuses while money or an open
-- dispute is still attached, otherwise scrubs everything personal. Money history and the ledger
-- stay (they are the platform's records), tied to an anonymised profile.
-- ---------------------------------------------------------------
create or replace function close_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_role user_role;
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  select role into v_role from profiles where id = v_uid;
  if v_role = 'admin' then raise exception 'ADMIN_CANNOT_CLOSE'; end if;

  -- Blockers that would strand money or an unresolved case
  if exists (select 1 from unlocks where cre_id = v_uid and status in ('held','available','disputed')) then raise exception 'EARNINGS_PENDING'; end if;
  if exists (select 1 from payouts where cre_id = v_uid and status in ('requested','processing')) then raise exception 'PAYOUT_PENDING'; end if;
  if exists (select 1 from briefs where creator_id = v_uid and status in ('awaiting_payment','open','closed')) then raise exception 'BRIEF_OPEN'; end if;
  if exists (select 1 from disputes d join unlocks u on u.id = d.unlock_id
              where v_uid in (u.creator_id, u.cre_id) and d.status in ('awaiting_cre','awaiting_admin')) then raise exception 'DISPUTE_OPEN'; end if;

  -- Waiting pitches are withdrawn so creators don't see cards from a closed account
  update pitches set status = 'withdrawn' where cre_id = v_uid and status = 'submitted';

  -- Scrub personal data
  delete from kyc_submissions where user_id = v_uid;
  -- Payout methods that were used for a paid withdrawal are referenced by the money history: keep the
  -- row (kind + last four digits, as on a bank statement) but erase the name and the encrypted number.
  delete from payout_methods where user_id = v_uid and not exists (select 1 from payouts p where p.method_id = payout_methods.id);
  update payout_methods set account_name = 'Deleted user', account_number_enc = '', is_default = false where user_id = v_uid;
  delete from portfolio_items where cre_id = v_uid;
  delete from cre_niches where user_id = v_uid;
  delete from swipe_items where cre_id = v_uid;
  delete from favorite_cres where creator_id = v_uid or cre_id = v_uid;
  delete from idea_tracking where creator_id = v_uid;
  delete from notifications where user_id = v_uid;
  delete from brief_invites where cre_id = v_uid;
  update cre_profiles set headline = null, bio = null, platforms = '{}', accepting_work = false, kyc_status = 'not_started',
         kyc_reject_reason = null where user_id = v_uid;
  update creator_profiles set brand_name = null, channel_url = null where user_id = v_uid;
  update profiles set display_name = 'Deleted user', handle = null, country_code = null,
         suspended_at = now(), suspended_reason = 'account_closed' where id = v_uid;
  perform audit('account.close', 'profile', v_uid::text, null);
end $$;
revoke execute on function close_my_account() from public, anon;
grant execute on function close_my_account() to authenticated;
