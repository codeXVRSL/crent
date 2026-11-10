-- Outlier Desk — protect researchers' ideas from creators who browse pitches and never pay.
-- 1) Guaranteed first unlock: a brief that received pitches can't close with zero unlocks;
--    the highest-scoring pitch is unlocked (and paid) automatically when the creator closes early
--    or the deadline passes. Admin closes are exempt.
-- 2) Locked pitch cards show rounded numbers (views to 2 significant figures, month instead of
--    exact date, length to the nearest 5 seconds), so the source video can't be found by search.
--    Creators read pitches only through creator_pitch_cards; exact numbers appear after unlock.

alter table platform_settings add column if not exists guarantee_first_unlock boolean not null default true;

-- ---------------------------------------------------------------
-- Shared unlock bookkeeping (no permission checks; callers must check and hold row locks).
-- ---------------------------------------------------------------
create or replace function _unlock_pitch_core(p_pitch_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare p pitches; b briefs; s platform_settings; v_fee int; v_net int; v_unlock uuid;
begin
  select * into p from pitches where id = p_pitch_id for update;
  select * into b from briefs where id = p.brief_id for update;
  select * into s from platform_settings where id;

  v_fee := fee_cents(b.price_per_idea_cents, b.cre_fee_bps);
  v_net := b.price_per_idea_cents - v_fee;

  insert into unlocks(pitch_id, brief_id, creator_id, cre_id, currency, gross_cents, cre_fee_cents, net_cents, status, available_at)
  values (p.id, b.id, b.creator_id, p.cre_id, b.currency, b.price_per_idea_cents, v_fee, v_net, 'held',
          now() + make_interval(hours => s.hold_hours))
  returning id into v_unlock;

  update pitches set status = 'unlocked', unlocked_at = now() where id = p.id;
  update briefs  set unlocks_used = unlocks_used + 1 where id = b.id;

  insert into ledger_entries(kind, currency, amount_cents, debit_account, credit_account, brief_id, unlock_id)
  values ('unlock_gross', b.currency, b.price_per_idea_cents, 'escrow:brief:' || b.id, 'cre:' || p.cre_id || ':held', b.id, v_unlock);
  if v_fee > 0 then
    insert into ledger_entries(kind, currency, amount_cents, debit_account, credit_account, brief_id, unlock_id)
    values ('cre_fee', b.currency, v_fee, 'cre:' || p.cre_id || ':held', 'platform:revenue', b.id, v_unlock);
  end if;

  perform notify(p.cre_id, 'pitch_unlocked', 'Your pitch was unlocked',
                 'You earned ' || money_text(v_net, b.currency) || '. It becomes available after the ' || s.hold_hours || '-hour hold.',
                 '/pitches/' || p.id);
  return v_unlock;
end $$;
revoke execute on function _unlock_pitch_core(uuid) from public, anon, authenticated;

create or replace function unlock_pitch(p_pitch_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare p pitches; b briefs; v_unlock uuid; v_brief uuid;
begin
  -- Lock order everywhere: brief first, then its pitches (matches _close_brief, so they can't deadlock).
  select brief_id into v_brief from pitches where id = p_pitch_id;
  if not found then raise exception 'PITCH_NOT_FOUND'; end if;
  select * into b from briefs where id = v_brief for update;
  select * into p from pitches where id = p_pitch_id for update;
  if b.creator_id <> auth.uid() or my_role() is distinct from 'creator' then raise exception 'NOT_BRIEF_OWNER'; end if;
  if b.status <> 'open' then raise exception 'BRIEF_NOT_OPEN'; end if;
  if p.status <> 'submitted' then raise exception 'PITCH_NOT_AVAILABLE'; end if;
  if b.unlocks_used >= b.max_unlocks then raise exception 'NO_UNLOCKS_LEFT'; end if;

  v_unlock := _unlock_pitch_core(p.id);

  if b.unlocks_used + 1 >= b.max_unlocks then
    perform _close_brief(b.id, 'max_unlocks');
  end if;
  return v_unlock;
end $$;

-- Internal close. Unlocks the top pitch first when the brief got pitches but none were unlocked,
-- then stops pitching, expires waiting pitches and queues the refund of unused budget + its fee.
create or replace function _close_brief(p_brief_id uuid, p_reason text)
returns integer language plpgsql security definer set search_path = public as $$
declare b briefs; pay payments; top pitches; v_unused_budget int; v_fee_refund int;
begin
  select * into b from briefs where id = p_brief_id for update;
  if b.status <> 'open' then return 0; end if;

  -- Only when nothing was ever unlocked on this brief (a creator who won a dispute isn't charged again),
  -- and only pitches from researchers who are still verified and not suspended.
  if p_reason in ('creator_closed', 'deadline')
     and not exists (select 1 from unlocks where brief_id = b.id)
     and coalesce((select guarantee_first_unlock from platform_settings where id), true) then
    select p.* into top from pitches p
      join profiles pr on pr.id = p.cre_id and pr.suspended_at is null
      join cre_profiles c on c.user_id = p.cre_id and c.kyc_status = 'approved'
     where p.brief_id = b.id and p.status = 'submitted'
     order by p.multiplier desc, p.submitted_at limit 1 for update of p;
    if found then
      perform _unlock_pitch_core(top.id);
      perform notify(b.creator_id, 'pitch_auto_unlocked', 'We unlocked your top pitch',
        'Briefs that receive pitches include at least one idea, so the highest-scoring pitch ('
        || top.format_label || ') was unlocked when the brief closed.', '/unlocks');
      select * into b from briefs where id = p_brief_id;
    end if;
  end if;

  update briefs set status = 'closed', closed_at = now(), close_reason = p_reason where id = b.id;
  update pitches set status = 'expired' where brief_id = b.id and status = 'submitted';
  v_unused_budget := (b.max_unlocks - b.unlocks_used) * b.price_per_idea_cents;
  v_fee_refund    := b.creator_fee_cents - fee_cents(b.unlocks_used * b.price_per_idea_cents, b.creator_fee_bps);
  if v_unused_budget > 0 then
    select * into pay from payments where brief_id = b.id and status = 'paid' order by paid_at limit 1;
    insert into refunds(payment_id, brief_id, amount_cents, fee_part_cents, reason)
    values (pay.id, b.id, v_unused_budget + v_fee_refund, v_fee_refund, 'unused_budget');
    perform notify(b.creator_id, 'brief_closed', 'Brief closed',
      'We''re refunding ' || money_text(v_unused_budget + v_fee_refund, b.currency) || ' of unused budget.',
      '/briefs/' || b.id);
  else
    update briefs set status = 'settled', settled_at = now() where id = b.id;
    perform notify(b.creator_id, 'brief_closed', 'Brief completed', 'All unlocks used.', '/briefs/' || b.id);
  end if;
  return v_unused_budget + v_fee_refund;
end $$;
revoke execute on function _close_brief(uuid, text) from public, anon, authenticated;

-- Scheduled close: each brief in its own sub-transaction, so one failure (e.g. a lock conflict)
-- skips that brief until the next run instead of rolling back the whole batch.
create or replace function close_expired_briefs()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from briefs where status = 'open' and deadline_at <= now() order by deadline_at limit 200 loop
    begin
      perform _close_brief(r.id, 'deadline'); n := n + 1;
    exception when others then
      raise warning 'close_expired_briefs: brief % skipped: %', r.id, sqlerrm;
    end;
  end loop;
  -- unpaid drafts older than 7 days
  update briefs set status = 'cancelled', close_reason = 'cancelled_unpaid', closed_at = now()
   where status in ('draft','awaiting_payment') and created_at < now() - interval '7 days';
  return n;
end $$;

-- ---------------------------------------------------------------
-- Locked pitch cards for creators
-- ---------------------------------------------------------------
create or replace function round_sig2(n bigint)
returns bigint language sql immutable as $$
  select case when n is null or n < 100 then n
              else (round(n / power(10::numeric, floor(log(n::numeric)) - 1)) * power(10::numeric, floor(log(n::numeric)) - 1))::bigint end
$$;

create or replace view creator_pitch_cards as
  select p.id, p.brief_id, p.cre_id, p.status, p.platform, p.format_label, p.hook_category, p.teaser,
         p.multiplier, p.source_channel_size_band, p.submitted_at, p.unlocked_at,
         (u.id is null) as is_locked,
         case when u.id is null then round_sig2(p.source_views) else p.source_views end as source_views,
         case when u.id is null then round_sig2(p.channel_median_views) else p.channel_median_views end as channel_median_views,
         case when u.id is null then date_trunc('month', p.source_posted_on)::date else p.source_posted_on end as source_posted_on,
         case when u.id is null and p.duration_seconds is not null
              then greatest(5, (round(p.duration_seconds / 5.0) * 5)::int) else p.duration_seconds end as duration_seconds,
         b.title as brief_title
    from pitches p
    join briefs b on b.id = p.brief_id
    left join unlocks u on u.pitch_id = p.id and u.status <> 'reversed'
   where b.creator_id = auth.uid();

revoke all on creator_pitch_cards from anon, authenticated;
grant select on creator_pitch_cards to authenticated;

-- Creators no longer read the raw pitches table (it has the exact numbers).
drop policy if exists "pitches_creator_read" on pitches;
