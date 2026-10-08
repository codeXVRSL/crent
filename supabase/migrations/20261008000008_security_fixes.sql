-- Outlier Desk — security and money-integrity fixes from the October review.

-- ---------------------------------------------------------------
-- 1. Admin powers require two-factor (aal2) at the database too, not only in the app's pages.
--    Without this, an admin password alone gave a token that could call admin functions and read
--    ID documents straight through the API. Operators can switch it off for a local test database
--    only:  update platform_settings set admin_mfa_required = false;
-- ---------------------------------------------------------------
alter table platform_settings add column if not exists admin_mfa_required boolean not null default true;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and suspended_at is null)
     and (coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
          or not coalesce((select admin_mfa_required from platform_settings where id), true))
$$;

-- ---------------------------------------------------------------
-- 2. Creators could read source_key (an unsalted hash of platform:video_id) on locked pitches and
--    match candidate videos against it before paying. Only the database itself needs that column.
-- ---------------------------------------------------------------
revoke select on pitches from anon, authenticated;
grant select (id, brief_id, cre_id, status, platform, format_label, duration_seconds, hook_category, teaser,
              source_views, channel_median_views, multiplier, source_posted_on, source_channel_size_band,
              submitted_at, unlocked_at) on pitches to authenticated;

-- ---------------------------------------------------------------
-- 3. A dispute resolved for the researcher after the hold ended skipped the hold_release ledger entry.
-- ---------------------------------------------------------------
create or replace function resolve_dispute(p_dispute_id uuid, p_for_creator boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare d disputes; u unlocks; b briefs; pay payments; v_fee_part int;
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
  select * into d from disputes where id = p_dispute_id for update;
  if not found or d.status in ('resolved_creator','resolved_cre') then raise exception 'DISPUTE_NOT_OPEN'; end if;
  select * into u from unlocks where id = d.unlock_id for update;
  select * into b from briefs where id = u.brief_id for update;

  if p_for_creator then
    update unlocks set status = 'reversed' where id = u.id;
    update pitches set status = 'refunded' where id = u.pitch_id;
    insert into ledger_entries(kind, currency, amount_cents, debit_account, credit_account, brief_id, unlock_id, note)
    values ('dispute_reversal', u.currency, u.net_cents, 'cre:' || u.cre_id || ':held', 'escrow:brief:' || b.id, b.id, u.id, 'net');
    if u.cre_fee_cents > 0 then
      insert into ledger_entries(kind, currency, amount_cents, debit_account, credit_account, brief_id, unlock_id, note)
      values ('dispute_reversal', u.currency, u.cre_fee_cents, 'platform:revenue', 'escrow:brief:' || b.id, b.id, u.id, 'fee');
    end if;
    if b.status = 'open' then
      update briefs set unlocks_used = unlocks_used - 1 where id = b.id;   -- budget goes back to the brief
    else
      v_fee_part := least(fee_cents(u.gross_cents, b.creator_fee_bps),
                          b.creator_fee_cents - coalesce((select sum(fee_part_cents) from refunds where brief_id = b.id), 0));
      select * into pay from payments where brief_id = b.id and status in ('paid','partially_refunded') order by paid_at limit 1;
      insert into refunds(payment_id, brief_id, amount_cents, fee_part_cents, reason)
      values (pay.id, b.id, u.gross_cents + greatest(v_fee_part,0), greatest(v_fee_part,0), 'dispute');
      update briefs set status = 'closed', settled_at = null where id = b.id and status = 'settled';
    end if;
    update disputes set status = 'resolved_creator', resolution_note = p_note, resolved_by = auth.uid(), resolved_at = now() where id = d.id;
  else
    -- Back to held; if the hold already ended, release it now with its ledger entry (held → available),
    -- exactly as release_holds() would, so the researcher's balances stay in step with the ledger.
    if u.available_at <= now() then
      update unlocks set status = 'available' where id = u.id;
      insert into ledger_entries(kind, currency, amount_cents, debit_account, credit_account, unlock_id, brief_id)
      values ('hold_release', u.currency, u.net_cents, 'cre:' || u.cre_id || ':held', 'cre:' || u.cre_id || ':available', u.id, u.brief_id);
    else
      update unlocks set status = 'held' where id = u.id;
    end if;
    update disputes set status = 'resolved_cre', resolution_note = p_note, resolved_by = auth.uid(), resolved_at = now() where id = d.id;
  end if;
  perform audit('dispute.resolve', 'dispute', d.id::text, jsonb_build_object('for_creator', p_for_creator, 'note', p_note));
  perform notify(u.creator_id, 'dispute_resolved', 'Dispute resolved', p_note, '/disputes/' || d.id);
  perform notify(u.cre_id, 'dispute_resolved', 'Dispute resolved', p_note, '/disputes/' || d.id);
end $$;

-- ---------------------------------------------------------------
-- 4. Each payout attempt gets its own number, so re-approving a failed payout sends a new transfer
--    instead of the provider replaying the first attempt under the same idempotency key.
-- ---------------------------------------------------------------
alter table payouts add column if not exists attempt integer not null default 0;
create or replace function approve_payout(p_payout_id uuid, p_fx_rate numeric)
returns void language plpgsql security definer set search_path = public as $$
declare po payouts;
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
  select * into po from payouts where id = p_payout_id for update;
  if po.status not in ('requested','failed') then raise exception 'PAYOUT_NOT_APPROVABLE'; end if;
  update payouts set status = 'processing', approved_by = auth.uid(), fx_rate = p_fx_rate,
         amount_local_cents = case when p_fx_rate is null then null else round(po.amount_cents * p_fx_rate)::int end,
         failure_reason = null, attempt = attempt + 1
   where id = po.id;
  perform audit('payout.approve', 'payout', po.id::text, jsonb_build_object('fx_rate', p_fx_rate, 'amount_cents', po.amount_cents));
end $$;

-- ---------------------------------------------------------------
-- 5. Suspended accounts can't open or answer disputes, review, message, start threads or receive
--    new unlocks. Enforced with triggers so every path (functions and direct inserts) is covered.
--    Only applies to signed-in callers; the service role (auth.uid() is null) is unaffected.
-- ---------------------------------------------------------------
create or replace function is_suspended(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_user and suspended_at is not null)
$$;

create or replace function block_suspended_actor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and is_suspended(auth.uid()) then raise exception 'ACCOUNT_SUSPENDED'; end if;
  return new;
end $$;

drop trigger if exists disputes_not_suspended on disputes;
create trigger disputes_not_suspended before insert or update on disputes for each row execute function block_suspended_actor();
drop trigger if exists reviews_not_suspended on reviews;
create trigger reviews_not_suspended before insert on reviews for each row execute function block_suspended_actor();
drop trigger if exists messages_not_suspended on messages;
create trigger messages_not_suspended before insert on messages for each row execute function block_suspended_actor();
drop trigger if exists threads_not_suspended on threads;
create trigger threads_not_suspended before insert on threads for each row execute function block_suspended_actor();

-- A creator can't unlock (and pay) a pitch from a researcher who has since been suspended.
create or replace function block_unlock_suspended()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and is_suspended(auth.uid()) then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if is_suspended(new.cre_id) then raise exception 'CRE_SUSPENDED'; end if;
  return new;
end $$;
drop trigger if exists unlocks_not_suspended on unlocks;
create trigger unlocks_not_suspended before insert on unlocks for each row execute function block_unlock_suspended();

-- ---------------------------------------------------------------
-- 6. Switching the default payout method silently did nothing (no update policy), leaving every
--    method marked default. Done here instead, without opening up updates to account details.
-- ---------------------------------------------------------------
create or replace function make_default_payout_method(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from payout_methods where id = p_id and user_id = auth.uid()) then raise exception 'NOT_FOUND'; end if;
  update payout_methods set is_default = (id = p_id) where user_id = auth.uid();
end $$;
revoke execute on function make_default_payout_method(uuid) from public, anon;
grant execute on function make_default_payout_method(uuid) to authenticated;
-- Repair existing data: keep only the newest method per person as default.
update payout_methods pm set is_default = (pm.id = (select id from payout_methods x where x.user_id = pm.user_id order by created_at desc limit 1));

revoke execute on function is_suspended(uuid) from public, anon;
revoke execute on function block_suspended_actor() from public, anon, authenticated;
revoke execute on function block_unlock_suspended() from public, anon, authenticated;
