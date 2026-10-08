# Running Outlier Desk: launch and day-to-day guide

This guide is for the owner and anyone helping run the site. It explains what to check before launch, what to do every day, and what to do when something goes wrong. No coding is needed for anything here except where it says so.

## Before you open the doors

Do these once, in this order.

1. **Deploy.** Follow "Deploy (Vercel)" in the README, or run `npm run deploy` with your Supabase and Vercel tokens. The site runs in Singapore, next to the database.
2. **Become admin.** Sign up with the email listed in `ADMIN_EMAILS`, confirm it from your inbox, choose **Continue as admin**, and scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or 1Password). Keep your phone safe: every admin login needs a code from it.
3. **Add a second admin.** Ask a trusted partner to do step 2 with their own email. If you lose your phone, they can reset your authenticator; without a second admin you'd have to use the Supabase dashboard.
4. **Check the settings.** Admin → Settings. The defaults are a 5% creator fee, a 10% researcher fee, a 72-hour hold, $3 to $500 per idea, a 3× minimum outlier score and a $10 withdrawal minimum. Every page and the Terms quote whatever you set here.
5. **Send yourself every email.** Do one full test run (post a brief, pitch, unlock, withdraw) with two of your own accounts and check that each email arrives and isn't in spam. Set up SPF and DKIM for your email domain in Resend first.
6. **Legal and payments.** Keep `PAYMENT_PROVIDER=mock` (test mode, with the yellow TEST MODE banner) until the business is registered (DTI or SEC, BIR), a Philippine lawyer has reviewed the Terms, Privacy Policy and Refund Policy, and your Xendit account is approved. The launch plan PDF has the full list.
7. **Tighten Supabase's own limits.** In Supabase → Authentication → Rate Limits, set sign-ins and token verifications to about 30 per 5 minutes per address.

## Every day (about 15 minutes)

Open **Admin → Overview**. The Queues box shows everything waiting on you.

| Queue | What to do | Promise to users |
|---|---|---|
| Verifications waiting | Compare the ID photo, selfie and legal name. Approve, or reject with a clear reason they can fix. | Within 2 business days |
| Open disputes | Read both sides and the proof. Decide, and write a short note: both sides receive it by email. | Researcher has 48 hours to reply; decide soon after |
| Payouts to approve | Enter today's USD→PHP rate from your provider, then approve. The researcher gets an email with the peso amount. | Within 1–2 business days of the request |
| Refunds needing action | These are refunds the provider couldn't do automatically. Refund by hand in the provider's dashboard, then record the reference here. | Same day if possible |
| Open flags | Messages where someone tried to share contact details. Usually a warning is enough; suspend repeat offenders. | Within a few days |
| New tester feedback | Read, reply if needed, mark done. | Weekly at least |

On the free Vercel plan, the automatic jobs (closing briefs past their deadline, releasing finished holds, sending refunds) run once a day at midnight Manila time. Press **Run scheduled jobs now** if you need them sooner.

## Every week

- **Back up the database.** Supabase's free plan has no backups you can restore yourself. Either upgrade to Pro (daily backups), or once a week have someone technical run `npx supabase db dump --db-url "<connection string>" -f backup.sql` and store the file somewhere private.
- **Look at the numbers.** Overview shows money funded, platform revenue and fill rate (closed briefs with at least one unlock; aim for 60% or more). A low fill rate means briefs need more researchers in that niche, or prices are too low.
- **Keep the secrets file safe.** The deploy script saved `.env.production.local`. It holds the key that encrypts researchers' account numbers. If it is lost, saved payout methods can't be read and researchers must re-enter them. Never change that key once real payout details exist.

## When something goes wrong

**The site is down or very slow.**
Open `https://YOUR_DOMAIN/api/health`. If it doesn't load, check status.vercel.com and status.supabase.com. If both are fine, open the Vercel dashboard → your project → Deployments and redeploy the last working one ("Promote to production").

**A researcher says their payout didn't arrive.**
Admin → Payouts & refunds → History shows the status, the method's last four digits, when it was paid and the provider reference. Give the researcher the reference so their bank or GCash can trace it. If it says failed, the reason is shown; ask them to fix their payout details, then approve it again (each approval is a new attempt).

**A creator says they were charged but the brief isn't live.**
Check Billing on their account (or the provider's dashboard). The site retries payment notifications from the provider automatically. If the payment shows as paid at the provider but not in the site after an hour, contact support with the payment reference.

**A refund looks wrong.**
Refunds are worked out by the database: unused ideas plus their share of the creator fee. The Pricing page shows a worked example. "Retry refund" only works on failed or manual refunds, so a refund can't be sent twice by mistake.

**You lost your phone (admin two-factor).**
Ask the second admin to remove your authenticator: Supabase dashboard → Authentication → Users → your user → MFA factors → delete. Then log in and scan a new QR code. If there is no second admin, do it yourself in the Supabase dashboard (which has its own login).

**Someone is abusing the platform.**
Admin → Users → search → **Suspend…** → write the reason → Suspend. From that moment they can't pitch, post, message, review, open disputes or receive unlocks; they see a "Your account is suspended" page. Lifting the suspension restores access. Closed accounts are shown as "Closed" and can't be reopened.

**Personal data may have leaked (for example a lost laptop with the secrets file, or a suspicious admin login).**
1. Change the admin passwords and reset the authenticators.
2. In Supabase → Project Settings → API, rotate the service-role key, then update it in Vercel → Settings → Environment Variables and redeploy.
3. Under the Data Privacy Act, a breach involving sensitive personal information (such as ID documents) must be reported to the National Privacy Commission and the affected people, generally within 72 hours of discovering it (NPC Circular 16-03). Call your lawyer first.

**A user asks for their data to be deleted.**
They can do it themselves: Settings → Close account. It refuses while money or a dispute is attached and says why. Once closed, their ID photos, payout details, saved items and profile are deleted; payment records stay, as the Privacy Policy explains.

## Going from test mode to real money

1. Get Xendit approval and add `XENDIT_SECRET_KEY` and `XENDIT_CALLBACK_TOKEN` in Vercel.
2. In Xendit, point the payment, refund and payout webhooks to `https://YOUR_DOMAIN/api/webhooks/payments` with the callback token.
3. Check the bank list on the wallet page against Xendit's current payout channel codes.
4. Set `PAYMENT_PROVIDER=xendit` and redeploy. The TEST MODE banner disappears.
5. Do one real end-to-end run with a small brief ($3) and a real GCash payout to yourself before announcing.
