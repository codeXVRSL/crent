-- Outlier Desk — repeat business on the platform
-- 1) Private briefs ("Work with again"): a creator can fund a brief that only one invited researcher
--    can see and pitch on. Same escrow, blind pitches and per-idea payment as public briefs.
-- 2) Repeat attempts to share contact details in chat warn the sender and alert admins.

alter table briefs add column if not exists invited_cre_id uuid references profiles(id);
create index if not exists briefs_invited_idx on briefs(invited_cre_id) where invited_cre_id is not null;

-- create_brief gains an optional invited researcher (replaces the 12-argument version).
drop function if exists create_brief(text, text, content_platform, int, text, text, text[], numeric, int, int, int, timestamptz);
create or replace function create_brief(
  p_title text, p_description text, p_platform content_platform, p_niche_id int,
  p_must_include text, p_avoid text, p_example_urls text[],
  p_min_multiplier numeric, p_max_video_age_days int,
  p_price_per_idea_cents int, p_max_unlocks int, p_deadline_at timestamptz,
  p_invited_cre_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare s platform_settings; v_id uuid; v_budget int; v_fee int; v_open int; m record;
begin
  if my_role() is distinct from 'creator' then raise exception 'NOT_CREATOR'; end if;
  select * into s from platform_settings where id;
  if p_price_per_idea_cents < s.min_price_per_idea_cents or p_price_per_idea_cents > s.max_price_per_idea_cents then
    raise exception 'PRICE_OUT_OF_RANGE'; end if;
  if p_max_unlocks < 1 or p_max_unlocks > 100 then raise exception 'MAX_UNLOCKS_OUT_OF_RANGE'; end if;
  if p_deadline_at < now() + interval '23 hours' or p_deadline_at > now() + interval '31 days' then
    raise exception 'DEADLINE_OUT_OF_RANGE'; end if;
  select count(*) into v_open from briefs where creator_id = auth.uid() and status in ('awaiting_payment','open');
  if v_open >= s.max_open_briefs_per_creator then raise exception 'TOO_MANY_OPEN_BRIEFS'; end if;
  if p_invited_cre_id is not null and not exists (
       select 1 from cre_profiles c join profiles pr on pr.id = c.user_id
        where c.user_id = p_invited_cre_id and c.kyc_status = 'approved' and c.accepting_work
          and pr.role = 'cre' and pr.suspended_at is null) then
    raise exception 'INVITED_CRE_NOT_AVAILABLE';
  end if;
  select * into m from mask_contacts(coalesce(p_title,'') || ' ' || coalesce(p_description,'') || ' ' ||
                                     coalesce(p_must_include,'') || ' ' || coalesce(p_avoid,''));
  if m.hit then raise exception 'CONTACT_DETAILS_NOT_ALLOWED'; end if;

  v_budget := p_price_per_idea_cents * p_max_unlocks;
  v_fee    := fee_cents(v_budget, s.creator_fee_bps);
  insert into briefs(creator_id, title, description, platform, niche_id, must_include, avoid, example_urls,
                     min_multiplier, max_video_age_days, currency, price_per_idea_cents, max_unlocks,
                     creator_fee_bps, cre_fee_bps, creator_fee_cents, total_charge_cents, deadline_at, invited_cre_id)
  values (auth.uid(), btrim(p_title), btrim(p_description), p_platform, p_niche_id,
          nullif(btrim(p_must_include),''), nullif(btrim(p_avoid),''), coalesce(p_example_urls,'{}'),
          greatest(coalesce(p_min_multiplier, s.min_multiplier), s.min_multiplier), p_max_video_age_days,
          s.default_currency, p_price_per_idea_cents, p_max_unlocks, s.creator_fee_bps, s.cre_fee_bps,
          v_fee, v_budget + v_fee, p_deadline_at, p_invited_cre_id)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function create_brief(text, text, content_platform, int, text, text, text[], numeric, int, int, int, timestamptz, uuid) from public, anon;
grant execute on function create_brief(text, text, content_platform, int, text, text, text[], numeric, int, int, int, timestamptz, uuid) to authenticated;

-- Private briefs are visible only to the invited researcher (and the owner/admin through other policies).
drop policy if exists "briefs_cre_read" on briefs;
create policy "briefs_cre_read" on briefs for select to authenticated
  using (status in ('open','closed','settled') and is_verified_cre()
         and (invited_cre_id is null or invited_cre_id = auth.uid()));

-- Only the invited researcher can pitch on a private brief, however the pitch is inserted.
create or replace function pitches_private_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_invited uuid;
begin
  select invited_cre_id into v_invited from briefs where id = new.brief_id;
  if v_invited is not null and v_invited <> new.cre_id then raise exception 'BRIEF_NOT_FOUND'; end if;
  return new;
end $$;
drop trigger if exists pitches_private_guard on pitches;
create trigger pitches_private_guard before insert on pitches for each row execute function pitches_private_guard();

-- Payment opens the brief: public briefs notify researchers in the niche; private ones only the invitee.
create or replace function mark_payment_paid(p_external_id text, p_provider_ref text, p_amount_cents int, p_method text)
returns text language plpgsql security definer set search_path = public as $$
declare pay payments; b briefs;
begin
  select * into pay from payments where external_id = p_external_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if pay.status = 'paid' then return 'already_paid'; end if;
  if p_amount_cents is not null and p_amount_cents <> pay.amount_cents then raise exception 'AMOUNT_MISMATCH'; end if;
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

-- Chat: same masking as before, plus escalation on repeated attempts.
create or replace function messages_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record; t threads; v_recent int;
begin
  select * into t from threads where id = new.thread_id;
  if new.sender_id <> t.creator_id and new.sender_id <> t.cre_id then raise exception 'NOT_THREAD_MEMBER'; end if;
  select * into m from mask_contacts(new.body);
  if m.hit then
    insert into flags(kind, subject_user, entity_type, entity_id, excerpt)
    values ('contact_leak', new.sender_id, 'thread', new.thread_id::text, left(new.body, 1000));
    -- Repeated attempts to move off-platform: warn the sender and alert admins (once per 30 days at 3 attempts).
    select count(*) into v_recent from flags
     where kind = 'contact_leak' and subject_user = new.sender_id and created_at > now() - interval '30 days';
    if v_recent = 3 then
      perform notify(new.sender_id, 'policy_warning', 'Keep deals on Outlier Desk',
        'Contact details are hidden in chat. Moving work off the platform breaks the Terms and can get your account suspended. You also lose escrow, disputes and reviews.',
        '/legal/terms');
      insert into notifications(user_id, kind, title, body, link)
      select p.id, 'circumvention_risk', 'Possible off-platform deal',
             'A user tried to share contact details 3 times in 30 days. Review their flags.', '/admin/flags'
        from profiles p where p.role = 'admin' and p.suspended_at is null;
    end if;
  end if;
  new.body := m.masked;
  new.was_masked := m.hit;
  new.read_at := null;
  new.created_at := now();
  return new;
end $$;
