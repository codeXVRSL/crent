-- Outlier Desk — researcher brief alerts and creator persona.

-- 1. Researchers choose which new briefs notify them: a minimum price per idea and, optionally, platforms.
--    Briefs stay visible in the feed either way; only the notification is filtered.
alter table cre_profiles add column if not exists alert_min_price_cents integer not null default 0
  check (alert_min_price_cents between 0 and 50000);
alter table cre_profiles add column if not exists alert_platforms content_platform[] not null default '{}';

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
     where c.kyc_status = 'approved' and c.accepting_work
       -- the researcher's own alert filters: a minimum price per idea and, optionally, only some platforms
       and b.price_per_idea_cents >= coalesce(c.alert_min_price_cents, 0)
       and (cardinality(c.alert_platforms) = 0 or b.platform = any(c.alert_platforms));
    return 'opened';
  else
    -- Paid after the brief was cancelled: refund in full.
    insert into refunds(payment_id, brief_id, amount_cents, fee_part_cents, reason)
    values (pay.id, b.id, pay.amount_cents, b.creator_fee_cents, 'cancelled');
    return 'refund_queued';
  end if;
end $$;

-- 2. Creator persona: saved once, prefilled into every new brief and the AI script prompt.
alter table creator_profiles add column if not exists audience text check (char_length(audience) <= 300);
alter table creator_profiles add column if not exists voice text check (char_length(voice) <= 300);
alter table creator_profiles add column if not exists avoid_topics text check (char_length(avoid_topics) <= 300);
