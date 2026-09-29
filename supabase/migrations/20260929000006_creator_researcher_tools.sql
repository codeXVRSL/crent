-- Outlier Desk — tools for creators and researchers
--   Creators: idea board (production stages + results), pitch shortlist and pass-with-feedback,
--             saved researchers and brief invites.
--   Researchers: swipe file of candidate outliers, invites, track record built from real results.
-- All writes go through security-definer functions or own-row RLS, like the rest of the schema.

-- ---------------------------------------------------------------
-- Idea board: every unlocked idea, tracked from "saved" to "posted".
-- Private to the creator. The researcher only ever sees the stage and the result multiple
-- (never the posted URL or notes, which could reveal the creator's channel or plans).
-- ---------------------------------------------------------------
create table idea_tracking (
  unlock_id       uuid primary key references unlocks(id) on delete cascade,
  creator_id      uuid not null references profiles(id) on delete cascade,
  cre_id          uuid not null references profiles(id),
  stage           text not null default 'saved' check (stage in ('saved','scripting','filming','posted','skipped')),
  board           text check (char_length(board) <= 40),
  planned_on      date,
  notes           text check (char_length(notes) <= 2000),
  posted_url      text check (posted_url is null or (char_length(posted_url) <= 500 and posted_url ~* '^https?://')),
  posted_on       date,
  result_views    bigint check (result_views >= 0),
  usual_views     bigint check (usual_views > 0),
  result_multiple numeric(8,1) generated always as (
                    case when result_views is not null and usual_views > 0
                         then round(result_views::numeric / usual_views, 1) end) stored,
  updated_at      timestamptz not null default now()
);
create index idea_tracking_creator_idx on idea_tracking(creator_id, stage);
create index idea_tracking_cre_idx     on idea_tracking(cre_id) where result_multiple is not null;

create or replace function save_idea_tracking(
  p_unlock_id uuid, p_stage text, p_board text, p_planned_on date, p_notes text,
  p_posted_url text, p_posted_on date, p_result_views bigint, p_usual_views bigint
) returns void language plpgsql security definer set search_path = public as $$
declare u unlocks; old idea_tracking; v_new idea_tracking;
begin
  select * into u from unlocks where id = p_unlock_id;
  if not found or u.creator_id <> auth.uid() or u.status = 'reversed' then raise exception 'UNLOCK_NOT_FOUND'; end if;
  if p_result_views is not null and p_result_views < 0 then raise exception 'INVALID_VIEWS'; end if;
  if p_usual_views is not null and p_usual_views <= 0 then raise exception 'INVALID_VIEWS'; end if;
  if p_posted_on is not null and p_posted_on > current_date then raise exception 'POSTED_DATE_IN_FUTURE'; end if;
  select * into old from idea_tracking where unlock_id = u.id;

  insert into idea_tracking(unlock_id, creator_id, cre_id, stage, board, planned_on, notes, posted_url, posted_on,
                            result_views, usual_views, updated_at)
  values (u.id, u.creator_id, u.cre_id, coalesce(p_stage, 'saved'), nullif(btrim(p_board), ''), p_planned_on,
          nullif(btrim(p_notes), ''), nullif(btrim(p_posted_url), ''), p_posted_on, p_result_views, p_usual_views, now())
  on conflict (unlock_id) do update set
    stage = excluded.stage, board = excluded.board, planned_on = excluded.planned_on, notes = excluded.notes,
    posted_url = excluded.posted_url, posted_on = excluded.posted_on, result_views = excluded.result_views,
    usual_views = excluded.usual_views, updated_at = now()
  returning * into v_new;

  -- Close the loop: tell the researcher how their idea did the first time a result is logged.
  if v_new.result_multiple is not null and (old.unlock_id is null or old.result_multiple is null) then
    perform notify(u.cre_id, 'idea_result', 'A creator posted your idea',
                   'It got ' || v_new.result_multiple || '× their usual views.', '/pitches');
  elsif v_new.stage = 'posted' and (old.unlock_id is null or old.stage <> 'posted') then
    perform notify(u.cre_id, 'idea_posted', 'A creator posted your idea', null, '/pitches');
  end if;
end $$;

-- What the researcher may see about their own ideas.
create view cre_idea_results as
  select t.unlock_id, u.pitch_id, t.cre_id, t.stage, t.posted_on, t.result_multiple, t.updated_at
    from idea_tracking t join unlocks u on u.id = t.unlock_id
   where t.cre_id = auth.uid() and u.status <> 'reversed';

-- Public track record: results creators logged after using a researcher's ideas.
create view cre_result_stats as
  select t.cre_id,
         count(*) filter (where t.stage = 'posted')::int                         as ideas_posted,
         count(t.result_multiple)::int                                           as results_logged,
         round(avg(t.result_multiple), 1)                                        as avg_result_multiple,
         count(*) filter (where t.result_multiple >= 2)::int                     as hits
    from idea_tracking t join unlocks u on u.id = t.unlock_id and u.status <> 'reversed'
   group by t.cre_id;

-- Repeat business: creators who came back and unlocked again.
create view cre_repeat_stats as
  select cre_id,
         count(*)::int                                  as unlocks_total,
         count(distinct creator_id)::int                as buyers,
         count(*) filter (where n >= 2)::int            as repeat_buyers
    from (select cre_id, creator_id, count(*) as n from unlocks where status <> 'reversed' group by cre_id, creator_id) x
   group by cre_id;

-- ---------------------------------------------------------------
-- Pitch review tools for creators
-- ---------------------------------------------------------------
-- Shortlist: private to the creator.
create table pitch_shortlist (
  pitch_id   uuid primary key references pitches(id) on delete cascade,
  creator_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Pass with a reason: the researcher sees it, so they learn what this creator wants.
create table pitch_feedback (
  pitch_id   uuid primary key references pitches(id) on delete cascade,
  creator_id uuid not null references profiles(id) on delete cascade,
  reason     text not null check (reason in ('not_my_style','seen_it','score_too_low','off_brief','too_hard_to_film','other')),
  note       text check (char_length(note) <= 400),
  created_at timestamptz not null default now()
);

create or replace function _own_submitted_pitch(p_pitch_id uuid) returns pitches
language plpgsql security definer set search_path = public as $$
declare p pitches;
begin
  select p2.* into p from pitches p2 join briefs b on b.id = p2.brief_id
   where p2.id = p_pitch_id and b.creator_id = auth.uid();
  if not found then raise exception 'PITCH_NOT_FOUND'; end if;
  return p;
end $$;
revoke execute on function _own_submitted_pitch(uuid) from public, anon, authenticated;

create or replace function set_pitch_shortlist(p_pitch_id uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare p pitches;
begin
  p := _own_submitted_pitch(p_pitch_id);
  if p_on then
    insert into pitch_shortlist(pitch_id, creator_id) values (p.id, auth.uid()) on conflict do nothing;
  else
    delete from pitch_shortlist where pitch_id = p.id;
  end if;
end $$;

create or replace function pass_pitch(p_pitch_id uuid, p_reason text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare p pitches; m record; b briefs;
begin
  p := _own_submitted_pitch(p_pitch_id);
  if p.status <> 'submitted' then raise exception 'PITCH_NOT_AVAILABLE'; end if;
  select * into m from mask_contacts(p_note);
  insert into pitch_feedback(pitch_id, creator_id, reason, note) values (p.id, auth.uid(), p_reason, nullif(btrim(m.masked), ''))
  on conflict (pitch_id) do update set reason = excluded.reason, note = excluded.note, created_at = now();
  delete from pitch_shortlist where pitch_id = p.id;
  select * into b from briefs where id = p.brief_id;
  perform notify(p.cre_id, 'pitch_passed', 'Feedback on your pitch', 'The creator passed on it. See why on the brief.', '/briefs/' || b.id);
end $$;

create or replace function unpass_pitch(p_pitch_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p pitches;
begin
  p := _own_submitted_pitch(p_pitch_id);
  delete from pitch_feedback where pitch_id = p.id;
end $$;

-- ---------------------------------------------------------------
-- Saved researchers and brief invites
-- ---------------------------------------------------------------
create table favorite_cres (
  creator_id uuid not null references profiles(id) on delete cascade,
  cre_id     uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (creator_id, cre_id)
);

create or replace function toggle_favorite_cre(p_cre_id uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_role() is distinct from 'creator' then raise exception 'NOT_CREATOR'; end if;
  if p_on then
    if not exists (select 1 from cre_profiles c join profiles pr on pr.id = c.user_id
                    where c.user_id = p_cre_id and c.kyc_status = 'approved' and pr.suspended_at is null) then
      raise exception 'CRE_NOT_FOUND';
    end if;
    insert into favorite_cres(creator_id, cre_id) values (auth.uid(), p_cre_id) on conflict do nothing;
  else
    delete from favorite_cres where creator_id = auth.uid() and cre_id = p_cre_id;
  end if;
end $$;

create table brief_invites (
  brief_id   uuid not null references briefs(id) on delete cascade,
  cre_id     uuid not null references profiles(id) on delete cascade,
  invited_at timestamptz not null default now(),
  primary key (brief_id, cre_id)
);
create index brief_invites_cre_idx on brief_invites(cre_id, invited_at desc);

create or replace function invite_to_brief(p_brief_id uuid, p_cre_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b briefs; v_count int;
begin
  select * into b from briefs where id = p_brief_id;
  if not found or b.creator_id <> auth.uid() then raise exception 'BRIEF_NOT_FOUND'; end if;
  if b.status <> 'open' or b.deadline_at <= now() then raise exception 'BRIEF_NOT_OPEN'; end if;
  if not exists (select 1 from cre_profiles c join profiles pr on pr.id = c.user_id
                  where c.user_id = p_cre_id and c.kyc_status = 'approved' and pr.suspended_at is null) then
    raise exception 'CRE_NOT_FOUND';
  end if;
  select count(*) into v_count from brief_invites where brief_id = b.id;
  if v_count >= 25 then raise exception 'TOO_MANY_INVITES'; end if;
  insert into brief_invites(brief_id, cre_id) values (b.id, p_cre_id) on conflict do nothing;
  if found then
    perform notify(p_cre_id, 'brief_invite', 'You were invited to pitch: ' || b.title,
                   money_text(b.price_per_idea_cents, b.currency) || ' per idea', '/briefs/' || b.id);
  end if;
end $$;

-- ---------------------------------------------------------------
-- Researcher swipe file: candidate outliers saved before there's a brief for them.
-- ---------------------------------------------------------------
create table swipe_items (
  id                   uuid primary key default gen_random_uuid(),
  cre_id               uuid not null references profiles(id) on delete cascade,
  platform             content_platform not null,
  niche_id             int references niches(id),
  title                text not null check (char_length(title) between 3 and 120),
  source_url           text not null check (char_length(source_url) <= 500 and source_url ~* '^https?://'),
  source_views         bigint not null check (source_views > 0),
  channel_median_views bigint not null check (channel_median_views > 0),
  multiplier           numeric(8,1) generated always as (round(source_views::numeric / channel_median_views, 1)) stored,
  source_posted_on     date check (source_posted_on <= current_date),
  hook_category        text check (hook_category in (
                         'question','bold_claim','number_list','story','before_after','myth_bust',
                         'tutorial','reaction','pov','challenge','controversy','other')),
  notes                text check (char_length(notes) <= 2000),
  status               text not null default 'saved' check (status in ('saved','pitched','archived')),
  created_at           timestamptz not null default now()
);
create index swipe_items_cre_idx on swipe_items(cre_id, created_at desc);

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['idea_tracking','pitch_shortlist','pitch_feedback','favorite_cres','brief_invites','swipe_items'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "admin_read_all" on %I for select to authenticated using (is_admin())', t);
  end loop;
end $$;

create policy "tracking_creator_read"  on idea_tracking   for select to authenticated using (creator_id = auth.uid());
create policy "shortlist_creator_read" on pitch_shortlist for select to authenticated using (creator_id = auth.uid());
create policy "feedback_party_read"    on pitch_feedback  for select to authenticated
  using (creator_id = auth.uid() or exists (select 1 from pitches p where p.id = pitch_id and p.cre_id = auth.uid()));
create policy "favorites_creator_read" on favorite_cres   for select to authenticated using (creator_id = auth.uid());
create policy "invites_party_read"     on brief_invites   for select to authenticated
  using (cre_id = auth.uid() or exists (select 1 from briefs b where b.id = brief_id and b.creator_id = auth.uid()));

create policy "swipe_own_read"   on swipe_items for select to authenticated using (cre_id = auth.uid());
create policy "swipe_own_insert" on swipe_items for insert to authenticated with check (cre_id = auth.uid() and my_role() = 'cre');
create policy "swipe_own_update" on swipe_items for update to authenticated using (cre_id = auth.uid()) with check (cre_id = auth.uid());
create policy "swipe_own_delete" on swipe_items for delete to authenticated using (cre_id = auth.uid());

-- ---------------------------------------------------------------
-- Public researcher view: add track record and repeat business (new columns go at the end).
-- ---------------------------------------------------------------
create or replace view public_cres as
  select pr.id, pr.display_name, pr.handle, pr.country_code, pr.created_at,
         c.headline, c.bio, c.platforms, c.years_experience, c.accepting_work,
         coalesce(array(select n.name from cre_niches cn join niches n on n.id = cn.niche_id
                         where cn.user_id = pr.id order by n.name), '{}') as niches,
         coalesce(array(select cn.niche_id from cre_niches cn where cn.user_id = pr.id), '{}') as niche_ids,
         s.pitches_sent, s.pitches_unlocked, s.unlock_rate_pct,
         r.avg_rating, coalesce(r.review_count, 0) as review_count,
         coalesce(rp.unlocks_total, 0)  as unlocks_total,
         coalesce(rp.buyers, 0)         as buyers,
         coalesce(rp.repeat_buyers, 0)  as repeat_buyers,
         coalesce(rs.ideas_posted, 0)   as ideas_posted,
         coalesce(rs.results_logged, 0) as results_logged,
         rs.avg_result_multiple,
         coalesce(rs.hits, 0)           as hits
    from profiles pr
    join cre_profiles c on c.user_id = pr.id and c.kyc_status = 'approved'
    left join cre_public_stats s on s.cre_id = pr.id
    left join review_stats r on r.reviewee_id = pr.id
    left join cre_repeat_stats rp on rp.cre_id = pr.id
    left join cre_result_stats rs on rs.cre_id = pr.id
   where pr.suspended_at is null;

revoke all on cre_idea_results, cre_result_stats, cre_repeat_stats from anon, authenticated;
grant select on cre_result_stats, cre_repeat_stats, public_cres to anon, authenticated;
grant select on cre_idea_results to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'save_idea_tracking(uuid, text, text, date, text, text, date, bigint, bigint)',
    'set_pitch_shortlist(uuid, boolean)', 'pass_pitch(uuid, text, text)', 'unpass_pitch(uuid)',
    'toggle_favorite_cre(uuid, boolean)', 'invite_to_brief(uuid, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
