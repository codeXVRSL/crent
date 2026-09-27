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
