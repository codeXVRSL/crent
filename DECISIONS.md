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

## Open questions for you
- Xendit: USD invoices, partial refunds, GCash/Maya payout channel codes on your account.
- Which countries creators may sign up from at launch.
- Final brand name and domain.
