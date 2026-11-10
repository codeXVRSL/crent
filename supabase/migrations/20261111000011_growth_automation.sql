-- Outlier Desk — growth automations run by n8n: website chat assistant, waitlist welcome emails,
-- one-time onboarding nudges. The n8n role gets only the columns these workflows use.

-- Waitlist: where the signup came from, and when the welcome email went out.
alter table waitlist add column if not exists source text not null default 'site' check (source in ('site', 'chat'));
alter table waitlist add column if not exists welcomed_at timestamptz;
-- Everyone already on the list before this change counts as welcomed, so nobody gets a surprise email.
update waitlist set welcomed_at = now() where welcomed_at is null;

grant select (id, email, side, source, created_at, welcomed_at) on waitlist to outlier_automation;
grant insert (email, side, source) on waitlist to outlier_automation;   -- the chat assistant can add a visitor
grant update (welcomed_at) on waitlist to outlier_automation;
grant usage on sequence waitlist_id_seq to outlier_automation;
drop policy if exists "automation_read" on waitlist;
drop policy if exists "automation_chat_join" on waitlist;
drop policy if exists "automation_welcome" on waitlist;
create policy "automation_read" on waitlist for select to outlier_automation using (true);
create policy "automation_chat_join" on waitlist for insert to outlier_automation with check (source = 'chat' and welcomed_at is null);
create policy "automation_welcome" on waitlist for update to outlier_automation using (true) with check (true);

-- Nudges read whether people finished their profile.
grant select on creator_profiles to outlier_automation;
drop policy if exists "automation_read" on creator_profiles;
create policy "automation_read" on creator_profiles for select to outlier_automation using (true);

-- Login emails for the nudge workflow. Only confirmed addresses, only for this role; the app's API roles can't see it.
create or replace view automation_user_contacts as
  select u.id, u.email, u.created_at
    from auth.users u
   where u.email is not null and u.email_confirmed_at is not null;
revoke all on automation_user_contacts from public, anon, authenticated;
grant select on automation_user_contacts to outlier_automation;
