# Testing Outlier Desk

A guide for the two of us testing the live test site. Payments are **simulated**: no card is charged and no money moves. A banner at the top of every page says so.

## Who plays what

Each account has one role, so use a different email for each.

| Person | Account | Role |
|---|---|---|
| Save | your main email (listed in `ADMIN_EMAILS`) | **Admin**: approves researchers, runs jobs, reads feedback |
| Save | a second email (e.g. a Gmail `+creator` alias: `you+creator@gmail.com`) | **Creator**: posts briefs, unlocks ideas |
| Jamaica | her own email | **Researcher (CRE)**: gets verified, pitches ideas, withdraws |

Gmail delivers `you+anything@gmail.com` to `you@gmail.com`, so you don't need extra inboxes.

## Shortcut: demo accounts
Run `npm run seed:demo` once against the test database to get a ready-made creator, two verified researchers and an admin (password `OutlierDemo2026!`). The creator already has a live brief with three locked pitches. See the README for the emails. You can skip steps 1–4 below and go straight to unlocking.

## 1 · Set up the admin (Save, once)
1. Sign up with your admin email. On the "How will you use Outlier Desk?" screen, choose **Continue as admin**.
   The site then asks you to set up an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or 1Password): scan the QR code and type the 6-digit code. From then on every admin login asks for a code. If you are testing on a local database without a phone handy, put `ADMIN_MFA_REQUIRED=false` in `.env.local`.
2. Leave **Hold period** at 72 hours for now. The hold is also the dispute window, so set it to **0 hours** (Admin → Settings) only when you reach step 6 and want to test payouts; after that, disputes can't be opened on new unlocks.

## 2 · Researcher gets verified (Jamaica)
1. Sign up → choose **I'm a researcher**.
2. Fill in the profile, pick 1–3 niches, and add **3 portfolio finds**: real videos with their views and the channel's usual (median) views.
3. Upload a photo of an ID and a selfie. Any photo works for testing; don't upload a real government ID to a test site. A photo of a library card or a drawing is fine.
4. Submit. She'll see "Verification pending".

**Save (admin):** Admin → **Verifications** → open her application → **Approve**.

## 3 · Creator posts a brief (Save, creator account)
1. Log out, sign up with the creator email → **I'm a creator** → finish the profile.
2. **Post a brief**: pick a niche Jamaica chose, a budget (e.g. $40), price per idea (e.g. $8), and a deadline.
3. **Continue to payment → Pay (test)**. The brief is now live.

## 4 · Researcher pitches (Jamaica)
1. **Open briefs** → open the brief → **Pitch an idea**.
2. Paste a real video URL, its views and the channel median. The outlier score appears live.
3. Write a teaser (don't give away the hook), then the hook, shot list and CTA, which stay locked. Optionally attach a proof screenshot.
4. Submit.

## 5 · Creator unlocks (Save, creator)
1. Open the brief. The pitch card shows the score and teaser, with the idea locked.
2. **Unlock**. The full idea, source link and proof screenshot appear.
3. Try **Unlocked ideas → Download CSV**, leave a **review**, and send a **message**. Emails and phone numbers get hidden automatically.
4. Optional: **Close brief** to see the unused budget refunded.

## 6 · Researcher gets paid (Jamaica + Save)
1. **Save (admin):** Admin → **Settings** → set **Hold period** to 0 and **Minimum withdrawal** to $1 (one $8 unlock earns $7.20, under the $10 default). Then Admin → **Run scheduled jobs now** to release the held earnings.
2. **Jamaica:** **Wallet** → add a GCash number (any 11-digit test number, e.g. 09170000000) → **Withdraw**.
3. **Save (admin):** Admin → **Payouts** → approve → mark as sent.

## 7 · New tools for creators and researchers
**Creator (Save):**
1. **Idea board**: every unlocked idea starts in "To do". Move it along with the arrow buttons, open **Details** to set a board name (e.g. "March batch") and a film date, then mark it **Posted** and enter the views it got and your usual views.
2. Open a brief with several pitches: sort by score, filter by hook type, **star** a pitch to shortlist it, and **Pass** on one with a reason.
3. On a pitch (or the researcher's public profile) tap **Save researcher**. Then go to **Saved researchers** and **Invite to pitch** on a live brief.
4. **Post a similar brief** from a brief page, or pick a template on the new-brief form.
5. **Unlocked ideas**: search for a word from a hook, and try **Copy as AI script prompt**.

**Researcher (Jamaica):**
1. **Swipe file** → save a video you found. If an open brief fits it, click **Pitch this**: the form opens with the link, views and date filled in.
2. **My pitches** shows the creator's result once Save logs views, and the reason if Save passed.
3. **Open briefs**: try the platform / pay / sort filters and **Invited only**.
4. Check your public profile: level badge and "Track record with creators".

## 7b · Account safety
- Type a wrong password 10 times for one account: the 11th attempt is refused for 15 minutes even with the right password.
- Settings → **Close account** on a researcher account with earnings still on hold: it refuses and says why. On an account with nothing attached, it asks you to type CLOSE, then logs you out; the same email can no longer log in and the public profile is gone.

## 8 · Try to break it
- Pitch the **same video twice** (even with a different URL format). It should be blocked.
- Put an email or @handle in a pitch or a message.
- Open a **dispute** on an unlocked idea as the creator, reply as the researcher, and decide it as admin.
- Use it on your **phone**, and try **dark mode**.
- Press **Ctrl+K / ⌘K** to jump around.

## Reporting problems
Use the **Feedback** button (bottom right, on every signed-in page). It records which page you were on. Save reads everything in **Admin → Feedback**.

## Known limits of the test site
- **Emails:** Supabase's free email service only delivers to a few addresses per hour. Sign-up doesn't need email on the test site, but "Forgot password" emails may not arrive. If you get locked out, tell Save; he can reset it from the Supabase dashboard.
- **Scheduled jobs** (closing expired briefs, releasing holds) run automatically once a day. Use **Run scheduled jobs now** instead of waiting.
- **Free database pauses** after about a week with no visits. Save can resume it from the Supabase dashboard.
