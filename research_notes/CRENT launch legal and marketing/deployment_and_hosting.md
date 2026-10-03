# CRENT: Deployment, Hosting and Payments Plan (Next.js 15 + Supabase, Philippine founder, October 2026)

**Research caveat (read first):** The sandbox's network proxy blocked direct access to every official pricing page (vercel.com, supabase.com, resend.com, xendit.co, help.xendit.co, docs.xendit.co, paymongo.com, stripe.com, dot.ph, paypal.com) and to WHOIS/RDAP servers. All figures below therefore come from web-search summaries of those pages and from 2026 third-party pricing round-ups that cite them. Each number links to the page it came from; where two sources disagree, both are shown. The founder should re-check the linked official page before signing up. PHP conversions are NOT provided for USD-priced SaaS because no sourced exchange rate was retrievable; use the BSP reference rate on the day (illustrative: at ~₱57/USD, $25 ≈ ₱1,425).

---

## Key Question 1: Hosting the Next.js 15 App Router app (Vercel Hobby vs Pro vs alternatives)

### Takeaway
Vercel Pro ($20/month) is the lowest-friction production host for Next.js 15, and it is required because Vercel's Hobby plan forbids commercial use (a site with a billing integration is explicitly named as a violation). If $20/month is too much at launch, Cloudflare Workers (free plan allows commercial use; $5/month paid) via the OpenNext adapter, or Railway Hobby ($5/month) are the cheapest legitimate options; a Singapore VPS (Hetzner/DigitalOcean) plus Coolify is cheapest at scale but needs sysadmin time.

### Cited Findings

**Vercel**
- Hobby is free with 100 GB bandwidth, 1M edge requests, 1M function invocations and 4 CPU-hours per month; it is "non-commercial only, so any revenue-generating app is forced onto Pro" — [Makerkit, Vercel cost 2026](https://makerkit.dev/blog/saas/vercel-cost); [Costbench](https://costbench.com/software/developer-tools/vercel/)
- Vercel's fair-use rules: Hobby is for "non-commercial, personal" use; examples of violations include "having a billing integration on the site (Stripe, Lemon Squeezy, Paddle), displaying ads ... or the project being owned by an LLC or other commercial entity"; enforcement is inconsistent but Vercel does send notices — [justinmckelvey.com, Is Vercel Free? (2026)](https://justinmckelvey.com/blog/is-vercel-free); official Hobby plan page: [vercel.com/docs/plans/hobby](https://vercel.com/docs/plans/hobby) (could not be fetched directly)
- Pro: $20 per seat per month, includes $20 of usage credit, allows commercial use, 1 TB bandwidth; usage beyond credit billed on multiple axes (bandwidth, compute, invocations, etc.) — [Comparedge](https://comparedge.com/tools/vercel/pricing); [Schematic](https://schematichq.com/blog/vercel-pricing)
- Cron jobs: Hobby allows 2 cron jobs per project, at most once per day, and timing is only precise to the hour (e.g. `0 3 * * *` fires sometime 03:00–03:59 UTC); more frequent expressions fail at deploy — [SteadyCron, Vercel cron limits](https://steadycron.com/guides/vercel-cron-limits/); [Runhooks](https://runhooks.app/blog/vercel-hobby-cron-job-limits-explained/); official page [vercel.com/docs/cron-jobs/usage-and-pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) (blocked)
- Function duration: with Fluid compute (default for new projects since 23 April 2025) Hobby functions can run up to 300 s; Pro default is 300 s, configurable to 800 s; a 1,800 s extended duration is in beta for Pro/Enterprise — [Vercel changelog](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute); [Malte Ubl (Vercel CTO) on X](https://x.com/cramforce/status/1937886722471481392). Older third-party guides still quote 10 s (Hobby) / 60 s (Pro) for cron functions — [Cronuru guide](https://cronuru.com/guides/vercel-cron) — this reflects the pre-Fluid limits and conflicts with the official changelog.
- Vercel Web Analytics on Hobby: 50,000 events/month, then collection pauses; Speed Insights free tier: 10,000 events per 30 days shared across the team — [Vercel Speed Insights limits](https://vercel.com/docs/speed-insights/limits-and-pricing); [Costbench Hobby limits](https://costbench.com/software/developer-tools/vercel/free-plan/)

**Netlify**
- Free plan allows commercial use but is a hard cap of 300 credits/month drawn by bandwidth, deploys, requests and function compute; "hit the cap and all your sites pause until the next month" — [Costbench Netlify free plan](https://costbench.com/software/developer-tools/netlify-dev/free-plan/); [Toolchase](https://toolchase.com/blog/netlify-pricing-guide/)
- Paid tier ~$19–20/seat; 100 GB bandwidth then $0.55/GB; 125k function invocations then $25/M — [Dev.to, Next.js hosting cost 2026](https://dev.to/nayankyada/nextjs-hosting-cost-in-2026-vercel-vs-netlify-vs-railway-vs-vps-431a)

**Railway / Render**
- Railway: Free ($1/month credit, 0.5 GB RAM), Hobby $5/month with $5 credit, Pro $20/month with $20 credit; overage ~$20/vCPU-month, $10/GB RAM-month, $0.05/GB egress — [Makerkit, best Next.js hosting 2026](https://makerkit.dev/blog/tutorials/best-hosting-nextjs); [Encore, Render vs Railway](https://encore.dev/articles/render-vs-railway)
- Render: free tier (750 h/month, spins down when idle), Starter $7/month, Standard $25/month, 100 GB bandwidth included — [Encore](https://encore.dev/articles/render-vs-railway)

**Cloudflare Workers (via OpenNext)**
- Free plan: 100,000 requests/day, 10 ms CPU per invocation, commercial use allowed, no SLA/support; paid Workers plan $5/month with 10M requests and 30M CPU-ms, then $0.30 per million requests; no egress fees — [Cloudflare Community](https://community.cloudflare.com/t/is-cloudflare-pages-workers-free-plan-free-for-commercial-use/291741); [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/); [Makerkit Cloudflare vs Railway](https://makerkit.dev/pricing-calculator/cloudflare-vs-railway)
- OpenNext Cloudflare adapter supports the latest Next.js 15 minor (and 16): App Router, Server Components, SSR, ISR (needs R2), Server Actions, Middleware, Image Optimization; NOT supported: Node.js middleware from 15.2, `runtime = "edge"` exports; free plan has a 3 MiB gzipped worker size limit that heavy dependencies (e.g. Sentry server SDK) can exceed — [OpenNext Cloudflare docs](https://opennext.js.org/cloudflare); [Toolchew 2026 guide](https://toolchew.com/en/how-to-deploy-nextjs-cloudflare-2026/)

**VPS in Singapore**
- DigitalOcean Singapore: Basic 2 vCPU / 4 GB droplet $24/month (80 GB SSD, 4 TB transfer); Hetzner CPX22 (2 vCPU / 4 GB) €7.99/month in EU, but Hetzner's Singapore location is priced higher (cost-optimised plans listed €15.49+/month with only 0.5 TB traffic) and Hetzner raised prices in 2026 — [Better Stack, DO vs Hetzner 2026](https://betterstack.com/community/guides/web-servers/digitalocean-vs-hetzner/); [Bitdoze, Hetzner after April 2026 increase](https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans/); [Costgoat Hetzner calculator Oct 2026](https://costgoat.com/pricing/hetzner)
- Coolify (self-hosted PaaS) on a VPS: ~$8–10/month for 1–2 Next.js sites including Coolify Cloud at $5/month — [Shipixen Coolify guide](https://shipixen.com/boilerplate-documentation/coolify-cloud-nextjs-deploy-integration)

### Inferences
- CRENT has a payments integration and is a business, so Vercel Hobby is off the table from day one regardless of traffic; budget $20/month for Vercel Pro or pick a host whose free/cheap tier permits commercial use (Cloudflare Workers free/paid, Railway Hobby, Netlify Free within 300 credits).
- The Hobby cron (once/day, 2 jobs) and the 300 s function limit matter for escrow auto-release and payout batching; on Pro, per-minute cron is available, otherwise use an external scheduler (see Key Question 7).
- For a non-engineer founder, Vercel Pro at $20/month is the safest choice: zero server maintenance, native Next.js support, built-in cron. Cloudflare Workers is the cheapest safe alternative but needs OpenNext configuration and may hit the 3 MiB bundle limit.
- A Singapore VPS makes sense only once bandwidth/compute overages on Vercel exceed ~$30–40/month and someone can patch/maintain a server.

### Gaps
- Could not read vercel.com/pricing or the Hobby fair-use page directly; overage unit prices (per-GB bandwidth, per-GB-hour compute) on Pro were not captured.
- Exact 2026 Hetzner Singapore shared-vCPU price per instance type was not confirmed from Hetzner's site.

---

## Key Question 2: Supabase (database, auth, storage for private ID photos)

### Takeaway
Use Supabase Pro ($25/month) in the Singapore region (`ap-southeast-1`) from launch: the Free plan pauses projects after 7 days of inactivity and has no backups, which is unacceptable for a marketplace holding escrow records and identity documents. Pro includes daily backups (7-day retention); point-in-time recovery is a $100/month add-on and can wait.

### Cited Findings
- Plans: Free $0, Pro $25/month per project (billed per organization plus usage), Team $599/month, Enterprise custom — [Costbench Supabase](https://costbench.com/software/database-as-service/supabase/); [JetAdmin Supabase pricing 2026](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)
- Free plan: 500 MB database, 1 GB file storage, 50,000 MAU, max 2 active projects; "Free projects pause after 7 days of inactivity ... data is retained, but the project goes offline until you manually resume it" — [UI Bakery Supabase pricing](https://uibakery.io/blog/supabase-pricing); [Axonbuild Supabase pricing](https://axonbuild.com/blog/supabase-pricing)
- Pro: includes a $10/month compute credit covering one Micro instance; daily backups with 7-day retention; 250 GB unified egress quota — [JetAdmin review](https://www.jetadmin.io/blog/supabase-review/); [Activepieces Supabase pricing](https://www.activepieces.com/blog/supabase-pricing-free-tier-limits-pro-costs-egress)
- Egress overage: $0.09/GB uncached, $0.03/GB cached — [Supabase docs, Manage egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress) (surfaced via search; direct fetch blocked)
- PITR add-on: $100/month (7-day window), $200/month (14 days), $400/month (28 days), billed hourly — [BackupDrill, Supabase PITR](https://backupdrill.com/compare/supabase-pitr); [Axonbuild Supabase backup](https://axonbuild.com/blog/supabase-backup/)
- Compute add-ons: Micro $10, Small $15, Medium $60, Large $110, XL $210, 2XL $410 per month — [MetaCTO Supabase cost](https://www.metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance)
- Region: Singapore is available as `ap-southeast-1` (Southeast Asia); pricing is the same across regions — [getdeploying.com Supabase](https://getdeploying.com/supabase)
- Private files (ID photos): set bucket `public = false`, name objects with non-guessable UUIDs, serve via `createSignedUrl()` with short expiry (minutes), gate signing behind an API route that checks ownership, add RLS policies limiting reads to the owner/admin, and keep the service-role key server-side only — [Dev.to, signed URLs will not save you](https://dev.to/veristria/your-supabase-storage-bucket-is-public-signed-urls-will-not-save-you-519a); [Supabase docs, serving assets](https://supabase.com/docs/guides/storage/serving/downloads)

### Inferences
- At 0–100 users the Pro plan's included storage and egress will not be exceeded; the $25 base is effectively the whole bill.
- At ~1,000 users (say 2,000 ID images at ~1–2 MB each = ~4 GB) storage stays inside the Pro allowance; egress for private signed-URL downloads is small because ID photos are viewed only by admins.
- Enable Supabase's spend cap on Pro to avoid surprise overage until revenue justifies turning it off.

### Gaps
- Could not confirm from supabase.com the Pro plan's included file-storage GB and the per-GB storage overage price (commonly cited as 100 GB included and ~$0.021/GB; this specific figure was not found in retrieved sources, so treat as unverified).
- Exact Pro database size allowance (commonly 8 GB) was not captured from a retrievable page.

---

## Key Question 3: Transactional email (Resend vs Postmark vs Amazon SES vs Brevo) and SPF/DKIM/DMARC

### Takeaway
Resend's free plan (3,000 emails/month, 100/day) is enough for launch and integrates cleanly with Next.js; if daily volume passes 100 (likely around a few hundred active users), move to Resend Pro ($20 for 50k) or Brevo (300/day free, $9 for 5k). Amazon SES is cheapest at scale ($0.10 per 1,000) but needs AWS setup. All require SPF, DKIM and DMARC DNS records on your sending domain.

### Cited Findings
- Resend Free: 3,000 emails/month, hard cap 100/day, up to 3 domains, 30-day data retention, shared IPs; Pro $20/month for 50,000 emails and 10 domains — [Coldletter, Resend pricing 2026](https://coldletter.com/blog/resend-pricing/); [Nuntly Resend pricing](https://nuntly.com/resend-pricing); official [resend.com/pricing](https://resend.com/pricing) blocked
- The most common reason to upgrade from Resend Free is the 100/day cap, not the monthly cap — [Automation Atlas](https://automationatlas.io/answers/resend-free-tier-explained-2026/)
- Amazon SES: $0.10 per 1,000 emails pay-as-you-go; free 3,000/month for first 12 months; "verified July 2026" — [Bluey Email, SES vs Postmark](https://blogs.blueyemail.com/amazon-ses-vs-postmark/); [Sequenzy pay-per-email](https://www.sequenzy.com/blog/best-pay-per-email-platforms)
- Brevo: Free 300 emails/day (~9,000/month); paid from $9 for 5,000/month; $29 for 20k — [Brevo, best transactional services 2026](https://www.brevo.com/blog/best-transactional-email-services/)
- Postmark: free 100 emails/month (developer tier), paid from $15 for 10,000/month; $55 at 50k; $115 at 100k — [Bluey Email comparison](https://blogs.blueyemail.com/best-transactional-email-services/) (note: one source phrased the free tier as "100 emails/day"; Postmark's long-standing developer tier is 100/month — verify on postmarkapp.com)
- SPF/DKIM/DMARC with Resend: Resend provisions an MX + SPF TXT record on a sending subdomain (default `send.yourdomain`) plus a DKIM TXT at `resend._domainkey.yourdomain`; verification usually completes within ~15 minutes; start DMARC at `_dmarc.yourdomain` with `v=DMARC1; p=none; rua=mailto:...`, review reports for a couple of weeks, then move to `p=quarantine` and later `p=reject` — [Resend docs, add a domain](https://resend.com/docs/add-a-domain); [Resend docs, DMARC](https://resend.com/docs/dashboard/domains/dmarc); [Phishfence Resend guide](https://phishfence.io/learn/dmarc-resend)

### Inferences
- A marketplace sends roughly 5–10 emails per active user per month (pitch received, accepted, escrow funded, released, payout sent). At 100 users that is ~1,000/month (Resend Free is fine); at 1,000 users ~5,000–10,000/month with 200–350/day peaks, which exceeds Resend Free's 100/day: budget $20/month (Resend Pro) or $9–29/month (Brevo), or ~$1/month on SES.
- Send from a subdomain (e.g. `mail.crent.ph` or `notify.crent.com`) so a deliverability problem never affects the founder's main mailbox.

### Gaps
- Postmark's exact 2026 free-tier wording could not be verified from postmarkapp.com.

---

## Key Question 4: Payments for a PH marketplace (USD card-in from foreign creators, PHP payouts to GCash/Maya/banks)

### Takeaway
Stripe is not a practical option for a Philippine-registered business (not on Stripe's supported list; at best invite-only with PHP-only payouts). The realistic stack is a Philippine gateway for both sides: **Xendit** (cards incl. international, USD acceptance, built-in invoices, refunds, and disbursements to 42+ banks and GCash/Maya) or **PayMongo** (slightly lower card and e-wallet rates, free batch disbursements, Wallet for payouts). Both require a DTI/SEC-registered business with BIR 2303. A merchant-of-record (Paddle/Lemon Squeezy, ~5% + $0.50 plus 1.5% international on LS) only solves the money-in side and still needs a PH payout rail.

### Cited Findings

**Stripe in the Philippines**
- Stripe's global availability page lists supported countries (Singapore, Malaysia, Thailand, Indonesia (Preview), India (Preview), etc.); the Philippines is not on the list — [stripe.com/global](https://stripe.com/global) via search summary; [Rapyd country list](https://www.rapyd.net/blog/are-you-located-in-a-stripe-supported-country/)
- Third-party 2026 guides describe Stripe PH as an invitation-only preview: accounts accept cards in PHP and USD but payouts are PHP only (USD auto-converted with FX loss), Stripe Billing unavailable, Connect limited, Shopify Payments unavailable; many applicants "waitlisted indefinitely or rejected"; common workaround is a US LLC or UK company — [Hynogo, Is Stripe available in PH 2026](https://hynogo.com/blog/is-stripe-available-in-philippines-2026); [IncorpUK](https://incorpuk.com/blog/how-to-open-stripe-account-in-the-philippines/). These sources conflict with the stripe.com/global summary (not listed at all); the safe reading is "not generally available".

**Xendit (Philippines)**
- Money-in fees (xendit.co/en-ph/pricing as summarized): local cards 3.20% + ₱10; internationally-issued cards charged in PHP 4.20% + ₱10; GCash 2.30%; Maya 1.80%; GrabPay/ShopeePay 2.00%; BPI/UBP direct bank transfer 1.00% or ₱25; 7-Eleven OTC 1.50% (min ₱15) + ₱11 processing; direct debit 1.30% + ₱11 — [Xendit PH pricing](https://www.xendit.co/en-ph/pricing/) (summary); [TrustRadius Xendit pricing](https://www.trustradius.com/products/xendit/pricing)
- A second set of sources quotes GCash at 3.00% + ₱11 and Maya at 2.00% + ₱11, and disbursements at 1.00% (min ₱15) + ₱11 for banks and e-wallets — [PhotonPay PH gateways 2026](https://www.photonpay.com/hk/blog/article/payment-gateways-philippines); [HitPay PH gateway comparison](https://hitpayapp.com/blog/philippines-payment-gateway-comparison). These conflict with the figures above; the structure "payment-method fee + fixed Xendit processing fee" is consistent across sources — [Xendit, complete guide to payment fees](https://www.xendit.co/en-ph/blog/a-complete-guide-to-payment-fees-what-your-business-is-actually-paying-for/)
- Disbursements: fixed ₱10 per successful disbursement (Xendit help centre); payouts to 42+ banks and 4 major e-wallets including GCash — [Xendit help, disbursement bank fee](https://help.xendit.co/hc/en-us/articles/360027727432-Do-I-get-charged-for-a-bank-transfer-fee-for-Disbursement); [Xendit products overview](https://help.xendit.co/hc/en-us/articles/360034705952-What-products-and-services-does-Xendit-provide)
- USD acceptance: for Philippine merchants Xendit "can help accept payments in PHP and/or USD through cards"; the card is charged and settled in PHP or USD; multi-currency processing is supported; any FX conversion incurs an extra fee — [Xendit help, accept USD](https://help.xendit.co/hc/en-us/articles/360035083551-Can-Xendit-help-me-accept-payments-in-USD-or-other-currencies); [Xendit docs, card multi-currency](https://docs.xendit.co/docs/card-multi-currency-processing)
- Refunds: "All refunds will incur an additional Xendit Processing Fee, and the original payment method fee and Xendit Processing Fee will be retained"; card settlement T+5 business days; chargeback dispute fee USD 25 (₱1,500) — [Xendit Pricing Policy](https://help.xendit.co/hc/en-us/articles/59516240127129-Xendit-Pricing-Policy); [Xendit PH T&Cs](https://www.xendit.co/en-ph/terms-and-conditions/)
- Platform/marketplace extras: xenPlatform ₱85 per active sub-account; subscriptions ₱10 per active plan per month; no setup fee — [Xendit help, XenPlatform fee](https://help.xendit.co/hc/en-us/articles/4413990486041-How-Much-is-XenPlatform-Fee); [Xendit help, subscriptions fee](https://help.xendit.co/hc/en-us/articles/29477976087065-How-is-the-scheme-for-Subscriptions-fee)
- Account activation documents (PH): Sole proprietorship: 1 primary or 2 secondary government IDs, TIN, promotional material/online store, DTI registration, BIR 2303. Partnership adds SEC certificate, notarized partners' certificate, articles of partnership. Corporation adds SEC certificate, notarized secretary's certificate, articles of incorporation, latest GIS. Legal name must match DTI/SEC; documents must be unexpired — [Xendit help, PH legal documents](https://help.xendit.co/hc/en-us/articles/11103239008793-PH-What-are-the-legal-documents-required-to-register-to-Xendit-for-Philippine-Merchants); [Xendit docs, activate account](https://docs-dev.xendit.co/getting-started/activate-account)

**PayMongo**
- No setup, monthly or minimum fees; fees only on successful payments — [PayMongo pricing](https://www.paymongo.com/en/pricing) (summary)
- Current rates cited: Visa/Mastercard 3.125% + ₱13.39 (older material says 3.5% + ₱15); international Visa/Mastercard 4.02% + ₱13.39; GCash 2.23%; Maya 1.79%; GrabPay 1.96%; ShopeePay 1.70%; QR Ph 1.3%; direct online banking 0.71% or ₱13.39 — [Software-listing PayMongo review 2026](https://software-listing.com/tools/paymongo); [PayMongo academy, transaction fees](https://www.paymongo.com/academy/transaction-fees-rates-and-charges)
- Money-out: PayMongo Disbursements moves money from the PayMongo Wallet to bank accounts, e-wallets or other wallets for payroll, contractor fees, refunds, customer cash-outs; batch disbursements to banks/e-wallets described as free; Wallet sends via InstaPay/PESONet; bank payouts need at least ₱80 cleared — [PayMongo docs, Disbursements](https://docs.paymongo.com/do/docs/money-movement-disbursements); [PayMongo Wallet](https://www.paymongo.com/en-ph/products/money-movement/wallet); [PayMongo payouts](https://developers.paymongo.com/docs/understanding-payouts-with-paymongo)

**PayPal (PH account)**
- International commercial transactions received by a PH merchant: ~4.4% + ₱15 fixed fee, plus a currency-conversion markup (~3%) when converting — [EcomCalcTools PayPal PH fees 2026](https://ecomcalctools.com/blog/fees-paypal/paypal-philippines/); official page [paypal.com/ph/business/paypal-business-fees](https://www.paypal.com/ph/business/paypal-business-fees) (blocked)

**Merchant of record (Paddle / Lemon Squeezy)**
- Paddle: 5% + $0.50 per transaction, no monthly fee; pays out anywhere except sanctioned countries (Philippines not excluded) — [Fungies MoR pricing 2026](https://fungies.io/merchant-of-record-pricing-guide-2026/); [Paddle help, supported countries](https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle)
- Lemon Squeezy: 5% + $0.50, plus 1.5% for international payments, plus 1% for payouts to non-US bank accounts; Philippines is on its bank-payout country list — [GetStackSmart LS fees 2026](https://getstacksmart.com/blog/lemon-squeezy-merchant-of-record-fees-2026); [Lemon Squeezy supported countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries)

### Inferences
- Effective cost of a $100 (≈₱5,700) international card payment: Xendit ~4.2% + ₱10 ≈ ₱249 (+ FX fee if settled in PHP); PayMongo ~4.02% + ₱13.39 ≈ ₱243; PayPal ~4.4% + ₱15 + ~3% FX ≈ ₱437; Lemon Squeezy 5% + $0.50 + 1.5% intl + 1% payout ≈ $8 (₱456). The PH gateways are roughly half the cost of PayPal/MoR for money-in.
- A payout of ₱2,000 to a researcher's GCash costs ~₱10 fixed on Xendit (per help centre) or up to 1% min ₱15 + ₱11 (~₱31) per the alternative source; PayMongo batch disbursements are described as free. Over 1,000 payouts/month this is ₱10,000–31,000 vs ₱0, so confirm the current disbursement tariff in writing before choosing.
- Escrow: neither gateway offers a regulated escrow product; the practical pattern is to collect into the platform's merchant balance/wallet, record the hold in Supabase, and disburse on release. Holding client money may have BSP implications — flag to the legal researcher.
- Account activation needs a DTI (sole prop) or SEC registration plus BIR 2303 and a live website/social page; do business registration before building the payment integration.
- MoR platforms (Paddle/LS) sell on your behalf, so they fit SaaS subscriptions rather than per-brief marketplace escrow; they also add ~2–3 points of cost. Keep as a fallback only if the gateway rejects the business category.

### Gaps
- Xendit's current (Oct 2026) PH card, e-wallet and disbursement fee table could not be read from xendit.co; the two conflicting sets above must be reconciled on the live pricing page or via a Xendit sales quote.
- Xendit's FX conversion fee percentage for USD-charged cards settled in PHP was not found.
- PayMongo's explicit requirements for freelancers/individuals vs registered businesses were not retrieved; PayMongo's own disbursement fee schedule (beyond "free batch disbursements" marketing) was not confirmed.
- Whether Stripe PH preview accounts are being onboarded in 2026 could not be verified from Stripe directly.

---

## Key Question 5: Domain names (.com, .ph, .com.ph) and availability of crent.com / crent.ph

### Takeaway
A .com costs ~$11/year at Porkbun (flat renewal) or ~$10 first year/$18 renewal at Namecheap; .ph is expensive (US$48/year at the dotPH registry, $41–53 at resellers) and .com.ph ~$35–46/year. crent.com is already taken by a Los Angeles credit-building startup, so CRENT should plan on a .ph/.com.ph, a modified .com (e.g. getcrent.com, crent.app) or buying the name on the aftermarket.

### Cited Findings
- Porkbun .com: $11.08 to register, renew and transfer (as of 19 Aug 2026) — [Priceworld Porkbun pricing](https://priceworld.com/domains/porkbun/); another 2026 source quotes $10.98 renew — [Comparegiants](https://comparegiants.com/comparison/porkbun-vs-namecheap/)
- Namecheap .com: ~$9.98 first year, renews at $18.48–18.84 — [Affmaven Porkbun vs Namecheap 2026](https://affmaven.com/porkbun-vs-namecheap/)
- .ph at the official dotPH registry: US$48 for 1 year, $90 for 2 years, $225 for 5, $450 for 10 — [dotPH FAQs](https://www.dot.ph/faqs) (via search summary; dot.ph/pricing blocked); resellers: Dynadot $46, Namecheap $52.98 register / $56.98 renew, Netorica $41.75, Gandi from $64.40 — [TLD-list .ph](https://tld-list.com/tld/ph); [Namecheap .ph](https://www.namecheap.com/domains/registration/cctld/ph/)
- .com.ph: $46 at Dynadot, $37.09 cheapest (Namecheap per TLD-list), US$35 at web.com.ph, $78.99 at 101domain — [TLD-list .com.ph](https://tld-list.com/tld/com.ph); [web.com.ph](https://www.web.com.ph/domain.html)
- crent.com is the website of "Crent", a Los Angeles company founded 2015 that lets users build credit from monthly payments (2–10 employees) — [Crent on Crunchbase](https://www.crunchbase.com/organization/crent); [Crent on LinkedIn](https://www.linkedin.com/company/crent-inc-)

### Inferences
- Because crent.com is an operating company's domain (and a fintech-adjacent one), it is not merely unavailable; using "CRENT" at crent.ph while a US fintech owns crent.com invites brand confusion. Flag to the trademark/legal researcher.
- Cheapest brand-safe path: register `crent.ph` (~$48/yr) AND a .com variant (~$11/yr) and redirect; total ~$60/year (~₱3,400).

### Gaps
- Live WHOIS/registrar availability for crent.ph and crent.com.ph could not be checked (whois.dot.ph and RDAP endpoints blocked). No search result referenced a crent.ph site, which weakly suggests it is unregistered, but this is unconfirmed.

---

## Key Question 6: Monitoring, error tracking, analytics and uptime (free tiers)

### Takeaway
Free tiers cover a launch-stage marketplace completely: Sentry (5k errors/month, 1 user) or PostHog (100k exceptions + 1M events/month) for errors and product analytics, Better Stack (10 monitors/heartbeats free) for uptime and cron heartbeats, and Vercel Web Analytics (50k events/month on Hobby; included on Pro) for traffic.

### Cited Findings
- Sentry free: 1 user, 5,000 errors/month, 50 replays, feature restrictions — [SSOJet Sentry alternatives](https://ssojet.com/blog/best-sentry-alternatives-error-tracking); [Pydantic, best Sentry alternatives](https://pydantic.dev/articles/best-sentry-alternatives)
- PostHog free: 1M product-analytics events, 5k session recordings, 1M feature-flag requests, 100k error-tracking exceptions, 50 GB logs per month — [AgentDeals PostHog free tier](https://agentdeals.dev/vendor/posthog); [PostHog vs Sentry](https://posthog.com/blog/posthog-vs-sentry)
- Better Stack free: 10 monitors and heartbeats, 100k exceptions/month, 5k session replays, 3 GB logs (3-day retention) — [Freetier.co Better Stack](https://freetier.co/directory/products/better-stack); [Better Stack vs PostHog](https://betterstack.com/community/comparisons/better-stack-vs-posthog/)
- Vercel Web Analytics on Hobby: 50,000 events/month then paused; Speed Insights 10,000 events/30 days team-wide — [Vercel Speed Insights limits](https://vercel.com/docs/speed-insights/limits-and-pricing); [Costbench Vercel free plan](https://costbench.com/software/developer-tools/vercel/free-plan/)

### Inferences
- Use Better Stack heartbeats to confirm the daily escrow-release cron actually ran (the cron pings a heartbeat URL; Better Stack alerts if the ping is missing). This is the single most valuable monitor for a money-moving app.
- Sentry's server SDK is heavy; if hosting on Cloudflare Workers free plan it may push the bundle over 3 MiB (see Key Question 1). On Vercel this is not an issue.

### Gaps
- Sentry's 2026 Team plan price (historically $26/month) was not retrieved; needed only if the 1-user limit bites when a second teammate joins.

---

## Key Question 7: Scheduled jobs when Vercel Hobby only allows daily cron

### Takeaway
If not on Vercel Pro, use cron-job.org (free, down to 1-minute intervals, custom headers for a secret token) to call a protected API route in the app; GitHub Actions `schedule` is also free but commonly fires 5–30 minutes late (sometimes hours) and can be dropped on inactive repos, so it is a poor choice for time-sensitive escrow or payout jobs.

### Cited Findings
- Vercel Hobby cron: max once per day (`0 0 * * *` style), 2 jobs per project, execution window is the whole hour — [Crontap, Vercel cron hourly limit](https://crontap.com/blog/vercel-cron-hourly-limit-and-how-to-beat-it); [SteadyCron](https://steadycron.com/guides/vercel-cron-limits/)
- cron-job.org is "entirely free, supports custom methods, headers, and body", fires as often as once per minute, no hard job-count cap beyond fair use — [Merginit, free cron schedulers 2026](https://merginit.com/blog/26062026-free-cron-job-scheduler-comparison)
- GitHub Actions scheduled workflows "may be delayed — sometimes by 30+ minutes — when the platform is busy, with delays of 5–30 minutes being common"; users report 8–14 hour delays and dropped days on new/inactive repos — [GitHub Community discussion #201738](https://github.com/orgs/community/discussions/201738); [GitHub Community discussion #156282](https://github.com/orgs/community/discussions/156282)
- Hybrid pattern: an external pinger (cron-job.org, UptimeRobot) hits GitHub's `workflow_dispatch` API or the app's own endpoint at the exact minute — [GitHub Community discussion #194300](https://github.com/orgs/community/discussions/194300)

### Inferences
- Pattern for CRENT: create `/api/cron/<job>` routes that verify an `Authorization: Bearer <CRON_SECRET>` header; register them in cron-job.org (e.g. escrow auto-release every 15 min, payout batch hourly, reminder emails daily). On Vercel Pro the same routes can be declared in `vercel.json` instead.
- Keep each job idempotent and under 300 s (Vercel limit) by processing in batches.

### Gaps
- cron-job.org's fair-use thresholds (max executions/day) were not retrieved from its own site.

---

## Key Question 8: Realistic monthly cost at launch (0–100 users) and at 1,000 users

### Takeaway
A compliant launch stack costs about **$45–50/month (~₱2,600–2,900)** fixed (Vercel Pro $20 + Supabase Pro $25 + domain amortised ~$5), with email, monitoring and cron on free tiers; payment fees are variable (~4–4.5% of GMV for international cards plus ₱10–31 per payout). At ~1,000 users the fixed stack rises to roughly **$70–110/month (~₱4,000–6,300)** once email goes paid and Vercel/Supabase usage edges past included credits. A "frugal" variant (Cloudflare Workers free/$5 + Supabase Pro) runs ~$25–30/month but costs engineering time.

### Cited Findings
(Unit prices are those cited in Key Questions 1–7; this section only combines them.)
- Vercel Pro $20/month incl. $20 usage credit — [Comparedge](https://comparedge.com/tools/vercel/pricing)
- Supabase Pro $25/month incl. $10 compute credit — [JetAdmin](https://www.jetadmin.io/blog/supabase-review/)
- Resend Free 3,000/month → Pro $20 — [Coldletter](https://coldletter.com/blog/resend-pricing/); Brevo Free 300/day → $9 — [Brevo](https://www.brevo.com/blog/best-transactional-email-services/)
- Domain: .ph $48/yr — [dotPH FAQs](https://www.dot.ph/faqs); .com $11.08/yr — [Priceworld](https://priceworld.com/domains/porkbun/)
- Cloudflare Workers paid $5/month — [Makerkit](https://makerkit.dev/pricing-calculator/cloudflare-vs-railway); Railway Hobby $5/month — [Makerkit](https://makerkit.dev/blog/tutorials/best-hosting-nextjs)
- Sentry/PostHog/Better Stack free tiers — [AgentDeals](https://agentdeals.dev/vendor/posthog); [Freetier.co](https://freetier.co/directory/products/better-stack)
- Payment fees: Xendit intl cards 4.20% + ₱10, GCash 2.30%, disbursement ₱10 — [Xendit PH pricing](https://www.xendit.co/en-ph/pricing/); PayMongo intl cards 4.02% + ₱13.39 — [Software-listing](https://software-listing.com/tools/paymongo)

### Inferences (cost model)

**Launch, 0–100 users (recommended stack)**
| Item | USD/month | Notes |
|---|---|---|
| Vercel Pro (1 seat) | $20 | Required for commercial use |
| Supabase Pro, Singapore | $25 | Daily backups included; spend cap on |
| Resend Free | $0 | Under 100 emails/day |
| Sentry/PostHog + Better Stack free | $0 | |
| cron-job.org | $0 | |
| Domain (.ph $48 + .com $11 per year) | ~$5 | amortised |
| Xendit/PayMongo | $0 fixed | Fees only per transaction |
| **Total fixed** | **~$50** | ≈ ₱2,850 at ₱57/USD (illustrative rate) |

Variable: at e.g. ₱100,000 GMV/month via international cards, gateway fees ≈ ₱4,200–4,500 plus ₱10–31 per payout.

**Frugal variant**: Cloudflare Workers (free or $5) + Supabase Pro $25 + same free tiers ≈ $25–30/month, but requires OpenNext setup and bundle-size discipline.

**~1,000 users**
| Item | USD/month | Why it moves |
|---|---|---|
| Vercel Pro + light overage | $20–40 | Function/bandwidth usage past the $20 credit |
| Supabase Pro + Small compute ($15) if DB load grows | $25–40 | PITR (+$100) still optional |
| Email (Resend Pro $20 or Brevo $9–29 or SES ~$1) | $1–20 | >100 emails/day |
| Monitoring | $0–26 | Sentry Team only if a second user needed |
| Domain | ~$5 | |
| **Total fixed** | **~$70–110** | ≈ ₱4,000–6,300 |

Variable fees scale with GMV: at ₱1,000,000/month GMV, international-card fees ≈ ₱42,000–45,000 and 1,000 payouts ≈ ₱10,000–31,000 (Xendit) or ~₱0 (PayMongo batch, per its docs).

### Gaps
- No sourced PHP/USD exchange rate was retrievable; the ₱57/USD figure is illustrative only.
- Vercel Pro overage unit prices were not captured, so the 1,000-user Vercel range is an estimate.

---

## Go-live checklist (synthesised from the findings above)

1. **Business registration first**: DTI (sole prop) or SEC (corp) + BIR 2303 + government IDs + a live website/social page are required to activate Xendit (and expected by PayMongo) — [Xendit PH documents](https://help.xendit.co/hc/en-us/articles/11103239008793-PH-What-are-the-legal-documents-required-to-register-to-Xendit-for-Philippine-Merchants). Legal name on the gateway must match DTI/SEC exactly.
2. **Domain**: buy crent.ph (~$48/yr) at dotPH or a reseller plus a .com variant (~$11/yr) at Porkbun; crent.com is taken.
3. **Supabase Pro in Singapore**: create the project in `ap-southeast-1`; turn on spend cap; confirm daily backups; make the ID-photo bucket private with UUID object names, RLS, and short-lived signed URLs; store the service-role key only in server env vars.
4. **Hosting**: Vercel Pro ($20) — connect GitHub repo, set env vars (Supabase URL/anon/service keys, gateway keys, CRON_SECRET, RESEND_API_KEY), add custom domain, enable Web Analytics. (Alternative: Cloudflare Workers via OpenNext; remove any `runtime = "edge"` exports.)
5. **Email**: add sending subdomain to Resend; publish SPF/DKIM/MX records it generates; add `_dmarc` TXT with `p=none` and a reporting address; move to `p=quarantine` after reviewing reports.
6. **Payments**: integrate gateway in test mode; verify webhooks for paid/failed/refunded; set up disbursement API with a manual-approval step for the first weeks; document refund policy knowing gateway fees are not returned on refund (Xendit) and chargeback fee is USD 25.
7. **Scheduled jobs**: protected `/api/cron/*` routes; on Vercel Pro declare in `vercel.json`; otherwise register in cron-job.org; each job pings a Better Stack heartbeat.
8. **Monitoring**: Sentry or PostHog SDK (client + server), Better Stack uptime monitor on the homepage and on a `/api/health` route that checks the DB.
9. **Backups beyond Supabase**: schedule a weekly `pg_dump` (GitHub Actions or cron-job.org → API route) to an off-platform bucket; consider PITR ($100/month) once GMV justifies it.
10. **Pre-launch tests**: a real ₱-denominated and a USD-denominated card payment end-to-end, one GCash payout, one Maya payout, one bank payout; a refund; a forced cron run; restore a backup to a scratch project.
11. **Legal/compliance hand-offs**: Data Privacy Act (ID photos), BSP implications of holding escrow funds, and brand conflict with the existing crent.com fintech — outside this note's scope; flagged for the legal researcher.
