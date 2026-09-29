# Outlier Desk — Full Website Build Specification

> **Version:** 1.0 · September 2026
> **Owner:** Save (solo founder, full-stack)
> **Status:** Ready to build. Working name "Outlier Desk" is not trademark-checked.
> **What this file is:** The single source of truth for building the Outlier Desk web app. It is written so a developer or an AI coding agent (Claude Code, Cursor, etc.) can build the product from top to bottom without extra briefing.

---

## 0. How to use this document

1. Read sections 1–3 to understand the product and the rules that must never break.
2. Build in the order of **Section 22 (Build Order)**. Each phase ends with acceptance criteria.
3. When handing this to an AI coding agent, paste this instruction first:

```
You are building Outlier Desk from the attached spec (outlier-desk-build-spec.md).
Follow the spec exactly. Build in the phase order in Section 22.
Never break the Non-Negotiable Rules in Section 3.
Use the exact database schema in Section 8 and the exact routes in Section 6.
After each phase, run the acceptance checks for that phase and report results.
If something in the spec is ambiguous, pick the simplest option that keeps
Section 3 intact, write the decision in DECISIONS.md, and continue.
```

---

## 1. Product summary

**One sentence:** Outlier Desk is a marketplace where content creators post research briefs and Content Research Experts (CREs) pitch proven, data-backed content ideas that creators pay to unlock.

**Think of it as:** Upwork, but only for content research, with a built-in way to stop idea theft.

### 1.1 The problem

- Creators need a steady supply of video ideas that are proven to work (outliers: videos that got far more views than the channel usually gets).
- Freelance research exists on Fiverr/Upwork, but it is buried, expensive (up to 20% fees) and has no way to show proof before the creator pays.
- CREs can't safely show an idea before being paid, because ideas are not protected by copyright. Once a creator sees it, they can use it for free.

### 1.2 The solution

1. The creator posts a **brief** and **funds it in advance** (money held by the payment provider).
2. CREs send **pitch cards**. A card shows the *proof* (outlier score, views, format, platform) but hides the *idea* (source video link, hook, breakdown, instructions).
3. The creator **unlocks** the cards they want. Unlocking reveals the hidden content and pays the CRE at that moment.
4. Unused budget is refunded when the brief closes.
5. Both sides review each other. Good pairs move to monthly **retainers** (Phase 2).

### 1.3 Three ways to buy (build order)

| Product | Phase | Description |
|---|---|---|
| **Idea Briefs** | MVP | Creator posts a brief, sets a price per idea and max unlocks, funds escrow. CREs pitch. Creator unlocks. |
| **Idea Packs** | Phase 2 | CREs list fixed packages (like Fiverr gigs), e.g. "15 fitness Shorts outliers with instructions, 48h, $60". |
| **Research Retainers** | Phase 2 | Monthly contracts: X ideas per week, paid in weekly milestones through escrow. |

### 1.4 Target users (MVP)

- **Creators (buyers):** Full-time short-form creators (TikTok, Reels, YouTube Shorts), coaches, personal brands, and social media agencies. Mostly US/UK/AU. Pay in USD by card.
- **CREs (sellers):** Content Research Experts, mostly in the Philippines to start. Paid out in PHP to GCash or bank.
- **Admin:** Save. Approves CREs, resolves disputes, manages payouts and flags.

### 1.5 Business model

| Fee | Default | Paid by | When |
|---|---|---|---|
| Creator marketplace fee | 5% (500 bps) | Creator | Added on top when funding a brief |
| CRE service fee | 10% (1000 bps) | CRE | Deducted from each unlock earning |
| Featured brief (Phase 2) | $10 | Creator | Optional at posting |
| CRE Pro (Phase 3) | ~$9/month | CRE | Subscription |

All fee values live in the `platform_settings` table and are **copied onto each brief when it is created** so later changes don't affect open briefs.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **CRE** | Content Research Expert. Finds proven content ideas and writes instructions for them. |
| **Outlier** | A video that performed far above its channel's normal views. |
| **Outlier score / multiplier** | `source_views ÷ channel_median_views`, shown to 1 decimal, e.g. `14.2×`. |
| **Brief** | A creator's request for ideas, with a price per idea and a max number of unlocks. |
| **Pitch card** | A CRE's submission to a brief. Has public fields (proof) and locked fields (the idea). |
| **Unlock** | The creator paying to reveal a pitch card's locked fields. Triggers the CRE's earning. |
| **Escrow / funded budget** | Money paid in advance by the creator and held until unlocks or refund. |
| **Hold period** | 72 hours after an unlock before the CRE earning becomes withdrawable (dispute window). |
| **Leakage** | Users moving a deal off-platform to avoid fees. |

---

## 3. Non-negotiable rules

These must hold everywhere. Every PR must be checked against them.

1. **Locked content never reaches the browser before unlock.** Locked fields live in a separate table (`pitch_secrets`) protected by Row Level Security. They are never selected in a query for a user who hasn't unlocked, never included in API responses, page props, HTML, logs sent to the client, or email previews. Hiding with CSS/blur is only visual decoration on placeholder text, never on real content.
2. **No brief is visible to CREs until it is fully funded.** Status must be `open`, which only a verified payment webhook can set.
3. **Unlocks are atomic.** One database function does the checks, creates the unlock, updates counters and writes ledger entries in a single transaction with row locks. No client-side money math.
4. **Money is stored as integer cents with a currency code.** Never floats. All fee math uses integer basis points and rounds half-up to the cent, in one shared function.
5. **Webhooks are verified and idempotent.** Verify the provider's signature/token. Process each provider event ID once.
6. **CREs must pass KYC before pitching** (Philippine Internet Transactions Act, RA 11967): full name, valid government ID, address, mobile number, email.
7. **Contact details are masked in chat and in pitch public fields** (emails, phone numbers, external links, social handles, messaging app names). Masked attempts create a `flag`.
8. **The platform never holds funds in the founder's personal account.** All money flows through the licensed payment provider.
9. **Every money movement writes a ledger entry.** Balances are computed from the ledger, never stored as a single editable number.
10. **Admin actions are audit-logged** (who, what, when, before/after).

---

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript (strict)** | React skills, server components keep secrets on the server |
| Styling | **Tailwind CSS v4 + shadcn/ui** | Fast, consistent components |
| Database/Auth/Storage | **Supabase** (Postgres 15+, Auth, Storage, Realtime) | Row Level Security, auth, file storage in one place |
| Server logic | Next.js Route Handlers + Server Actions; Postgres functions for money logic | Money logic lives in the database transaction |
| Payments | **Xendit xenPlatform** (primary) behind a `PaymentProvider` interface | PH-regulated, split payments, GCash/bank payouts |
| Email | **Resend** + React Email templates | Simple transactional email |
| Scheduled jobs | **Supabase pg_cron** (or Vercel Cron hitting a protected route) | Close expired briefs, release holds |
| Validation | **Zod** (shared schemas client + server) | One source of truth for inputs |
| Forms | React Hook Form + Zod resolver | |
| Data fetching | Server components + `@supabase/ssr`; TanStack Query only for live client views | |
| Hosting | **Vercel** (app) + Supabase Cloud (Singapore region `ap-southeast-1`) | Close to PH users |
| Analytics | PostHog (product events), Vercel Analytics (web vitals) | |
| Errors | Sentry | |
| Testing | Vitest (unit), Playwright (end-to-end), pgTAP or SQL test scripts (database functions) | |
| Rate limiting | Upstash Redis (`@upstash/ratelimit`) | Protect auth, pitches, messages |

> **Payment provider note:** Before building Phase 1 payments, confirm with Xendit sales: (a) accepting foreign cards in USD, (b) holding funds until unlock/refund (escrow-style) or split-on-settlement, (c) partial refunds on cards, (d) payouts to GCash and PH banks for sub-accounts, (e) fees. If Xendit can't do (a) or (b), use the same interface with another provider. Record the answer in `DECISIONS.md`.

---

## 5. Project structure

```
outlier-desk/
├─ app/
│  ├─ (marketing)/
│  │  ├─ page.tsx                      # Home
│  │  ├─ how-it-works/page.tsx
│  │  ├─ for-creators/page.tsx
│  │  ├─ for-cres/page.tsx
│  │  ├─ pricing/page.tsx
│  │  ├─ cres/page.tsx                 # Public CRE directory
│  │  ├─ cres/[handle]/page.tsx        # Public CRE profile
│  │  ├─ help/page.tsx
│  │  └─ legal/{terms,privacy,refunds,cre-agreement,acceptable-use}/page.tsx
│  ├─ (auth)/
│  │  ├─ login/page.tsx
│  │  ├─ signup/page.tsx
│  │  ├─ auth/callback/route.ts
│  │  └─ reset-password/page.tsx
│  ├─ (app)/
│  │  ├─ layout.tsx                    # Auth guard + app shell
│  │  ├─ onboarding/page.tsx           # Choose role
│  │  ├─ onboarding/creator/page.tsx
│  │  ├─ onboarding/cre/page.tsx       # Profile + KYC
│  │  ├─ dashboard/page.tsx            # Role-aware
│  │  ├─ briefs/page.tsx               # Creator: my briefs · CRE: open briefs feed
│  │  ├─ briefs/new/page.tsx
│  │  ├─ briefs/[id]/page.tsx          # Role-aware brief detail
│  │  ├─ briefs/[id]/pay/page.tsx
│  │  ├─ briefs/[id]/pitch/page.tsx    # CRE submits pitch
│  │  ├─ pitches/page.tsx              # CRE: my pitches
│  │  ├─ pitches/[id]/page.tsx         # Pitch detail (locked/unlocked)
│  │  ├─ unlocks/page.tsx              # Creator: all unlocked ideas (library)
│  │  ├─ messages/page.tsx
│  │  ├─ messages/[threadId]/page.tsx
│  │  ├─ wallet/page.tsx               # CRE earnings + withdraw
│  │  ├─ billing/page.tsx              # Creator payments + refunds
│  │  ├─ disputes/[id]/page.tsx
│  │  ├─ notifications/page.tsx
│  │  └─ settings/{profile,account,payout,notifications}/page.tsx
│  ├─ admin/
│  │  ├─ layout.tsx                    # Admin guard
│  │  ├─ page.tsx                      # Overview metrics
│  │  ├─ kyc/page.tsx
│  │  ├─ users/page.tsx · users/[id]/page.tsx
│  │  ├─ briefs/page.tsx
│  │  ├─ pitches/page.tsx
│  │  ├─ disputes/page.tsx · disputes/[id]/page.tsx
│  │  ├─ payouts/page.tsx
│  │  ├─ flags/page.tsx
│  │  ├─ settings/page.tsx             # Fees, thresholds
│  │  └─ audit/page.tsx
│  └─ api/
│     ├─ webhooks/xendit/route.ts
│     ├─ cron/close-briefs/route.ts
│     ├─ cron/release-holds/route.ts
│     └─ health/route.ts
├─ components/
│  ├─ ui/                              # shadcn
│  ├─ pitch-card/{PitchCardLocked,PitchCardUnlocked,OutlierBadge}.tsx
│  ├─ brief/{BriefForm,BriefCard,BriefStatusPill,BudgetMeter}.tsx
│  ├─ money/{Money,FeeBreakdown}.tsx
│  ├─ chat/{ThreadList,MessageList,Composer}.tsx
│  └─ layout/{SiteHeader,AppShell,Footer}.tsx
├─ lib/
│  ├─ supabase/{server.ts,client.ts,admin.ts,middleware.ts}
│  ├─ payments/{provider.ts,xendit.ts,mock.ts}
│  ├─ money.ts                         # cents helpers, fee math
│  ├─ outlier.ts                       # multiplier + tier
│  ├─ contact-filter.ts                # masking + flag detection
│  ├─ url-normalize.ts                 # platform + video id from URL
│  ├─ email/{send.ts,templates/*}
│  ├─ validation/*.ts                  # Zod schemas
│  ├─ auth/guards.ts
│  └─ analytics.ts
├─ supabase/
│  ├─ migrations/*.sql
│  ├─ seed.sql
│  └─ tests/*.sql
├─ tests/
│  ├─ unit/*.test.ts
│  └─ e2e/*.spec.ts
├─ middleware.ts
├─ DECISIONS.md
└─ .env.example
```

---

## 6. Routes, pages and access

Legend: **P** = public, **A** = any signed-in user, **C** = creator, **R** = CRE (approved KYC unless noted), **AD** = admin.

| Route | Access | Purpose |
|---|---|---|
| `/` | P | Landing page (Section 16 copy) |
| `/how-it-works` | P | Explains brief → pitch → unlock → pay, with a live example pitch card |
| `/for-creators` | P | Creator-focused sales page |
| `/for-cres` | P | CRE recruitment page, fees, KYC requirements |
| `/pricing` | P | Fee table and worked example |
| `/cres` | P | Directory of approved CREs, filter by niche/platform/rating |
| `/cres/[handle]` | P | CRE profile: bio, niches, platforms, portfolio (public proof only), ratings, stats |
| `/help` | P | FAQ |
| `/legal/*` | P | Terms, Privacy, Refunds, CRE Agreement, Acceptable Use |
| `/login`, `/signup`, `/reset-password` | P | Supabase Auth (email+password, magic link, Google) |
| `/onboarding` | A | Choose role (creator or CRE). One role per account in MVP. |
| `/onboarding/creator` | A | Display name, brand/channel name, main platform, niches, country, agree to Terms |
| `/onboarding/cre` | A | Profile + KYC form (Section 9.1). Status → `pending` |
| `/dashboard` | C, R (any KYC status) | Role-aware home (Section 7) |
| `/briefs` | C, R | Creator: own briefs by status. CRE: feed of `open` briefs matching niches/platforms |
| `/briefs/new` | C | Brief form (Section 9.2) |
| `/briefs/[id]` | C (owner), R, AD | Creator view: pitch cards grid, budget meter, unlock buttons. CRE view: brief details + "Pitch an idea" + own pitches on this brief |
| `/briefs/[id]/pay` | C (owner) | Fee breakdown + redirect to provider checkout |
| `/briefs/[id]/pitch` | R | Pitch form (Section 9.3) |
| `/pitches` | R | CRE's pitches with status |
| `/pitches/[id]` | owner CRE, brief creator, AD | Locked or unlocked view depending on access |
| `/unlocks` | C | Library of all unlocked ideas with search + export to CSV |
| `/messages`, `/messages/[threadId]` | C, R | Threads tied to a brief or pitch |
| `/wallet` | R | Pending, available, paid out; withdraw form |
| `/billing` | C | Payments, receipts, refunds |
| `/disputes/[id]` | parties, AD | Dispute timeline and evidence |
| `/notifications` | A | In-app notifications |
| `/settings/*` | A | Profile, account, payout method (CRE), notification preferences |
| `/admin/*` | AD | Admin panel (Section 13) |

**Middleware rules**
- Not signed in → redirect app routes to `/login?next=…`.
- Signed in but no role → redirect to `/onboarding`.
- CRE with KYC not `approved` → can view dashboard, profile, settings, and a read-only brief feed with a banner "Your verification is under review. You can pitch once approved." Pitch routes return 403.
- `admin/*` requires `profiles.role = 'admin'`.
- Suspended users (`profiles.suspended_at is not null`) → `/suspended` page only.

---

## 7. Dashboards

### 7.1 Creator dashboard
- **Top row (summary):** Open briefs · New pitches waiting · Ideas unlocked this month · Budget remaining in open briefs.
- **Needs attention list:** briefs with new pitches, briefs closing in < 24h, disputes awaiting response, unpaid draft briefs.
- **Recent pitches:** last 6 pitch cards across all briefs (locked view) with Unlock buttons.
- **CTA:** "Post a brief".

### 7.2 CRE dashboard
- **Top row:** Pending earnings (in hold) · Available to withdraw · Unlock rate (unlocked ÷ submitted, last 90 days) · Average rating.
- **Matching briefs:** open briefs in the CRE's niches/platforms, sorted by newest, showing price per idea, unlocks left, time left, creator's unlock-rate badge.
- **My recent pitches:** status pills.
- **KYC banner** if not approved.

---

## 8. Database schema (Supabase / Postgres)

Put this in `supabase/migrations/0001_init.sql`. Split into more files if preferred, keeping order.

```sql
-- =========================================================
-- Extensions
-- =========================================================
create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;

-- =========================================================
-- Enums
-- =========================================================
create type user_role        as enum ('creator','cre','admin');
create type kyc_status       as enum ('not_started','pending','approved','rejected');
create type content_platform as enum ('tiktok','instagram_reels','youtube_shorts','youtube_long','facebook_reels','x','linkedin','other');
create type brief_status     as enum ('draft','awaiting_payment','open','closed','settled','cancelled');
create type pitch_status     as enum ('submitted','unlocked','withdrawn','expired','refunded');
create type unlock_status    as enum ('held','available','paid_out','disputed','reversed');
create type dispute_status   as enum ('open','awaiting_cre','awaiting_admin','resolved_creator','resolved_cre','cancelled');
create type payment_status   as enum ('pending','paid','failed','expired','refunded','partially_refunded');
create type payout_status    as enum ('requested','approved','processing','paid','failed','cancelled');
create type ledger_kind      as enum (
  'brief_funding',      -- creator paid budget (credit to escrow)
  'creator_fee',        -- platform revenue from creator
  'unlock_gross',       -- escrow → CRE (gross)
  'cre_fee',            -- CRE → platform revenue
  'refund',             -- escrow → creator
  'creator_fee_refund', -- platform → creator
  'payout',             -- CRE available → paid out
  'dispute_reversal',   -- CRE → creator after dispute
  'adjustment'          -- admin manual, requires note
);
create type flag_kind        as enum ('contact_leak','duplicate_source','fake_proof','abuse','spam','other');
create type notif_kind       as enum (
  'brief_funded','new_pitch','pitch_unlocked','brief_closing','brief_closed',
  'refund_issued','earning_available','payout_paid','payout_failed',
  'kyc_approved','kyc_rejected','dispute_opened','dispute_updated','dispute_resolved',
  'new_message','review_received'
);

-- =========================================================
-- Settings (single row)
-- =========================================================
create table platform_settings (
  id                     boolean primary key default true check (id),
  creator_fee_bps        integer not null default 500   check (creator_fee_bps between 0 and 3000),
  cre_fee_bps            integer not null default 1000  check (cre_fee_bps between 0 and 3000),
  hold_hours             integer not null default 72,
  min_price_per_idea_cents integer not null default 300,     -- $3
  max_price_per_idea_cents integer not null default 50000,   -- $500
  min_multiplier         numeric(6,1) not null default 3.0,
  min_payout_cents       integer not null default 1000,      -- $10
  max_open_briefs_per_creator integer not null default 10,
  max_pitches_per_cre_per_brief integer not null default 5,
  default_currency       char(3) not null default 'USD',
  updated_at             timestamptz not null default now()
);
insert into platform_settings default values;

-- =========================================================
-- Users
-- =========================================================
create table profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  role           user_role,
  display_name   text not null default '',
  handle         citext unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  avatar_path    text,
  country_code   char(2),
  timezone       text default 'UTC',
  suspended_at   timestamptz,
  suspended_reason text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table creator_profiles (
  user_id        uuid primary key references profiles(id) on delete cascade,
  brand_name     text,
  main_platform  content_platform,
  channel_url    text,
  follower_band  text check (follower_band in ('<10k','10k-50k','50k-200k','200k-1M','1M+')),
  company_name   text,
  is_agency      boolean not null default false
);

create table cre_profiles (
  user_id          uuid primary key references profiles(id) on delete cascade,
  headline         text check (char_length(headline) <= 90),
  bio              text check (char_length(bio) <= 1200),
  platforms        content_platform[] not null default '{}',
  years_experience smallint check (years_experience between 0 and 30),
  languages        text[] not null default '{en}',
  kyc_status       kyc_status not null default 'not_started',
  kyc_reviewed_at  timestamptz,
  kyc_reviewed_by  uuid references profiles(id),
  kyc_reject_reason text,
  accepting_work   boolean not null default true
);

-- Private KYC data (ITA RA 11967). Only owner + admin can read.
create table kyc_submissions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  legal_name      text not null,
  birth_date      date not null,
  address_line    text not null,
  city            text not null,
  province        text not null,
  postal_code     text not null,
  country_code    char(2) not null default 'PH',
  mobile_number   text not null,
  id_type         text not null check (id_type in ('philsys','passport','drivers_license','umid','prc','postal','voters','other')),
  id_front_path   text not null,   -- storage: kyc/{user_id}/...
  id_back_path    text,
  selfie_path     text not null,
  business_reg_no text,            -- optional DTI/SEC number
  tin             text,            -- optional BIR TIN
  submitted_at    timestamptz not null default now()
);

-- =========================================================
-- Taxonomy
-- =========================================================
create table niches (
  id      serial primary key,
  slug    text unique not null,
  name    text not null,
  parent_id integer references niches(id)
);
create table cre_niches     (user_id uuid references profiles(id) on delete cascade, niche_id int references niches(id), primary key(user_id,niche_id));
create table creator_niches (user_id uuid references profiles(id) on delete cascade, niche_id int references niches(id), primary key(user_id,niche_id));

-- =========================================================
-- CRE portfolio (public proof of past finds)
-- =========================================================
create table portfolio_items (
  id               uuid primary key default gen_random_uuid(),
  cre_id           uuid not null references profiles(id) on delete cascade,
  platform         content_platform not null,
  niche_id         int references niches(id),
  title            text not null check (char_length(title) <= 120),
  source_url       text not null,
  source_views     bigint not null check (source_views > 0),
  channel_median_views bigint not null check (channel_median_views > 0),
  multiplier       numeric(8,1) generated always as (round(source_views::numeric / channel_median_views, 1)) stored,
  result_note      text check (char_length(result_note) <= 400), -- e.g. "Client remake got 420k views"
  proof_path       text,
  created_at       timestamptz not null default now()
);

-- =========================================================
-- Briefs
-- =========================================================
create table briefs (
  id                    uuid primary key default gen_random_uuid(),
  creator_id            uuid not null references profiles(id) on delete restrict,
  title                 text not null check (char_length(title) between 8 and 100),
  description           text not null check (char_length(description) between 40 and 3000),
  platform              content_platform not null,
  niche_id              int not null references niches(id),
  audience_notes        text check (char_length(audience_notes) <= 1000),
  must_include          text check (char_length(must_include) <= 1000),
  avoid                 text check (char_length(avoid) <= 1000),
  example_urls          text[] not null default '{}' check (array_length(example_urls,1) is null or array_length(example_urls,1) <= 5),
  min_multiplier        numeric(6,1) not null default 3.0,
  max_video_age_days    integer check (max_video_age_days between 1 and 3650),
  currency              char(3) not null default 'USD',
  price_per_idea_cents  integer not null check (price_per_idea_cents > 0),
  max_unlocks           integer not null check (max_unlocks between 1 and 100),
  creator_fee_bps       integer not null,   -- snapshot at creation
  cre_fee_bps           integer not null,   -- snapshot at creation
  budget_cents          integer generated always as (price_per_idea_cents * max_unlocks) stored,
  creator_fee_cents     integer not null,   -- computed by create_brief()
  total_charge_cents    integer not null,   -- budget + fee
  unlocks_used          integer not null default 0 check (unlocks_used >= 0),
  status                brief_status not null default 'draft',
  deadline_at           timestamptz not null,
  opened_at             timestamptz,
  closed_at             timestamptz,
  settled_at            timestamptz,
  close_reason          text check (close_reason in ('deadline','max_unlocks','creator_closed','admin','cancelled_unpaid')),
  is_featured           boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint unlocks_within_max check (unlocks_used <= max_unlocks),
  constraint deadline_window check (deadline_at > created_at)
);
create index briefs_open_idx on briefs(status, deadline_at) where status = 'open';
create index briefs_creator_idx on briefs(creator_id, created_at desc);
create index briefs_niche_platform_idx on briefs(niche_id, platform) where status = 'open';

-- =========================================================
-- Pitches (public part)
-- =========================================================
create table pitches (
  id                   uuid primary key default gen_random_uuid(),
  brief_id             uuid not null references briefs(id) on delete restrict,
  cre_id               uuid not null references profiles(id) on delete restrict,
  status               pitch_status not null default 'submitted',
  -- Public proof fields
  platform             content_platform not null,
  format_label         text not null check (char_length(format_label) <= 80),   -- "Talking head + on-screen receipts"
  duration_seconds     integer check (duration_seconds between 1 and 7200),
  hook_category        text not null check (hook_category in (
                         'question','bold_claim','number_list','story','before_after','myth_bust',
                         'tutorial','reaction','pov','challenge','controversy','other')),
  teaser               text not null check (char_length(teaser) between 20 and 200), -- non-revealing angle
  source_views         bigint not null check (source_views > 0),
  channel_median_views bigint not null check (channel_median_views > 0),
  multiplier           numeric(8,1) generated always as (round(source_views::numeric / channel_median_views, 1)) stored,
  source_posted_on     date not null,
  source_channel_size_band text check (source_channel_size_band in ('<10k','10k-50k','50k-200k','200k-1M','1M+')),
  -- Duplicate detection (derived server-side from secret URL; not the URL itself)
  source_key           text not null,  -- e.g. 'tiktok:7312345678901234567' (hash if preferred)
  submitted_at         timestamptz not null default now(),
  unlocked_at          timestamptz,
  withdrawn_at         timestamptz,
  constraint one_source_per_brief unique (brief_id, source_key)
);
create index pitches_brief_idx on pitches(brief_id, submitted_at);
create index pitches_cre_idx on pitches(cre_id, submitted_at desc);

-- =========================================================
-- Pitch secrets (locked part) — RLS protected
-- =========================================================
create table pitch_secrets (
  pitch_id           uuid primary key references pitches(id) on delete cascade,
  source_url         text not null,
  source_channel_url text,
  hook_text          text not null check (char_length(hook_text) between 5 and 300),
  why_it_worked      text not null check (char_length(why_it_worked) between 40 and 2000),
  instructions       text not null check (char_length(instructions) between 80 and 6000), -- shot list, script beats, on-screen text, CTA
  adaptation_notes   text check (char_length(adaptation_notes) <= 2000),              -- how to fit it to this creator
  proof_path         text            -- screenshot of views/median in private storage
);

-- =========================================================
-- Unlocks (one per pitch)
-- =========================================================
create table unlocks (
  id               uuid primary key default gen_random_uuid(),
  pitch_id         uuid not null unique references pitches(id) on delete restrict,
  brief_id         uuid not null references briefs(id) on delete restrict,
  creator_id       uuid not null references profiles(id),
  cre_id           uuid not null references profiles(id),
  currency         char(3) not null,
  gross_cents      integer not null check (gross_cents > 0),
  cre_fee_cents    integer not null check (cre_fee_cents >= 0),
  net_cents        integer not null check (net_cents >= 0),
  status           unlock_status not null default 'held',
  available_at     timestamptz not null,
  payout_id        uuid,
  created_at       timestamptz not null default now(),
  constraint net_math check (net_cents = gross_cents - cre_fee_cents)
);
create index unlocks_cre_status_idx on unlocks(cre_id, status);
create index unlocks_release_idx on unlocks(available_at) where status = 'held';

-- =========================================================
-- Payments (creator → provider)
-- =========================================================
create table payments (
  id                 uuid primary key default gen_random_uuid(),
  brief_id           uuid references briefs(id),
  payer_id           uuid not null references profiles(id),
  provider           text not null default 'xendit',
  provider_ref       text unique,           -- invoice/charge id
  external_id        text unique not null,  -- our idempotency key e.g. 'brief_<uuid>'
  currency           char(3) not null,
  amount_cents       integer not null check (amount_cents > 0),
  refunded_cents     integer not null default 0 check (refunded_cents >= 0),
  status             payment_status not null default 'pending',
  checkout_url       text,
  method             text,                  -- card, gcash, etc.
  paid_at            timestamptz,
  raw                jsonb,
  created_at         timestamptz not null default now()
);

create table refunds (
  id             uuid primary key default gen_random_uuid(),
  payment_id     uuid not null references payments(id),
  brief_id       uuid references briefs(id),
  amount_cents   integer not null check (amount_cents > 0),
  reason         text not null check (reason in ('unused_budget','dispute','cancelled','admin')),
  provider_ref   text unique,
  status         text not null default 'pending' check (status in ('pending','succeeded','failed')),
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);

-- =========================================================
-- Payouts (provider → CRE)
-- =========================================================
create table payout_methods (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  kind           text not null check (kind in ('gcash','maya','bank')),
  account_name   text not null,
  account_number_last4 text not null,
  account_number_encrypted bytea not null,   -- pgcrypto; key from vault/env
  bank_code      text,
  is_default     boolean not null default false,
  verified_at    timestamptz,
  created_at     timestamptz not null default now()
);

create table payouts (
  id               uuid primary key default gen_random_uuid(),
  cre_id           uuid not null references profiles(id),
  method_id        uuid not null references payout_methods(id),
  currency         char(3) not null,
  amount_cents     integer not null check (amount_cents > 0),
  fx_rate          numeric(12,6),            -- USD→PHP at send time
  amount_local_cents integer,
  status           payout_status not null default 'requested',
  provider_ref     text unique,
  failure_reason   text,
  requested_at     timestamptz not null default now(),
  approved_by      uuid references profiles(id),
  paid_at          timestamptz
);
alter table unlocks add constraint unlocks_payout_fk foreign key (payout_id) references payouts(id);

-- =========================================================
-- Ledger (append-only)
-- =========================================================
create table ledger_entries (
  id            bigserial primary key,
  kind          ledger_kind not null,
  currency      char(3) not null,
  amount_cents  integer not null check (amount_cents > 0),
  -- accounts: 'escrow:brief:<id>', 'creator:<id>', 'cre:<id>:held', 'cre:<id>:available', 'platform:revenue', 'external'
  debit_account  text not null,
  credit_account text not null,
  brief_id      uuid references briefs(id),
  pitch_id      uuid references pitches(id),
  unlock_id     uuid references unlocks(id),
  payment_id    uuid references payments(id),
  refund_id     uuid references refunds(id),
  payout_id     uuid references payouts(id),
  note          text,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);
create index ledger_brief_idx on ledger_entries(brief_id);
create index ledger_debit_idx on ledger_entries(debit_account);
create index ledger_credit_idx on ledger_entries(credit_account);
-- Append-only: block UPDATE/DELETE
create or replace function ledger_block_mutation() returns trigger language plpgsql as $$
begin raise exception 'LEDGER_IS_APPEND_ONLY'; end $$;
create trigger ledger_no_update before update or delete on ledger_entries
  for each row execute function ledger_block_mutation();

-- =========================================================
-- Disputes
-- =========================================================
create table disputes (
  id            uuid primary key default gen_random_uuid(),
  unlock_id     uuid not null unique references unlocks(id),
  opened_by     uuid not null references profiles(id),
  reason        text not null check (reason in (
                  'source_dead','stats_false','not_matching_card','duplicate_of_other_unlock',
                  'instructions_missing','plagiarized','other')),
  details       text not null check (char_length(details) between 20 and 2000),
  evidence_paths text[] not null default '{}',
  cre_response  text check (char_length(cre_response) <= 2000),
  status        dispute_status not null default 'awaiting_cre',
  resolution_note text,
  resolved_by   uuid references profiles(id),
  opened_at     timestamptz not null default now(),
  cre_deadline_at timestamptz not null default now() + interval '48 hours',
  resolved_at   timestamptz
);

-- =========================================================
-- Reviews (only after an unlock)
-- =========================================================
create table reviews (
  id           uuid primary key default gen_random_uuid(),
  unlock_id    uuid not null references unlocks(id),
  reviewer_id  uuid not null references profiles(id),
  reviewee_id  uuid not null references profiles(id),
  rating       smallint not null check (rating between 1 and 5),
  body         text check (char_length(body) <= 800),
  created_at   timestamptz not null default now(),
  unique (unlock_id, reviewer_id)
);

-- =========================================================
-- Messaging
-- =========================================================
create table threads (
  id           uuid primary key default gen_random_uuid(),
  brief_id     uuid references briefs(id),
  pitch_id     uuid references pitches(id),
  creator_id   uuid not null references profiles(id),
  cre_id       uuid not null references profiles(id),
  last_message_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (brief_id, creator_id, cre_id)
);
create table messages (
  id           bigserial primary key,
  thread_id    uuid not null references threads(id) on delete cascade,
  sender_id    uuid not null references profiles(id),
  body         text not null check (char_length(body) between 1 and 4000), -- stored AFTER masking
  was_masked   boolean not null default false,
  attachment_path text,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index messages_thread_idx on messages(thread_id, created_at);

-- =========================================================
-- Flags, notifications, audit
-- =========================================================
create table flags (
  id          uuid primary key default gen_random_uuid(),
  kind        flag_kind not null,
  subject_user uuid references profiles(id),
  reported_by uuid references profiles(id),  -- null = system
  entity_type text not null,                 -- 'message','pitch','brief','user'
  entity_id   text not null,
  excerpt     text,                          -- original text for contact_leak (admin only)
  status      text not null default 'open' check (status in ('open','dismissed','actioned')),
  created_at  timestamptz not null default now()
);

create table notifications (
  id         bigserial primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       notif_kind not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);

create table notification_prefs (
  user_id uuid primary key references profiles(id) on delete cascade,
  email_new_pitch   boolean not null default true,
  email_digest      text not null default 'instant' check (email_digest in ('instant','daily','off')),
  email_marketing   boolean not null default false
);

create table audit_log (
  id          bigserial primary key,
  actor_id    uuid references profiles(id),
  action      text not null,     -- 'kyc.approve','dispute.resolve','settings.update',...
  entity_type text not null,
  entity_id   text not null,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

create table webhook_events (
  id           text primary key,  -- provider event id (idempotency)
  provider     text not null,
  type         text not null,
  payload      jsonb not null,
  processed_at timestamptz,
  error        text,
  received_at  timestamptz not null default now()
);

-- =========================================================
-- Phase 2: Packs & Retainers (create now, unused in MVP)
-- =========================================================
create table packs (
  id              uuid primary key default gen_random_uuid(),
  cre_id          uuid not null references profiles(id),
  title           text not null,
  description     text not null,
  platform        content_platform not null,
  niche_id        int references niches(id),
  ideas_count     integer not null check (ideas_count between 1 and 100),
  delivery_hours  integer not null check (delivery_hours between 12 and 336),
  price_cents     integer not null check (price_cents > 0),
  currency        char(3) not null default 'USD',
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create table retainers (
  id                 uuid primary key default gen_random_uuid(),
  creator_id         uuid not null references profiles(id),
  cre_id             uuid not null references profiles(id),
  ideas_per_week     integer not null,
  weekly_price_cents integer not null,
  currency           char(3) not null default 'USD',
  status             text not null default 'proposed' check (status in ('proposed','active','paused','ended')),
  started_at         timestamptz,
  ended_at           timestamptz
);
```

### 8.1 Helper views

```sql
-- CRE balances computed from unlocks
create view cre_balances as
select
  cre_id,
  currency,
  coalesce(sum(net_cents) filter (where status = 'held'),0)       as held_cents,
  coalesce(sum(net_cents) filter (where status = 'available'),0)  as available_cents,
  coalesce(sum(net_cents) filter (where status = 'paid_out'),0)   as paid_out_cents,
  coalesce(sum(net_cents) filter (where status = 'disputed'),0)   as disputed_cents
from unlocks group by cre_id, currency;

-- Public creator stats shown on briefs (trust signal for CREs)
create view creator_public_stats as
select
  b.creator_id,
  count(distinct b.id) filter (where b.status in ('closed','settled'))            as briefs_completed,
  count(p.id)                                                                      as pitches_received,
  count(u.id)                                                                      as unlocks_made,
  case when count(p.id) = 0 then null
       else round(100.0 * count(u.id) / count(p.id), 0) end                        as unlock_rate_pct,
  count(d.id) filter (where d.status = 'resolved_creator')                         as disputes_won,
  count(d.id)                                                                      as disputes_opened
from briefs b
left join pitches p  on p.brief_id = b.id
left join unlocks u  on u.pitch_id = p.id
left join disputes d on d.unlock_id = u.id
group by b.creator_id;

-- Public CRE stats
create view cre_public_stats as
select
  p.cre_id,
  count(*)                                             as pitches_sent,
  count(*) filter (where p.status in ('unlocked','refunded')) as pitches_unlocked,
  case when count(*) = 0 then null
       else round(100.0 * count(*) filter (where p.status = 'unlocked') / count(*), 0) end as unlock_rate_pct,
  (select round(avg(r.rating)::numeric,1) from reviews r where r.reviewee_id = p.cre_id) as avg_rating,
  (select count(*) from reviews r where r.reviewee_id = p.cre_id)                      as review_count
from pitches p group by p.cre_id;
```

### 8.2 Core database functions

All money functions are `security definer`, set `search_path = public`, check `auth.uid()`, and lock rows with `for update`.

```sql
-- Fee math: integer bps, round half up
create or replace function fee_cents(amount integer, bps integer)
returns integer language sql immutable as $$
  select ((amount::bigint * bps + 5000) / 10000)::integer
$$;

-- ---------------------------------------------------------
-- create_brief: validates, snapshots fees, returns id (status draft)
-- ---------------------------------------------------------
create or replace function create_brief(
  p_title text, p_description text, p_platform content_platform, p_niche_id int,
  p_audience_notes text, p_must_include text, p_avoid text, p_example_urls text[],
  p_min_multiplier numeric, p_max_video_age_days int,
  p_price_per_idea_cents int, p_max_unlocks int, p_deadline_at timestamptz
) returns uuid language plpgsql security definer set search_path = public as $$
declare s platform_settings; v_id uuid; v_budget int; v_fee int; v_open int;
begin
  if (select role from profiles where id = auth.uid()) <> 'creator' then raise exception 'NOT_CREATOR'; end if;
  select * into s from platform_settings where id;
  if p_price_per_idea_cents < s.min_price_per_idea_cents or p_price_per_idea_cents > s.max_price_per_idea_cents
    then raise exception 'PRICE_OUT_OF_RANGE'; end if;
  if p_deadline_at < now() + interval '24 hours' or p_deadline_at > now() + interval '30 days'
    then raise exception 'DEADLINE_OUT_OF_RANGE'; end if;
  select count(*) into v_open from briefs where creator_id = auth.uid() and status in ('awaiting_payment','open');
  if v_open >= s.max_open_briefs_per_creator then raise exception 'TOO_MANY_OPEN_BRIEFS'; end if;
  v_budget := p_price_per_idea_cents * p_max_unlocks;
  v_fee    := fee_cents(v_budget, s.creator_fee_bps);
  insert into briefs(creator_id,title,description,platform,niche_id,audience_notes,must_include,avoid,
                     example_urls,min_multiplier,max_video_age_days,currency,price_per_idea_cents,max_unlocks,
                     creator_fee_bps,cre_fee_bps,creator_fee_cents,total_charge_cents,deadline_at,status)
  values (auth.uid(),p_title,p_description,p_platform,p_niche_id,p_audience_notes,p_must_include,p_avoid,
          coalesce(p_example_urls,'{}'),greatest(p_min_multiplier,s.min_multiplier),p_max_video_age_days,
          s.default_currency,p_price_per_idea_cents,p_max_unlocks,s.creator_fee_bps,s.cre_fee_bps,
          v_fee,v_budget+v_fee,p_deadline_at,'draft')
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------
-- mark_brief_paid: called ONLY by webhook handler with service role
-- ---------------------------------------------------------
create or replace function mark_brief_paid(p_payment_id uuid, p_provider_ref text, p_method text, p_raw jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare pay payments; b briefs;
begin
  select * into pay from payments where id = p_payment_id for update;
  if pay.status = 'paid' then return; end if;             -- idempotent
  select * into b from briefs where id = pay.brief_id for update;
  if pay.amount_cents <> b.total_charge_cents then raise exception 'AMOUNT_MISMATCH'; end if;
  update payments set status='paid', paid_at=now(), provider_ref=p_provider_ref, method=p_method, raw=p_raw where id = pay.id;
  update briefs set status='open', opened_at=now() where id = b.id and status in ('draft','awaiting_payment');
  insert into ledger_entries(kind,currency,amount_cents,debit_account,credit_account,brief_id,payment_id)
  values ('brief_funding',b.currency,b.budget_cents,'external','escrow:brief:'||b.id,b.id,pay.id),
         ('creator_fee',b.currency,b.creator_fee_cents,'external','platform:revenue',b.id,pay.id);
end $$;

-- ---------------------------------------------------------
-- unlock_pitch: the heart of the product
-- ---------------------------------------------------------
create or replace function unlock_pitch(p_pitch_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare p pitches; b briefs; s platform_settings; v_fee int; v_net int; v_unlock uuid;
begin
  select * into p from pitches where id = p_pitch_id for update;
  if not found then raise exception 'PITCH_NOT_FOUND'; end if;
  select * into b from briefs where id = p.brief_id for update;
  if b.creator_id <> auth.uid() then raise exception 'NOT_BRIEF_OWNER'; end if;
  if b.status <> 'open' then raise exception 'BRIEF_NOT_OPEN'; end if;
  if p.status <> 'submitted' then raise exception 'PITCH_NOT_AVAILABLE'; end if;
  if b.unlocks_used >= b.max_unlocks then raise exception 'NO_UNLOCKS_LEFT'; end if;
  select * into s from platform_settings where id;

  v_fee := fee_cents(b.price_per_idea_cents, b.cre_fee_bps);
  v_net := b.price_per_idea_cents - v_fee;

  insert into unlocks(pitch_id,brief_id,creator_id,cre_id,currency,gross_cents,cre_fee_cents,net_cents,status,available_at)
  values (p.id,b.id,b.creator_id,p.cre_id,b.currency,b.price_per_idea_cents,v_fee,v_net,'held',
          now() + make_interval(hours => s.hold_hours))
  returning id into v_unlock;

  update pitches set status='unlocked', unlocked_at=now() where id = p.id;
  update briefs  set unlocks_used = unlocks_used + 1, updated_at=now() where id = b.id;

  insert into ledger_entries(kind,currency,amount_cents,debit_account,credit_account,brief_id,pitch_id,unlock_id)
  values ('unlock_gross',b.currency,b.price_per_idea_cents,'escrow:brief:'||b.id,'cre:'||p.cre_id||':held',b.id,p.id,v_unlock);
  if v_fee > 0 then
    insert into ledger_entries(kind,currency,amount_cents,debit_account,credit_account,brief_id,pitch_id,unlock_id)
    values ('cre_fee',b.currency,v_fee,'cre:'||p.cre_id||':held','platform:revenue',b.id,p.id,v_unlock);
  end if;

  insert into notifications(user_id,kind,title,body,link)
  values (p.cre_id,'pitch_unlocked','Your pitch was unlocked',
          'You earned '||to_char(v_net/100.0,'FM999990.00')||' '||b.currency||'. It becomes available after the hold period.',
          '/pitches/'||p.id);

  if b.unlocks_used + 1 >= b.max_unlocks then
    perform close_brief(b.id, 'max_unlocks');
  end if;
  return v_unlock;
end $$;

-- ---------------------------------------------------------
-- close_brief: stops pitching, expires remaining pitches, queues refund
-- (refund API call happens in app code after this returns)
-- ---------------------------------------------------------
create or replace function close_brief(p_brief_id uuid, p_reason text)
returns integer  -- refund amount in cents (budget + fee on unused)
language plpgsql security definer set search_path = public as $$
declare b briefs; v_unused int; v_unused_budget int; v_fee_refund int;
begin
  select * into b from briefs where id = p_brief_id for update;
  if b.status <> 'open' then return 0; end if;
  if p_reason = 'creator_closed' and b.creator_id <> auth.uid() then raise exception 'NOT_BRIEF_OWNER'; end if;
  update briefs set status='closed', closed_at=now(), close_reason=p_reason where id = b.id;
  update pitches set status='expired' where brief_id = b.id and status = 'submitted';
  v_unused := b.max_unlocks - b.unlocks_used;
  v_unused_budget := v_unused * b.price_per_idea_cents;
  -- refund creator fee proportionally on unused budget
  v_fee_refund := b.creator_fee_cents - fee_cents(b.unlocks_used * b.price_per_idea_cents, b.creator_fee_bps);
  if v_unused_budget > 0 then
    insert into refunds(payment_id,brief_id,amount_cents,reason)
    select id, b.id, v_unused_budget + v_fee_refund, 'unused_budget' from payments
     where brief_id = b.id and status = 'paid' limit 1;
  else
    update briefs set status='settled', settled_at=now() where id = b.id;
  end if;
  return v_unused_budget + v_fee_refund;
end $$;

-- ---------------------------------------------------------
-- release_holds: cron every 15 min
-- ---------------------------------------------------------
create or replace function release_holds() returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with moved as (
    update unlocks set status='available'
     where status='held' and available_at <= now()
       and not exists (select 1 from disputes d where d.unlock_id = unlocks.id and d.status in ('open','awaiting_cre','awaiting_admin'))
    returning *
  )
  select count(*) into n from moved;
  -- ledger: held → available per released unlock
  insert into ledger_entries(kind,currency,amount_cents,debit_account,credit_account,unlock_id,note)
  select 'adjustment', u.currency, u.net_cents, 'cre:'||u.cre_id||':held', 'cre:'||u.cre_id||':available', u.id, 'hold_release'
    from unlocks u where u.status='available' and not exists (
      select 1 from ledger_entries l where l.unlock_id=u.id and l.note='hold_release');
  return n;
end $$;
```

> Also create: `submit_pitch(...)` (Section 9.3 checks), `withdraw_pitch(id)`, `open_dispute(unlock_id, reason, details, evidence)`, `resolve_dispute(id, outcome, note)` (admin), `request_payout(method_id, amount)`, `mark_payout_paid(id, provider_ref)`, `cancel_unpaid_brief(id)`. Same pattern: lock rows, check ownership/state, write ledger, write notification, write audit log for admin actions.

### 8.3 Row Level Security (RLS)

Enable RLS on **every** table. Summary of policies:

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `profiles` | Public: `id, display_name, handle, avatar_path, country_code, role` via a `public_profiles` view. Full row: self + admin | trigger on auth signup | self (not `role` once set, not `suspended_*`) | none |
| `creator_profiles` | self, admin; public subset via view | self | self | none |
| `cre_profiles` | public if `kyc_status='approved'` (via view excluding KYC columns); self; admin | self | self (not `kyc_*`) | none |
| `kyc_submissions` | self, admin | self | none (resubmit = new row) | none |
| `portfolio_items` | public if owner approved | owner CRE | owner | owner |
| `briefs` | owner creator (all statuses); approved CREs when `status in ('open','closed','settled')`; admin | via `create_brief()` only | owner while `draft` (text fields only) | owner while `draft` |
| `pitches` | owner CRE; brief owner creator; admin | via `submit_pitch()` only | none (use functions) | none |
| **`pitch_secrets`** | **owner CRE; creator only if `exists(unlocks where pitch_id = pitch_secrets.pitch_id and creator_id = auth.uid() and status <> 'reversed')`; admin** | via `submit_pitch()` | owner CRE while pitch `submitted` | none |
| `unlocks` | creator or CRE party; admin | via `unlock_pitch()` | none | none |
| `payments`, `refunds` | payer; admin | server only (service role) | server only | none |
| `payout_methods` | owner (no encrypted column exposed; use view); admin | owner | owner | owner (if no pending payout) |
| `payouts` | owner CRE; admin | via `request_payout()` | admin/server | none |
| `ledger_entries` | admin only | functions only | blocked by trigger | blocked |
| `disputes` | parties; admin | via `open_dispute()` | CRE response field via function; admin | none |
| `reviews` | public | party of unlock, once, after unlock | none | none |
| `threads`, `messages` | participants; admin | participants (messages go through masking server action) | `read_at` by recipient | none |
| `flags` | admin | server; users can report (entity + reason only) | admin | none |
| `notifications` | owner | server/functions | owner (`read_at`) | owner |
| `audit_log`, `webhook_events`, `platform_settings` (write) | admin | server | admin (settings) | none |

**Example policy for the most important table:**

```sql
alter table pitch_secrets enable row level security;

create policy "cre_reads_own_secret" on pitch_secrets for select
  using (exists (select 1 from pitches p where p.id = pitch_id and p.cre_id = auth.uid()));

create policy "creator_reads_after_unlock" on pitch_secrets for select
  using (exists (select 1 from unlocks u
                  where u.pitch_id = pitch_secrets.pitch_id
                    and u.creator_id = auth.uid()
                    and u.status <> 'reversed'));

create policy "admin_reads_all_secrets" on pitch_secrets for select
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
```

**Required RLS tests (Section 20):** a creator who has not unlocked gets zero rows from `pitch_secrets`; a different creator gets zero rows even after someone else unlocked; a CRE can't read another CRE's secrets.

### 8.4 Storage buckets

| Bucket | Public? | Path pattern | Who can read |
|---|---|---|---|
| `avatars` | public | `{user_id}/avatar.webp` | everyone |
| `portfolio` | public | `{user_id}/{item_id}.webp` | everyone |
| `kyc` | **private** | `{user_id}/{submission_id}/{front|back|selfie}.jpg` | owner + admin (signed URLs, 5 min) |
| `pitch-proof` | **private** | `{cre_id}/{pitch_id}.webp` | owner CRE, unlocked creator, admin (signed URLs) |
| `dispute-evidence` | **private** | `{dispute_id}/{file}` | parties + admin |
| `message-attachments` | **private** | `{thread_id}/{file}` | participants + admin |

Upload limits: images only (`jpeg, png, webp`), max 5 MB, re-encode to WebP server-side and strip EXIF.

### 8.5 Triggers

- `on auth.users insert` → create `profiles` row + `notification_prefs` row.
- `updated_at` trigger on `profiles`, `briefs`.
- `threads.last_message_at` updated on message insert.
- Prevent changing `profiles.role` after it's set (except admin).

### 8.6 Seed data (`supabase/seed.sql`)

- Niches (top level → examples): Personal finance (budgeting, investing, side hustles), Fitness (home workouts, weight loss, bodybuilding), Business & coaching (sales, marketing, mindset), Beauty & fashion, Food & cooking, Parenting & family, Faith & Christian living, Real estate, Tech & AI, Travel, Education & study, Health & wellness, Relationships, Pets, Gaming, Comedy & entertainment, Home & DIY, Cars.
- 1 admin, 3 creators, 5 approved CREs, 1 pending CRE, 6 briefs in different states, 20 pitches, 6 unlocks, 1 dispute. All clearly fake names and `example.com` emails.

---

## 9. Forms and validation (Zod)

Shared schemas in `lib/validation/`. Server re-validates everything.

### 9.1 CRE onboarding + KYC (`/onboarding/cre`)

**Step 1 — Public profile**
| Field | Rules |
|---|---|
| Display name | 2–50 chars |
| Handle | `^[a-z0-9_]{3,24}$`, unique, live availability check |
| Headline | ≤ 90 chars, e.g. "Short-form finance researcher · 300+ outliers found" |
| Bio | 100–1200 chars, contact filter applied (Section 11) |
| Platforms | ≥ 1 |
| Niches | 1–5 |
| Years of experience | 0–30 |
| Languages | ≥ 1 |
| Avatar | optional image |

**Step 2 — Portfolio (min 3 items to submit for review)**
Title, platform, niche, source URL, source views, channel median views (multiplier shown live), optional result note, optional proof screenshot. Multiplier must be ≥ 3.0.

**Step 3 — Verification (private)**
Legal name, birth date (must be 18+), address, city, province, postal code, country, mobile number (PH format `^(\+63|0)9\d{9}$` when PH), ID type, ID front, ID back (if applicable), selfie holding ID, optional DTI/SEC number, optional TIN. Checkbox: "I agree to the CRE Agreement and confirm this information is true." → `kyc_status = pending`, admin notified.

**Step 4 — Payout method (can be done later, required before first withdrawal)**
GCash / Maya / Bank. Account name must match legal name (admin check).

### 9.2 Brief form (`/briefs/new`)

| Field | Rules / UI |
|---|---|
| Title | 8–100 chars. Placeholder: "10 TikTok ideas for a personal finance coach" |
| Platform | select |
| Niche | searchable select |
| What you need | 40–3000 chars. Helper: "Describe your audience, your style, and what a great idea looks like." |
| Audience notes | optional ≤ 1000 |
| Must include | optional ≤ 1000 |
| Avoid | optional ≤ 1000 |
| Example videos you like | up to 5 URLs |
| Minimum outlier score | number, default 3.0, min 3.0, step 0.5 |
| Max age of source video | optional: 30 / 90 / 180 / 365 days / any |
| Price per unlocked idea | USD, $3–$500. Show hint: "Most briefs pay $5–$15 per idea." |
| Max unlocks | 1–100 |
| Deadline | 1–30 days from now (date picker; default 5 days) |

**Live fee breakdown panel** (uses `lib/money.ts`, same formula as SQL):
```
Budget        5 ideas × $8.00      $40.00
Marketplace fee (5%)                $2.00
You pay today                      $42.00
Unused budget is refunded when the brief closes.
```

Submit → `create_brief()` → create payment → redirect to `/briefs/[id]/pay` → provider checkout.

### 9.3 Pitch form (`/briefs/[id]/pitch`)

Two clearly separated panels with labels:

**"Shown before unlock"** (public)
| Field | Rules |
|---|---|
| Platform | defaults to brief platform |
| Format | ≤ 80 chars, e.g. "Talking head + on-screen receipts" |
| Duration | seconds |
| Hook type | select (enum list) |
| Teaser | 20–200 chars, must not contain the hook text (similarity check, Section 11.3) |
| Source views | integer > 0 |
| Channel median views | integer > 0. Helper: "Median views of the channel's last 20 videos." |
| Outlier score | read-only, computed live, must be ≥ brief min |
| Source posted on | date; must satisfy brief max age |
| Source channel size | band |

**"Revealed after unlock"** (locked)
| Field | Rules |
|---|---|
| Source video URL | valid URL for the chosen platform; normalized to `source_key` |
| Source channel URL | optional |
| Hook (exact words) | 5–300 chars |
| Why it worked | 40–2000 chars |
| Instructions | 80–6000 chars. Template pre-filled (below) |
| How to adapt it for this creator | optional ≤ 2000 |
| Proof screenshot | image showing views + channel page |

**Instructions template (pre-filled, editable):**
```
HOOK (0–3s):
ON-SCREEN TEXT:
SHOT LIST:
1.
2.
3.
KEY BEATS / SCRIPT:
CTA:
CAPTION + HASHTAGS:
NOTES:
```

**`submit_pitch()` checks (server/database):**
1. Caller is CRE with `kyc_status = 'approved'`, not suspended.
2. Brief `status = 'open'` and `deadline_at > now()`.
3. Caller is not the brief owner.
4. Caller has < `max_pitches_per_cre_per_brief` non-withdrawn pitches on this brief.
5. `multiplier >= brief.min_multiplier`; `source_posted_on` within `max_video_age_days` if set.
6. `source_key` not already used on this brief (unique constraint → error `DUPLICATE_SOURCE`: "Another CRE already pitched this video for this brief.").
7. Public fields pass the contact filter; teaser not too similar to hook.
8. Insert `pitches` + `pitch_secrets` in one transaction; notify creator (respect digest prefs).

---

## 10. Payments integration

### 10.1 Provider interface (`lib/payments/provider.ts`)

```ts
export type Money = { amountCents: number; currency: 'USD' | 'PHP' };

export interface CheckoutSession {
  providerRef: string;
  checkoutUrl: string;
  expiresAt: string;
}

export interface PaymentProvider {
  createCheckout(input: {
    externalId: string;           // 'brief_<uuid>'
    amount: Money;
    description: string;
    payer: { email: string; name: string };
    successUrl: string;
    failureUrl: string;
  }): Promise<CheckoutSession>;

  parseWebhook(req: Request): Promise<{
    eventId: string;
    type: 'payment.paid' | 'payment.failed' | 'payment.expired'
        | 'refund.succeeded' | 'refund.failed'
        | 'payout.succeeded' | 'payout.failed';
    externalId?: string;
    providerRef: string;
    amountCents?: number;
    method?: string;
    raw: unknown;
  }>;  // MUST throw if signature/callback token invalid

  refund(input: { providerRef: string; amount: Money; reason: string; idempotencyKey: string }):
    Promise<{ providerRef: string; status: 'pending' | 'succeeded' | 'failed' }>;

  payout(input: {
    idempotencyKey: string;
    amount: Money;                // PHP after conversion
    destination: { kind: 'gcash' | 'maya' | 'bank'; accountName: string; accountNumber: string; bankCode?: string };
    description: string;
  }): Promise<{ providerRef: string; status: 'pending' | 'succeeded' | 'failed' }>;
}
```

Implementations: `xendit.ts` (real), `mock.ts` (local dev + tests; simulates webhooks with a dev-only route `/api/dev/simulate-webhook`).

### 10.2 Funding flow

1. Creator submits brief → `create_brief()` → brief `draft`.
2. Server action `startBriefCheckout(briefId)`:
   - Checks owner + status `draft|awaiting_payment`.
   - Insert `payments` row with `external_id = 'brief_' || brief_id`, amount = `total_charge_cents`.
   - `provider.createCheckout()` → store `provider_ref`, `checkout_url`.
   - Set brief `awaiting_payment`. Redirect to checkout.
3. Provider → `POST /api/webhooks/xendit`:
   - `parseWebhook` (verify `x-callback-token` against `XENDIT_CALLBACK_TOKEN`; reject otherwise with 401).
   - Insert into `webhook_events(id)`; on conflict do nothing and return 200 (idempotent).
   - `payment.paid` → `mark_brief_paid()` → notify creator + matching CREs (Section 12).
   - `payment.failed/expired` → payment status updated; brief stays `awaiting_payment`; email creator with retry link.
   - Mark `processed_at`. Return 200 within 5 s (do slow work after).
4. Success page polls brief status for up to 30 s, then shows "Payment received. Your brief is live." or "We're confirming your payment. We'll email you."

Unpaid drafts older than 7 days → `cancel_unpaid_brief()` via cron.

### 10.3 Unlock flow

Unlock uses money already in escrow, so there's **no card charge at unlock**.
1. Creator clicks **Unlock for $8.00** → confirm dialog (in-page): "Unlock this idea for $8.00 from your brief budget? 4 unlocks left after this."
2. Server action calls `unlock_pitch()` via user-scoped Supabase client (so `auth.uid()` is the creator).
3. On success, revalidate page; the unlocked card fetches `pitch_secrets` (now allowed by RLS) and renders.
4. Map errors to messages:
   - `NO_UNLOCKS_LEFT` → "You've used all unlocks for this brief. Post a new brief or raise the limit."
   - `BRIEF_NOT_OPEN` → "This brief is closed."
   - `PITCH_NOT_AVAILABLE` → "This pitch was withdrawn or already unlocked."

### 10.4 Closing and refunds

- Cron `/api/cron/close-briefs` every 15 min (protected by `CRON_SECRET` header): for each `open` brief with `deadline_at <= now()` → `close_brief(id,'deadline')`.
- Creator can close early from the brief page ("Close brief and refund unused budget").
- After `close_brief` inserts a `refunds` row, app code calls `provider.refund()` with idempotency key `refund_<refund_id>`; webhook updates status; on success write `refund` + `creator_fee_refund` ledger entries, update `payments.refunded_cents`, set brief `settled`, notify creator.
- If the provider can't partially refund a card, fall back to manual refund queue in `/admin/payouts` (tab "Refunds") and email the creator.

### 10.5 Payouts

- CRE requests withdrawal of any amount ≥ `min_payout_cents` up to `available_cents`.
- `request_payout()` marks the selected `available` unlocks as linked to the payout (oldest first, full unlocks only; amount = sum of those unlocks).
- MVP: admin approves in `/admin/payouts` (fraud check) → server converts USD→PHP at the provider's quoted rate (store `fx_rate`) → `provider.payout()` → webhook → `mark_payout_paid()` → unlocks `paid_out` → ledger `payout` → notify CRE.
- Show CRE the estimated PHP amount before confirming, with the note "Final peso amount depends on the exchange rate when the payout is sent."

### 10.6 Disputes

- Creator can open a dispute on an unlock **within the hold window (72 h)**.
- Reasons: source dead, stats false, doesn't match the card, duplicate of another unlock, instructions missing, plagiarized.
- Unlock status → `disputed`; hold release is blocked.
- CRE has 48 h to respond (text + evidence). Then status `awaiting_admin`.
- Admin resolves:
  - **Creator wins** → unlock `reversed`, pitch `refunded`, amount returned to creator (refund via provider or brief budget reopened if brief still open), ledger `dispute_reversal`, CRE dispute count +1.
  - **CRE wins** → unlock `available` immediately.
- 3 lost disputes in 90 days → auto-flag CRE for admin review.

---

## 11. Trust and safety logic

### 11.1 Contact filter (`lib/contact-filter.ts`)

Applied server-side to: messages, pitch public fields, brief text, bios, reviews.

Detect and replace with `[hidden by Outlier Desk]`:
- Emails: `/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i`
- Phone numbers: 8+ digits allowing spaces, dashes, dots, parentheses, `+` prefix; also number words ("nine one seven…") — basic list for EN/Tagalog digits (isa, dalawa, tatlo…).
- URLs and domains: `https?://`, `www.`, bare domains `\b[a-z0-9-]+\.(com|net|org|io|co|me|ph|ly|gg|link|bio)\b`. **Allowed** in brief `example_urls` and pitch secret fields only.
- Handles: `@[a-z0-9_.]{3,}` outside allowed fields.
- Keywords near a contact attempt: whatsapp, telegram, viber, signal, discord, skype, messenger, gcash, paypal, "email me", "text me", "dm me on".
- Obfuscations: "at" / "dot" spelled out, spaced letters.

Behavior:
- Store the **masked** text in the table; store the original only in `flags.excerpt` (admin-only).
- Show the sender a one-time inline notice: "Contact details are hidden so both of you stay protected by escrow and reviews."
- 3 flags in 30 days → notify admin; admin can warn or suspend.

### 11.2 URL normalization (`lib/url-normalize.ts`)

Return `{ platform, videoId, sourceKey }`:
- TikTok: `tiktok.com/@user/video/{id}`, `vm.tiktok.com/{code}` (resolve server-side with a HEAD request with timeout; if it fails, key on the short code and flag for admin).
- Instagram: `/reel/{code}`, `/p/{code}`.
- YouTube: `watch?v={id}`, `youtu.be/{id}`, `/shorts/{id}`.
- Facebook: `/reel/{id}`, `/watch?v={id}`.
- Strip tracking params. `sourceKey = platform + ':' + videoId` (lowercase), stored hashed (`sha256`) in `pitches.source_key` so the public table never exposes the video ID.

### 11.3 Teaser vs hook check

Reject if the teaser contains ≥ 60% of the hook's words (after lowercasing and removing stopwords) or trigram similarity (`pg_trgm similarity`) > 0.5. Message: "Your teaser gives away the hook. Describe the angle without the exact words."

### 11.4 Outlier score (`lib/outlier.ts`)

```ts
export function multiplier(sourceViews: number, channelMedian: number): number {
  if (sourceViews <= 0 || channelMedian <= 0) throw new Error('INVALID_VIEWS');
  return Math.round((sourceViews / channelMedian) * 10) / 10;
}
export function tier(m: number): 'solid' | 'strong' | 'breakout' {
  if (m >= 10) return 'breakout';   // 10×+
  if (m >= 5) return 'strong';      // 5–9.9×
  return 'solid';                   // 3–4.9×
}
```
MVP: CRE enters numbers + uploads proof; admin spot-checks 1 in 10 pitches from new CREs (first 20 pitches each). Phase 3: auto-fetch YouTube stats via YouTube Data API.

### 11.5 Rate limits

| Action | Limit |
|---|---|
| Sign-up / login | 5 per 10 min per IP |
| Pitch submissions | 20 per hour per CRE |
| Messages | 60 per hour per user |
| Brief creation | 10 per day per creator |
| Unlock | 30 per minute per creator (anti-script) |

### 11.6 Reputation signals shown in UI

- On briefs (seen by CREs): creator's unlock rate, briefs completed, disputes opened/won. New creators show "New buyer".
- On pitch cards and profiles (seen by creators): CRE unlock rate, average rating, review count, "Verified" badge after KYC approval.

---

## 12. Notifications and emails

In-app notification for every event; email per user prefs. Templates in `lib/email/templates/*.tsx` (React Email). Sender: `Outlier Desk <hello@outlierdesk.xxx>`.

| Event | To | Email subject |
|---|---|---|
| Brief funded | Creator | "Your brief is live: {title}" |
| Brief funded (matching) | CREs with matching niche + platform, accepting work (batch, max 200, respect digest) | "New brief: {title} · ${price}/idea" |
| New pitch | Creator | "New pitch on {title}: {multiplier}× {format}" (never includes locked content) |
| Pitch unlocked | CRE | "Your pitch was unlocked · +${net}" |
| Brief closing in 24h | Creator | "{title} closes tomorrow · {n} pitches waiting" |
| Brief closed | Creator + pitching CREs | "{title} has closed" |
| Refund issued | Creator | "Refund of ${amount} is on its way" |
| Earning available | CRE (daily digest) | "${amount} is ready to withdraw" |
| Payout paid / failed | CRE | "Payout sent: ₱{amount}" / "Payout failed: {reason}" |
| KYC approved / rejected | CRE | "You're verified. Start pitching." / "We need a clearer ID photo" |
| Dispute opened / updated / resolved | Both parties | "A dispute was opened on your unlock" etc. |
| New message | Recipient (if offline > 10 min) | "New message from {name}" (body masked, first 120 chars) |
| Review received | Reviewee | "You got a {rating}-star review" |

Every email footer: unsubscribe link for non-transactional emails, business address, "You're receiving this because you have an Outlier Desk account."

---

## 13. Admin panel (`/admin`)

| Page | Contents | Actions |
|---|---|---|
| Overview | GMV (7/30 days), platform revenue, open briefs, unlock fill rate (% briefs with ≥ 1 unlock), median time to first pitch, median time to first unlock, open disputes, pending KYC, pending payouts, flags | — |
| KYC | Queue sorted oldest first; view ID images via signed URLs; portfolio; checklist (name matches ID, selfie matches, 18+, address complete) | Approve, Reject (reason required, template reasons) |
| Users | Search by name/email/handle; role; status; stats | Suspend/unsuspend (reason), change role, reset KYC, impersonate read-only (logs audit) |
| Briefs | Filter by status; view pitches | Close brief, cancel unpaid, feature |
| Pitches | Recent from new CREs for spot-check; view secrets | Mark verified, flag fake proof, remove (refund if unlocked) |
| Disputes | Queue; timeline; evidence | Resolve for creator / for CRE with note |
| Payouts | Requested, processing, failed; refunds queue | Approve, retry, mark paid manually (with provider ref) |
| Flags | Contact leaks, duplicates, reports | Dismiss, warn user (templated message), suspend |
| Settings | Fees, hold hours, limits, min multiplier | Update (audit-logged, affects new briefs only) |
| Audit | Filterable log | Export CSV |

Admin = `profiles.role = 'admin'`, plus 2FA (Supabase MFA TOTP) required for `/admin`.

---

## 14. UI components and states

### 14.1 Pitch card — locked (`PitchCardLocked`)

```
┌──────────────────────────────────────────┐
│ [Locked · $8]              TikTok · Finance│
│                                            │
│ OUTLIER SCORE        SOURCE VIEWS          │
│ 14.2×  [Breakout]    1.3M vs 92k median    │
│                                            │
│ FORMAT   Talking head + on-screen receipts │
│ LENGTH   38s          POSTED  12 Aug 2026  │
│ HOOK TYPE  Number list                     │
│ ANGLE    "Tracking a month of spending,    │
│           with a surprise category."       │
│                                            │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ (placeholder bars)     │
│                                            │
│ @marie_cre  ✓ Verified · 94% unlock · 4.8★ │
│ [Unlock for $8.00]   [Message]             │
└──────────────────────────────────────────┘
```
The placeholder bars are decorative divs, **not** blurred real text.

### 14.2 Pitch card — unlocked (`PitchCardUnlocked`)
Adds: source video link (opens new tab), source channel, exact hook, why it worked, instructions (pre-formatted), adaptation notes, proof image, buttons: **Copy instructions**, **Export to CSV**, **Open dispute** (visible within 72 h), **Leave review**.

### 14.3 Status pills

| Entity | Status | Label | Style |
|---|---|---|---|
| Brief | draft | Draft | neutral |
| Brief | awaiting_payment | Awaiting payment | warning |
| Brief | open | Live | accent |
| Brief | closed | Closed · refund pending | neutral |
| Brief | settled | Completed | neutral |
| Brief | cancelled | Cancelled | muted |
| Pitch | submitted | Waiting | neutral |
| Pitch | unlocked | Unlocked | success |
| Pitch | expired | Not unlocked | muted |
| Pitch | withdrawn | Withdrawn | muted |
| Pitch | refunded | Refunded after dispute | danger |
| Unlock | held | On hold until {date} | warning |
| Unlock | available | Available | success |

### 14.4 Budget meter
Progress bar: `unlocks_used / max_unlocks` with text "3 of 5 unlocks used · $16.00 left · closes in 2 days".

### 14.5 Empty states (all real copy)
- Creator, no briefs: "No briefs yet. Post your first brief and get pitches from verified researchers, usually within a day." [Post a brief]
- Brief with no pitches: "No pitches yet. Briefs usually get their first pitch within 24 hours. We've notified {n} researchers in {niche}."
- CRE feed empty: "No open briefs match your niches right now. Add more niches or check back later." [Edit niches]
- Wallet empty: "Earnings show up here after a creator unlocks your pitch."

### 14.6 Loading and error states
- Skeletons for lists and cards.
- Every server action returns `{ ok: true, data } | { ok: false, code, message }`; show message inline near the control, never a generic "Something went wrong" without a next step.

---

## 15. Design system

Use the same visual identity as the Outlier Desk Blueprint.

### 15.1 Tokens

```css
:root {
  --bg: #F6F8FA;  --surface: #FFFFFF;  --ink: #15202B;  --muted: #56616E;  --line: #DCE2E8;
  --accent: #0E6E62;  --accent-soft: #E2F1EE;
  --warn: #945600;    --warn-soft: #FBF0DE;
  --bad: #A33A2E;     --bad-soft: #F8E6E3;
  --good: #1F7A3A;    --good-soft: #E3F3E7;
  --radius-sm: 6px; --radius-md: 10px; --radius-full: 999px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #0F151B; --surface: #161E26; --ink: #E5EBF0; --muted: #95A2AF; --line: #29343F;
    --accent: #52C4B1; --accent-soft: #143029;
    --warn: #E6A84B;   --warn-soft: #2D2313;
    --bad: #E98476;    --bad-soft: #2F1B18;
    --good: #6FCF8E;   --good-soft: #15291C;
  }
}
:root[data-theme="dark"] { /* same values as the dark block above */ }
```
Map these into Tailwind v4 `@theme` so classes like `bg-surface text-ink border-line` work. Include a theme toggle (system / light / dark) in settings and the header.

### 15.2 Typography (Google Fonts via `next/font`)
- **Display:** Bricolage Grotesque 600/750 — headings, big numbers (outlier score).
- **Body:** Source Serif 4 400/600 — marketing pages and long text.
- **UI:** **Source Sans 3** 400/600 for app UI, forms and tables (pairs with Source Serif 4).
- **Mono / data:** JetBrains Mono 400/600 — labels, money, multipliers, IDs. Always `font-variant-numeric: tabular-nums` for money and stats.
- Scale: 12 / 14 / 16 / 18 / 22 / 28 / 36 / 48. Labels uppercase mono 12px, letter-spacing 0.08em.

### 15.3 Layout rules
- App shell: left sidebar on ≥ 1024 px (Dashboard, Briefs, Pitches/Unlocks, Messages, Wallet/Billing, Settings), bottom tab bar on mobile (4 items + More).
- Content max width 1200 px; forms max width 720 px.
- Mobile-first, works at 360 px width. No horizontal scrolling except tables in their own scroll container.
- Accessible: WCAG 2.2 AA contrast, visible focus rings (accent 2px), all icons with labels, forms with `<label>`, keyboard-usable dialogs (shadcn), `prefers-reduced-motion` respected.

### 15.4 Money and number formatting
- `Intl.NumberFormat('en-US', { style: 'currency', currency })` for USD; `en-PH` for PHP.
- Multiplier: `14.2×` (always one decimal, multiplication sign `×`).
- Views: compact (`1.3M`, `92k`).
- Dates: relative for < 7 days ("in 2 days", "3 hours ago"), else `12 Aug 2026`. Show times in user's timezone.

---

## 16. Marketing pages content

### 16.1 Home (`/`)

**Hero**
- Eyebrow: `CONTENT RESEARCH MARKETPLACE`
- H1: **Proven content ideas, researched by people who do it every day.**
- Sub: Post what you need. Verified Content Research Experts pitch outlier videos with the numbers to prove them. Pay only for the ideas you unlock.
- Buttons: **Post a brief** · **I'm a researcher**
- Visual: a live-looking locked pitch card (Section 14.1) next to its unlocked version.

**How it works (3 steps — a real sequence, numbered)**
1. **Post a brief and fund it.** Tell us your niche, platform and price per idea. Your budget is held safely until you use it.
2. **Get pitch cards.** Researchers send ideas with the proof visible: outlier score, views, format. The idea itself stays locked.
3. **Unlock what you like.** You get the source video, the hook, why it worked and step-by-step filming instructions. Unused budget comes back to you.

**Why creators use it**
- Proof before you pay. Every card shows how far the source video beat its channel's normal views.
- No retainers to start. Try a researcher on a $30 brief before committing.
- Instructions, not just links. Every idea comes with a shot list, hook and CTA.

**Why researchers use it**
- Keep 90%. Our fee is 10%, lower than general freelance sites.
- Your ideas are protected. Creators can't see the idea until they've paid for it.
- Get paid in pesos to GCash or your bank.

**Pricing strip:** Creators pay a 5% marketplace fee. Researchers pay 10%. No subscriptions.

**FAQ preview (4 items)** → link to `/help`.

**Footer:** How it works · For creators · For researchers · Pricing · Help · Terms · Privacy · Refunds · © Outlier Desk

### 16.2 `/pricing` worked example
```
You post: 5 ideas × $8 = $40 budget
You pay today: $40 + $2.00 fee = $42.00
You unlock 3 ideas → researchers receive $7.20 each ($8 − 10% fee)
Brief closes → you get back $16.00 + $0.80 fee = $16.80
Total spent: $25.20 for 3 researched ideas
```
(Check: fee on used budget $24 × 5% = $1.20; $24 + $1.20 = $25.20; $42.00 − $16.80 = $25.20 ✓)

### 16.3 `/help` FAQ (minimum set)
- What is an outlier score?
- What do I get when I unlock an idea?
- What if the idea isn't what the card showed? (disputes)
- When do I get refunded?
- How are researchers verified?
- Can I work with a researcher again? (message them; retainers coming soon)
- Why can't I share my email or phone in chat?
- How and when do researchers get paid?
- Which countries can use Outlier Desk?
- Who owns the idea after I unlock it? (Creator gets a non-exclusive right to use the idea and instructions; the CRE may not pitch the same source video to the same creator again. Ideas themselves aren't copyrightable; the written instructions are licensed to the creator.)

### 16.4 SEO
- Titles/descriptions per page; Open Graph image generated with `next/og` using the brand fonts.
- `sitemap.xml` (marketing + public CRE profiles), `robots.txt` (disallow `/admin`, app routes).
- JSON-LD: `Organization` on home, `Person` + `AggregateRating` on CRE profiles (only real reviews).
- Blog is Phase 3 (topics: outlier research, hooks, niche breakdowns).

---

## 17. Legal pages (drafts must be reviewed by a Philippine lawyer)

Create these routes with clear, plain-language drafts:
1. **Terms of Service** — marketplace role (Outlier Desk is a platform, not a party to the research service), accounts, fees, escrow via provider, unlocks are final except through disputes, prohibited off-platform payment for work found on the platform (12 months), suspension, limitation of liability, governing law (Philippines), internal complaint process first (required by RA 11967), then DTI/courts.
2. **Privacy Policy** — Data Privacy Act of 2012 (RA 10173): what data (incl. KYC), purposes, retention (KYC kept for the period required by law, then deleted), processors (Supabase, Vercel, Xendit, Resend, PostHog, Sentry), rights (access, correction, erasure, portability), data protection officer contact, cross-border transfer notice.
3. **Refund Policy** — unused budget refunded at close; disputes window 72 h; card refunds take 5–10 business days; no refunds on unlocked ideas unless dispute won.
4. **CRE Agreement** — independent contractor, truthful stats, no plagiarism of other CREs' write-ups, license granted to creator on unlock (non-exclusive, perpetual, for the creator's own content), taxes are the CRE's responsibility (BIR), KYC consent.
5. **Acceptable Use** — no copying other CREs' locked content, no fake stats, no harassment, no adult/illegal niches, no contact-sharing.

Also show: business name, DTI/SEC registration number, BIR TIN, business address and contact email in the footer or a `/legal/company` page (ITA transparency).

---

## 18. Analytics events (PostHog)

Track with `user_id`, `role`, and relevant IDs. No PII or locked content in properties.

`signup_completed` · `role_selected` · `kyc_submitted` · `kyc_approved` · `brief_started` · `brief_created` · `checkout_started` · `brief_funded` · `brief_viewed_by_cre` · `pitch_started` · `pitch_submitted` · `pitch_unlocked` · `brief_closed` (with fill %) · `refund_issued` · `dispute_opened` · `dispute_resolved` · `payout_requested` · `payout_paid` · `message_sent` · `contact_masked` · `review_submitted`

**North-star and health metrics (admin overview):**
- Fill rate: % of funded briefs with ≥ 1 unlock (target ≥ 60%).
- Time to first pitch (target < 12 h), time to first unlock.
- Unlock rate per brief (unlocks ÷ pitches).
- Repeat creators within 30 days.
- GMV and platform revenue (= creator fees + CRE fees − refunded creator fees).
- Dispute rate (target < 3% of unlocks).

---

## 19. Security checklist

- [ ] RLS on every table; CI test that fails if any table in `public` has RLS disabled.
- [ ] Service role key only in server code (`lib/supabase/admin.ts`), never imported in client components (ESLint rule `no-restricted-imports`).
- [ ] `pitch_secrets` only fetched in server components or server actions using the user-scoped client.
- [ ] Next.js: `server-only` package in files that touch secrets or service role.
- [ ] Webhook token verified with constant-time compare; webhook route rejects non-POST.
- [ ] CSRF: server actions only (built-in origin check); no open GET mutations.
- [ ] Security headers: CSP (self + Supabase + Xendit + PostHog + Sentry), HSTS, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy.
- [ ] Payout account numbers encrypted with pgcrypto; key in env/secret manager; only last 4 shown.
- [ ] KYC images in private bucket, signed URLs 5 min, EXIF stripped.
- [ ] Admin requires MFA; admin actions audit-logged.
- [ ] Rate limits (Section 11.5).
- [ ] Dependency scanning (GitHub Dependabot) and `npm audit` in CI.
- [ ] Backups: Supabase daily backups + point-in-time recovery on paid plan.
- [ ] Error messages never include stack traces or SQL to the client.

---

## 20. Testing plan

### 20.1 Unit (Vitest)
- `money.ts`: fee math matches SQL `fee_cents` for 1,000 random cases; rounding half-up.
- `outlier.ts`: multiplier and tiers, invalid inputs throw.
- `contact-filter.ts`: 40+ cases (emails, PH numbers `0917 123 4567`, `+63 917…`, spelled digits, "gmail dot com", handles, allowed URLs in allowed fields).
- `url-normalize.ts`: each platform format, tracking params, invalid URLs.

### 20.2 Database (SQL tests)
- `unlock_pitch`: success path; not owner; brief closed; pitch already unlocked; max unlocks reached; **two concurrent unlocks when 1 unlock left → exactly one succeeds**.
- `close_brief`: refund amount correct for 0, some, all unlocks; creator fee refund correct.
- `submit_pitch`: KYC not approved; duplicate source; multiplier below min; too many pitches.
- Ledger: sums per brief balance to zero after settlement (`funding = unlock_gross + refund`).
- **RLS:** unauthorised reads of `pitch_secrets`, `kyc_submissions`, `payments`, `ledger_entries` return 0 rows.

### 20.3 End-to-end (Playwright, with mock payment provider)
1. Creator signs up → onboarding → creates brief → mock checkout → webhook → brief live.
2. CRE signs up → KYC → admin approves → CRE sees brief → submits pitch.
3. Creator sees locked card (assert page HTML does **not** contain the hook text or source URL) → unlocks → sees secrets.
4. Creator closes brief early → refund row created → mock refund webhook → brief settled.
5. Dispute flow → admin resolves for creator → CRE balance reduced.
6. Hold release cron → CRE withdraws → admin approves → mock payout webhook → paid.
7. Chat: sending an email address is masked; flag created.
8. Mobile viewport (390×844) run of flows 1 and 3.

### 20.4 Manual pre-launch checks
- Real card payment and refund with Xendit test mode, then a real $1 live transaction.
- Real GCash payout of ₱50 to the founder's own account.
- Email deliverability (SPF, DKIM, DMARC on domain).

---

## 21. Environment variables (`.env.example`)

```
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME="Outlier Desk"

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only
PAYOUT_ENCRYPTION_KEY=              # 32+ chars, server only

# Payments
PAYMENT_PROVIDER=mock               # mock | xendit
XENDIT_SECRET_KEY=
XENDIT_CALLBACK_TOKEN=
XENDIT_PLATFORM_ACCOUNT_ID=

# Email
RESEND_API_KEY=
EMAIL_FROM="Outlier Desk <hello@yourdomain>"

# Jobs
CRON_SECRET=

# Rate limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Observability
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
SENTRY_DSN=
```

---

## 22. Build order (phases with acceptance criteria)

### Phase 0 — Validation without code (Weeks 1–3, before building)
- Landing page with two waitlists (creator, CRE) — can be the `/` page from Phase 1 with a form writing to a `waitlist` table.
- Run 5 briefs manually (Google Form + document pitch cards + payment links).
- Call Xendit sales and a lawyer; record answers in `DECISIONS.md`.
- **Go/no-go:** at least 3 of 5 manual briefs lead to paid unlocks.

### Phase 1 — Foundation (Week 1)
- Next.js + Tailwind + shadcn + Supabase setup, design tokens, fonts, theme toggle.
- Full migration (Section 8) + seed + RLS + storage buckets.
- Auth (email, magic link, Google), onboarding role choice, middleware guards.
- Marketing pages with final copy (Section 16).
- ✅ **Accept:** can sign up as creator or CRE; RLS test suite passes; Lighthouse ≥ 90 on home (mobile).

### Phase 2 — CRE profiles + KYC + admin basics (Week 2)
- CRE onboarding (profile, portfolio, KYC, payout method).
- Public CRE directory and profile pages.
- Admin KYC queue, users page, audit log, MFA for admin.
- ✅ **Accept:** CRE submits KYC; admin approves; profile appears publicly without any KYC data.

### Phase 3 — Briefs + payments (Weeks 3–4)
- Brief form with live fee breakdown; `create_brief`.
- Payment provider interface + mock + Xendit implementation; checkout; webhook; `mark_brief_paid`.
- Creator dashboard, brief list/detail; CRE brief feed with filters.
- New-brief notifications to matching CREs.
- ✅ **Accept:** funded brief appears in CRE feed only after webhook; replayed webhook doesn't double-fund; amount mismatch rejected.

### Phase 4 — Pitches + unlocks (Weeks 4–5)
- Pitch form with public/locked panels, URL normalization, duplicate check, teaser check, contact filter.
- Locked/unlocked pitch cards; `unlock_pitch`; unlock library `/unlocks` with CSV export.
- ✅ **Accept:** locked view HTML contains no secret fields (E2E test); concurrent unlock test passes; unlock updates budget meter and notifies CRE.

### Phase 5 — Close, refunds, wallet, payouts (Weeks 5–6)
- Crons: close briefs, release holds, cancel unpaid drafts.
- Refund flow; creator billing page.
- CRE wallet, withdraw, admin payout approval, payout webhooks.
- ✅ **Accept:** ledger balances to zero per settled brief; real test refund and ₱50 payout succeed in provider test/live mode.

### Phase 6 — Messaging, disputes, reviews, flags (Weeks 6–7)
- Threads + Realtime messages with masking; flags.
- Disputes end to end; admin resolution.
- Reviews after unlock; stats views on cards and briefs.
- ✅ **Accept:** all E2E flows in Section 20.3 pass on desktop and mobile.

### Phase 7 — Launch hardening (Week 8)
- Legal pages reviewed; company details in footer.
- Security checklist (Section 19) complete; Sentry + PostHog live; backups on.
- Email templates tested in Gmail/Outlook; SPF/DKIM/DMARC.
- Invite first 20–30 CREs (manually approved), then first creators by hand.
- ✅ **Accept:** first real funded brief → pitch → unlock → payout completes in production.

### Later phases
- **Phase 8:** Idea Packs (catalog, orders, delivery, escrow release on acceptance or after 3 days).
- **Phase 9:** Retainers (proposal, weekly milestones funded in advance, auto-release after 3 days, pause/end).
- **Phase 10:** Featured briefs, CRE Pro subscription, YouTube Data API auto-stats, duplicate detection across briefs for the same creator, saved searches, team seats for agencies, PH creators paying in PHP via GCash.

---

## 23. Open decisions (fill in `DECISIONS.md`)

| # | Decision | Default in this spec |
|---|---|---|
| 1 | Payment provider after Xendit call | Xendit behind interface |
| 2 | Whether funds are held by provider until unlock or split on settlement | Provider holds; app ledger tracks |
| 3 | Refund method when partial card refund unsupported | Manual admin refund queue |
| 4 | Final brand name + domain (trademark check at IPOPHL and USPTO) | "Outlier Desk" placeholder |
| 5 | Countries allowed for creators at launch | US, CA, UK, AU, NZ, PH, SG |
| 6 | CREs outside the Philippines | Not at launch |
| 7 | One role per account vs both | One role per account |
| 8 | Hold period | 72 hours |
| 9 | Off-platform non-circumvention period in Terms | 12 months |
| 10 | Business entity | Register with DTI (sole prop) or SEC (OPC) + BIR before live payments |

---

## 24. Definition of done (every feature)

- Works on mobile (360 px) and desktop, light and dark theme.
- Loading, empty, error and success states designed with real copy.
- Zod validation on client and server; database constraints match.
- RLS reviewed; no secret or KYC data in client bundles or responses.
- Analytics event added where listed.
- Unit/SQL/E2E tests added and passing in CI.
- Accessible: keyboard, labels, contrast, focus.
- Any new admin action writes to `audit_log`.
