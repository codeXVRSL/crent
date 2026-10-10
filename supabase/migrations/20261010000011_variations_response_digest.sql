-- Outlier Desk — request a variation, researcher response time, weekly digest opt-out.

-- ---------------------------------------------------------------
-- 1. Request a variation: one free alternate hook or angle per unlock (the "revision" pattern).
--    The creator asks once with a short note; the researcher answers once. Both texts are masked.
-- ---------------------------------------------------------------
create table variation_requests (
  unlock_id    uuid primary key references unlocks(id) on delete cascade,
  creator_id   uuid not null references profiles(id),
  cre_id       uuid not null references profiles(id),
  note         text not null check (char_length(note) between 10 and 1000),
  response     text check (char_length(response) between 10 and 3000),
  requested_at timestamptz not null default now(),
  answered_at  timestamptz
);
create index variation_requests_cre_idx on variation_requests(cre_id, answered_at);
alter table variation_requests enable row level security;
create policy "variation_party_read" on variation_requests for select to authenticated
  using (auth.uid() in (creator_id, cre_id));
-- Writes go through the two functions below only.

create or replace function request_variation(p_unlock_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare u unlocks; m record;
begin
  select * into u from unlocks where id = p_unlock_id;
  if not found or u.creator_id <> auth.uid() then raise exception 'UNLOCK_NOT_FOUND'; end if;
  if u.status = 'reversed' then raise exception 'NOT_ALLOWED'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 10 then raise exception 'VARIATION_NOTE_TOO_SHORT'; end if;
  if exists (select 1 from variation_requests where unlock_id = u.id) then raise exception 'VARIATION_ALREADY_REQUESTED'; end if;
  select * into m from mask_contacts(btrim(p_note));
  insert into variation_requests(unlock_id, creator_id, cre_id, note) values (u.id, u.creator_id, u.cre_id, left(m.masked, 1000));
  perform notify(u.cre_id, 'variation_requested', 'A creator asked for a variation', left(m.masked, 140), '/pitches#variations');
end $$;

create or replace function answer_variation(p_unlock_id uuid, p_response text)
returns void language plpgsql security definer set search_path = public as $$
declare v variation_requests; m record;
begin
  select * into v from variation_requests where unlock_id = p_unlock_id for update;
  if not found or v.cre_id <> auth.uid() then raise exception 'VARIATION_NOT_FOUND'; end if;
  if v.answered_at is not null then raise exception 'VARIATION_ALREADY_ANSWERED'; end if;
  if char_length(btrim(coalesce(p_response, ''))) < 10 then raise exception 'VARIATION_RESPONSE_TOO_SHORT'; end if;
  select * into m from mask_contacts(btrim(p_response));
  update variation_requests set response = left(m.masked, 3000), answered_at = now() where unlock_id = v.unlock_id;
  perform notify(v.creator_id, 'variation_answered', 'Your variation is ready', left(m.masked, 140), '/unlocks');
end $$;

revoke execute on function request_variation(uuid, text) from public, anon;
revoke execute on function answer_variation(uuid, text) from public, anon;
grant execute on function request_variation(uuid, text), answer_variation(uuid, text) to authenticated;

-- Suspended accounts can't use it either (same rule as disputes and messages).
create trigger variation_not_suspended before insert or update on variation_requests
  for each row execute function block_suspended_actor();

-- ---------------------------------------------------------------
-- 2. Response time: how quickly a researcher first replies after a creator writes in a conversation.
--    Only aggregates are exposed; message contents stay private.
-- ---------------------------------------------------------------
create or replace view cre_response_stats as
with asked as (
  select t.id as thread_id, t.cre_id,
         (select min(created_at) from messages m where m.thread_id = t.id and m.sender_id = t.creator_id) as asked_at
    from threads t
), replied as (
  select a.cre_id,
         (select min(created_at) from messages m where m.thread_id = a.thread_id and m.sender_id = a.cre_id and m.created_at > a.asked_at) - a.asked_at as took
    from asked a where a.asked_at is not null
)
select cre_id,
       count(took)::int as reply_samples,
       round((extract(epoch from percentile_cont(0.5) within group (order by took)) / 3600)::numeric, 1) as median_reply_hours
  from replied where took is not null
 group by cre_id;
grant select on cre_response_stats to anon, authenticated;

-- ---------------------------------------------------------------
-- 3. Weekly digest email: people can switch it off; each week is sent once.
-- ---------------------------------------------------------------
alter table profiles add column if not exists email_digest boolean not null default true;
create table digest_runs (
  week_start date primary key,
  sent_count integer not null default 0,
  ran_at     timestamptz not null default now()
);
alter table digest_runs enable row level security;   -- service role only
