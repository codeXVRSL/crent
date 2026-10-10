-- Outlier Desk: full database setup (all migrations + seed). Run once on an empty Supabase project.

-- ===== supabase/migrations/20260927000001_schema.sql =====
-- Outlier Desk — schema
-- Money is always integer cents + ISO currency. Never floats.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- ---------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------
create type user_role        as enum ('creator','cre','admin');
create type kyc_status       as enum ('not_started','pending','approved','rejected');
create type content_platform as enum ('tiktok','instagram_reels','youtube_shorts','youtube_long','facebook_reels','other');
create type brief_status     as enum ('draft','awaiting_payment','open','closed','settled','cancelled');
create type pitch_status     as enum ('submitted','unlocked','withdrawn','expired','refunded');
create type unlock_status    as enum ('held','available','paid_out','disputed','reversed');
create type dispute_status   as enum ('awaiting_cre','awaiting_admin','resolved_creator','resolved_cre');
create type payment_status   as enum ('pending','paid','failed','expired','refunded','partially_refunded');
create type payout_status    as enum ('requested','processing','paid','failed','cancelled');
create type ledger_kind      as enum ('brief_funding','creator_fee','unlock_gross','cre_fee','hold_release',
                                      'refund','creator_fee_refund','payout','dispute_reversal','adjustment');
create type flag_kind        as enum ('contact_leak','duplicate_source','fake_proof','abuse','spam','other');

-- ---------------------------------------------------------------
-- Settings (single row). Fees are copied onto each brief at creation.
-- ---------------------------------------------------------------
create table platform_settings (
  id                            boolean primary key default true check (id),
  creator_fee_bps               integer not null default 500  check (creator_fee_bps between 0 and 3000),
  cre_fee_bps                   integer not null default 1000 check (cre_fee_bps between 0 and 3000),
  hold_hours                    integer not null default 72   check (hold_hours between 0 and 720),
  min_price_per_idea_cents      integer not null default 300,
  max_price_per_idea_cents      integer not null default 50000,
  min_multiplier                numeric(6,1) not null default 3.0,
  min_payout_cents              integer not null default 1000,
  max_open_briefs_per_creator   integer not null default 10,
  max_pitches_per_cre_per_brief integer not null default 5,
  default_currency              char(3) not null default 'USD',
  updated_at                    timestamptz not null default now()
);
insert into platform_settings default values;

-- ---------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------
create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  role             user_role,
  display_name     text not null default '' check (char_length(display_name) <= 50),
  handle           text unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  country_code     char(2),
  suspended_at     timestamptz,
  suspended_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table creator_profiles (
  user_id       uuid primary key references profiles(id) on delete cascade,
  brand_name    text check (char_length(brand_name) <= 80),
  main_platform content_platform,
  channel_url   text check (char_length(channel_url) <= 300),
  follower_band text check (follower_band in ('<10k','10k-50k','50k-200k','200k-1M','1M+')),
  is_agency     boolean not null default false
);

create table cre_profiles (
  user_id           uuid primary key references profiles(id) on delete cascade,
  headline          text check (char_length(headline) <= 90),
  bio               text check (char_length(bio) <= 1200),
  platforms         content_platform[] not null default '{}',
  years_experience  smallint check (years_experience between 0 and 30),
  kyc_status        kyc_status not null default 'not_started',
  kyc_reviewed_at   timestamptz,
  kyc_reviewed_by   uuid references profiles(id),
  kyc_reject_reason text,
  accepting_work    boolean not null default true
);

-- Private verification data (Internet Transactions Act, RA 11967). Owner + admin only.
create table kyc_submissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  legal_name    text not null check (char_length(legal_name) between 3 and 120),
  birth_date    date not null check (birth_date <= (current_date - interval '18 years')),
  address_line  text not null,
  city          text not null,
  province      text not null,
  postal_code   text not null,
  country_code  char(2) not null default 'PH',
  mobile_number text not null,
  id_type       text not null check (id_type in ('philsys','passport','drivers_license','umid','prc','postal','voters','other')),
  id_front_path text not null,
  selfie_path   text not null,
  tin           text,
  submitted_at  timestamptz not null default now()
);
create index kyc_user_idx on kyc_submissions(user_id, submitted_at desc);

-- ---------------------------------------------------------------
-- Taxonomy
-- ---------------------------------------------------------------
create table niches (
  id   serial primary key,
  slug text unique not null,
  name text not null
);
create table cre_niches (
  user_id  uuid references profiles(id) on delete cascade,
  niche_id int  references niches(id),
  primary key (user_id, niche_id)
);

-- ---------------------------------------------------------------
-- CRE portfolio — public proof of past finds
-- ---------------------------------------------------------------
create table portfolio_items (
  id                   uuid primary key default gen_random_uuid(),
  cre_id               uuid not null references profiles(id) on delete cascade,
  platform             content_platform not null,
  niche_id             int references niches(id),
  title                text not null check (char_length(title) between 3 and 120),
  source_url           text not null check (char_length(source_url) <= 500),
  source_views         bigint not null check (source_views > 0),
  channel_median_views bigint not null check (channel_median_views > 0),
  multiplier           numeric(8,1) generated always as (round(source_views::numeric / channel_median_views, 1)) stored,
  result_note          text check (char_length(result_note) <= 400),
  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Briefs
-- ---------------------------------------------------------------
create table briefs (
  id                   uuid primary key default gen_random_uuid(),
  creator_id           uuid not null references profiles(id) on delete restrict,
  title                text not null check (char_length(title) between 8 and 100),
  description          text not null check (char_length(description) between 40 and 3000),
  platform             content_platform not null,
  niche_id             int not null references niches(id),
  must_include         text check (char_length(must_include) <= 1000),
  avoid                text check (char_length(avoid) <= 1000),
  example_urls         text[] not null default '{}' check (coalesce(array_length(example_urls,1),0) <= 5),
  min_multiplier       numeric(6,1) not null default 3.0,
  max_video_age_days   integer check (max_video_age_days between 1 and 3650),
  currency             char(3) not null default 'USD',
  price_per_idea_cents integer not null check (price_per_idea_cents > 0),
  max_unlocks          integer not null check (max_unlocks between 1 and 100),
  creator_fee_bps      integer not null,
  cre_fee_bps          integer not null,
  budget_cents         integer generated always as (price_per_idea_cents * max_unlocks) stored,
  creator_fee_cents    integer not null,
  total_charge_cents   integer not null,
  unlocks_used         integer not null default 0 check (unlocks_used >= 0),
  status               brief_status not null default 'draft',
  deadline_at          timestamptz not null,
  opened_at            timestamptz,
  closed_at            timestamptz,
  settled_at           timestamptz,
  close_reason         text check (close_reason in ('deadline','max_unlocks','creator_closed','admin','cancelled_unpaid')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint unlocks_within_max check (unlocks_used <= max_unlocks)
);
create index briefs_open_idx    on briefs(status, deadline_at) where status = 'open';
create index briefs_creator_idx on briefs(creator_id, created_at desc);

-- ---------------------------------------------------------------
-- Pitches: public proof part
-- ---------------------------------------------------------------
create table pitches (
  id                       uuid primary key default gen_random_uuid(),
  brief_id                 uuid not null references briefs(id) on delete restrict,
  cre_id                   uuid not null references profiles(id) on delete restrict,
  status                   pitch_status not null default 'submitted',
  platform                 content_platform not null,
  format_label             text not null check (char_length(format_label) between 3 and 80),
  duration_seconds         integer check (duration_seconds between 1 and 7200),
  hook_category            text not null check (hook_category in (
                             'question','bold_claim','number_list','story','before_after','myth_bust',
                             'tutorial','reaction','pov','challenge','controversy','other')),
  teaser                   text not null check (char_length(teaser) between 20 and 200),
  source_views             bigint not null check (source_views > 0),
  channel_median_views     bigint not null check (channel_median_views > 0),
  multiplier               numeric(8,1) generated always as (round(source_views::numeric / channel_median_views, 1)) stored,
  source_posted_on         date not null,
  source_channel_size_band text check (source_channel_size_band in ('<10k','10k-50k','50k-200k','200k-1M','1M+')),
  source_key               text not null, -- sha256 of normalized platform:video_id. Never the URL.
  submitted_at             timestamptz not null default now(),
  unlocked_at              timestamptz,
  constraint one_source_per_brief unique (brief_id, source_key)
);
create index pitches_brief_idx on pitches(brief_id, submitted_at);
create index pitches_cre_idx   on pitches(cre_id, submitted_at desc);

-- ---------------------------------------------------------------
-- Pitch secrets: the idea itself. Readable only by owner CRE,
-- the creator after unlock, and admins (see RLS migration).
-- ---------------------------------------------------------------
create table pitch_secrets (
  pitch_id           uuid primary key references pitches(id) on delete cascade,
  source_url         text not null check (char_length(source_url) <= 500),
  source_channel_url text check (char_length(source_channel_url) <= 500),
  hook_text          text not null check (char_length(hook_text) between 5 and 300),
  why_it_worked      text not null check (char_length(why_it_worked) between 40 and 2000),
  instructions       text not null check (char_length(instructions) between 80 and 6000),
  adaptation_notes   text check (char_length(adaptation_notes) <= 2000)
);

-- ---------------------------------------------------------------
-- Unlocks (one per pitch)
-- ---------------------------------------------------------------
create table unlocks (
  id            uuid primary key default gen_random_uuid(),
  pitch_id      uuid not null unique references pitches(id) on delete restrict,
  brief_id      uuid not null references briefs(id) on delete restrict,
  creator_id    uuid not null references profiles(id),
  cre_id        uuid not null references profiles(id),
  currency      char(3) not null,
  gross_cents   integer not null check (gross_cents > 0),
  cre_fee_cents integer not null check (cre_fee_cents >= 0),
  net_cents     integer not null check (net_cents >= 0),
  status        unlock_status not null default 'held',
  available_at  timestamptz not null,
  payout_id     uuid,
  created_at    timestamptz not null default now(),
  constraint net_math check (net_cents = gross_cents - cre_fee_cents)
);
create index unlocks_cre_status_idx on unlocks(cre_id, status);
create index unlocks_release_idx    on unlocks(available_at) where status = 'held';

-- ---------------------------------------------------------------
-- Payments, refunds
-- ---------------------------------------------------------------
create table payments (
  id             uuid primary key default gen_random_uuid(),
  brief_id       uuid not null references briefs(id),
  payer_id       uuid not null references profiles(id),
  provider       text not null,
  provider_ref   text unique,
  external_id    text unique not null,
  currency       char(3) not null,
  amount_cents   integer not null check (amount_cents > 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  status         payment_status not null default 'pending',
  checkout_url   text,
  method         text,
  paid_at        timestamptz,
  created_at     timestamptz not null default now()
);

create table refunds (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references payments(id),
  brief_id     uuid not null references briefs(id),
  amount_cents integer not null check (amount_cents > 0),
  fee_part_cents integer not null default 0 check (fee_part_cents >= 0),
  reason       text not null check (reason in ('unused_budget','dispute','cancelled','admin')),
  provider_ref text unique,
  status       text not null default 'pending' check (status in ('pending','processing','succeeded','failed','manual')),
  failure_reason text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------------
-- Payouts
-- ---------------------------------------------------------------
create table payout_methods (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references profiles(id) on delete cascade,
  kind                 text not null check (kind in ('gcash','maya','bank')),
  bank_code            text,
  account_name         text not null check (char_length(account_name) between 3 and 120),
  account_last4        text not null check (account_last4 ~ '^[0-9]{4}$'),
  account_number_enc   text not null, -- AES-256-GCM, encrypted in app code with PAYOUT_ENCRYPTION_KEY
  is_default           boolean not null default true,
  created_at           timestamptz not null default now()
);

create table payouts (
  id             uuid primary key default gen_random_uuid(),
  cre_id         uuid not null references profiles(id),
  method_id      uuid not null references payout_methods(id),
  currency       char(3) not null,
  amount_cents   integer not null check (amount_cents > 0),
  fx_rate        numeric(12,6),
  amount_local_cents integer,
  status         payout_status not null default 'requested',
  provider_ref   text unique,
  failure_reason text,
  requested_at   timestamptz not null default now(),
  approved_by    uuid references profiles(id),
  paid_at        timestamptz
);
alter table unlocks add constraint unlocks_payout_fk foreign key (payout_id) references payouts(id);

-- ---------------------------------------------------------------
-- Ledger (append-only). Accounts:
--   external · escrow:brief:<id> · platform:revenue
--   cre:<id>:held · cre:<id>:available · creator:<id>
-- ---------------------------------------------------------------
create table ledger_entries (
  id             bigserial primary key,
  kind           ledger_kind not null,
  currency       char(3) not null,
  amount_cents   integer not null check (amount_cents > 0),
  debit_account  text not null,
  credit_account text not null,
  brief_id       uuid references briefs(id),
  unlock_id      uuid references unlocks(id),
  payment_id     uuid references payments(id),
  refund_id      uuid references refunds(id),
  payout_id      uuid references payouts(id),
  note           text,
  created_at     timestamptz not null default now()
);
create index ledger_brief_idx  on ledger_entries(brief_id);
create index ledger_unlock_idx on ledger_entries(unlock_id);

create function ledger_block_mutation() returns trigger language plpgsql as $$
begin raise exception 'LEDGER_IS_APPEND_ONLY'; end $$;
create trigger ledger_no_mutation before update or delete on ledger_entries
  for each row execute function ledger_block_mutation();

-- ---------------------------------------------------------------
-- Disputes, reviews
-- ---------------------------------------------------------------
create table disputes (
  id              uuid primary key default gen_random_uuid(),
  unlock_id       uuid not null unique references unlocks(id),
  opened_by       uuid not null references profiles(id),
  reason          text not null check (reason in ('source_dead','stats_false','not_matching_card',
                    'duplicate_of_other_unlock','instructions_missing','plagiarized','other')),
  details         text not null check (char_length(details) between 20 and 2000),
  cre_response    text check (char_length(cre_response) <= 2000),
  status          dispute_status not null default 'awaiting_cre',
  resolution_note text,
  resolved_by     uuid references profiles(id),
  opened_at       timestamptz not null default now(),
  cre_deadline_at timestamptz not null default now() + interval '48 hours',
  resolved_at     timestamptz
);

create table reviews (
  id          uuid primary key default gen_random_uuid(),
  unlock_id   uuid not null references unlocks(id),
  reviewer_id uuid not null references profiles(id),
  reviewee_id uuid not null references profiles(id),
  rating      smallint not null check (rating between 1 and 5),
  body        text check (char_length(body) <= 800),
  created_at  timestamptz not null default now(),
  unique (unlock_id, reviewer_id)
);

-- ---------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------
create table threads (
  id              uuid primary key default gen_random_uuid(),
  brief_id        uuid not null references briefs(id),
  creator_id      uuid not null references profiles(id),
  cre_id          uuid not null references profiles(id),
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (brief_id, creator_id, cre_id)
);
create table messages (
  id         bigserial primary key,
  thread_id  uuid not null references threads(id) on delete cascade,
  sender_id  uuid not null references profiles(id),
  body       text not null check (char_length(body) between 1 and 4000),
  was_masked boolean not null default false,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index messages_thread_idx on messages(thread_id, created_at);

-- ---------------------------------------------------------------
-- Flags, notifications, audit, webhooks
-- ---------------------------------------------------------------
create table flags (
  id           uuid primary key default gen_random_uuid(),
  kind         flag_kind not null,
  subject_user uuid references profiles(id),
  reported_by  uuid references profiles(id),
  entity_type  text not null,
  entity_id    text not null,
  excerpt      text,
  status       text not null default 'open' check (status in ('open','dismissed','actioned')),
  created_at   timestamptz not null default now()
);

create table notifications (
  id         bigserial primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);

create table audit_log (
  id          bigserial primary key,
  actor_id    uuid references profiles(id),
  action      text not null,
  entity_type text not null,
  entity_id   text not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create table webhook_events (
  id           text primary key,
  provider     text not null,
  type         text not null,
  payload      jsonb not null,
  processed_at timestamptz,
  error        text,
  received_at  timestamptz not null default now()
);

create table waitlist (
  id         bigserial primary key,
  email      text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  side       text not null check (side in ('creator','cre')),
  created_at timestamptz not null default now()
);

-- ===== supabase/migrations/20260927000002_functions.sql =====
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

-- ===== supabase/migrations/20260927000003_rls.sql =====
-- Outlier Desk — Row Level Security and public views
-- Every table has RLS on. Writes to money tables happen only through functions (no insert/update policies).

create or replace function is_verified_cre()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cre_profiles c join profiles p on p.id = c.user_id
                  where c.user_id = auth.uid() and c.kyc_status = 'approved' and p.suspended_at is null)
$$;
grant execute on function is_verified_cre() to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'platform_settings','profiles','creator_profiles','cre_profiles','kyc_submissions','niches','cre_niches',
    'portfolio_items','briefs','pitches','pitch_secrets','unlocks','payments','refunds','payout_methods','payouts',
    'ledger_entries','disputes','reviews','threads','messages','flags','notifications','audit_log','webhook_events','waitlist'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "admin_read_all" on %I for select to authenticated using (is_admin())', t);
  end loop;
end $$;

-- settings & taxonomy: readable by everyone
create policy "settings_public_read" on platform_settings for select to anon, authenticated using (true);
create policy "niches_public_read"   on niches            for select to anon, authenticated using (true);
create policy "cre_niches_public_read" on cre_niches      for select to anon, authenticated using (true);
create policy "cre_niches_own_insert"  on cre_niches      for insert to authenticated with check (user_id = auth.uid() and my_role() = 'cre');
create policy "cre_niches_own_delete"  on cre_niches      for delete to authenticated using (user_id = auth.uid());

-- profiles
create policy "profiles_self_read"   on profiles for select to authenticated using (id = auth.uid());
create policy "profiles_self_update" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "creator_self_read"    on creator_profiles for select to authenticated using (user_id = auth.uid());
create policy "creator_self_update"  on creator_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cre_self_read"        on cre_profiles for select to authenticated using (user_id = auth.uid());
create policy "cre_self_update"      on cre_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- KYC: owner can read their own submissions; inserts only via submit_kyc()
create policy "kyc_self_read" on kyc_submissions for select to authenticated using (user_id = auth.uid());

-- portfolio: public when the CRE is verified
create policy "portfolio_public_read" on portfolio_items for select to anon, authenticated
  using (cre_id = auth.uid() or exists (select 1 from cre_profiles c where c.user_id = cre_id and c.kyc_status = 'approved'));
create policy "portfolio_own_insert" on portfolio_items for insert to authenticated with check (cre_id = auth.uid() and my_role() = 'cre');
create policy "portfolio_own_update" on portfolio_items for update to authenticated using (cre_id = auth.uid()) with check (cre_id = auth.uid());
create policy "portfolio_own_delete" on portfolio_items for delete to authenticated using (cre_id = auth.uid());

-- briefs: owner sees all own; verified CREs see funded briefs. Writes via functions only.
create policy "briefs_owner_read" on briefs for select to authenticated using (creator_id = auth.uid());
create policy "briefs_cre_read"   on briefs for select to authenticated
  using (status in ('open','closed','settled') and is_verified_cre());

-- pitches: owner CRE and the brief's creator
create policy "pitches_cre_read"     on pitches for select to authenticated using (cre_id = auth.uid());
create policy "pitches_creator_read" on pitches for select to authenticated
  using (exists (select 1 from briefs b where b.id = brief_id and b.creator_id = auth.uid()));

-- pitch_secrets: THE rule. Owner CRE, or the creator after a non-reversed unlock.
create policy "secrets_cre_read" on pitch_secrets for select to authenticated
  using (exists (select 1 from pitches p where p.id = pitch_id and p.cre_id = auth.uid()));
create policy "secrets_creator_after_unlock" on pitch_secrets for select to authenticated
  using (exists (select 1 from unlocks u where u.pitch_id = pitch_secrets.pitch_id
                   and u.creator_id = auth.uid() and u.status <> 'reversed'));

-- unlocks, payments, refunds, payouts
create policy "unlocks_party_read"  on unlocks  for select to authenticated using (auth.uid() in (creator_id, cre_id));
create policy "payments_payer_read" on payments for select to authenticated using (payer_id = auth.uid());
create policy "refunds_owner_read"  on refunds  for select to authenticated
  using (exists (select 1 from briefs b where b.id = brief_id and b.creator_id = auth.uid()));
create policy "payouts_owner_read"  on payouts  for select to authenticated using (cre_id = auth.uid());

-- payout methods: owner manages; account number stored encrypted
create policy "pm_owner_read"   on payout_methods for select to authenticated using (user_id = auth.uid());
create policy "pm_owner_insert" on payout_methods for insert to authenticated with check (user_id = auth.uid() and my_role() = 'cre');
create policy "pm_owner_delete" on payout_methods for delete to authenticated
  using (user_id = auth.uid() and not exists (select 1 from payouts p where p.method_id = payout_methods.id and p.status in ('requested','processing')));

-- disputes, reviews
create policy "disputes_party_read" on disputes for select to authenticated
  using (exists (select 1 from unlocks u where u.id = unlock_id and auth.uid() in (u.creator_id, u.cre_id)));
create policy "reviews_public_read" on reviews for select to anon, authenticated using (true);

-- messaging
create policy "threads_member_read" on threads for select to authenticated using (auth.uid() in (creator_id, cre_id));
create policy "messages_member_read" on messages for select to authenticated
  using (exists (select 1 from threads t where t.id = thread_id and auth.uid() in (t.creator_id, t.cre_id)));
create policy "messages_member_insert" on messages for insert to authenticated
  with check (sender_id = auth.uid()
              and exists (select 1 from threads t where t.id = thread_id and auth.uid() in (t.creator_id, t.cre_id)));

-- notifications
create policy "notif_own_read"   on notifications for select to authenticated using (user_id = auth.uid());
create policy "notif_own_update" on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- waitlist: anyone may join, nobody may read (except admin)
create policy "waitlist_insert" on waitlist for insert to anon, authenticated with check (true);

-- ---------------------------------------------------------------
-- Public views (run as owner, expose safe columns only)
-- ---------------------------------------------------------------
create view public_profiles as
  select id, role, display_name, handle, country_code, created_at from profiles where suspended_at is null;

create view cre_public_stats as
  select p.cre_id,
         count(*)::int                                                         as pitches_sent,
         count(*) filter (where p.status = 'unlocked')::int                    as pitches_unlocked,
         case when count(*) filter (where p.status <> 'withdrawn') = 0 then null
              else round(100.0 * count(*) filter (where p.status = 'unlocked')
                         / count(*) filter (where p.status <> 'withdrawn'))::int end as unlock_rate_pct
    from pitches p group by p.cre_id;

create view creator_public_stats as
  select b.creator_id,
         count(distinct b.id) filter (where b.status in ('open','closed','settled'))::int as briefs_posted,
         count(p.id)::int                                                    as pitches_received,
         count(u.id)::int                                                    as unlocks_made,
         case when count(p.id) = 0 then null else round(100.0 * count(u.id) / count(p.id))::int end as unlock_rate_pct,
         count(d.id)::int                                                    as disputes_opened
    from briefs b
    left join pitches p  on p.brief_id = b.id and p.status <> 'withdrawn'
    left join unlocks u  on u.pitch_id = p.id
    left join disputes d on d.unlock_id = u.id
   group by b.creator_id;

create view review_stats as
  select reviewee_id, round(avg(rating), 1) as avg_rating, count(*)::int as review_count
    from reviews group by reviewee_id;

create view public_cres as
  select pr.id, pr.display_name, pr.handle, pr.country_code, pr.created_at,
         c.headline, c.bio, c.platforms, c.years_experience, c.accepting_work,
         coalesce(array(select n.name from cre_niches cn join niches n on n.id = cn.niche_id
                         where cn.user_id = pr.id order by n.name), '{}') as niches,
         coalesce(array(select cn.niche_id from cre_niches cn where cn.user_id = pr.id), '{}') as niche_ids,
         s.pitches_sent, s.pitches_unlocked, s.unlock_rate_pct,
         r.avg_rating, coalesce(r.review_count, 0) as review_count
    from profiles pr
    join cre_profiles c on c.user_id = pr.id and c.kyc_status = 'approved'
    left join cre_public_stats s on s.cre_id = pr.id
    left join review_stats r on r.reviewee_id = pr.id
   where pr.suspended_at is null;

create view public_creators as
  select pr.id, pr.display_name, pr.handle, c.brand_name, c.main_platform, c.is_agency,
         coalesce(s.briefs_posted, 0) as briefs_posted, s.unlock_rate_pct, coalesce(s.disputes_opened, 0) as disputes_opened,
         r.avg_rating, coalesce(r.review_count, 0) as review_count
    from profiles pr
    join creator_profiles c on c.user_id = pr.id
    left join creator_public_stats s on s.creator_id = pr.id
    left join review_stats r on r.reviewee_id = pr.id;

-- Balances follow the caller's own RLS on unlocks
create view cre_balances with (security_invoker = true) as
  select cre_id, currency,
         coalesce(sum(net_cents) filter (where status in ('held','disputed')), 0)::int                  as held_cents,
         coalesce(sum(net_cents) filter (where status = 'available' and payout_id is null), 0)::int    as available_cents,
         coalesce(sum(net_cents) filter (where status = 'available' and payout_id is not null), 0)::int as in_payout_cents,
         coalesce(sum(net_cents) filter (where status = 'paid_out'), 0)::int                           as paid_out_cents
    from unlocks group by cre_id, currency;

revoke all on public_profiles, cre_public_stats, creator_public_stats, review_stats, public_cres, public_creators, cre_balances
  from anon, authenticated;
grant select on public_profiles, cre_public_stats, creator_public_stats, review_stats, public_cres, public_creators
  to anon, authenticated;
grant select on cre_balances to authenticated;

-- ===== supabase/migrations/20260927000004_storage.sql =====
-- Outlier Desk — private storage for verification images
-- Paths must start with the uploader's user id: kyc/<user_id>/<file>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc', 'kyc', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "kyc_owner_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "kyc_owner_read" on storage.objects for select to authenticated
  using (bucket_id = 'kyc' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ===== supabase/migrations/20260928000005_feedback_and_proof.sql =====
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

-- ===== supabase/migrations/20260929000006_creator_researcher_tools.sql =====
-- Outlier Desk — tools for creators and researchers
--   Creators: idea board (production stages + results), pitch shortlist and pass-with-feedback,
--             saved researchers and brief invites.
--   Researchers: swipe file of candidate outliers, invites, track record built from real results.
-- All writes go through security-definer functions or own-row RLS, like the rest of the schema.

-- ---------------------------------------------------------------
-- Idea board: every unlocked idea, tracked from "saved" to "posted".
-- Private to the creator. The researcher only ever sees the stage and the result multiple
-- (never the posted URL or notes, which could reveal the creator's channel or plans).
-- ---------------------------------------------------------------
create table idea_tracking (
  unlock_id       uuid primary key references unlocks(id) on delete cascade,
  creator_id      uuid not null references profiles(id) on delete cascade,
  cre_id          uuid not null references profiles(id),
  stage           text not null default 'saved' check (stage in ('saved','scripting','filming','posted','skipped')),
  board           text check (char_length(board) <= 40),
  planned_on      date,
  notes           text check (char_length(notes) <= 2000),
  posted_url      text check (posted_url is null or (char_length(posted_url) <= 500 and posted_url ~* '^https?://')),
  posted_on       date,
  result_views    bigint check (result_views >= 0),
  usual_views     bigint check (usual_views > 0),
  result_multiple numeric(8,1) generated always as (
                    case when result_views is not null and usual_views > 0
                         then round(result_views::numeric / usual_views, 1) end) stored,
  updated_at      timestamptz not null default now()
);
create index idea_tracking_creator_idx on idea_tracking(creator_id, stage);
create index idea_tracking_cre_idx     on idea_tracking(cre_id) where result_multiple is not null;

create or replace function save_idea_tracking(
  p_unlock_id uuid, p_stage text, p_board text, p_planned_on date, p_notes text,
  p_posted_url text, p_posted_on date, p_result_views bigint, p_usual_views bigint
) returns void language plpgsql security definer set search_path = public as $$
declare u unlocks; old idea_tracking; v_new idea_tracking;
begin
  select * into u from unlocks where id = p_unlock_id;
  if not found or u.creator_id <> auth.uid() or u.status = 'reversed' then raise exception 'UNLOCK_NOT_FOUND'; end if;
  if p_result_views is not null and p_result_views < 0 then raise exception 'INVALID_VIEWS'; end if;
  if p_usual_views is not null and p_usual_views <= 0 then raise exception 'INVALID_VIEWS'; end if;
  if p_posted_on is not null and p_posted_on > current_date then raise exception 'POSTED_DATE_IN_FUTURE'; end if;
  select * into old from idea_tracking where unlock_id = u.id;

  insert into idea_tracking(unlock_id, creator_id, cre_id, stage, board, planned_on, notes, posted_url, posted_on,
                            result_views, usual_views, updated_at)
  values (u.id, u.creator_id, u.cre_id, coalesce(p_stage, 'saved'), nullif(btrim(p_board), ''), p_planned_on,
          nullif(btrim(p_notes), ''), nullif(btrim(p_posted_url), ''), p_posted_on, p_result_views, p_usual_views, now())
  on conflict (unlock_id) do update set
    stage = excluded.stage, board = excluded.board, planned_on = excluded.planned_on, notes = excluded.notes,
    posted_url = excluded.posted_url, posted_on = excluded.posted_on, result_views = excluded.result_views,
    usual_views = excluded.usual_views, updated_at = now()
  returning * into v_new;

  -- Close the loop: tell the researcher how their idea did the first time a result is logged.
  if v_new.result_multiple is not null and (old.unlock_id is null or old.result_multiple is null) then
    perform notify(u.cre_id, 'idea_result', 'A creator posted your idea',
                   'It got ' || v_new.result_multiple || '× their usual views.', '/pitches');
  elsif v_new.stage = 'posted' and (old.unlock_id is null or old.stage <> 'posted') then
    perform notify(u.cre_id, 'idea_posted', 'A creator posted your idea', null, '/pitches');
  end if;
end $$;

-- What the researcher may see about their own ideas.
create view cre_idea_results as
  select t.unlock_id, u.pitch_id, t.cre_id, t.stage, t.posted_on, t.result_multiple, t.updated_at
    from idea_tracking t join unlocks u on u.id = t.unlock_id
   where t.cre_id = auth.uid() and u.status <> 'reversed';

-- Public track record: results creators logged after using a researcher's ideas.
create view cre_result_stats as
  select t.cre_id,
         count(*) filter (where t.stage = 'posted')::int                         as ideas_posted,
         count(t.result_multiple)::int                                           as results_logged,
         round(avg(t.result_multiple), 1)                                        as avg_result_multiple,
         count(*) filter (where t.result_multiple >= 2)::int                     as hits
    from idea_tracking t join unlocks u on u.id = t.unlock_id and u.status <> 'reversed'
   group by t.cre_id;

-- Repeat business: creators who came back and unlocked again.
create view cre_repeat_stats as
  select cre_id,
         count(*)::int                                  as unlocks_total,
         count(distinct creator_id)::int                as buyers,
         count(*) filter (where n >= 2)::int            as repeat_buyers
    from (select cre_id, creator_id, count(*) as n from unlocks where status <> 'reversed' group by cre_id, creator_id) x
   group by cre_id;

-- ---------------------------------------------------------------
-- Pitch review tools for creators
-- ---------------------------------------------------------------
-- Shortlist: private to the creator.
create table pitch_shortlist (
  pitch_id   uuid primary key references pitches(id) on delete cascade,
  creator_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Pass with a reason: the researcher sees it, so they learn what this creator wants.
create table pitch_feedback (
  pitch_id   uuid primary key references pitches(id) on delete cascade,
  creator_id uuid not null references profiles(id) on delete cascade,
  reason     text not null check (reason in ('not_my_style','seen_it','score_too_low','off_brief','too_hard_to_film','other')),
  note       text check (char_length(note) <= 400),
  created_at timestamptz not null default now()
);

create or replace function _own_submitted_pitch(p_pitch_id uuid) returns pitches
language plpgsql security definer set search_path = public as $$
declare p pitches;
begin
  select p2.* into p from pitches p2 join briefs b on b.id = p2.brief_id
   where p2.id = p_pitch_id and b.creator_id = auth.uid();
  if not found then raise exception 'PITCH_NOT_FOUND'; end if;
  return p;
end $$;
revoke execute on function _own_submitted_pitch(uuid) from public, anon, authenticated;

create or replace function set_pitch_shortlist(p_pitch_id uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare p pitches;
begin
  p := _own_submitted_pitch(p_pitch_id);
  if p_on then
    insert into pitch_shortlist(pitch_id, creator_id) values (p.id, auth.uid()) on conflict do nothing;
  else
    delete from pitch_shortlist where pitch_id = p.id;
  end if;
end $$;

create or replace function pass_pitch(p_pitch_id uuid, p_reason text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare p pitches; m record; b briefs;
begin
  p := _own_submitted_pitch(p_pitch_id);
  if p.status <> 'submitted' then raise exception 'PITCH_NOT_AVAILABLE'; end if;
  select * into m from mask_contacts(p_note);
  insert into pitch_feedback(pitch_id, creator_id, reason, note) values (p.id, auth.uid(), p_reason, nullif(btrim(m.masked), ''))
  on conflict (pitch_id) do update set reason = excluded.reason, note = excluded.note, created_at = now();
  delete from pitch_shortlist where pitch_id = p.id;
  select * into b from briefs where id = p.brief_id;
  perform notify(p.cre_id, 'pitch_passed', 'Feedback on your pitch', 'The creator passed on it. See why on the brief.', '/briefs/' || b.id);
end $$;

create or replace function unpass_pitch(p_pitch_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p pitches;
begin
  p := _own_submitted_pitch(p_pitch_id);
  delete from pitch_feedback where pitch_id = p.id;
end $$;

-- ---------------------------------------------------------------
-- Saved researchers and brief invites
-- ---------------------------------------------------------------
create table favorite_cres (
  creator_id uuid not null references profiles(id) on delete cascade,
  cre_id     uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (creator_id, cre_id)
);

create or replace function toggle_favorite_cre(p_cre_id uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_role() is distinct from 'creator' then raise exception 'NOT_CREATOR'; end if;
  if p_on then
    if not exists (select 1 from cre_profiles c join profiles pr on pr.id = c.user_id
                    where c.user_id = p_cre_id and c.kyc_status = 'approved' and pr.suspended_at is null) then
      raise exception 'CRE_NOT_FOUND';
    end if;
    insert into favorite_cres(creator_id, cre_id) values (auth.uid(), p_cre_id) on conflict do nothing;
  else
    delete from favorite_cres where creator_id = auth.uid() and cre_id = p_cre_id;
  end if;
end $$;

create table brief_invites (
  brief_id   uuid not null references briefs(id) on delete cascade,
  cre_id     uuid not null references profiles(id) on delete cascade,
  invited_at timestamptz not null default now(),
  primary key (brief_id, cre_id)
);
create index brief_invites_cre_idx on brief_invites(cre_id, invited_at desc);

create or replace function invite_to_brief(p_brief_id uuid, p_cre_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b briefs; v_count int;
begin
  select * into b from briefs where id = p_brief_id;
  if not found or b.creator_id <> auth.uid() then raise exception 'BRIEF_NOT_FOUND'; end if;
  if b.status <> 'open' or b.deadline_at <= now() then raise exception 'BRIEF_NOT_OPEN'; end if;
  if not exists (select 1 from cre_profiles c join profiles pr on pr.id = c.user_id
                  where c.user_id = p_cre_id and c.kyc_status = 'approved' and pr.suspended_at is null) then
    raise exception 'CRE_NOT_FOUND';
  end if;
  select count(*) into v_count from brief_invites where brief_id = b.id;
  if v_count >= 25 then raise exception 'TOO_MANY_INVITES'; end if;
  insert into brief_invites(brief_id, cre_id) values (b.id, p_cre_id) on conflict do nothing;
  if found then
    perform notify(p_cre_id, 'brief_invite', 'You were invited to pitch: ' || b.title,
                   money_text(b.price_per_idea_cents, b.currency) || ' per idea', '/briefs/' || b.id);
  end if;
end $$;

-- ---------------------------------------------------------------
-- Researcher swipe file: candidate outliers saved before there's a brief for them.
-- ---------------------------------------------------------------
create table swipe_items (
  id                   uuid primary key default gen_random_uuid(),
  cre_id               uuid not null references profiles(id) on delete cascade,
  platform             content_platform not null,
  niche_id             int references niches(id),
  title                text not null check (char_length(title) between 3 and 120),
  source_url           text not null check (char_length(source_url) <= 500 and source_url ~* '^https?://'),
  source_views         bigint not null check (source_views > 0),
  channel_median_views bigint not null check (channel_median_views > 0),
  multiplier           numeric(8,1) generated always as (round(source_views::numeric / channel_median_views, 1)) stored,
  source_posted_on     date check (source_posted_on <= current_date),
  hook_category        text check (hook_category in (
                         'question','bold_claim','number_list','story','before_after','myth_bust',
                         'tutorial','reaction','pov','challenge','controversy','other')),
  notes                text check (char_length(notes) <= 2000),
  status               text not null default 'saved' check (status in ('saved','pitched','archived')),
  created_at           timestamptz not null default now()
);
create index swipe_items_cre_idx on swipe_items(cre_id, created_at desc);

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['idea_tracking','pitch_shortlist','pitch_feedback','favorite_cres','brief_invites','swipe_items'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "admin_read_all" on %I for select to authenticated using (is_admin())', t);
  end loop;
end $$;

create policy "tracking_creator_read"  on idea_tracking   for select to authenticated using (creator_id = auth.uid());
create policy "shortlist_creator_read" on pitch_shortlist for select to authenticated using (creator_id = auth.uid());
create policy "feedback_party_read"    on pitch_feedback  for select to authenticated
  using (creator_id = auth.uid() or exists (select 1 from pitches p where p.id = pitch_id and p.cre_id = auth.uid()));
create policy "favorites_creator_read" on favorite_cres   for select to authenticated using (creator_id = auth.uid());
create policy "invites_party_read"     on brief_invites   for select to authenticated
  using (cre_id = auth.uid() or exists (select 1 from briefs b where b.id = brief_id and b.creator_id = auth.uid()));

create policy "swipe_own_read"   on swipe_items for select to authenticated using (cre_id = auth.uid());
create policy "swipe_own_insert" on swipe_items for insert to authenticated with check (cre_id = auth.uid() and my_role() = 'cre');
create policy "swipe_own_update" on swipe_items for update to authenticated using (cre_id = auth.uid()) with check (cre_id = auth.uid());
create policy "swipe_own_delete" on swipe_items for delete to authenticated using (cre_id = auth.uid());

-- ---------------------------------------------------------------
-- Public researcher view: add track record and repeat business (new columns go at the end).
-- ---------------------------------------------------------------
create or replace view public_cres as
  select pr.id, pr.display_name, pr.handle, pr.country_code, pr.created_at,
         c.headline, c.bio, c.platforms, c.years_experience, c.accepting_work,
         coalesce(array(select n.name from cre_niches cn join niches n on n.id = cn.niche_id
                         where cn.user_id = pr.id order by n.name), '{}') as niches,
         coalesce(array(select cn.niche_id from cre_niches cn where cn.user_id = pr.id), '{}') as niche_ids,
         s.pitches_sent, s.pitches_unlocked, s.unlock_rate_pct,
         r.avg_rating, coalesce(r.review_count, 0) as review_count,
         coalesce(rp.unlocks_total, 0)  as unlocks_total,
         coalesce(rp.buyers, 0)         as buyers,
         coalesce(rp.repeat_buyers, 0)  as repeat_buyers,
         coalesce(rs.ideas_posted, 0)   as ideas_posted,
         coalesce(rs.results_logged, 0) as results_logged,
         rs.avg_result_multiple,
         coalesce(rs.hits, 0)           as hits
    from profiles pr
    join cre_profiles c on c.user_id = pr.id and c.kyc_status = 'approved'
    left join cre_public_stats s on s.cre_id = pr.id
    left join review_stats r on r.reviewee_id = pr.id
    left join cre_repeat_stats rp on rp.cre_id = pr.id
    left join cre_result_stats rs on rs.cre_id = pr.id
   where pr.suspended_at is null;

revoke all on cre_idea_results, cre_result_stats, cre_repeat_stats from anon, authenticated;
grant select on cre_result_stats, cre_repeat_stats, public_cres to anon, authenticated;
grant select on cre_idea_results to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'save_idea_tracking(uuid, text, text, date, text, text, date, bigint, bigint)',
    'set_pitch_shortlist(uuid, boolean)', 'pass_pitch(uuid, text, text)', 'unpass_pitch(uuid)',
    'toggle_favorite_cre(uuid, boolean)', 'invite_to_brief(uuid, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ===== supabase/migrations/20261004000007_rate_limits_and_account_closure.sql =====
-- Outlier Desk — login/sign-up rate limiting and self-service account closure.

-- ---------------------------------------------------------------
-- Rate limits. Counted in the database so they work on serverless hosting with no Redis.
-- Called with the service role from server actions (see lib/rate-limit.ts).
-- ---------------------------------------------------------------
create table rate_limits (
  key          text primary key,            -- e.g. 'login:ip:1.2.3.4' or 'login:email:a@b.c'
  window_start timestamptz not null default now(),
  hits         integer not null default 0
);
alter table rate_limits enable row level security;   -- no policies: service role only

-- Returns true when the call is allowed, false when the limit for this window is exhausted.
create or replace function rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare r rate_limits;
begin
  insert into rate_limits(key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rate_limits.hits + 1 end,
        window_start = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now() else rate_limits.window_start end
  returning * into r;
  return r.hits <= p_limit;
end $$;
revoke execute on function rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function rate_limit_hit(text, int, int) to service_role;

-- Housekeeping, run by the scheduled job.
create or replace function prune_rate_limits()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from rate_limits where window_start < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function prune_rate_limits() from public, anon, authenticated;
grant execute on function prune_rate_limits() to service_role;

-- ---------------------------------------------------------------
-- Account closure. The person asks from Settings; the database refuses while money or an open
-- dispute is still attached, otherwise scrubs everything personal. Money history and the ledger
-- stay (they are the platform's records), tied to an anonymised profile.
-- ---------------------------------------------------------------
create or replace function close_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_role user_role;
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  select role into v_role from profiles where id = v_uid;
  if v_role = 'admin' then raise exception 'ADMIN_CANNOT_CLOSE'; end if;

  -- Blockers that would strand money or an unresolved case
  if exists (select 1 from unlocks where cre_id = v_uid and status in ('held','available','disputed')) then raise exception 'EARNINGS_PENDING'; end if;
  if exists (select 1 from payouts where cre_id = v_uid and status in ('requested','processing')) then raise exception 'PAYOUT_PENDING'; end if;
  if exists (select 1 from briefs where creator_id = v_uid and status in ('awaiting_payment','open','closed')) then raise exception 'BRIEF_OPEN'; end if;
  if exists (select 1 from disputes d join unlocks u on u.id = d.unlock_id
              where v_uid in (u.creator_id, u.cre_id) and d.status in ('awaiting_cre','awaiting_admin')) then raise exception 'DISPUTE_OPEN'; end if;

  -- Waiting pitches are withdrawn so creators don't see cards from a closed account
  update pitches set status = 'withdrawn' where cre_id = v_uid and status = 'submitted';

  -- Scrub personal data
  delete from kyc_submissions where user_id = v_uid;
  -- Payout methods that were used for a paid withdrawal are referenced by the money history: keep the
  -- row (kind + last four digits, as on a bank statement) but erase the name and the encrypted number.
  delete from payout_methods where user_id = v_uid and not exists (select 1 from payouts p where p.method_id = payout_methods.id);
  update payout_methods set account_name = 'Deleted user', account_number_enc = '', is_default = false where user_id = v_uid;
  delete from portfolio_items where cre_id = v_uid;
  delete from cre_niches where user_id = v_uid;
  delete from swipe_items where cre_id = v_uid;
  delete from favorite_cres where creator_id = v_uid or cre_id = v_uid;
  delete from idea_tracking where creator_id = v_uid;
  delete from notifications where user_id = v_uid;
  delete from brief_invites where cre_id = v_uid;
  update cre_profiles set headline = null, bio = null, platforms = '{}', accepting_work = false, kyc_status = 'not_started',
         kyc_reject_reason = null where user_id = v_uid;
  update creator_profiles set brand_name = null, channel_url = null where user_id = v_uid;
  update profiles set display_name = 'Deleted user', handle = null, country_code = null,
         suspended_at = now(), suspended_reason = 'account_closed' where id = v_uid;
  perform audit('account.close', 'profile', v_uid::text, null);
end $$;
revoke execute on function close_my_account() from public, anon;
grant execute on function close_my_account() to authenticated;

-- ===== supabase/migrations/20261008000008_security_fixes.sql =====
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

-- ===== supabase/migrations/20261008000009_ph_friendly_checks.sql =====
-- Outlier Desk — fewer false alarms in forms used from the Philippines.

-- 1. "Posted on" dates are checked against today's date in the Philippines, not UTC. Between midnight
--    and 8 am Manila time, UTC is still on yesterday, so a video posted this morning was rejected.
alter function submit_pitch set timezone = 'Asia/Manila';
alter function save_idea_tracking set timezone = 'Asia/Manila';
alter table swipe_items drop constraint if exists swipe_items_source_posted_on_check;
alter table swipe_items add constraint swipe_items_source_posted_on_check
  check (source_posted_on <= (now() at time zone 'Asia/Manila')::date);

-- 2. Payment app names (GCash, PayPal, Maya...) are everyday topics for Filipino finance creators
--    ("Budgeting with GCash"), so they no longer count as contact details on their own. Account numbers,
--    emails, links and handles are still caught by the other patterns; messaging apps still count.
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
    '\m(whatsapp|telegram|viber|discord|skype|wechat)\M'                       -- messaging apps
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

-- ===== supabase/migrations/20261009000010_alerts_and_persona.sql =====
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

-- ===== supabase/migrations/20261010000011_variations_response_digest.sql =====
-- Outlier Desk — request a variation, researcher response time, weekly digest opt-out.

-- ---------------------------------------------------------------
-- 1. Request a variation: one free alternate hook or angle per unlock (the "revision" pattern).
--    The creator asks once with a short note; the researcher answers once. Both texts are masked.
-- ---------------------------------------------------------------
create table variation_requests (
  unlock_id    uuid primary key references unlocks(id) on delete cascade,
  creator_id   uuid not null references profiles(id),
  cre_id       uuid not null references profiles(id),
  note         text not null check (char_length(note) between 10 and 1000),
  response     text check (char_length(response) between 10 and 3000),
  requested_at timestamptz not null default now(),
  answered_at  timestamptz
);
create index variation_requests_cre_idx on variation_requests(cre_id, answered_at);
alter table variation_requests enable row level security;
create policy "variation_party_read" on variation_requests for select to authenticated
  using (auth.uid() in (creator_id, cre_id));
-- Writes go through the two functions below only.

create or replace function request_variation(p_unlock_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare u unlocks; m record;
begin
  select * into u from unlocks where id = p_unlock_id;
  if not found or u.creator_id <> auth.uid() then raise exception 'UNLOCK_NOT_FOUND'; end if;
  if u.status = 'reversed' then raise exception 'NOT_ALLOWED'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 10 then raise exception 'VARIATION_NOTE_TOO_SHORT'; end if;
  if exists (select 1 from variation_requests where unlock_id = u.id) then raise exception 'VARIATION_ALREADY_REQUESTED'; end if;
  select * into m from mask_contacts(btrim(p_note));
  insert into variation_requests(unlock_id, creator_id, cre_id, note) values (u.id, u.creator_id, u.cre_id, left(m.masked, 1000));
  perform notify(u.cre_id, 'variation_requested', 'A creator asked for a variation', left(m.masked, 140), '/pitches#variations');
end $$;

create or replace function answer_variation(p_unlock_id uuid, p_response text)
returns void language plpgsql security definer set search_path = public as $$
declare v variation_requests; m record;
begin
  select * into v from variation_requests where unlock_id = p_unlock_id for update;
  if not found or v.cre_id <> auth.uid() then raise exception 'VARIATION_NOT_FOUND'; end if;
  if v.answered_at is not null then raise exception 'VARIATION_ALREADY_ANSWERED'; end if;
  if char_length(btrim(coalesce(p_response, ''))) < 10 then raise exception 'VARIATION_RESPONSE_TOO_SHORT'; end if;
  select * into m from mask_contacts(btrim(p_response));
  update variation_requests set response = left(m.masked, 3000), answered_at = now() where unlock_id = v.unlock_id;
  perform notify(v.creator_id, 'variation_answered', 'Your variation is ready', left(m.masked, 140), '/unlocks');
end $$;

revoke execute on function request_variation(uuid, text) from public, anon;
revoke execute on function answer_variation(uuid, text) from public, anon;
grant execute on function request_variation(uuid, text), answer_variation(uuid, text) to authenticated;

-- Suspended accounts can't use it either (same rule as disputes and messages).
create trigger variation_not_suspended before insert or update on variation_requests
  for each row execute function block_suspended_actor();

-- ---------------------------------------------------------------
-- 2. Response time: how quickly a researcher first replies after a creator writes in a conversation.
--    Only aggregates are exposed; message contents stay private.
-- ---------------------------------------------------------------
create or replace view cre_response_stats as
with asked as (
  select t.id as thread_id, t.cre_id,
         (select min(created_at) from messages m where m.thread_id = t.id and m.sender_id = t.creator_id) as asked_at
    from threads t
), replied as (
  select a.cre_id,
         (select min(created_at) from messages m where m.thread_id = a.thread_id and m.sender_id = a.cre_id and m.created_at > a.asked_at) - a.asked_at as took
    from asked a where a.asked_at is not null
)
select cre_id,
       count(took)::int as reply_samples,
       round((extract(epoch from percentile_cont(0.5) within group (order by took)) / 3600)::numeric, 1) as median_reply_hours
  from replied where took is not null
 group by cre_id;
grant select on cre_response_stats to anon, authenticated;

-- ---------------------------------------------------------------
-- 3. Weekly digest email: people can switch it off; each week is sent once.
-- ---------------------------------------------------------------
alter table profiles add column if not exists email_digest boolean not null default true;
create table digest_runs (
  week_start date primary key,
  sent_count integer not null default 0,
  ran_at     timestamptz not null default now()
);
alter table digest_runs enable row level security;   -- service role only

-- ===== supabase/migrations/20261011000012_youtube_views_check.sql =====
-- Outlier Desk — automatic YouTube views check on pitches.
-- When the app has a YouTube Data API key, it looks up the source video right after a pitch is
-- submitted and records whether the claimed views and post date match. Everyone who can see the
-- pitch sees the result (a badge); the real numbers stay with admins, since an exact view count
-- could help someone find the locked video.

alter table pitches
  add column views_check            text check (views_check in ('verified','mismatch','not_found')),
  add column views_checked_at       timestamptz,
  add column views_check_actual     bigint,
  add column views_check_posted_on  date;

grant select (views_check, views_checked_at) on pitches to authenticated;
-- views_check_actual and views_check_posted_on are written and read with the service key only.

-- ===== supabase/migrations/20261011000013_retainers.sql =====
-- Outlier Desk — retainers: a brief that repeats every month for a researcher the creator works with.
-- Each month the daily job copies the brief into a new draft and tells the creator to fund it. Paying
-- works exactly like any other brief; once it's live the researcher is invited automatically. Nothing
-- is charged without the creator pressing Pay, so there's no stored card and no surprise charge.

create table retainers (
  id                   uuid primary key default gen_random_uuid(),
  creator_id           uuid not null references profiles(id) on delete cascade,
  cre_id               uuid not null references profiles(id) on delete cascade,
  title                text not null,
  description          text not null,
  platform             content_platform not null,
  niche_id             int references niches(id),
  must_include         text,
  avoid                text,
  example_urls         text[] not null default '{}',
  min_multiplier       numeric(6,1) not null,
  max_video_age_days   int,
  price_per_idea_cents int not null,
  max_unlocks          int not null,
  deadline_days        int not null check (deadline_days between 1 and 30),
  day_of_month         int not null check (day_of_month between 1 and 28),
  next_run_on          date not null,
  active               boolean not null default true,
  paused_reason        text check (paused_reason in ('creator','researcher_unavailable','price_out_of_range','creator_suspended')),
  last_brief_id        uuid references briefs(id) on delete set null,
  created_at           timestamptz not null default now()
);
create index retainers_due_idx on retainers(next_run_on) where active;
create index retainers_creator_idx on retainers(creator_id, created_at desc);
create index retainers_cre_idx on retainers(cre_id);

alter table briefs add column retainer_id uuid references retainers(id) on delete set null;
grant select (retainer_id) on briefs to authenticated;

alter table retainers enable row level security;
create policy "retainer_party_read" on retainers for select to authenticated
  using (auth.uid() in (creator_id, cre_id) or is_admin());
-- Writes go through the functions below only.

-- The next date with this day of the month that is strictly after `after`.
create or replace function retainer_next_date(p_day int, p_after date)
returns date language sql immutable as $$
  select case when make_date(extract(year from p_after)::int, extract(month from p_after)::int, p_day) > p_after
              then make_date(extract(year from p_after)::int, extract(month from p_after)::int, p_day)
              else (make_date(extract(year from p_after)::int, extract(month from p_after)::int, p_day) + interval '1 month')::date end
$$;

create or replace function create_retainer(p_brief_id uuid, p_cre_id uuid, p_day_of_month int)
returns uuid language plpgsql security definer set search_path = public as $$
declare b briefs; v_id uuid; v_deadline int;
begin
  if my_role() is distinct from 'creator' then raise exception 'NOT_CREATOR'; end if;
  select * into b from briefs where id = p_brief_id;
  if not found or b.creator_id <> auth.uid() then raise exception 'BRIEF_NOT_FOUND'; end if;
  if b.status in ('draft','awaiting_payment','cancelled') then raise exception 'RETAINER_NEEDS_FUNDED_BRIEF'; end if;
  if p_day_of_month is null or p_day_of_month not between 1 and 28 then raise exception 'RETAINER_DAY_OUT_OF_RANGE'; end if;
  if not exists (select 1 from cre_profiles c join profiles pr on pr.id = c.user_id
                  where c.user_id = p_cre_id and c.kyc_status = 'approved' and pr.suspended_at is null) then
    raise exception 'CRE_NOT_FOUND';
  end if;
  if (select count(*) from retainers where creator_id = auth.uid() and active) >= 10 then raise exception 'TOO_MANY_RETAINERS'; end if;
  if exists (select 1 from retainers where creator_id = auth.uid() and cre_id = p_cre_id and title = b.title) then
    raise exception 'RETAINER_EXISTS';
  end if;
  -- Same length of time to pitch as the original brief, rounded to whole days.
  v_deadline := least(30, greatest(1, round(extract(epoch from (b.deadline_at - coalesce(b.opened_at, b.created_at))) / 86400)::int));
  insert into retainers(creator_id, cre_id, title, description, platform, niche_id, must_include, avoid, example_urls,
                        min_multiplier, max_video_age_days, price_per_idea_cents, max_unlocks, deadline_days, day_of_month, next_run_on)
  values (b.creator_id, p_cre_id, b.title, b.description, b.platform, b.niche_id, b.must_include, b.avoid, b.example_urls,
          b.min_multiplier, b.max_video_age_days, b.price_per_idea_cents, b.max_unlocks, v_deadline, p_day_of_month,
          retainer_next_date(p_day_of_month, (now() at time zone 'Asia/Manila')::date))
  returning id into v_id;
  perform notify(p_cre_id, 'retainer_started', 'A creator put you on a monthly retainer',
                 b.title || ': you''ll be invited each month on day ' || p_day_of_month, '/briefs');
  return v_id;
end $$;

create or replace function set_retainer_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r retainers;
begin
  select * into r from retainers where id = p_id for update;
  if not found or r.creator_id <> auth.uid() then raise exception 'RETAINER_NOT_FOUND'; end if;
  if p_active then
    if (select count(*) from retainers where creator_id = auth.uid() and active and id <> r.id) >= 10 then raise exception 'TOO_MANY_RETAINERS'; end if;
    update retainers set active = true, paused_reason = null,
      next_run_on = greatest(next_run_on, retainer_next_date(day_of_month, (now() at time zone 'Asia/Manila')::date))
      where id = r.id;
  else
    update retainers set active = false, paused_reason = 'creator' where id = r.id;
  end if;
end $$;

create or replace function delete_retainer(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from retainers where id = p_id and creator_id = auth.uid();
  if not found then raise exception 'RETAINER_NOT_FOUND'; end if;
end $$;

-- Daily job (service role): make this month's draft for every retainer that is due.
-- Returns the drafts it made so the app can email the creators.
create or replace function run_retainers()
returns table (brief_id uuid, creator_id uuid, title text, total_charge_cents int, currency text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare r retainers; s platform_settings; v_today date := (now() at time zone 'Asia/Manila')::date;
        v_id uuid; v_budget int; v_fee int; v_reason text;
begin
  select * into s from platform_settings where id;
  for r in select * from retainers where active and next_run_on <= v_today order by next_run_on for update skip locked loop
    v_reason := null;
    if exists (select 1 from profiles where id = r.creator_id and suspended_at is not null) then v_reason := 'creator_suspended';
    elsif not exists (select 1 from cre_profiles c join profiles pr on pr.id = c.user_id
                       where c.user_id = r.cre_id and c.kyc_status = 'approved' and pr.suspended_at is null) then v_reason := 'researcher_unavailable';
    elsif r.price_per_idea_cents not between s.min_price_per_idea_cents and s.max_price_per_idea_cents then v_reason := 'price_out_of_range';
    end if;
    if v_reason is not null then
      update retainers set active = false, paused_reason = v_reason where id = r.id;
      if v_reason <> 'creator_suspended' then
        perform notify(r.creator_id, 'retainer_paused', 'Your monthly brief is paused: ' || r.title,
          case v_reason when 'researcher_unavailable' then 'The researcher can''t take briefs right now.'
                        else 'Its price is outside the current limits. Post a new brief to start again.' end, '/briefs');
      end if;
      continue;
    end if;
    -- Last month's draft still unpaid: don't pile up another one, just move to next month.
    if r.last_brief_id is not null and exists (select 1 from briefs where id = r.last_brief_id and status in ('draft','awaiting_payment')) then
      update retainers set next_run_on = retainer_next_date(r.day_of_month, v_today) where id = r.id;
      continue;
    end if;
    v_budget := r.price_per_idea_cents * r.max_unlocks;
    v_fee    := fee_cents(v_budget, s.creator_fee_bps);
    insert into briefs(creator_id, title, description, platform, niche_id, must_include, avoid, example_urls,
                       min_multiplier, max_video_age_days, currency, price_per_idea_cents, max_unlocks,
                       creator_fee_bps, cre_fee_bps, creator_fee_cents, total_charge_cents, deadline_at, retainer_id)
    values (r.creator_id, r.title, r.description, r.platform, r.niche_id, r.must_include, r.avoid, r.example_urls,
            greatest(r.min_multiplier, s.min_multiplier), r.max_video_age_days, s.default_currency, r.price_per_idea_cents, r.max_unlocks,
            s.creator_fee_bps, s.cre_fee_bps, v_fee, v_budget + v_fee, now() + make_interval(days => r.deadline_days), r.id)
    returning id into v_id;
    update retainers set last_brief_id = v_id, next_run_on = retainer_next_date(r.day_of_month, v_today) where id = r.id;
    perform notify(r.creator_id, 'retainer_draft', 'Your monthly brief is ready to fund: ' || r.title,
                   money_text(v_budget + v_fee, s.default_currency) || '. Pay to put it live; your researcher is invited automatically.', '/briefs/' || v_id);
    brief_id := v_id; creator_id := r.creator_id; title := r.title; total_charge_cents := v_budget + v_fee; currency := s.default_currency;
    return next;
  end loop;
end $$;

-- When a retainer's brief goes live, invite its researcher (same as pressing "Invite to pitch").
create or replace function invite_retainer_researcher()
returns trigger language plpgsql security definer set search_path = public as $$
declare r retainers;
begin
  select * into r from retainers where id = new.retainer_id;
  if found and exists (select 1 from cre_profiles c join profiles pr on pr.id = c.user_id
                        where c.user_id = r.cre_id and c.kyc_status = 'approved' and pr.suspended_at is null) then
    insert into brief_invites(brief_id, cre_id) values (new.id, r.cre_id) on conflict do nothing;
    perform notify(r.cre_id, 'brief_invite', 'Your monthly brief is live: ' || new.title,
                   money_text(new.price_per_idea_cents, new.currency) || ' per idea', '/briefs/' || new.id);
  end if;
  return new;
end $$;
create trigger briefs_retainer_invite after update of status on briefs
  for each row when (new.status = 'open' and old.status is distinct from 'open' and new.retainer_id is not null)
  execute function invite_retainer_researcher();

revoke execute on function create_retainer(uuid, uuid, int), set_retainer_active(uuid, boolean), delete_retainer(uuid),
  run_retainers(), invite_retainer_researcher(), retainer_next_date(int, date) from public, anon, authenticated;
grant execute on function create_retainer(uuid, uuid, int), set_retainer_active(uuid, boolean), delete_retainer(uuid) to authenticated;
grant execute on function run_retainers() to service_role;

-- Closing an account ends its retainers (both sides).
create or replace function end_retainers_on_close()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.suspended_reason = 'account_closed' and old.suspended_reason is distinct from 'account_closed' then
    update retainers set active = false, paused_reason = case when creator_id = new.id then 'creator' else 'researcher_unavailable' end
      where active and new.id in (creator_id, cre_id);
  end if;
  return new;
end $$;
revoke execute on function end_retainers_on_close() from public, anon, authenticated;
create trigger profiles_end_retainers after update of suspended_reason on profiles
  for each row execute function end_retainers_on_close();

-- ===== supabase/seed.sql =====
-- Niches (run automatically by `supabase db reset`; safe to re-run)
insert into niches (slug, name) values
  ('personal-finance','Personal finance'),
  ('investing','Investing'),
  ('side-hustles','Side hustles'),
  ('fitness','Fitness'),
  ('weight-loss','Weight loss'),
  ('business-coaching','Business & coaching'),
  ('marketing','Marketing & sales'),
  ('mindset','Mindset & self-improvement'),
  ('beauty-fashion','Beauty & fashion'),
  ('food-cooking','Food & cooking'),
  ('parenting','Parenting & family'),
  ('faith','Faith & Christian living'),
  ('real-estate','Real estate'),
  ('tech-ai','Tech & AI'),
  ('travel','Travel'),
  ('education','Education & study'),
  ('health-wellness','Health & wellness'),
  ('relationships','Relationships'),
  ('pets','Pets'),
  ('gaming','Gaming'),
  ('comedy','Comedy & entertainment'),
  ('home-diy','Home & DIY'),
  ('cars','Cars')
on conflict (slug) do nothing;
