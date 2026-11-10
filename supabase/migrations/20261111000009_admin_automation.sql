-- Outlier Desk — support for the n8n admin workflows (automation/n8n).
-- admin_alert_log remembers which events were already emailed, so every alert is sent exactly once.
create table if not exists admin_alert_log (
  kind      text        not null check (char_length(kind) <= 40),
  entity_id text        not null check (char_length(entity_id) <= 200),
  sent_at   timestamptz not null default now(),
  primary key (kind, entity_id)
);
alter table admin_alert_log enable row level security;   -- no policies: only the automation role / service role use it
revoke all on admin_alert_log from anon, authenticated;

-- A read-mostly database role for n8n. Create its LOGIN user yourself so the password never lives in git:
--   create role n8n_admin login password '<strong password>' in role outlier_automation;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'outlier_automation') then
    create role outlier_automation nologin;
  end if;
end $$;
grant usage on schema public to outlier_automation;
grant select on profiles, cre_profiles, kyc_submissions, briefs, pitches, pitch_secrets, unlocks, payouts,
                refunds, disputes, flags, feedback, ledger_entries, platform_settings to outlier_automation;
grant select, insert on admin_alert_log to outlier_automation;
grant insert on flags to outlier_automation;   -- the AI spot-check files findings as flags
-- Row Level Security still applies to this role: let it read what the admin workflows need.
do $$
declare t text;
begin
  foreach t in array array['profiles','cre_profiles','kyc_submissions','briefs','pitches','pitch_secrets','unlocks',
                           'payouts','refunds','disputes','flags','feedback','ledger_entries','platform_settings'] loop
    execute format('drop policy if exists "automation_read" on %I', t);
    execute format('create policy "automation_read" on %I for select to outlier_automation using (true)', t);
  end loop;
end $$;
drop policy if exists "automation_flags_insert" on flags;
create policy "automation_flags_insert" on flags for insert to outlier_automation with check (true);
drop policy if exists "automation_log" on admin_alert_log;
create policy "automation_log" on admin_alert_log for all to outlier_automation using (true) with check (true);
