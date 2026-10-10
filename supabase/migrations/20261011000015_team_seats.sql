-- Outlier Desk — team seats: a creator (or agency) shares their idea board, read-only, with up to 5
-- teammates. Teammates sign in with their own account, accept an emailed invite, and can read the
-- unlocked ideas and their progress. They can't pay, unlock, message or change anything.

create table team_members (
  owner_id  uuid not null references profiles(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (owner_id, member_id),
  check (owner_id <> member_id)
);
create index team_members_member_idx on team_members(member_id);

create table team_invites (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  email       text not null check (char_length(email) between 3 and 320 and email like '%@%'),
  token       uuid not null unique default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index team_invites_open_idx on team_invites(owner_id, lower(email)) where accepted_at is null;

alter table team_members enable row level security;
alter table team_invites enable row level security;
create policy "team_party_read" on team_members for select to authenticated using (auth.uid() in (owner_id, member_id));
create policy "team_invites_owner_read" on team_invites for select to authenticated using (owner_id = auth.uid());
-- Writes go through the functions below only.

create or replace function invite_teammate(p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_token uuid;
begin
  if my_role() is distinct from 'creator' then raise exception 'NOT_CREATOR'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 320 then raise exception 'TEAM_EMAIL_INVALID'; end if;
  if v_email = (select lower(email) from auth.users where id = auth.uid()) then raise exception 'TEAM_SELF_INVITE'; end if;
  if (select count(*) from team_members where owner_id = auth.uid())
     + (select count(*) from team_invites where owner_id = auth.uid() and accepted_at is null) >= 5 then
    raise exception 'TEAM_FULL';
  end if;
  if exists (select 1 from team_members m join auth.users u on u.id = m.member_id
              where m.owner_id = auth.uid() and lower(u.email) = v_email) then raise exception 'TEAM_ALREADY_MEMBER'; end if;
  insert into team_invites(owner_id, email) values (auth.uid(), v_email)
    on conflict (owner_id, lower(email)) where accepted_at is null do update set created_at = now()
    returning token into v_token;
  return v_token;
end $$;

create or replace function accept_team_invite(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare i team_invites;
begin
  if auth.uid() is null then raise exception 'NOT_ALLOWED'; end if;
  select * into i from team_invites where token = p_token for update;
  if not found or i.accepted_at is not null or i.created_at < now() - interval '14 days' then raise exception 'TEAM_INVITE_INVALID'; end if;
  if lower(i.email) <> (select lower(email) from auth.users where id = auth.uid()) then raise exception 'TEAM_INVITE_OTHER_EMAIL'; end if;
  if i.owner_id = auth.uid() then raise exception 'TEAM_SELF_INVITE'; end if;
  insert into team_members(owner_id, member_id) values (i.owner_id, auth.uid()) on conflict do nothing;
  update team_invites set accepted_at = now() where id = i.id;
  perform notify(i.owner_id, 'team_joined', 'A teammate joined your idea board',
                 (select display_name from profiles where id = auth.uid()) || ' can now see your idea board (read-only).', '/team');
  return i.owner_id;
end $$;

create or replace function remove_teammate(p_member uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from team_members where owner_id = auth.uid() and member_id = p_member;
  if not found then raise exception 'TEAM_MEMBER_NOT_FOUND'; end if;
end $$;

create or replace function revoke_team_invite(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from team_invites where id = p_id and owner_id = auth.uid() and accepted_at is null;
  if not found then raise exception 'TEAM_INVITE_INVALID'; end if;
end $$;

create or replace function leave_team(p_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from team_members where owner_id = p_owner and member_id = auth.uid();
  if not found then raise exception 'TEAM_MEMBER_NOT_FOUND'; end if;
end $$;

-- For the owner: teammates (name and sign-in email) and invites still waiting.
create or replace function my_team()
returns table (kind text, id uuid, name text, email text, since timestamptz)
language sql stable security definer set search_path = public as $$
  select 'member', m.member_id, p.display_name, u.email::text, m.added_at
    from team_members m join profiles p on p.id = m.member_id join auth.users u on u.id = m.member_id
   where m.owner_id = auth.uid()
  union all
  select 'invite', i.id, null, i.email, i.created_at
    from team_invites i where i.owner_id = auth.uid() and i.accepted_at is null and i.created_at >= now() - interval '14 days'
  order by 1 desc, 5
$$;

-- For a teammate: the boards they can see.
create or replace function teams_i_am_on()
returns table (owner_id uuid, owner_name text, brand_name text)
language sql stable security definer set search_path = public as $$
  select m.owner_id, p.display_name, cp.brand_name
    from team_members m join profiles p on p.id = m.owner_id left join creator_profiles cp on cp.user_id = m.owner_id
   where m.member_id = auth.uid() and p.suspended_at is null
   order by m.added_at
$$;

-- The owner's idea board, read-only, for a teammate (or the owner). Same rows the owner sees on /ideas.
create or replace function team_idea_board(p_owner uuid)
returns table (unlock_id uuid, brief_title text, hook_text text, format_label text, platform content_platform,
               multiplier numeric, stage text, board text, planned_on date, notes text, posted_url text,
               result_views bigint, result_multiple numeric, unlocked_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_owner <> auth.uid() and not exists (select 1 from team_members where owner_id = p_owner and member_id = auth.uid()) then
    raise exception 'TEAM_MEMBER_NOT_FOUND';
  end if;
  return query
    select u.id, b.title, s.hook_text, p.format_label, p.platform, p.multiplier,
           coalesce(t.stage, 'saved'), t.board, t.planned_on, t.notes, t.posted_url, t.result_views, t.result_multiple, u.created_at
      from unlocks u
      join briefs b on b.id = u.brief_id
      join pitches p on p.id = u.pitch_id
      join pitch_secrets s on s.pitch_id = u.pitch_id
      left join idea_tracking t on t.unlock_id = u.id
     where u.creator_id = p_owner and u.status <> 'reversed'
     order by u.created_at desc;
end $$;

revoke execute on function invite_teammate(text), accept_team_invite(uuid), remove_teammate(uuid), revoke_team_invite(uuid),
  leave_team(uuid), my_team(), teams_i_am_on(), team_idea_board(uuid) from public, anon;
grant execute on function invite_teammate(text), accept_team_invite(uuid), remove_teammate(uuid), revoke_team_invite(uuid),
  leave_team(uuid), my_team(), teams_i_am_on(), team_idea_board(uuid) to authenticated;

-- Suspended or closed accounts can't use or join teams.
create trigger team_members_not_suspended before insert on team_members for each row execute function block_suspended_actor();
create trigger team_invites_not_suspended before insert on team_invites for each row execute function block_suspended_actor();

-- Closing an account removes it from every team, on both sides.
create or replace function end_teams_on_close()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.suspended_reason = 'account_closed' and old.suspended_reason is distinct from 'account_closed' then
    delete from team_members where new.id in (owner_id, member_id);
    delete from team_invites where owner_id = new.id;
  end if;
  return new;
end $$;
revoke execute on function end_teams_on_close() from public, anon, authenticated;
create trigger profiles_end_teams after update of suspended_reason on profiles
  for each row execute function end_teams_on_close();
