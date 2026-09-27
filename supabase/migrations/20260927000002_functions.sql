-- Outlier Desk — database functions
-- All money logic lives here so it runs inside one transaction with row locks.
-- Errors are raised as short codes (e.g. NO_UNLOCKS_LEFT) that the app maps to messages.

-- ---------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------
create or replace function fee_cents(amount integer, bps integer)
returns integer language sql immutable as $$
  select ((amount::bigint * bps + 5000) / 10000)::integer
$$;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and suspended_at is null)
$$;

create or replace function my_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and suspended_at is null
$$;

create or replace function notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into notifications(user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link)
$$;

create or replace function money_text(p_cents integer, p_currency text)
returns text language sql immutable as $$
  select case when p_currency = 'USD' then '$' else p_currency || ' ' end || to_char(p_cents / 100.0, 'FM999999990.00')
$$;

create or replace function audit(p_action text, p_entity_type text, p_entity_id text, p_detail jsonb)
returns void language sql security definer set search_path = public as $$
  insert into audit_log(actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_detail)
$$;

-- ---------------------------------------------------------------
-- Contact masking (emails, phones, links, handles, messaging apps)
-- ---------------------------------------------------------------
create or replace function mask_contacts(p_text text, out masked text, out hit boolean)
language plpgsql immutable as $$
declare
  patterns text[] := array[
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}',                                    -- email
    '[a-z0-9._-]+\s*(\(at\)|\[at\]| at )\s*[a-z0-9-]+\s*(\(dot\)|\[dot\]| dot )\s*[a-z]{2,}', -- spelled-out email
    'https?://\S+',                                                                      -- url
    'www\.\S+',
    '\m[a-z0-9-]+\.(com|net|org|io|co|me|ph|ly|gg|link|bio|app|xyz|to)\M(/\S*)?',        -- bare domain
    '(\+?63|\m0)[\s.-]*9\d{2}[\s.-]*\d{3}[\s.-]*\d{4}',                                  -- PH mobile
    '\+\d{1,3}[\s.-]*\(?\d{2,4}\)?[\s.-]*\d{3,4}[\s.-]*\d{3,4}',                         -- international
    '\m(whatsapp|telegram|viber|discord|skype|wechat|gcash|paypal|venmo|cashapp|payoneer)\M'
  ];
  p text;
begin
  masked := coalesce(p_text, '');
  foreach p in array patterns loop
    masked := regexp_replace(masked, p, '[hidden]', 'gi');
  end loop;
  masked := regexp_replace(masked, '(^|\s)@[A-Za-z0-9_.]{3,}', '\1[hidden]', 'g');     -- @handles
  hit := masked is distinct from coalesce(p_text, '');
end $$;

-- ---------------------------------------------------------------
-- Source URL → stable key for duplicate detection (hashed, never exposed as URL)
-- ---------------------------------------------------------------
create or replace function source_key_from_url(p_url text)
returns text language plpgsql immutable set search_path = public, extensions as $$
declare u text := btrim(coalesce(p_url, '')); k text; id text;
begin
  if u !~* '^https?://' then raise exception 'INVALID_SOURCE_URL'; end if;
  id := substring(u from 'tiktok\.com/@[^/?#]+/video/(\d+)');
  if id is not null then k := 'tiktok:' || id; end if;
  if k is null then id := substring(u from '(?:vm\.tiktok\.com|tiktok\.com/t)/([A-Za-z0-9]+)');
    if id is not null then k := 'tiktok_short:' || id; end if; end if;
  if k is null then id := substring(u from 'instagram\.com/(?:reels?|p)/([A-Za-z0-9_-]+)');
    if id is not null then k := 'instagram:' || id; end if; end if;
  if k is null then id := substring(u from 'youtube\.com/shorts/([A-Za-z0-9_-]{11})');
    if id is not null then k := 'youtube:' || id; end if; end if;
  if k is null then id := substring(u from 'youtube\.com/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})');
    if id is not null then k := 'youtube:' || id; end if; end if;
  if k is null then id := substring(u from 'youtu\.be/([A-Za-z0-9_-]{11})');
    if id is not null then k := 'youtube:' || id; end if; end if;
  if k is null then id := substring(u from 'facebook\.com/reel/(\d+)');
    if id is not null then k := 'facebook:' || id; end if; end if;
  if k is null then id := substring(u from 'facebook\.com/watch/?\?(?:[^#]*&)?v=(\d+)');
    if id is not null then k := 'facebook:' || id; end if; end if;
  if k is null then
    k := 'url:' || lower(regexp_replace(regexp_replace(u, '[?#].*$', ''), '/+$', ''));
  end if;
  return encode(digest(k, 'sha256'), 'hex');
end $$;

-- ---------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), ''), 50));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger profiles_touch before update on profiles for each row execute function touch_updated_at();
create trigger briefs_touch   before update on briefs   for each row execute function touch_updated_at();

-- Users may edit their own profile, but never role or suspension fields.
-- Runs as the caller (not security definer) so current_user tells us who is editing.
create or replace function guard_profile_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if not is_admin() and current_user not in ('postgres','service_role') then
    if new.role is distinct from old.role then raise exception 'ROLE_CHANGE_NOT_ALLOWED'; end if;
    if new.suspended_at is distinct from old.suspended_at
       or new.suspended_reason is distinct from old.suspended_reason then
      raise exception 'NOT_ALLOWED';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on profiles for each row execute function guard_profile_update();

-- CREs may edit their profile, but not verification fields.
create or replace function guard_cre_profile_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if not is_admin() and current_user not in ('postgres','service_role') then
    if new.kyc_status is distinct from old.kyc_status
       or new.kyc_reviewed_at is distinct from old.kyc_reviewed_at
       or new.kyc_reviewed_by is distinct from old.kyc_reviewed_by
       or new.kyc_reject_reason is distinct from old.kyc_reject_reason then
      raise exception 'NOT_ALLOWED';
    end if;
  end if;
  return new;
end $$;
create trigger cre_profiles_guard before update on cre_profiles for each row execute function guard_cre_profile_update();

-- Mask contact details in every chat message, whoever inserts it.
create or replace function messages_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record; t threads;
begin
  select * into t from threads where id = new.thread_id;
  if new.sender_id <> t.creator_id and new.sender_id <> t.cre_id then raise exception 'NOT_THREAD_MEMBER'; end if;
  select * into m from mask_contacts(new.body);
  if m.hit then
    insert into flags(kind, subject_user, entity_type, entity_id, excerpt)
    values ('contact_leak', new.sender_id, 'thread', new.thread_id::text, left(new.body, 1000));
  end if;
  new.body := m.masked;
  new.was_masked := m.hit;
  new.read_at := null;
  new.created_at := now();
  return new;
end $$;
create trigger messages_mask before insert on messages for each row execute function messages_before_insert();

create or replace function messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare t threads; other uuid;
begin
  update threads set last_message_at = new.created_at where id = new.thread_id returning * into t;
  other := case when new.sender_id = t.creator_id then t.cre_id else t.creator_id end;
  perform notify(other, 'new_message', 'New message', left(new.body, 120), '/messages/' || t.id);
  return new;
end $$;
create trigger messages_after after insert on messages for each row execute function messages_after_insert();

-- ---------------------------------------------------------------
-- Onboarding
-- ---------------------------------------------------------------
create or replace function set_initial_role(p_role user_role)
returns void language plpgsql security definer set search_path = public as $$
declare cur user_role;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_role not in ('creator','cre') then raise exception 'INVALID_ROLE'; end if;
  select role into cur from profiles where id = auth.uid() for update;
  if cur is not null then raise exception 'ROLE_ALREADY_SET'; end if;
  update profiles set role = p_role where id = auth.uid();
  if p_role = 'creator' then insert into creator_profiles(user_id) values (auth.uid()) on conflict do nothing;
  else insert into cre_profiles(user_id) values (auth.uid()) on conflict do nothing; end if;
end $$;

create or replace function submit_kyc(
  p_legal_name text, p_birth_date date, p_address_line text, p_city text, p_province text,
  p_postal_code text, p_country_code text, p_mobile_number text, p_id_type text,
  p_id_front_path text, p_selfie_path text, p_tin text
) returns void language plpgsql security definer set search_path = public as $$
declare cp cre_profiles; n_port int;
begin
  if my_role() is distinct from 'cre' then raise exception 'NOT_CRE'; end if;
  select * into cp from cre_profiles where user_id = auth.uid() for update;
  if cp.kyc_status = 'approved' then raise exception 'ALREADY_VERIFIED'; end if;
  if cp.kyc_status = 'pending' then raise exception 'ALREADY_PENDING'; end if;
  select count(*) into n_port from portfolio_items where cre_id = auth.uid();
  if n_port < 3 then raise exception 'PORTFOLIO_TOO_SMALL'; end if;
  if coalesce(p_country_code,'PH') = 'PH' and p_mobile_number !~ '^(\+63|0)9\d{9}$' then
    raise exception 'INVALID_MOBILE';
  end if;
  if p_id_front_path !~ ('^' || auth.uid()::text || '/') or p_selfie_path !~ ('^' || auth.uid()::text || '/') then
    raise exception 'INVALID_UPLOAD_PATH';
  end if;
  insert into kyc_submissions(user_id, legal_name, birth_date, address_line, city, province, postal_code,
    country_code, mobile_number, id_type, id_front_path, selfie_path, tin)
  values (auth.uid(), p_legal_name, p_birth_date, p_address_line, p_city, p_province, p_postal_code,
    coalesce(p_country_code,'PH'), p_mobile_number, p_id_type, p_id_front_path, p_selfie_path, nullif(p_tin,''));
  update cre_profiles set kyc_status = 'pending', kyc_reject_reason = null where user_id = auth.uid();
  insert into notifications(user_id, kind, title, body, link)
  select id, 'kyc_submitted', 'New verification to review', null, '/admin/kyc' from profiles where role = 'admin';
end $$;

create or replace function review_kyc(p_user uuid, p_approve boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
  if not p_approve and coalesce(btrim(p_reason),'') = '' then raise exception 'REASON_REQUIRED'; end if;
  update cre_profiles
     set kyc_status = case when p_approve then 'approved'::kyc_status else 'rejected'::kyc_status end,
         kyc_reviewed_at = now(), kyc_reviewed_by = auth.uid(),
         kyc_reject_reason = case when p_approve then null else p_reason end
   where user_id = p_user and kyc_status = 'pending';
  if not found then raise exception 'NOT_PENDING'; end if;
  perform audit(case when p_approve then 'kyc.approve' else 'kyc.reject' end, 'user', p_user::text,
                jsonb_build_object('reason', p_reason));
  perform notify(p_user, 'kyc_result',
    case when p_approve then 'You''re verified. You can start pitching.' else 'We couldn''t verify your details' end,
    case when p_approve then null else p_reason end,
    case when p_approve then '/briefs' else '/onboarding/cre' end);
end $$;

create or replace function set_suspended(p_user uuid, p_suspend boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_user = auth.uid() then raise exception 'NOT_ALLOWED'; end if;
  update profiles set suspended_at = case when p_suspend then now() end,
                      suspended_reason = case when p_suspend then p_reason end
   where id = p_user;
  perform audit(case when p_suspend then 'user.suspend' else 'user.unsuspend' end, 'user', p_user::text,
                jsonb_build_object('reason', p_reason));
end $$;

-- ---------------------------------------------------------------
-- Briefs
-- ---------------------------------------------------------------
create or replace function create_brief(
  p_title text, p_description text, p_platform content_platform, p_niche_id int,
  p_must_include text, p_avoid text, p_example_urls text[],
  p_min_multiplier numeric, p_max_video_age_days int,
  p_price_per_idea_cents int, p_max_unlocks int, p_deadline_at timestamptz
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
  select * into m from mask_contacts(coalesce(p_title,'') || ' ' || coalesce(p_description,'') || ' ' ||
                                     coalesce(p_must_include,'') || ' ' || coalesce(p_avoid,''));
  if m.hit then raise exception 'CONTACT_DETAILS_NOT_ALLOWED'; end if;

  v_budget := p_price_per_idea_cents * p_max_unlocks;
  v_fee    := fee_cents(v_budget, s.creator_fee_bps);
  insert into briefs(creator_id, title, description, platform, niche_id, must_include, avoid, example_urls,
                     min_multiplier, max_video_age_days, currency, price_per_idea_cents, max_unlocks,
                     creator_fee_bps, cre_fee_bps, creator_fee_cents, total_charge_cents, deadline_at)
  values (auth.uid(), btrim(p_title), btrim(p_description), p_platform, p_niche_id,
          nullif(btrim(p_must_include),''), nullif(btrim(p_avoid),''), coalesce(p_example_urls,'{}'),
          greatest(coalesce(p_min_multiplier, s.min_multiplier), s.min_multiplier), p_max_video_age_days,
          s.default_currency, p_price_per_idea_cents, p_max_unlocks, s.creator_fee_bps, s.cre_fee_bps,
          v_fee, v_budget + v_fee, p_deadline_at)
  returning id into v_id;
  return v_id;
end $$;

-- Creator starts checkout. Returns the pending payment row the server then sends to the provider.
create or replace function prepare_brief_payment(p_brief_id uuid, p_provider text)
returns payments language plpgsql security definer set search_path = public as $$
declare b briefs; p payments;
begin
  select * into b from briefs where id = p_brief_id for update;
  if not found or b.creator_id <> auth.uid() then raise exception 'BRIEF_NOT_FOUND'; end if;
  if b.status not in ('draft','awaiting_payment') then raise exception 'BRIEF_ALREADY_PAID'; end if;
  if b.deadline_at < now() + interval '12 hours' then raise exception 'DEADLINE_TOO_CLOSE'; end if;
  -- expire older pending attempts
  update payments set status = 'expired' where brief_id = b.id and status = 'pending';
  insert into payments(brief_id, payer_id, provider, external_id, currency, amount_cents)
  values (b.id, auth.uid(), p_provider, 'brief_' || b.id || '_' || substr(md5(random()::text), 1, 8),
          b.currency, b.total_charge_cents)
  returning * into p;
  update briefs set status = 'awaiting_payment' where id = b.id;
  return p;
end $$;

-- Webhook: payment confirmed by provider (service role only).
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
     where c.kyc_status = 'approved' and c.accepting_work;
    return 'opened';
  else
    -- Paid after the brief was cancelled: refund in full.
    insert into refunds(payment_id, brief_id, amount_cents, fee_part_cents, reason)
    values (pay.id, b.id, pay.amount_cents, b.creator_fee_cents, 'cancelled');
    return 'refund_queued';
  end if;
end $$;

create or replace function mark_payment_failed(p_external_id text, p_status payment_status)
returns void language plpgsql security definer set search_path = public as $$
declare pay payments;
begin
  select * into pay from payments where external_id = p_external_id for update;
  if not found or pay.status <> 'pending' then return; end if;
  update payments set status = p_status where id = pay.id;
  perform notify(pay.payer_id, 'payment_failed', 'Payment didn''t go through',
                 'Your brief is saved. Try paying again.', '/briefs/' || pay.brief_id);
end $$;

-- Internal close. Stops pitching, expires waiting pitches, queues refund of unused budget + its fee.
create or replace function _close_brief(p_brief_id uuid, p_reason text)
returns integer language plpgsql security definer set search_path = public as $$
declare b briefs; pay payments; v_unused_budget int; v_fee_refund int;
begin
  select * into b from briefs where id = p_brief_id for update;
  if b.status <> 'open' then return 0; end if;
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

create or replace function close_brief(p_brief_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare b briefs;
begin
  select * into b from briefs where id = p_brief_id;
  if not found or (b.creator_id <> auth.uid() and not is_admin()) then raise exception 'BRIEF_NOT_FOUND'; end if;
  if b.status <> 'open' then raise exception 'BRIEF_NOT_OPEN'; end if;
  return _close_brief(p_brief_id, case when is_admin() and b.creator_id <> auth.uid() then 'admin' else 'creator_closed' end);
end $$;

create or replace function delete_draft_brief(p_brief_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b briefs;
begin
  select * into b from briefs where id = p_brief_id for update;
  if not found or b.creator_id <> auth.uid() then raise exception 'BRIEF_NOT_FOUND'; end if;
  if b.status not in ('draft','awaiting_payment') then raise exception 'BRIEF_ALREADY_PAID'; end if;
  update payments set status = 'expired' where brief_id = b.id and status = 'pending';
  update briefs set status = 'cancelled', close_reason = 'cancelled_unpaid', closed_at = now() where id = b.id;
end $$;

-- ---------------------------------------------------------------
-- Pitches
-- ---------------------------------------------------------------
create or replace function submit_pitch(
  p_brief_id uuid, p_platform content_platform, p_format_label text, p_duration_seconds int,
  p_hook_category text, p_teaser text, p_source_views bigint, p_channel_median_views bigint,
  p_source_posted_on date, p_source_channel_size_band text,
  p_source_url text, p_source_channel_url text, p_hook_text text, p_why_it_worked text,
  p_instructions text, p_adaptation_notes text
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare b briefs; s platform_settings; cp cre_profiles; v_mult numeric; v_count int; v_id uuid; v_key text; m record;
begin
  if my_role() is distinct from 'cre' then raise exception 'NOT_CRE'; end if;
  select * into cp from cre_profiles where user_id = auth.uid();
  if cp.kyc_status <> 'approved' then raise exception 'NOT_VERIFIED'; end if;
  select * into s from platform_settings where id;
  select * into b from briefs where id = p_brief_id for share;
  if not found then raise exception 'BRIEF_NOT_FOUND'; end if;
  if b.status <> 'open' or b.deadline_at <= now() then raise exception 'BRIEF_NOT_OPEN'; end if;
  if b.creator_id = auth.uid() then raise exception 'NOT_ALLOWED'; end if;

  select count(*) into v_count from pitches where brief_id = b.id and cre_id = auth.uid() and status <> 'withdrawn';
  if v_count >= s.max_pitches_per_cre_per_brief then raise exception 'TOO_MANY_PITCHES'; end if;

  if p_source_views <= 0 or p_channel_median_views <= 0 then raise exception 'INVALID_VIEWS'; end if;
  v_mult := round(p_source_views::numeric / p_channel_median_views, 1);
  if v_mult < b.min_multiplier then raise exception 'MULTIPLIER_TOO_LOW'; end if;
  if p_source_posted_on > current_date then raise exception 'POSTED_DATE_IN_FUTURE'; end if;
  if b.max_video_age_days is not null and p_source_posted_on < current_date - b.max_video_age_days then
    raise exception 'SOURCE_TOO_OLD'; end if;

  select * into m from mask_contacts(coalesce(p_teaser,'') || ' ' || coalesce(p_format_label,''));
  if m.hit then raise exception 'CONTACT_DETAILS_NOT_ALLOWED'; end if;
  if position(lower(btrim(p_hook_text)) in lower(p_teaser)) > 0
     or similarity(lower(p_teaser), lower(p_hook_text)) > 0.5 then
    raise exception 'TEASER_REVEALS_HOOK';
  end if;

  v_key := source_key_from_url(p_source_url);
  begin
    insert into pitches(brief_id, cre_id, platform, format_label, duration_seconds, hook_category, teaser,
                        source_views, channel_median_views, source_posted_on, source_channel_size_band, source_key)
    values (b.id, auth.uid(), p_platform, btrim(p_format_label), p_duration_seconds, p_hook_category, btrim(p_teaser),
            p_source_views, p_channel_median_views, p_source_posted_on, p_source_channel_size_band, v_key)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'DUPLICATE_SOURCE';
  end;
  insert into pitch_secrets(pitch_id, source_url, source_channel_url, hook_text, why_it_worked, instructions, adaptation_notes)
  values (v_id, btrim(p_source_url), nullif(btrim(p_source_channel_url),''), btrim(p_hook_text), btrim(p_why_it_worked),
          btrim(p_instructions), nullif(btrim(p_adaptation_notes),''));

  perform notify(b.creator_id, 'new_pitch', 'New pitch on ' || b.title,
                 v_mult || '× · ' || btrim(p_format_label), '/briefs/' || b.id);
  return v_id;
end $$;

create or replace function withdraw_pitch(p_pitch_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update pitches set status = 'withdrawn'
   where id = p_pitch_id and cre_id = auth.uid() and status = 'submitted';
  if not found then raise exception 'PITCH_NOT_AVAILABLE'; end if;
end $$;

-- ---------------------------------------------------------------
-- Unlock: the heart of the product
-- ---------------------------------------------------------------
create or replace function unlock_pitch(p_pitch_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare p pitches; b briefs; s platform_settings; v_fee int; v_net int; v_unlock uuid;
begin
  select * into p from pitches where id = p_pitch_id for update;
  if not found then raise exception 'PITCH_NOT_FOUND'; end if;
  select * into b from briefs where id = p.brief_id for update;
  if b.creator_id <> auth.uid() or my_role() is distinct from 'creator' then raise exception 'NOT_BRIEF_OWNER'; end if;
  if b.status <> 'open' then raise exception 'BRIEF_NOT_OPEN'; end if;
  if p.status <> 'submitted' then raise exception 'PITCH_NOT_AVAILABLE'; end if;
  if b.unlocks_used >= b.max_unlocks then raise exception 'NO_UNLOCKS_LEFT'; end if;
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

  if b.unlocks_used + 1 >= b.max_unlocks then
    perform _close_brief(b.id, 'max_unlocks');
  end if;
  return v_unlock;
end $$;

-- ---------------------------------------------------------------
-- Scheduled jobs (service role)
-- ---------------------------------------------------------------
create or replace function close_expired_briefs()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from briefs where status = 'open' and deadline_at <= now() order by deadline_at limit 200 loop
    perform _close_brief(r.id, 'deadline'); n := n + 1;
  end loop;
  -- unpaid drafts older than 7 days
  update briefs set status = 'cancelled', close_reason = 'cancelled_unpaid', closed_at = now()
   where status in ('draft','awaiting_payment') and created_at < now() - interval '7 days';
  return n;
end $$;

create or replace function release_holds()
returns integer language plpgsql security definer set search_path = public as $$
declare r unlocks; n int := 0;
begin
  for r in select * from unlocks where status = 'held' and available_at <= now() for update skip locked loop
    update unlocks set status = 'available' where id = r.id;
    insert into ledger_entries(kind, currency, amount_cents, debit_account, credit_account, unlock_id, brief_id)
    values ('hold_release', r.currency, r.net_cents, 'cre:' || r.cre_id || ':held', 'cre:' || r.cre_id || ':available', r.id, r.brief_id);
    perform notify(r.cre_id, 'earning_available', money_text(r.net_cents, r.currency) || ' is ready to withdraw', null, '/wallet');
    n := n + 1;
  end loop;
  return n;
end $$;

-- Provider reported the refund result (service role).
create or replace function complete_refund(p_refund_id uuid, p_provider_ref text, p_success boolean, p_failure text)
returns void language plpgsql security definer set search_path = public as $$
declare r refunds; b briefs;
begin
  select * into r from refunds where id = p_refund_id for update;
  if not found then raise exception 'REFUND_NOT_FOUND'; end if;
  if r.status in ('succeeded') then return; end if;
  select * into b from briefs where id = r.brief_id for update;
  if not p_success then
    update refunds set status = 'failed', failure_reason = p_failure, provider_ref = coalesce(p_provider_ref, provider_ref) where id = r.id;
    return;
  end if;
  update refunds set status = 'succeeded', completed_at = now(), provider_ref = coalesce(p_provider_ref, provider_ref) where id = r.id;
  if r.amount_cents - r.fee_part_cents > 0 then
    insert into ledger_entries(kind, currency, amount_cents, debit_account, credit_account, brief_id, refund_id, payment_id)
    values ('refund', b.currency, r.amount_cents - r.fee_part_cents, 'escrow:brief:' || b.id, 'external', b.id, r.id, r.payment_id);
  end if;
  if r.fee_part_cents > 0 then
    insert into ledger_entries(kind, currency, amount_cents, debit_account, credit_account, brief_id, refund_id, payment_id)
    values ('creator_fee_refund', b.currency, r.fee_part_cents, 'platform:revenue', 'external', b.id, r.id, r.payment_id);
  end if;
  update payments set refunded_cents = refunded_cents + r.amount_cents,
         status = case when refunded_cents + r.amount_cents >= amount_cents then 'refunded'::payment_status
                       else 'partially_refunded'::payment_status end
   where id = r.payment_id;
  if b.status = 'closed' and not exists (select 1 from refunds where brief_id = b.id and status not in ('succeeded')) then
    update briefs set status = 'settled', settled_at = now() where id = b.id;
  end if;
  perform notify(b.creator_id, 'refund_issued', 'Refund of ' || money_text(r.amount_cents, b.currency) || ' sent',
                 'Card refunds usually take 5–10 business days to appear.', '/billing');
end $$;

create or replace function mark_refund_processing(p_refund_id uuid, p_provider_ref text)
returns void language sql security definer set search_path = public as $$
  update refunds set status = 'processing', provider_ref = p_provider_ref where id = p_refund_id and status in ('pending','failed')
$$;

-- ---------------------------------------------------------------
-- Payouts
-- ---------------------------------------------------------------
create or replace function request_payout(p_method_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare s platform_settings; v_total int; v_id uuid; v_currency char(3);
begin
  if my_role() is distinct from 'cre' then raise exception 'NOT_CRE'; end if;
  if not exists (select 1 from cre_profiles where user_id = auth.uid() and kyc_status = 'approved') then
    raise exception 'NOT_VERIFIED'; end if;
  if not exists (select 1 from payout_methods where id = p_method_id and user_id = auth.uid()) then
    raise exception 'PAYOUT_METHOD_NOT_FOUND'; end if;
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

create or replace function cancel_payout(p_payout_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update payouts set status = 'cancelled'
   where id = p_payout_id and status = 'requested' and (cre_id = auth.uid() or is_admin());
  if not found then raise exception 'PAYOUT_NOT_CANCELLABLE'; end if;
  update unlocks set payout_id = null where payout_id = p_payout_id;
end $$;

-- Admin approves; server then calls provider (service role marks processing / result).
create or replace function approve_payout(p_payout_id uuid, p_fx_rate numeric)
returns void language plpgsql security definer set search_path = public as $$
declare po payouts;
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
  select * into po from payouts where id = p_payout_id for update;
  if po.status not in ('requested','failed') then raise exception 'PAYOUT_NOT_APPROVABLE'; end if;
  update payouts set status = 'processing', approved_by = auth.uid(), fx_rate = p_fx_rate,
         amount_local_cents = case when p_fx_rate is null then null else round(po.amount_cents * p_fx_rate)::int end,
         failure_reason = null
   where id = po.id;
  perform audit('payout.approve', 'payout', po.id::text, jsonb_build_object('fx_rate', p_fx_rate, 'amount_cents', po.amount_cents));
end $$;

create or replace function complete_payout(p_payout_id uuid, p_provider_ref text, p_success boolean, p_failure text)
returns void language plpgsql security definer set search_path = public as $$
declare po payouts; u unlocks;
begin
  select * into po from payouts where id = p_payout_id for update;
  if not found then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if po.status = 'paid' then return; end if;
  if not p_success then
    update payouts set status = 'failed', failure_reason = p_failure, provider_ref = coalesce(p_provider_ref, provider_ref) where id = po.id;
    perform notify(po.cre_id, 'payout_failed', 'Payout failed', p_failure, '/wallet');
    return;
  end if;
  update payouts set status = 'paid', paid_at = now(), provider_ref = coalesce(p_provider_ref, provider_ref) where id = po.id;
  for u in select * from unlocks where payout_id = po.id for update loop
    update unlocks set status = 'paid_out' where id = u.id;
  end loop;
  insert into ledger_entries(kind, currency, amount_cents, debit_account, credit_account, payout_id)
  values ('payout', po.currency, po.amount_cents, 'cre:' || po.cre_id || ':available', 'external', po.id);
  perform notify(po.cre_id, 'payout_paid', 'Payout sent: ' || money_text(po.amount_cents, po.currency), null, '/wallet');
end $$;

-- ---------------------------------------------------------------
-- Disputes
-- ---------------------------------------------------------------
create or replace function open_dispute(p_unlock_id uuid, p_reason text, p_details text)
returns uuid language plpgsql security definer set search_path = public as $$
declare u unlocks; v_id uuid;
begin
  select * into u from unlocks where id = p_unlock_id for update;
  if not found or u.creator_id <> auth.uid() then raise exception 'UNLOCK_NOT_FOUND'; end if;
  if u.status <> 'held' or u.available_at <= now() then raise exception 'DISPUTE_WINDOW_CLOSED'; end if;
  insert into disputes(unlock_id, opened_by, reason, details) values (u.id, auth.uid(), p_reason, btrim(p_details))
  returning id into v_id;
  update unlocks set status = 'disputed' where id = u.id;
  perform notify(u.cre_id, 'dispute_opened', 'A creator opened a dispute',
                 'Reply within 48 hours with your side.', '/disputes/' || v_id);
  return v_id;
end $$;

create or replace function respond_dispute(p_dispute_id uuid, p_response text)
returns void language plpgsql security definer set search_path = public as $$
declare d disputes; u unlocks;
begin
  select * into d from disputes where id = p_dispute_id for update;
  select * into u from unlocks where id = d.unlock_id;
  if not found or u.cre_id <> auth.uid() then raise exception 'DISPUTE_NOT_FOUND'; end if;
  if d.status <> 'awaiting_cre' then raise exception 'DISPUTE_NOT_AWAITING_RESPONSE'; end if;
  update disputes set cre_response = btrim(p_response), status = 'awaiting_admin' where id = d.id;
  insert into notifications(user_id, kind, title, body, link)
  select id, 'dispute_ready', 'Dispute ready for review', null, '/disputes/' || d.id from profiles where role = 'admin';
end $$;

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
    update unlocks set status = case when available_at <= now() then 'available'::unlock_status else 'held'::unlock_status end where id = u.id;
    update disputes set status = 'resolved_cre', resolution_note = p_note, resolved_by = auth.uid(), resolved_at = now() where id = d.id;
  end if;
  perform audit('dispute.resolve', 'dispute', d.id::text, jsonb_build_object('for_creator', p_for_creator, 'note', p_note));
  perform notify(u.creator_id, 'dispute_resolved', 'Dispute resolved', p_note, '/disputes/' || d.id);
  perform notify(u.cre_id, 'dispute_resolved', 'Dispute resolved', p_note, '/disputes/' || d.id);
end $$;

-- ---------------------------------------------------------------
-- Reviews and messaging
-- ---------------------------------------------------------------
create or replace function submit_review(p_unlock_id uuid, p_rating int, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare u unlocks; v_reviewee uuid; m record;
begin
  select * into u from unlocks where id = p_unlock_id;
  if not found or auth.uid() not in (u.creator_id, u.cre_id) then raise exception 'UNLOCK_NOT_FOUND'; end if;
  if u.status = 'reversed' then raise exception 'NOT_ALLOWED'; end if;
  v_reviewee := case when auth.uid() = u.creator_id then u.cre_id else u.creator_id end;
  select * into m from mask_contacts(p_body);
  insert into reviews(unlock_id, reviewer_id, reviewee_id, rating, body)
  values (u.id, auth.uid(), v_reviewee, p_rating, nullif(btrim(m.masked),''));
  perform notify(v_reviewee, 'review_received', 'You got a ' || p_rating || '-star review', null, '/dashboard');
exception when unique_violation then raise exception 'ALREADY_REVIEWED';
end $$;

create or replace function get_or_create_thread(p_brief_id uuid, p_cre_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare b briefs; v_id uuid;
begin
  select * into b from briefs where id = p_brief_id;
  if not found then raise exception 'BRIEF_NOT_FOUND'; end if;
  -- Creator can message a CRE who pitched on this brief; the CRE can message the creator of a brief they pitched on.
  if not exists (select 1 from pitches where brief_id = b.id and cre_id = p_cre_id) then raise exception 'NOT_ALLOWED'; end if;
  if auth.uid() <> b.creator_id and auth.uid() <> p_cre_id then raise exception 'NOT_ALLOWED'; end if;
  insert into threads(brief_id, creator_id, cre_id) values (b.id, b.creator_id, p_cre_id)
  on conflict (brief_id, creator_id, cre_id) do nothing;
  select id into v_id from threads where brief_id = b.id and creator_id = b.creator_id and cre_id = p_cre_id;
  return v_id;
end $$;

create or replace function mark_thread_read(p_thread_id uuid)
returns void language sql security definer set search_path = public as $$
  update messages set read_at = now()
   where thread_id = p_thread_id and sender_id <> auth.uid() and read_at is null
     and exists (select 1 from threads t where t.id = p_thread_id and auth.uid() in (t.creator_id, t.cre_id))
$$;

create or replace function report_user(p_user uuid, p_entity_type text, p_entity_id text, p_note text)
returns void language sql security definer set search_path = public as $$
  insert into flags(kind, subject_user, reported_by, entity_type, entity_id, excerpt)
  values ('abuse', p_user, auth.uid(), p_entity_type, p_entity_id, left(p_note, 1000))
$$;

create or replace function update_settings(p_creator_fee_bps int, p_cre_fee_bps int, p_hold_hours int,
                                           p_min_price_cents int, p_min_multiplier numeric, p_min_payout_cents int)
returns void language plpgsql security definer set search_path = public as $$
declare before jsonb;
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
  select to_jsonb(s) into before from platform_settings s where id;
  update platform_settings set creator_fee_bps = p_creator_fee_bps, cre_fee_bps = p_cre_fee_bps,
    hold_hours = p_hold_hours, min_price_per_idea_cents = p_min_price_cents,
    min_multiplier = p_min_multiplier, min_payout_cents = p_min_payout_cents, updated_at = now() where id;
  perform audit('settings.update', 'settings', 'platform', jsonb_build_object('before', before));
end $$;

-- ---------------------------------------------------------------
-- Function permissions
-- Postgres grants EXECUTE to PUBLIC by default, and Supabase also grants to anon/authenticated.
-- Lock everything down, then grant only what each role may call.
-- ---------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- used inside RLS policies and views (evaluated as the caller)
grant execute on function is_admin(), my_role(), fee_cents(integer, integer), money_text(integer, text),
  mask_contacts(text) to anon, authenticated;

-- signed-in user actions
grant execute on function
  set_initial_role(user_role),
  submit_kyc(text, date, text, text, text, text, text, text, text, text, text, text),
  review_kyc(uuid, boolean, text),
  set_suspended(uuid, boolean, text),
  create_brief(text, text, content_platform, int, text, text, text[], numeric, int, int, int, timestamptz),
  prepare_brief_payment(uuid, text),
  close_brief(uuid),
  delete_draft_brief(uuid),
  submit_pitch(uuid, content_platform, text, int, text, text, bigint, bigint, date, text, text, text, text, text, text, text),
  withdraw_pitch(uuid),
  unlock_pitch(uuid),
  request_payout(uuid),
  cancel_payout(uuid),
  approve_payout(uuid, numeric),
  open_dispute(uuid, text, text),
  respond_dispute(uuid, text),
  resolve_dispute(uuid, boolean, text),
  submit_review(uuid, int, text),
  get_or_create_thread(uuid, uuid),
  mark_thread_read(uuid),
  report_user(uuid, text, text, text),
  update_settings(int, int, int, int, numeric, int)
to authenticated;

-- server-only (webhooks, cron) — service_role
grant execute on function
  mark_payment_paid(text, text, int, text),
  mark_payment_failed(text, payment_status),
  close_expired_briefs(),
  release_holds(),
  complete_refund(uuid, text, boolean, text),
  mark_refund_processing(uuid, text),
  complete_payout(uuid, text, boolean, text),
  _close_brief(uuid, text),
  source_key_from_url(text),
  notify(uuid, text, text, text, text)
to service_role;
