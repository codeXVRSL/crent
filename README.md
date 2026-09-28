# Outlier Desk

A marketplace where content creators post research briefs and verified Content Research Experts (CREs) pitch proven content ideas. Creators pay only for the ideas they unlock.

Built with Next.js 15 (App Router, TypeScript), Tailwind CSS v4 and Supabase (Postgres, Auth, Storage). Payments go through a swappable provider: a built-in **test mode** for development, and **Xendit** for real money.

---

## What works

| Area | Status |
|---|---|
| Sign up, log in, one role per account (creator or researcher) | ✅ |
| Creator profile | ✅ |
| Researcher profile, portfolio finds, ID verification with private photo upload | ✅ |
| Admin review of verifications (approve / reject with reason) | ✅ |
| Post a brief with live fee breakdown → pay → brief goes live | ✅ |
| Researchers see funded briefs in their niches; pitch form with live outlier score | ✅ |
| Duplicate source detection (same video in any URL format), teaser-reveals-hook check, contact-detail check | ✅ |
| **Locked pitch cards: the idea never reaches the creator's browser before unlock** | ✅ (tested) |
| Unlock (atomic; two simultaneous unlocks can't overspend a brief) | ✅ (tested) |
| Auto-close at max unlocks or deadline; close early; refund unused budget + its share of the fee | ✅ |
| 72-hour hold, then earnings become withdrawable | ✅ |
| Payout methods (GCash / Maya / bank, account number encrypted), withdrawal requests, admin approval with USD→PHP rate | ✅ |
| Disputes: creator opens within 72h → researcher replies → admin decides; reversal refunds the creator | ✅ |
| Reviews after unlock; public researcher directory and profiles with stats | ✅ |
| Messaging with automatic hiding of emails, phone numbers, links and handles (+ admin flags) | ✅ |
| In-app notifications; transactional emails via Resend (printed to the log if no key) | ✅ |
| Admin: overview metrics, verifications, disputes, payouts & manual refunds, flags, users/suspension, fee settings, audit log | ✅ |
| Append-only money ledger; escrow balances to zero per brief | ✅ (tested) |
| Light and dark theme, mobile layout | ✅ |
| Tester Feedback button → admin Feedback inbox; test-mode banner | ✅ |
| Proof screenshot on pitches (private, shown after unlock); CSV export of unlocked ideas | ✅ |
| Admin "Run scheduled jobs now"; admin sign-up via `ADMIN_EMAILS` | ✅ |
| Open Graph image, sitemap, robots, security headers | ✅ |

### Not built yet (from the spec's later phases)
Idea Packs, research retainers, featured briefs, researcher Pro subscription, referral codes, admin two-factor login, rate limiting, Sentry/PostHog, live (websocket) chat — chat refreshes every few seconds instead — and avatar uploads.

---

## Run it locally

### 1. Requirements
- Node.js 20+
- A Supabase project (free tier is fine) — or the Supabase CLI with Docker for a fully local setup

### 2. Install
```bash
npm install
cp .env.example .env.local
```

### 3. Create the database
**Option A — Supabase CLI (recommended)**
```bash
npx supabase login
npx supabase init            # only creates supabase/config.toml; keeps the migrations
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push         # applies supabase/migrations/*.sql
```
Then open the Supabase SQL Editor and run `supabase/seed.sql` (adds the niche list).

**Option B — SQL Editor only**
In Supabase → SQL Editor, run these files in order:
1. `supabase/migrations/20260927000001_schema.sql`
2. `supabase/migrations/20260927000002_functions.sql`
3. `supabase/migrations/20260927000003_rls.sql`
4. `supabase/migrations/20260927000004_storage.sql`
5. `supabase/migrations/20260928000005_feedback_and_proof.sql`
6. `supabase/seed.sql`

### 4. Configure Supabase Auth
Supabase → Authentication → URL Configuration:
- **Site URL:** `http://localhost:3000` (later your real domain)
- **Redirect URLs:** add `http://localhost:3000/auth/callback` (and your domain's `/auth/callback`)

Email confirmation can stay on; new users click the link in their email.

### 5. Fill in `.env.local`
From Supabase → Project Settings → API: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
Generate the two secrets:
```bash
openssl rand -base64 48   # PAYOUT_ENCRYPTION_KEY (never change it after launch)
openssl rand -hex 32      # CRON_SECRET
```
Keep `PAYMENT_PROVIDER=mock` for now.

### 6. Start
```bash
npm run dev
```
Open http://localhost:3000.

### 7. Make yourself admin
Sign up once with your own email, then in the Supabase SQL Editor:
```sql
update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```
Log out and back in. You'll land on `/admin`. Use a **different** email for your creator and researcher test accounts.

### 8. Try the whole flow (test mode)
1. Sign up as a researcher → finish profile, add 3 portfolio finds, submit verification.
2. As admin → **Verifications** → Approve.
3. Sign up as a creator → **Post a brief** → **Continue to payment** → **Pay (test)**.
4. As the researcher → **Open briefs** → pitch an idea.
5. As the creator → open the brief → the card is locked → **Unlock**.
6. Close the brief early to see the refund, or wait for the deadline.
7. The scheduled job releases holds; to test now, call it by hand:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron
   ```
   (Holds last 72 hours. For testing, set **Hold period** to 0 in Admin → Settings before the unlock.)
8. As the researcher → **Wallet** → add GCash → withdraw. As admin → **Payouts** → approve.

---

## Deploy (Vercel)
1. Push this folder to a GitHub repo and import it in Vercel.
2. Add every variable from `.env.example` in Vercel → Settings → Environment Variables. Set `NEXT_PUBLIC_APP_URL` to your domain.
3. `vercel.json` runs `/api/cron` once a day (midnight Manila time) so it works on Vercel's free Hobby plan. While testing, use **Admin → Run scheduled jobs now**. For launch, either move to Pro and set the schedule to `*/15 * * * *`, or keep Hobby and point a free external scheduler (e.g. cron-job.org) at `https://YOUR_DOMAIN/api/cron` with header `Authorization: Bearer <CRON_SECRET>` every 15 minutes.
4. Add your domain's `/auth/callback` to Supabase Redirect URLs and change the Site URL.

## Switching to real payments (Xendit)
1. Talk to Xendit sales first and confirm: USD card payments on your account, partial refunds on invoice payments, and payouts to GCash/Maya/PH banks. Record the answers in `DECISIONS.md`.
2. Set `PAYMENT_PROVIDER=xendit`, `XENDIT_SECRET_KEY`, `XENDIT_CALLBACK_TOKEN`.
3. In the Xendit dashboard, set the webhook URL for invoices, refunds and payouts to `https://YOUR_DOMAIN/api/webhooks/payments`.
4. Test with Xendit's test keys, then do one real $1 payment, refund and ₱50 payout to yourself.

`lib/payments/xendit.ts` follows Xendit's Invoices v2, Refunds and Payouts v2 APIs. Check field names against Xendit's current docs before going live; anything the provider can't refund automatically lands in **Admin → Payouts & refunds** for a manual refund.

## Tests
```bash
npm test                 # unit tests: fee math matches the database, outlier score
npm run db:test          # database: whole marketplace flow, security rules, race condition
                         # needs a throwaway Postgres 15+: PGHOST=... PGPORT=... PGUSER=postgres npm run db:test
npx playwright test      # browser test of the full flow; needs the app + Supabase running and
                         # SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set (local Supabase recommended)
```
The browser test skips the ID-photo upload (it writes the verification row directly) and makes one account admin through the API.

## Design system
- **Type:** Geist and Geist Mono (self-hosted through `next/font`, no third-party requests), Instrument Serif italic for one accent word in the hero.
- **Color:** cool neutrals plus one signal color (teal) and amber for "locked". Tokens live in `app/globals.css`; light and dark are both designed, and the theme follows the system unless the user picks one.
- **Surfaces:** hairline borders at low opacity, 16px card radius, tinted shadows, dot-grid backgrounds on hero areas.
- **Motion:** one easing curve, 150–520 ms, disabled when the user prefers reduced motion. Glass blur and 3D are left out for performance on mid-range phones.
- **Components:** `components/ui.tsx` (buttons with loading state, inputs with focus ring, cards, pills, stat tiles, notices, empty states), `components/pitch-card.tsx` (outlier score with a views-vs-median bar chart), `components/command-palette.tsx` (⌘K / Ctrl+K).

## How it's put together
```
supabase/migrations/   schema, money functions, Row Level Security, storage policy
supabase/tests/        database tests (run.sh)
lib/payments/          provider interface, test mode, Xendit, webhook/refund/payout handling
app/(marketing)/       public pages: home, pricing, researchers directory, help, legal drafts
app/(auth)/            login, signup, auth callback
app/onboarding/        role choice, creator profile, researcher profile + verification
app/(app)/             signed-in app: dashboard, briefs, pitches, unlocks, wallet, billing, messages, admin
app/actions/           server actions (all writes)
app/api/               payment webhook, scheduled job, health check
```

**Rules the code relies on**
- Money is integer cents. All money changes happen inside database functions with row locks, and each one writes to the append-only ledger.
- Locked pitch content lives in `pitch_secrets`, which Row Level Security only shows to the researcher, to the creator after a non-reversed unlock, and to admins.
- Briefs are only visible to researchers once a verified payment webhook has opened them.
- The service-role key is only used in `lib/supabase/admin.ts` (webhooks, scheduled job, admin payout/refund calls).

## Before launch
- Have a Philippine lawyer review `app/(marketing)/legal/[slug]/page.tsx` (drafts) and the escrow setup.
- Register the business (DTI or SEC) and with the BIR; put the registration numbers in the site footer.
- Check the trade name "Outlier Desk" with IPOPHL before buying a domain.
- Set up SPF/DKIM for your email domain in Resend.
