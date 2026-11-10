# Decisions

Choices made while building, where the spec left room. Change them here when you decide otherwise.

| # | Decision | Why |
|---|---|---|
| 1 | Payment provider sits behind `lib/payments/types.ts`; test mode is the default | Build and test everything before Xendit confirms what your account supports |
| 2 | Brief budgets are charged up front; unlocks move money inside the app's ledger, not the card | No card charge per unlock; fewer fees and failures |
| 3 | Refunds the provider can't do automatically become `manual` and show in Admin → Payouts & refunds | Partial card refunds may not be supported on every channel |
| 4 | Payouts are withdraw-all-available, admin-approved, with the USD→PHP rate entered at approval | Fraud check while volume is small; rate is recorded on the payout |
| 5 | Contact masking runs in the database (trigger on messages, checks in brief/pitch functions) | Can't be skipped by calling the API directly |
| 6 | Duplicate sources are compared by a SHA-256 of the normalized platform + video id | The public pitch row never contains the URL |
| 7 | One role per account | Simpler permissions; the spec's default |
| 8 | Creator fee is refunded proportionally on unused budget | Creators pay 5% only on what they use |
| 9 | Chat streams new messages over Supabase Realtime; a 30-second refresh stays as a fallback | Instant chat without a separate websocket server; still works if Realtime drops |
| 10 | Fonts load from Google Fonts at runtime (not `next/font`) | Builds work in restricted networks; same result for visitors |
| 11 | Unpaid draft briefs are cancelled after 7 days by the scheduled job | Keeps the brief list clean |
| 12 | Creator stats shown to researchers: briefs posted, % of pitches unlocked, disputes opened | Lets researchers avoid creators who browse and never buy |
| 13 | Admin powers need a two-step (aal2) session, checked in `is_admin()` as well as on admin pages | A stolen admin password alone can't move money. Break-glass: `update platform_settings set admin_mfa_required = false;` in the Supabase SQL editor |
| 14 | Rate limits are fixed windows counted in Postgres (`rate_limit_hit`), callable only by the server; they fail open | Works on Vercel without Redis; a limiter outage never locks everyone out |
| 15 | Profile photos live in a public `avatars` bucket; the database only accepts paths inside the user's own folder | Photos are meant to be public; the path rule stops overwriting other people's photos |
| 16 | Sentry is optional and off without a DSN; the browser SDK loads only when configured | No cost or bundle weight until you want monitoring |

## Open questions for you
- Xendit: USD invoices, partial refunds, GCash/Maya payout channel codes on your account.
- Which countries creators may sign up from at launch.
- Final brand name and domain.
