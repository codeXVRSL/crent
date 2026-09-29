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
| 9 | Chat refreshes every 6 seconds instead of websockets | Simple and reliable for the MVP |
| 10 | Fonts load from Google Fonts at runtime (not `next/font`) | Builds work in restricted networks; same result for visitors |
| 11 | Unpaid draft briefs are cancelled after 7 days by the scheduled job | Keeps the brief list clean |
| 12 | Creator stats shown to researchers: briefs posted, % of pitches unlocked, disputes opened | Lets researchers avoid creators who browse and never buy |
| 13 | Researchers see only the stage and result multiple of their posted ideas, never the creator's video link or notes | The link would reveal the creator's channel and invite going off-platform |
| 14 | Result = views the creator's video got ÷ the creator's usual views, entered by the creator | Same scale as the outlier score; no platform API needed. Self-reported, so it's shown as "logged by creators" |
| 15 | "Pass" doesn't lock or refund anything; the pitch stays unlockable until the brief closes | Gives the researcher feedback without adding a new money state |
| 16 | Researcher levels are computed in the app (`lib/level.ts`) from public stats, not stored | Thresholds can change without a migration |
| 17 | Up to 25 invites per brief; invited researchers see the brief even outside their niches | Stops invite spam while letting creators bring back researchers they trust |
| 18 | "Copy as AI script prompt" builds text only; nothing is sent to an AI service | No new vendor, no cost, creator uses whichever tool they like |

## Open questions for you
- Xendit: USD invoices, partial refunds, GCash/Maya payout channel codes on your account.
- Which countries creators may sign up from at launch.
- Final brand name and domain.
