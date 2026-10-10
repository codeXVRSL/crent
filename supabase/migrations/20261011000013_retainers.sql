-- Outlier Desk — retainers: a brief that repeats every month for a researcher the creator works with.
-- Each month the daily job copies the brief into a new draft and tells the creator to fund it. Paying
-- works exactly like any other brief; once it's live the researcher is invited automatically. Nothing
-- is charged without the creator pressing Pay, so there's no stored card and no surprise charge.

create table retainers (
  id                   uuid primary key default gen_random_uuid(),
  creator_id           uuid not null references profiles(id) on delete cascade,
  cre_id               uuid not null references profiles(id) on delete cascade,
  title                text not null,
  description          text not null,
  platform             content_platform not null,
  niche_id             int references niches(id),
  must_include         text,
  avoid                text,
  example_urls         text[] not null default '{}',
  min_multiplier       numeric(6,1) not null,
  max_video_age_days   int,
  price_per_idea_cents int not null,
  max_unlocks          int not null,
  deadline_days        int not null check (deadline_days between 1 and 30),
  day_of_month         int not null check (day_of_month between 1 and 28),
  next_run_on          date not null,
  active               boolean not null default true,
  paused_reason        text check (paused_reason in ('creator','researcher_unavailable','price_out_of_range','creator_suspended')),
  last_brief_id        uuid references briefs(id) on delete set null,
  created_at           timestamptz not null default now()
);
create index retainers_due_idx on retainers(next_run_on) where active;
create index retainers_creator_idx on retainers(creator_id, created_at desc);
create index retainers_cre_idx on retainers(cre_id);

alter table briefs add column retainer_id uuid references retainers(id) on delete set null;
grant select (retainer_id) on briefs to authenticated;

alter table retainers enable row level security;
create policy "retainer_party_read" on retainers for select to authenticated
  using (auth.uid() in (creator_id, cre_id) or is_admin());
-- Writes go through the functions below only.

-- The next date with this day of the month that is strictly after `after`.
create or replace function retainer_next_date(p_day int, p_after date)
returns date language sql immutable as $$
  select case when make_date(extract(year from p_after)::int, extract(month from p_after)::int, p_day) > p_after
              then make_date(extract(year from p_after)::int, extract(month from p_after)::int, p_day)
              else (make_date(extract(year from p_after)::int, extract(month from p_after)::int, p_day) + interval '1 month')::date end
$$;

create or replace function create_retainer(p_brief_id uuid, p_cre_id uuid, p_day_of_month int)
returns uuid language plpgsql security definer set search_path = public as $$
declare b briefs; v_id uuid; v_deadline int;
begin
  if my_role() is distinct from 'creator' then raise exception 'NOT_CREATOR'; end if;
  select * into b from briefs where id = p_brief_id;
  if not found or b.creator_id <> auth.uid() then raise exception 'BRIEF_NOT_FOUND'; end if;
  if b.status in ('draft','awaiting_payment','cancelled') then raise exception 'RETAINER_NEEDS_FUNDED_BRIEF'; end if;
  if p_day_of_month is null or p_day_of_month not between 1 and 28 then raise exception 'RETAINER_DAY_OUT_OF_RANGE'; end if;
  if not exists (select 1 from cre_profiles c join profiles pr on pr.id = c.user_id
                  where c.user_id = p_cre_id and c.kyc_status = 'approved' and pr.suspended_at is null) then
    raise exception 'CRE_NOT_FOUND';
  end if;
  if (select count(*) from retainers where creator_id = auth.uid() and active) >= 10 then raise exception 'TOO_MANY_RETAINERS'; end if;
  if exists (select 1 from retainers where creator_id = auth.uid() and cre_id = p_cre_id and title = b.title) then
    raise exception 'RETAINER_EXISTS';
  end if;
  -- Same length of time to pitch as the original brief, rounded to whole days.
  v_deadline := least(30, greatest(1, round(extract(epoch from (b.deadline_at - coalesce(b.opened_at, b.created_at))) / 86400)::int));
  insert into retainers(creator_id, cre_id, title, description, platform, niche_id, must_include, avoid, example_urls,
                        min_multiplier, max_video_age_days, price_per_idea_cents, max_unlocks, deadline_days, day_of_month, next_run_on)
  values (b.creator_id, p_cre_id, b.title, b.description, b.platform, b.niche_id, b.must_include, b.avoid, b.example_urls,
          b.min_multiplier, b.max_video_age_days, b.price_per_idea_cents, b.max_unlocks, v_deadline, p_day_of_month,
          retainer_next_date(p_day_of_month, (now() at time zone 'Asia/Manila')::date))
  returning id into v_id;
  perform notify(p_cre_id, 'retainer_started', 'A creator put you on a monthly retainer',
                 b.title || ': you''ll be invited each month on day ' || p_day_of_month, '/briefs');
  return v_id;
end $$;

create or replace function set_retainer_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r retainers;
begin
  select * into r from retainers where id = p_id for update;
  if not found or r.creator_id <> auth.uid() then raise exception 'RETAINER_NOT_FOUND'; end if;
  if p_active then
    if (select count(*) from retainers where creator_id = auth.uid() and active and id <> r.id) >= 10 then raise exception 'TOO_MANY_RETAINERS'; end if;
    update retainers set active = true, paused_reason = null,
      next_run_on = greatest(next_run_on, retainer_next_date(day_of_month, (now() at time zone 'Asia/Manila')::date))
      where id = r.id;
  else
    update retainers set active = false, paused_reason = 'creator' where id = r.id;
  end if;
end $$;

create or replace function delete_retainer(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from retainers where id = p_id and creator_id = auth.uid();
  if not found then raise exception 'RETAINER_NOT_FOUND'; end if;
end $$;

-- Daily job (service role): make this month's draft for every retainer that is due.
-- Returns the drafts it made so the app can email the creators.
create or replace function run_retainers()
returns table (brief_id uuid, creator_id uuid, title text, total_charge_cents int, currency text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare r retainers; s platform_settings; v_today date := (now() at time zone 'Asia/Manila')::date;
        v_id uuid; v_budget int; v_fee int; v_reason text;
begin
  select * into s from platform_settings where id;
  for r in select * from retainers where active and next_run_on <= v_today order by next_run_on for update skip locked loop
    v_reason := null;
    if exists (select 1 from profiles where id = r.creator_id and suspended_at is not null) then v_reason := 'creator_suspended';
    elsif not exists (select 1 from cre_profiles c join profiles pr on pr.id = c.user_id
                       where c.user_id = r.cre_id and c.kyc_status = 'approved' and pr.suspended_at is null) then v_reason := 'researcher_unavailable';
    elsif r.price_per_idea_cents not between s.min_price_per_idea_cents and s.max_price_per_idea_cents then v_reason := 'price_out_of_range';
    end if;
    if v_reason is not null then
      update retainers set active = false, paused_reason = v_reason where id = r.id;
      if v_reason <> 'creator_suspended' then
        perform notify(r.creator_id, 'retainer_paused', 'Your monthly brief is paused: ' || r.title,
          case v_reason when 'researcher_unavailable' then 'The researcher can''t take briefs right now.'
                        else 'Its price is outside the current limits. Post a new brief to start again.' end, '/briefs');
      end if;
      continue;
    end if;
    -- Last month's draft still unpaid: don't pile up another one, just move to next month.
    if r.last_brief_id is not null and exists (select 1 from briefs where id = r.last_brief_id and status in ('draft','awaiting_payment')) then
      update retainers set next_run_on = retainer_next_date(r.day_of_month, v_today) where id = r.id;
      continue;
    end if;
    v_budget := r.price_per_idea_cents * r.max_unlocks;
    v_fee    := fee_cents(v_budget, s.creator_fee_bps);
    insert into briefs(creator_id, title, description, platform, niche_id, must_include, avoid, example_urls,
                       min_multiplier, max_video_age_days, currency, price_per_idea_cents, max_unlocks,
                       creator_fee_bps, cre_fee_bps, creator_fee_cents, total_charge_cents, deadline_at, retainer_id)
    values (r.creator_id, r.title, r.description, r.platform, r.niche_id, r.must_include, r.avoid, r.example_urls,
            greatest(r.min_multiplier, s.min_multiplier), r.max_video_age_days, s.default_currency, r.price_per_idea_cents, r.max_unlocks,
            s.creator_fee_bps, s.cre_fee_bps, v_fee, v_budget + v_fee, now() + make_interval(days => r.deadline_days), r.id)
    returning id into v_id;
    update retainers set last_brief_id = v_id, next_run_on = retainer_next_date(r.day_of_month, v_today) where id = r.id;
    perform notify(r.creator_id, 'retainer_draft', 'Your monthly brief is ready to fund: ' || r.title,
                   money_text(v_budget + v_fee, s.default_currency) || '. Pay to put it live; your researcher is invited automatically.', '/briefs/' || v_id);
    brief_id := v_id; creator_id := r.creator_id; title := r.title; total_charge_cents := v_budget + v_fee; currency := s.default_currency;
    return next;
  end loop;
end $$;

-- When a retainer's brief goes live, invite its researcher (same as pressing "Invite to pitch").
create or replace function invite_retainer_researcher()
returns trigger language plpgsql security definer set search_path = public as $$
declare r retainers;
begin
  select * into r from retainers where id = new.retainer_id;
  if found and exists (select 1 from cre_profiles c join profiles pr on pr.id = c.user_id
                        where c.user_id = r.cre_id and c.kyc_status = 'approved' and pr.suspended_at is null) then
    insert into brief_invites(brief_id, cre_id) values (new.id, r.cre_id) on conflict do nothing;
    perform notify(r.cre_id, 'brief_invite', 'Your monthly brief is live: ' || new.title,
                   money_text(new.price_per_idea_cents, new.currency) || ' per idea', '/briefs/' || new.id);
  end if;
  return new;
end $$;
create trigger briefs_retainer_invite after update of status on briefs
  for each row when (new.status = 'open' and old.status is distinct from 'open' and new.retainer_id is not null)
  execute function invite_retainer_researcher();

revoke execute on function create_retainer(uuid, uuid, int), set_retainer_active(uuid, boolean), delete_retainer(uuid),
  run_retainers(), invite_retainer_researcher(), retainer_next_date(int, date) from public, anon, authenticated;
grant execute on function create_retainer(uuid, uuid, int), set_retainer_active(uuid, boolean), delete_retainer(uuid) to authenticated;
grant execute on function run_retainers() to service_role;

-- Closing an account ends its retainers (both sides).
create or replace function end_retainers_on_close()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.suspended_reason = 'account_closed' and old.suspended_reason is distinct from 'account_closed' then
    update retainers set active = false, paused_reason = case when creator_id = new.id then 'creator' else 'researcher_unavailable' end
      where active and new.id in (creator_id, cre_id);
  end if;
  return new;
end $$;
revoke execute on function end_retainers_on_close() from public, anon, authenticated;
create trigger profiles_end_retainers after update of suspended_reason on profiles
  for each row execute function end_retainers_on_close();
