-- Outlier Desk — tester feedback inbox and pitch proof screenshots

-- ---------------------------------------------------------------
-- Feedback: anyone signed in can send; only admins read.
-- ---------------------------------------------------------------
create table feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null check (kind in ('bug','idea','confusing','other')),
  page       text check (char_length(page) <= 300),
  message    text not null check (char_length(message) between 5 and 4000),
  status     text not null default 'new' check (status in ('new','seen','done')),
  created_at timestamptz not null default now()
);
create index feedback_created_idx on feedback(created_at desc);
alter table feedback enable row level security;
create policy "admin_read_all" on feedback for select to authenticated using (is_admin());
create policy "feedback_own_insert" on feedback for insert to authenticated with check (user_id = auth.uid());

create or replace function set_feedback_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
  update feedback set status = p_status where id = p_id;
end $$;
revoke execute on function set_feedback_status(uuid, text) from public, anon;
grant execute on function set_feedback_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------
-- Proof screenshot on pitches (private; shown after unlock)
-- ---------------------------------------------------------------
alter table pitch_secrets add column proof_path text check (proof_path is null or char_length(proof_path) <= 300);

-- The researcher attaches proof to their own pitch while it's still waiting.
create or replace function attach_pitch_proof(p_pitch_id uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_path !~ ('^' || auth.uid()::text || '/') then raise exception 'INVALID_UPLOAD_PATH'; end if;
  update pitch_secrets s set proof_path = p_path
    from pitches p
   where s.pitch_id = p.id and p.id = p_pitch_id and p.cre_id = auth.uid() and p.status = 'submitted';
  if not found then raise exception 'PITCH_NOT_AVAILABLE'; end if;
end $$;
revoke execute on function attach_pitch_proof(uuid, text) from public, anon;
grant execute on function attach_pitch_proof(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pitch-proof', 'pitch-proof', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "proof_owner_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'pitch-proof' and (storage.foldername(name))[1] = auth.uid()::text);

-- Readable by the uploader, admins, and the creator once they've unlocked the pitch it belongs to.
create policy "proof_read" on storage.objects for select to authenticated
  using (bucket_id = 'pitch-proof' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.pitch_secrets s join public.unlocks u on u.pitch_id = s.pitch_id
                where s.proof_path = storage.objects.name and u.creator_id = auth.uid() and u.status <> 'reversed')
  ));
