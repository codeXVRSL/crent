-- Outlier Desk — launch hardening
-- 1) Rate limits  2) Admin two-step login (MFA)  3) Live chat (Realtime)  4) Profile photos

-- ---------------------------------------------------------------
-- 1. Rate limits (fixed window). Only the server (service role) may call these.
-- ---------------------------------------------------------------
create table if not exists rate_limits (
  key          text        not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (key, window_start)
);
alter table rate_limits enable row level security;   -- no policies: nobody reads it directly
revoke all on rate_limits from anon, authenticated;

-- Returns true while the caller is under p_max hits in the current window.
create or replace function rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  w timestamptz;
  n integer;
begin
  if p_key is null or p_max < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'INVALID_RATE_LIMIT';
  end if;
  w := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into rate_limits(key, window_start, hits) values (left(p_key, 200), w, 1)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into n;
  return n <= p_max;
end $$;

create or replace function purge_rate_limits()
returns integer language sql security definer set search_path = public as $$
  with d as (delete from rate_limits where window_start < now() - interval '1 day' returning 1)
  select count(*)::int from d
$$;

revoke execute on function rate_limit_hit(text, integer, integer), purge_rate_limits() from public, anon, authenticated;
grant  execute on function rate_limit_hit(text, integer, integer), purge_rate_limits() to service_role;

-- ---------------------------------------------------------------
-- 2. Admin two-step login. Admin powers need an aal2 session (password + authenticator code).
--    Break-glass if you lose your authenticator: update platform_settings set admin_mfa_required = false;
-- ---------------------------------------------------------------
alter table platform_settings add column if not exists admin_mfa_required boolean not null default true;

create or replace function jwt_aal()
returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', 'aal1')
$$;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and suspended_at is null)
     and (jwt_aal() = 'aal2'
          or not coalesce((select admin_mfa_required from platform_settings where id), true))
$$;

grant execute on function jwt_aal() to anon, authenticated, service_role;

-- Anyone who turned on two-step login must use an aal2 session for everything, not only admins.
create or replace function mfa_satisfied()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select auth.uid() is null
      or jwt_aal() = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;
grant execute on function mfa_satisfied() to anon, authenticated, service_role;

-- Runs before every database API request (PostgREST pre-request hook), so it also covers direct API calls
-- that skip the website: blocks unverified two-step sessions and caps writes per user.
create or replace function check_request()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if not mfa_satisfied() then
    raise exception 'MFA_REQUIRED' using errcode = '42501', hint = 'Enter your two-step code first.';
  end if;
  if coalesce(current_setting('request.method', true), 'GET') in ('POST', 'PATCH', 'PUT', 'DELETE') then
    begin
      if not rate_limit_hit('api-write:' || auth.uid()::text, 120, 60) then
        raise exception 'RATE_LIMITED' using errcode = '42501';
      end if;
    exception when read_only_sql_transaction then null;   -- read-only requests can't count; let them through
    end;
  end if;
end $$;
grant execute on function check_request() to anon, authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'alter role authenticator set pgrst.db_pre_request = ''public.check_request''';
    notify pgrst, 'reload config';
  end if;
end $$;

-- Realtime and Storage don't use the pre-request hook, so the same rule goes into their policies.
create policy "messages_mfa" on messages as restrictive for select to authenticated
  using ((select mfa_satisfied()));
create policy "storage_mfa" on storage.objects as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

-- The waitlist is joined only through the website's rate-limited server action (service role).
drop policy if exists "waitlist_insert" on waitlist;

-- ---------------------------------------------------------------
-- 3. Live chat: stream new messages over Supabase Realtime (RLS still decides who receives them).
-- ---------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;

-- ---------------------------------------------------------------
-- 4. Profile photos: public bucket, each user writes only inside their own folder.
-- ---------------------------------------------------------------
alter table profiles add column if not exists avatar_path text
  check (avatar_path is null
         or (avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,40}\.(jpg|png|webp)$'
             and split_part(avatar_path, '/', 1) = id::text));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "avatars_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_owner_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
-- The bucket is public, so photos load by URL without a read policy. Owners may read (list) only their own folder.
create policy "avatars_owner_read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- At most 5 files per person, so the public bucket can't be used as free file hosting.
create or replace function avatar_file_count(p_user uuid)
returns integer language plpgsql volatile security definer set search_path = public, storage as $$
declare n integer;
begin
  -- Serialise uploads per person so parallel uploads can't slip past the cap.
  perform pg_advisory_xact_lock(hashtext('avatars:' || p_user::text));
  select count(*)::int into n from storage.objects
   where bucket_id = 'avatars' and (storage.foldername(name))[1] = p_user::text;
  return n;
end $$;
revoke execute on function avatar_file_count(uuid) from public, anon;
grant execute on function avatar_file_count(uuid) to authenticated, service_role;
create policy "avatars_file_cap" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'avatars' or public.avatar_file_count(auth.uid()) < 5);

-- Expose the photo on public views (new columns go last so existing columns keep their order).
create or replace view public_profiles as
  select id, role, display_name, handle, country_code, created_at, avatar_path from profiles where suspended_at is null;

create or replace view public_cres as
  select pr.id, pr.display_name, pr.handle, pr.country_code, pr.created_at,
         c.headline, c.bio, c.platforms, c.years_experience, c.accepting_work,
         coalesce(array(select n.name from cre_niches cn join niches n on n.id = cn.niche_id
                         where cn.user_id = pr.id order by n.name), '{}') as niches,
         coalesce(array(select cn.niche_id from cre_niches cn where cn.user_id = pr.id), '{}') as niche_ids,
         s.pitches_sent, s.pitches_unlocked, s.unlock_rate_pct,
         r.avg_rating, coalesce(r.review_count, 0) as review_count,
         pr.avatar_path
    from profiles pr
    join cre_profiles c on c.user_id = pr.id and c.kyc_status = 'approved'
    left join cre_public_stats s on s.cre_id = pr.id
    left join review_stats r on r.reviewee_id = pr.id
   where pr.suspended_at is null;

revoke all on public_profiles, public_cres from anon, authenticated;
grant select on public_profiles, public_cres to anon, authenticated;
