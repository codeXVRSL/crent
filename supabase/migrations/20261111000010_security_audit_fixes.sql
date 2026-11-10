-- Outlier Desk — fixes from the pre-launch security audit.

-- C1: a payment event must carry the paid amount.
create or replace function mark_payment_paid(p_external_id text, p_provider_ref text, p_amount_cents int, p_method text)
returns text language plpgsql security definer set search_path = public as $$
declare pay payments; b briefs;
begin
  select * into pay from payments where external_id = p_external_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if pay.status = 'paid' then return 'already_paid'; end if;
  -- The provider must always say how much was paid; a missing amount is treated as a forged or broken event.
  if p_amount_cents is null then raise exception 'AMOUNT_REQUIRED'; end if;
  if p_amount_cents <> pay.amount_cents then raise exception 'AMOUNT_MISMATCH'; end if;
  select * into b from briefs where id = pay.brief_id for update;

  update payments set status = 'paid', paid_at = now(),
         provider_ref = coalesce(p_provider_ref, provider_ref), method = p_method
   where id = pay.id;
  insert into ledger_entries(kind, currency, amount_cents, debit_account, credit_account, brief_id, payment_id)
  values ('brief_funding', b.currency, b.budget_cents, 'external', 'escrow:brief:' || b.id, b.id, pay.id);
  if b.creator_fee_cents > 0 then
    insert into ledger_entries(kind, currency, amount_cents, debit_account, credit_account, brief_id, payment_id)
    values ('creator_fee', b.currency, b.creator_fee_cents, 'external', 'platform:revenue', b.id, pay.id);
  end if;

  if b.status in ('draft','awaiting_payment') then
    update briefs set status = 'open', opened_at = now() where id = b.id;
    perform notify(b.creator_id, 'brief_funded', 'Your brief is live', b.title, '/briefs/' || b.id);
    -- tell matching verified CREs
    insert into notifications(user_id, kind, title, body, link)
    select distinct c.user_id, 'new_brief',
           'New brief: ' || b.title, money_text(b.price_per_idea_cents, b.currency) || ' per idea',
           '/briefs/' || b.id
      from cre_profiles c
      join profiles pr on pr.id = c.user_id and pr.suspended_at is null
      join cre_niches cn on cn.user_id = c.user_id and cn.niche_id = b.niche_id
     where c.kyc_status = 'approved' and c.accepting_work and b.invited_cre_id is null;
    -- private brief: only the invited researcher hears about it
    if b.invited_cre_id is not null then
      perform notify(b.invited_cre_id, 'private_brief', 'Private brief for you: ' || b.title,
                     money_text(b.price_per_idea_cents, b.currency) || ' per idea. Only you can see and pitch on this brief.',
                     '/briefs/' || b.id);
    end if;
    return 'opened';
  else
    -- Paid after the brief was cancelled: refund in full.
    insert into refunds(payment_id, brief_id, amount_cents, fee_part_cents, reason)
    values (pay.id, b.id, pay.amount_cents, b.creator_fee_cents, 'cancelled');
    return 'refund_queued';
  end if;
end $$;

-- M1: payout accounts. Adding one needs a login in the last 15 minutes (checked on the auth token),
-- and switching accounts after a past payout has a 72-hour cooling-off before withdrawing.
create or replace function recent_login(p_minutes int)
returns boolean language sql stable as $$
  select coalesce((
    select max((a ->> 'timestamp')::bigint)
      from jsonb_array_elements(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'amr', '[]'::jsonb)) a
  ), 0) > extract(epoch from now()) - p_minutes * 60
$$;
grant execute on function recent_login(int) to authenticated, service_role;
create policy "pm_recent_login" on payout_methods as restrictive for insert to authenticated
  with check (recent_login(15));

create or replace function request_payout(p_method_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare s platform_settings; v_total int; v_id uuid; v_currency char(3);
begin
  if my_role() is distinct from 'cre' then raise exception 'NOT_CRE'; end if;
  if not exists (select 1 from cre_profiles where user_id = auth.uid() and kyc_status = 'approved') then
    raise exception 'NOT_VERIFIED'; end if;
  if not exists (select 1 from payout_methods where id = p_method_id and user_id = auth.uid()) then
    raise exception 'PAYOUT_METHOD_NOT_FOUND'; end if;
  -- A researcher who has been paid before and switches to a new account must wait 72 hours, so a
  -- hijacked account can't redirect earnings straight away (the owner is emailed when a method is added).
  if exists (select 1 from payouts where cre_id = auth.uid() and status = 'paid')
     and exists (select 1 from payout_methods where id = p_method_id and created_at > now() - interval '72 hours') then
    raise exception 'PAYOUT_METHOD_TOO_NEW'; end if;
  if exists (select 1 from payouts where cre_id = auth.uid() and status in ('requested','processing')) then
    raise exception 'PAYOUT_ALREADY_PENDING'; end if;
  select * into s from platform_settings where id;
  perform 1 from unlocks where cre_id = auth.uid() and status = 'available' and payout_id is null for update;
  select coalesce(sum(net_cents),0), min(currency) into v_total, v_currency
    from unlocks where cre_id = auth.uid() and status = 'available' and payout_id is null;
  if v_total < s.min_payout_cents then raise exception 'BELOW_MIN_PAYOUT'; end if;
  insert into payouts(cre_id, method_id, currency, amount_cents)
  values (auth.uid(), p_method_id, v_currency, v_total) returning id into v_id;
  update unlocks set payout_id = v_id where cre_id = auth.uid() and status = 'available' and payout_id is null;
  insert into notifications(user_id, kind, title, body, link)
  select id, 'payout_requested', 'Payout requested', money_text(v_total, v_currency), '/admin/payouts' from profiles where role = 'admin';
  return v_id;
end $$;

-- L1: FX rate sanity range on payout approval.
create or replace function approve_payout(p_payout_id uuid, p_fx_rate numeric)
returns void language plpgsql security definer set search_path = public as $$
declare po payouts;
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
  -- USD→PHP sanity range: catches a typo like 5850 instead of 58.50 that would send 100× the amount.
  if p_fx_rate is not null and (p_fx_rate < 30 or p_fx_rate > 100) then raise exception 'FX_RATE_OUT_OF_RANGE'; end if;
  select * into po from payouts where id = p_payout_id for update;
  if po.status not in ('requested','failed') then raise exception 'PAYOUT_NOT_APPROVABLE'; end if;
  update payouts set status = 'processing', approved_by = auth.uid(), fx_rate = p_fx_rate,
         amount_local_cents = case when p_fx_rate is null then null else round(po.amount_cents * p_fx_rate)::int end,
         failure_reason = null
   where id = po.id;
  perform audit('payout.approve', 'payout', po.id::text, jsonb_build_object('fx_rate', p_fx_rate, 'amount_cents', po.amount_cents));
end $$;

-- L3: per-person file caps on private uploads (ID photos, pitch proof), like the photo cap.
create or replace function storage_file_count(p_bucket text, p_user uuid)
returns integer language plpgsql volatile security definer set search_path = public, storage as $$
declare n integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_bucket || ':' || p_user::text));
  select count(*)::int into n from storage.objects where bucket_id = p_bucket and (storage.foldername(name))[1] = p_user::text;
  return n;
end $$;
revoke execute on function storage_file_count(text, uuid) from public, anon;
grant execute on function storage_file_count(text, uuid) to authenticated, service_role;
create policy "kyc_file_cap" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'kyc' or public.storage_file_count('kyc', auth.uid()) < 10);
create policy "proof_file_cap" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'pitch-proof' or public.storage_file_count('pitch-proof', auth.uid()) < 300);

-- L4: links must be https (blocks javascript: and other schemes written straight through the API).
-- NOT VALID: existing rows are left alone; every new or edited row is checked.
create or replace function all_https(p text[])
returns boolean language sql immutable as $$
  select coalesce(bool_and(u ~ '^https://[^\s]+$'), true) from unnest(coalesce(p, '{}')) u
$$;
alter table briefs add constraint briefs_example_urls_https check (all_https(example_urls)) not valid;
alter table portfolio_items add constraint portfolio_source_https check (source_url ~ '^https://') not valid;
alter table creator_profiles add constraint creator_channel_https check (channel_url is null or channel_url = '' or channel_url ~ '^https://') not valid;
alter table pitch_secrets add constraint secrets_source_https check (source_url ~ '^https://') not valid;
alter table pitch_secrets add constraint secrets_channel_https check (source_channel_url is null or source_channel_url = '' or source_channel_url ~ '^https://') not valid;

-- L5: public views stop listing admin accounts and suspended creators.
create or replace view public_profiles as
  select id, role, display_name, handle, country_code, created_at, avatar_path
    from profiles where suspended_at is null and role is distinct from 'admin';
create or replace view public_creators as
  select pr.id, pr.display_name, pr.handle, c.brand_name, c.main_platform, c.is_agency,
         coalesce(s.briefs_posted, 0) as briefs_posted, s.unlock_rate_pct, coalesce(s.disputes_opened, 0) as disputes_opened,
         r.avg_rating, coalesce(r.review_count, 0) as review_count
    from profiles pr
    join creator_profiles c on c.user_id = pr.id
    left join creator_public_stats s on s.creator_id = pr.id
    left join review_stats r on r.reviewee_id = pr.id
   where pr.suspended_at is null;
revoke all on public_profiles, public_creators from anon, authenticated;
grant select on public_profiles, public_creators to anon, authenticated;

-- M2: the n8n role sees only what its workflows use from ID verification (no names, addresses, IDs).
revoke select on kyc_submissions from outlier_automation;
grant select (user_id, submitted_at) on kyc_submissions to outlier_automation;
-- H1: let the live-alerts workflow see stuck payment webhooks (type and error only, not payloads).
grant select (id, provider, type, error, processed_at, received_at) on webhook_events to outlier_automation;
drop policy if exists "automation_read" on webhook_events;
create policy "automation_read" on webhook_events for select to outlier_automation using (true);
