# Test report, 1 October 2026

A full pass over the test site with three fresh accounts (creator, researcher, admin) and the demo accounts, done through a real browser against a production build (`next build && next start`) and a local Supabase.

## What was run

| Suite | Result |
|---|---|
| Unit tests (`npm test`): fee math, outlier score, researcher levels, AI prompt | 16 / 16 passed |
| Database tests (`npm run db:test`): marketplace flow, money ledger, privacy rules, simultaneous-unlock race, idea board / invites / swipe file privacy | all passed |
| Scripted browser tests (`npx playwright test`): sign-up → verification → brief → pitch → unlock → refund → payout → chat; swipe file → shortlist/pass → idea board → results → invites | 2 / 2 passed |
| Exploratory browser run (`tests/e2e/exploratory.mjs`), 34 steps | 34 / 34 passed, 0 console errors |

The exploratory run covers what the scripted tests skip: ID photo upload and admin review (reject with reason, resubmit, approve), pitch with a proof screenshot, every pitch rule (score too low, teaser reveals hook, duplicate, 5-pitch limit, withdraw), CSV export contents, reviews, chat masking from both sides, the Feedback button and admin inbox, the whole dispute (open → reply → admin refund → access removed → billing and wallet), the hold/dispute window closing, GCash payout end to end, admin settings validation, suspension and lifting it, every admin page, cross-role access (wrong-role pages, another creator's brief and dispute, export and cron without login), idea-board edge cases, swipe file archive/delete, directory filters, settings, command palette, password reset, logout, and a phone-width dark-mode sweep of every page for all three roles.

## Bugs found and fixed

All of these were real and are fixed in this commit.

1. **Admin verification decisions showed no confirmation.** Approve/Reject worked, but the card vanished with the message, leaving an empty queue and no feedback. Now confirmed at the top of the page.
2. **"Delete draft" didn't delete.** The brief was only marked cancelled and stayed in "My briefs". Deleted drafts are now hidden.
3. **Review confirmation lost.** After rating a researcher the form disappeared along with "Thanks for the review". Now shows "You rated 4★".
4. **Dispute reply confirmation lost.** The researcher's reply replaced the form, hiding the confirmation. Now confirmed at the top.
5. **Dispute resolution confirmation lost.** Same for the admin's decision.
6. **Payout approval confirmation lost.** "Payout sent." disappeared with the card. Now confirmed at the top.
7. **`TESTING.md` contradiction.** It told testers to set the hold period to 0 hours in step 1, which makes disputes impossible to test (the hold *is* the dispute window). Reordered: hold stays at 72 h until the payout step.
8. **Dashboard counted passed pitches as "waiting"** (fixed yesterday, re-verified).

## Things that work and were checked specifically

- Locked ideas never reach the browser before unlock, and a reversed unlock removes access again while leaving other unlocked ideas alone.
- Contact details are hidden in chat, briefs, reviews and pass notes, and each attempt lands in the admin's Flags.
- The ID photos and proof screenshots upload to private storage and load for the right people only.
- A rejected form keeps everything the person typed.
- Suspended users are sent to `/suspended` and get back in when the suspension is lifted.
- Every page fits a 390 px phone screen in dark mode with no sideways scrolling.

## Not covered

Real payments (Xendit) and real email delivery (Resend) run in test mode here; both need their accounts set up before they can be tested.
