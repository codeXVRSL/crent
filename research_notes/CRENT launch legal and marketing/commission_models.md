# Commission and Fee Models for Two-Sided Freelance/Creative Marketplaces (benchmarks for CRENT, as of Oct 2026)

Method note: all findings below come from web search results (official help/pricing/investor pages where available, otherwise 2026 fee guides). The research sandbox blocked direct page fetches (Upwork, Fiverr, Glassdoor, OnlineJobs.ph, etc. returned EGRESS_BLOCKED), so figures are taken from search-result summaries of those pages; the report writer should treat third-party fee guides as secondary and the SEC filings / official pricing pages as primary. PHP conversions use ~₱58/USD.

## KQ1. Take rates and fee structures of comparable marketplaces (who pays, minimums, surcharges, repeat-client discounts)

### Takeaway
Freelance marketplaces cluster at an all-in take of roughly 15–28% of GMV (Upwork 18.7%, Fiverr 27.7% reported marketplace take rates), split across both sides; creator/talent marketplaces (Cameo, Collabstr, Toptal) run 25–40%+. The notable patterns are (a) a buyer-side fee of ~5% that is politically easier than a higher seller fee, (b) fixed small-order surcharges to protect margin on tiny tickets, and (c) loyalty/tier discounts for repeat or high-volume relationships. CRENT's current 5% + 10% (≈14.3% of gross) is at the low end of the range.

### Cited Findings
**Fiverr**
- Seller fee is a flat 20% of every order in 2026; a $100 order nets the seller $80 before taxes — [FreelancerCalculator](https://freelancercalculator.com/fiverr-fees-freelancers-official-breakdown-2026/); [Fastlancer](https://www.fastlancer.org/en/fastlancer-blog/fiverr-review/)
- Buyer pays a 5.5% service fee on the purchase amount; Fiverr's official help page states an additional $3.50 is added to orders under $200 — [Fiverr Help: Paying for orders](https://help.fiverr.com/hc/en-us/articles/360050216133-Paying-for-orders-extras-or-custom-offers). Conflicting third-party figures cite a $2.50 small-order fee on orders under $50 — [Fastlancer](https://www.fastlancer.org/en/fastlancer-blog/fiverr-review/); the official page is the better source, but Fiverr has used different thresholds over time.
- Reported marketplace take rate (revenue / GMV) was 27.7% for FY2025 (27.6% in FY2024); FY2025 marketplace GMV $1,073.0M (−2.2% YoY); 3.1M active buyers, $342 spend per buyer — [Fiverr Q4/FY2025 results (SEC 20-F)](https://www.sec.gov/Archives/edgar/data/0001762301/000117891326000858/zk2634486.htm); [Fiverr IR](https://investors.fiverr.com/node/9886/pdf)
- Effective take including buyer fees and small-order surcharges is estimated at 24–35% by third parties — [Fastlancer](https://www.fastlancer.org/en/fastlancer-blog/fiverr-review/)
- Funds clear 14 days after order completion (7 days for Top Rated, Seller Plus Premium and Pro sellers) — [Vaultleap](https://vaultleap.com/blog/fiverr-fees-explained-2026); [FiverrTutorials](https://fiverrtutorials.com/fiverr-payment-process)

**Upwork**
- Since May 1, 2025 freelancers pay a variable service fee of 0–15% per contract, set when the proposal/offer is made and locked for the life of the contract; most report ~10–12% effective — [goLance](https://golance.com/blogs/upwork-fees-explained-2026); [FreelanceCompare](https://freelancecompare.com/blog/upwork-fees-explained)
- Clients on Basic pay a 5% Marketplace Fee (3% for eligible US clients paying by bank account); Business Plus clients pay 10% (8% with the bank discount); plus a one-time Contract Initiation Fee of $0.99–$14.99 per new contract — [Upwork client pricing](https://www.upwork.com/pricing/client); [Omnivoo](https://omnivoo.com/blog/how-much-does-upwork-cost-2026-full-breakdown)
- Connects cost $0.15 each; proposals need ~2–16 Connects depending on category and boosts — [Vortenza](https://www.vortenza.com/guides/upwork-fees-2026)
- Reported marketplace take rate was 18.7% for FY2025 (18.0% in 2024) and 19.0% in Q4 2025; GSV >$4B; 785K active clients; GSV per active client >$5,100 — [Upwork Q4/FY2025 results](https://investors.upwork.com/news-releases/news-release-details/upwork-reports-fourth-quarter-and-full-year-2025-financial); [TipRanks take-rate series](https://www.tipranks.com/stocks/upwk/kpis/take-rate)
- "Bring Your Own Client" (0% fee) was discontinued for new clients on Feb 18, 2025; Direct Contracts now carry a 5% fee, or 0% for Freelancer Plus subscribers — [FreelancerFiles](https://freelancerfiles.com/blogs/news/upwork-bring-your-own-client); [Millo](https://millo.co/upwork-fees)

**Contra**
- 0% commission on freelancers; Pro plan $29/month or $199/year includes waived contract/invoice fees for invited clients, boosted ranking, faster payouts at 1% fee — [Contra pricing](https://contra.com/pricing); [Remogrid](https://www.remogrid.com/blog/reviews/contra-freelance-platform-review-is-the-pro-tier-worth-it-2026)
- One guide reports Contra charges a $29 per-contract fee (to the client side) in lieu of commission, cheaper than Upwork above ~$250 projects — [FreelanceCompare](https://freelancecompare.com/blog/freelance-platforms-lowest-fees) (this conflicts somewhat with "always commission-free"; the model is client-pays-flat-fee, freelancer-pays-0%)

**Toptal**
- No commission deducted from talent; Toptal marks up talent rates ~30–50% when billing clients; clients pay a $500 refundable deposit and a $79/month subscription; typical client rates $60–$150+/hr — [HireInSouth](https://www.hireinsouth.com/post/how-much-does-toptal-cost); [The Frontend Company](https://www.thefrontendcompany.com/posts/toptal-pricing)

**Freelancer.com**
- Freelancer pays 10% or $5 minimum per fixed-price project (whichever is greater), 10% on hourly; a $20 project therefore pays an effective 25% fee; memberships $0.99–$59.95/month; Preferred Freelancer Program drops the fee to 3% on employer-invited projects but 15% on Recruiter projects — [Freelancer.com Fees & Charges](https://www.freelancer.com/feesandcharges); [FreelanceCompare](https://freelancecompare.com/blog/freelancer-com-fees-explained)

**99designs**
- Tiered designer platform fee by level: Entry 15%, Mid 10%, Top 5%; plus a $100 client-introduction fee spread over the first $500 billed with a new client (waived if the designer brings the client in via email invite or won/was finalist in that client's contest) — [99designs Help: platform fee](https://support.99designs.com/hc/en-us/articles/360022206031-What-is-a-platform-fee); [99designs Help: 1-to-1 project fees](https://support.99designs.com/hc/en-us/articles/204761265-What-fees-do-you-charge-for-1-to-1-Projects)

**Behance / Dribbble (job boards, not transactional)**
- Dribbble job posts from $299 per 30-day listing; Job Posting Plan $150/month; Hiring Suite $300/month — [Betterteam: Dribbble](https://www.betterteam.com/dribbble-job-posting-site); [itqlick](https://www.itqlick.com/dribbble/pricing)
- Behance job listing $399 per 30 days (periodically free promos); unlimited plan $1,499/month — [Betterteam: Behance](https://www.betterteam.com/behance)

**Collabstr / Cameo (creator marketplaces)**
- Collabstr brands: Basic free with 10% marketplace fee per transaction; Pro $299/month; Premium $399/month with the fee cut to 5%; creators pay a separate 15% on their payout; payment held in escrow until the brand approves the deliverable — [Collabstr pricing](https://collabstr.com/pricing); [Coldiq](https://coldiq.com/tools/collabstr); [Creator Stack Club](https://www.creatorstackclub.com/software/collabstr)
- Cameo takes 25% of each transaction (Apple takes 30% first on iOS purchases) — [Influencer Marketing Hub](https://influencermarketinghub.com/cameo/); [Talkspresso](https://talkspresso.com/blog/why-cameo-is-dying)

**Etsy**
- $0.20 listing fee; 6.5% transaction fee on item + shipping; payment processing 3% + $0.25 (US); Offsite Ads 12–15% only when triggered; a $50 sale pays ~$5.20 (~10%) all-in without ads — [Craftybase](https://craftybase.com/blog/the-complete-guide-to-etsy-fees); [SellerFeeCalc](https://sellerfeecalc.com/blog/etsy-fees-explained-2026)

**Take-rate frameworks**
- Take rates range from low single digits to mid-30s% of GMV depending on fragmentation, substitutes and operational value-add; "platforms" (Patreon, Substack) charge 5–15%, "marketplaces" that bring demand charge 10–50%; start at 10% for platforms and 20% for marketplaces and adjust — [Tidemark: Marketplace Take Rates](https://www.tidemarkcap.com/vskp-chapter/marketplace-take-rates); [a16z Marketplace Glossary](https://a16z.com/the-marketplace-glossary/); [Lenny's Newsletter: marketplace metrics](https://www.lennysnewsletter.com/p/the-most-important-marketplace-metrics)
- The three drivers of a defensible take rate: driving new demand, convenience to the seller, and level of competition — [Tidemark](https://www.tidemarkcap.com/vskp-chapter/marketplace-take-rates)

### Inferences
- CRENT's blended take (5% creator + 10% researcher ≈ 14.3% of gross paid, 15% of the idea price) sits below Upwork (18.7%) and well below Fiverr (27.7%), and in line with "platform" rather than "marketplace" pricing. Since CRENT does bring demand to researchers (the harder side to monetise elsewhere), a 15–20% blended take is defensible under the Tidemark/a16z framework.
- Every incumbent protects small tickets with a fixed surcharge or minimum (Fiverr $3.50 under $200; Freelancer $5 minimum; Upwork $0.99+ contract initiation; Etsy $0.20 + $0.25). CRENT's $3–$15 tickets are far smaller than any of these platforms' typical orders, so it needs a structural answer (prepaid budget wallet, minimum top-up) rather than a per-idea surcharge.
- Repeat-client discounts are a real norm: Upwork locks the fee per contract (lower for long relationships), 99designs waives the intro fee on self-sourced clients, Freelancer Preferred drops to 3% on invited projects. A "bring your own creator → 0–5%" rule is cheap for CRENT and matches market expectations.

### Gaps
- Could not access Fiverr's or Upwork's official help pages directly to reconcile the Fiverr small-order fee threshold ($2.50/<$50 vs $3.50/<$200); the official-help citation is the more credible.
- No official Toptal fee disclosure exists; markup figures are third-party estimates.

## KQ2. What creators pay today for content research / idea generation (Fiverr gigs, Upwork PH rates, agency CRE salaries, SaaS tool prices)

### Takeaway
The "idea" is already priced very low on gig marketplaces ($5 for 10–25 generic ideas on Fiverr, i.e. $0.20–$0.50 per idea), while verified labour is priced at $5–$15/hour on Upwork for Filipino researchers and $800–$1,100/month for full-time agency CREs; research SaaS tools cost $29–$69/month. CRENT's $5–$15 per *proven* idea therefore competes on quality/verification, not on price per idea, and $5–$15 is only credible if each idea is demonstrably backed by outlier data.

### Cited Findings
**Fiverr idea gigs**
- "Discover the next viral YouTube content ideas" starts at $5 (10 ideas aligned to brand/audience, 1-day delivery); "trending video ideas for any industry" from $5 (25 SEO-optimised prompts); sellers describe researching up to 100 ideas via Google/Instagram/YouTube/TikTok keywords — [Fiverr gig: hrishikeshkumar](https://www.fiverr.com/hrishikeshkumar/discover-the-next-viral-youtube-content-ideas); [Fiverr gig: guardiolag](https://www.fiverr.com/guardiolag/provide-trending-video-ideas-for-any-industry); [Fiverr category: YouTube video ideas](https://www.fiverr.com/gigs/youtube-video-ideas); [Fiverr category: YouTube research](https://www.fiverr.com/gigs/youtube-research)
- Faceless viral video production gigs (a different service) start ~$40 — [Fiverr gig: sirleewho](https://www.fiverr.com/sirleewho/produce-faceless-viral-videos-to-grow-your-youtube-channel)

**Upwork / VA rates for Filipino researchers**
- Upwork VAs typically $10–$20/hr (median $13); Philippines-based freelancers sit at the lower end for admin/research — [Upwork: VA hourly rates](https://www.upwork.com/hire/virtual-assistants/cost/)
- Filipino VA cost $3–$25/hr in 2026, most agencies $6.50–$15/hr — [VA Masters](https://vamasters.com/hiring-a-virtual-assistant-in-the-philippines-heres-what-it-costs/)
- TikTok content-research VAs on Fiverr/Upwork charge $5–$25/hr — [VA Masters: TikTok VA](https://vamasters.com/tiktok-virtual-assistant/)
- OnlineJobs.ph listings: "Content Researcher for YouTube compilations and shorts" $350–$400/month; keyword research roles $6–$7/hr — [OnlineJobs.ph research category](https://www.onlinejobs.ph/jobseekers/search/c/research)

**Agency salaries**
- Young Publisher (Max Tornow's short-form agency; 4,000+ clients since 2019) advertises a full-time Filipino Content Research Expert (CRE) at $800/month base (≈₱46,400) paid twice monthly via Wise, 38 hrs/week, with bonuses taking strong CREs to $1,000–$1,100/month (≈₱58,000–₱63,800) — [OnlineJobs.ph: CRE $800 p/m](https://www.onlinejobs.ph/jobseekers/job/content-research-expert-cre-800-p-m-bonuses-up-to-1-100-p-m-537277)
- Glassdoor Philippines "Content Researcher" averages ≈₱17K–₱24K/month (the page also shows a $21,667/yr figure that appears to be a USD-mislabelled artefact; treat with caution) — [Glassdoor PH content researcher](https://www.glassdoor.com/Salaries/philippines-content-researcher-salary-SRCH_IL.0,11_IN204_KO12,30.htm)
- Jobstreet/Glassdoor: content & research support roles ₱35K–₱40K/month; content writers ₱35K–₱45K/month — [Jobstreet content researcher jobs](https://ph.jobstreet.com/content-researcher-jobs); [Glassdoor content writer jobs PH](https://www.glassdoor.com/Job/philippines-content-writer-jobs-SRCH_IL.0,11_IN204_KO12,26.htm)

**Subscription research tools (the "alternative spend")**
- 1of10: Free $0; Basic $29/month ($349/yr); Pro $69/month ($828/yr) — [1of10 review](https://1of10.com/blog/1of10-review/); [Coldiq: 1of10](https://coldiq.com/tools/1of10)
- Spotter Studio: $49/month or $299/year, 60-day free trial — [OutlierKit: Spotter Studio alternatives](https://outlierkit.com/resources/spotter-studio-alternatives/)
- Sandcastles: Pro $39/month (annual) or $49 month-to-month (500 credits); Visionary $79/month (1,500 credits); Titan $399/month (10,000 credits, API) — [Creator Economy Tools: Sandcastles](https://creatoreconomytools.com/tool/sandcastles-ai); [Coldiq: Sandcastles](https://coldiq.com/tools/sandcastles)
- vidIQ: Boost $39/month or $199/yr (~$16.58/mo), 2,000 AI credits; Max $39/month billed annually ($468/yr), 6,000 credits; free tier exists — [1of10: vidIQ pricing](https://1of10.com/blog/vidiq-pricing/); [OutlierKit: vidIQ pricing](https://outlierkit.com/resources/vidiq-pricing/)

### Inferences
- A full-time CRE at $1,000/month producing, say, 100–200 vetted ideas/month implies an internal agency cost of ~$5–$10 per idea, which validates CRENT's $5–$15 "typical" band as the real cost of verified research, versus $0.20–$0.50 per unverified Fiverr idea.
- The monthly SaaS budget creators already allocate to idea research ($29–$69) is the natural anchor for a creator's monthly CRENT budget: a $30–$60 escrow top-up buys 3–8 proven ideas, which is a clean comparison ("one Sandcastles month = 5 ideas a human already validated").
- Researcher-side: a part-time researcher who sells 40 ideas/month at $8 earns $288 net of 10% (≈₱16,700), i.e. roughly a third of a CRE salary for a fraction of the hours, which is attractive if liquidity exists.

### Gaps
- No public rate card specific to "content research expert" freelancers on Upwork (search results only give VA/TikTok VA ranges).
- Could not fetch the Fiverr category page to tabulate review counts/seller countries for research gigs.

## KQ3. Escrow, hold periods, dispute windows, minimum withdrawals, and payout costs to the Philippines

### Takeaway
The norm is escrow-funded fixed-price work, a 14-day approval/auto-release window, a further 5–14 day clearance/security hold, and payouts via Payoneer, PayPal, Wise or direct-to-local-bank at ~$0.99–$3 fixed plus 1–3% FX. GCash is now reachable free from Payoneer and cheaply from Wise, which lets CRENT promise PHP payouts at near-zero marginal cost if it batches withdrawals.

### Cited Findings
- Upwork fixed-price: after "Submit Work", the client has 14 days to approve/request changes; if silent, funds auto-release; then a 5-day security hold before withdrawal; disputes must be addressed within 5 days — [Upwork Help: How Upwork protects your payments](https://support.upwork.com/hc/en-us/articles/211062568-How-Upwork-protects-your-payments); [GigRadar: payment protection](https://gigradar.io/blog/upwork-payment-protection-fixed-price); [Upwork Scout](https://upwork-scout.com/blog/how-to-get-paid-on-upwork)
- Upwork hourly: billed weekly Monday, 5-day review, available the following Wednesday (~10 days after week end) — [GigRadar: how to get paid](https://gigradar.io/blog/how-to-get-paid-on-upwork)
- Upwork PH withdrawals: Direct to Local Bank $0.99 (PHP in ≤4 business days, undisclosed FX markup); PayPal ~$2; Payoneer ~$2 (+0.5–2% conversion); US wire $50; ACH $2.99 from Sept 1, 2026 — [PinoyRemote: withdraw Upwork earnings](https://pinoyremote.com/withdraw-upwork-earnings-philippines/); [Elevate Pay: Upwork fees Philippines](https://www.elevatepay.co/blog/upwork-fees-philippines); [GigRadar: fastest withdrawal](https://gigradar.io/blog/upwork-withdraw-money-fastest)
- Fiverr: 14-day clearance (7 days for Top Rated / Seller Plus Premium / Pro); PayPal withdrawal free from Fiverr side but PayPal FX 3–4%; Payoneer account $3; bank transfer via Payoneer $1; Revenue Card $1–$3; funds hit PayPal/Payoneer within 24h and bank in 1–3 business days — [Vaultleap: Fiverr fees 2026](https://vaultleap.com/blog/fiverr-fees-explained-2026); [FiverrTutorials: payment process](https://fiverrtutorials.com/fiverr-payment-process); [Xflowpay](https://www.xflowpay.com/blog/fiver-payment-methods)
- Collabstr: brand funds escrow; nothing releases until the brand confirms the deliverable meets the brief — [Creator Stack Club: Collabstr](https://www.creatorstackclub.com/software/collabstr)
- Payoneer: 1.2–4% published for cross-currency bank withdrawal, typically ~2%; cash-in to GCash is free on the GCash side; $29.95 annual inactivity fee if <~$2K received in 12 months — [PinoyRemote: GCash vs Wise vs PayPal vs Payoneer](https://pinoyremote.com/gcash-vs-wise-vs-paypal-vs-payoneer/); [LiveInPH: Payoneer PH fees 2026](https://liveinph.com/payoneer-philippines-withdrawal-fees-2026); [Manila Shaker: GCash–Payoneer partnership](https://manilashaker.com/gcash-and-payoneer-partner-to-support-freelancers/)
- Wise: fixed fee + variable from 0.33% at mid-market; $1,000 from a Wise balance costs ~$6.23 (Jul 2026); Wise caps e-wallet (GCash) payouts at ₱50,000 per transfer; GCash charges nothing to receive Wise; PayPal→GCash cash-in costs 1% — [PinoyRemote: withdraw Wise to GCash](https://pinoyremote.com/withdraw-wise-gcash-philippines/); [Trabahong Online: Payoneer vs Wise](https://trabahongonline.com/en/comparisons/payoneer-vs-wise-fees)
- Fiverr affiliate minimum payout is $100 (useful as a minimum-threshold benchmark) — [UpPromote: Fiverr affiliate](https://uppromote.com/affiliate-directory/fiverr/)

### Inferences
- A 14-day creator review window + 5–7 day clearance is standard; CRENT can differentiate by shortening to a 48–72 hour review window for an "idea unlock" (the deliverable is instant and verifiable), with a 7-day clearance that drops to 3 days for verified/top researchers, mirroring Fiverr's Top-Rated 7-day rule.
- Because per-withdrawal costs are fixed ($1–$3) and Wise/Payoneer→GCash is free on the receiving side, a minimum withdrawal of $20–$25 (≈₱1,160–₱1,450) or a free monthly batch payout keeps payout cost under ~2% of researcher earnings.

### Gaps
- No published pricing found for PayMongo/Xendit *disbursement* (payout) APIs to GCash/InstaPay; only acquiring fees are public. CRENT should request a quote.
- Could not verify Upwork's exact Direct-to-Local-Bank FX markup (described only as "undisclosed").

## KQ4. Referral and affiliate commission norms; ambassador programs for recruiting Filipino freelancers

### Takeaway
Marketplaces pay affiliates either a bounty per first-time buyer ($15–$150 CPA) or a hybrid ($10 CPA + 10% revenue share for 12 months); SaaS pays 20–30% recurring for 12 months then tapers. Supply-side recruiting in the Philippines is usually done via Payoneer/GCash-style milestone bonuses ($75–$250 after volume thresholds) and job-referral credits, not percentage commissions.

### Cited Findings
- Fiverr Affiliates: CPA $15–$150 per first-time buyer (dynamic by category) or hybrid $10 CPA + 10% revenue share for 12 months; CPA cap $500 per referred user; monthly net-30 payouts; $100 minimum payout — [Fiverr Affiliates](https://www.fiverr.com/partnerships/affiliates); [UpPromote](https://uppromote.com/affiliate-directory/fiverr/); [FiverrTutorials affiliate guide](https://fiverrtutorials.com/earn-fiverr-affiliate-program)
- Upwork affiliate (via Impact): ~50% of Upwork's fee on the referred client's spend (≈6% of transaction), 30-day cookie; in-product referrals pay Connects/credits — [Medium: Upwork/Fiverr affiliate](https://medium.com/@edithabrake/does-upwork-and-fiverr-have-an-affiliate-program-99c63ef8bd59); [DealNews Upwork promos](https://www.dealnews.com/features/upwork/promo-codes/)
- SaaS benchmarks (2,600+ programs): 20–30% recurring is the norm; Rewardful 2025 average 22.1% (programs <$100K affiliate revenue) to 24.5% (>$1M); 71% of SaaS programs pay recurring, typically 20–30% for months 1–12, 10–15% for months 13–24; creator-tool programs 12–22% — [Tapfiliate: commission rates 2026](https://tapfiliate.com/blog/affiliate-commission-rates/); [Track360 benchmark](https://track360.io/blog/affiliate-commission-rates-benchmark-2026); [StackedReview SaaS stats](https://stackedreview.com/saas-affiliate-marketing-statistics/)
- Payoneer refer-a-friend: both parties receive $250 after the referee transacts $30,000 within 150 days; OnlineJobs.ph co-marketing gives $75 after the first $1,000 received — [Payoneer RAF](https://www.payoneer.com/raf/); [OnlineJobs.ph blog: Payoneer](https://blog.onlinejobs.ph/payoneer-works-together-onlinejobs-ph/)
- GJobs by PasaJob (inside GCash) pays referrers when a referred person is hired; 6 referral credits per job — [GCash Help: GJobs referrals](https://help.gcash.com/hc/en-us/articles/23431265122969-How-to-refer-someone-in-GJobs-by-PasaJobs); [PasaJob (Wikipedia)](https://en.wikipedia.org/wiki/PasaJob)
- Outsourced.ph runs a staff referral bonus program for recruiting Filipino talent — [Outsourced.ph referral program](https://outsourced.ph/outsourced-referral-program/)
- Philippines was Upwork's fastest-growing market with +208% revenue growth in 2025 and ~1.5M freelancers — [Jobbers: platform statistics 2026](https://www.jobbers.io/freelance-platform-statistics-2026-users-fees-market-share-analysis/)

### Inferences
- Demand-side: pay creator referrals as a share of CRENT's *fee* (not GMV) so it is always margin-positive: 25–30% of CRENT's take for 12 months on a $50/month creator yields ~$1.90–$2.25/month per referral, comparable to SaaS norms on a per-dollar-of-revenue basis.
- Supply-side: a milestone bounty (e.g., ₱500 ≈ $8.60 once the referred researcher sells their first 10 ideas, ₱1,000 at 50 ideas) mirrors Payoneer/OnlineJobs-style structures and avoids paying for unproductive sign-ups.

### Gaps
- No public data on conversion or payout economics of PH ambassador programs run by Fiverr/Upwork specifically.

## KQ5. Seller/buyer subscription tiers and featured-listing pricing

### Takeaway
Pro tiers for sellers price at $20–$50/month and bundle visibility, analytics, faster payouts and lower fees; buyer plans run $0 (with 5–10% fee) up to $299–$399/month with reduced fees; promoted placements are CPC auctions at ~$0.10–$2.00 per click.

### Cited Findings
- Fiverr Seller Plus: Standard $25/month, Premium $49/month (analytics, support, promotional tools, faster payments; Premium gets 7-day clearance) — [HireInSouth: Fiverr pricing](https://www.hireinsouth.com/post/fiverr-pricing); [Upwork vs Fiverr guide](https://www.upwork.com/resources/upwork-vs-fiverr). (The brief's "$19–39" figure appears outdated; 2026 sources show $25/$49.)
- Upwork Freelancer Plus: $19.99/month with 100 Connects, competitor-bid visibility, custom URL, Uma AI, and 0% fee on self-sourced Direct Contracts — [goLance](https://golance.com/blogs/upwork-fees-explained-2026); [Millo](https://millo.co/upwork-fees)
- Freelancer.com memberships $0.99 (Intro) to $59.95 (Premier)/month for more bids, lower fees, visibility — [HireInSouth: Freelancer pricing](https://www.hireinsouth.com/post/freelancer-pricing)
- Contra Pro $29/month or $199/yr — [Contra pricing](https://contra.com/pricing)
- Collabstr buyer plans: Basic free (10% fee), Pro $299/month, Premium $399/month (5% fee) — [Collabstr pricing](https://collabstr.com/pricing)
- Upwork client Business Plus: 10% marketplace fee (vs 5% Basic) in exchange for premium features — [Upwork client pricing](https://www.upwork.com/pricing/client)
- Fiverr Promoted Gigs: CPC auction, seller sets max bid and daily budget, pays only on click; typical $0.10–$2.00 per click — [Fiverr Help: Promoting your Gigs](https://help.fiverr.com/hc/en-us/articles/360017729338-Promoting-your-Gigs-with-Fiverr-Ads); [FiverrTutorials: Promoted Gigs](https://fiverrtutorials.com/fiverr-ranking-guide/fiverr-promoted-gigs-guide)
- Etsy Ads: on-site PPC with a daily budget; Offsite Ads 12–15% of sale when triggered — [Marmalead: Etsy fees](https://blog.marmalead.com/etsy-fees-explained/)

### Inferences
- For CRENT's researcher base (₱-denominated incomes), a $25–$49 Pro tier is too steep for early supply; a ₱499–₱999/month (~$9–$17) "Researcher Pro" that lowers the service fee from 10% to 5% and shortens clearance is the PH-appropriate analogue.
- Featured placement should be sold as flat "boosted idea" slots (e.g., $1–$2 per boosted listing for 7 days) rather than CPC, because CRENT lacks the search volume to clear a CPC auction.

### Gaps
- No public information on Fiverr Seller Plus adoption rates or revenue per subscriber (Fiverr reports only aggregate "services revenue" of $133.4M in FY2025 — [SEC 20-F](https://www.sec.gov/Archives/edgar/data/0001762301/000117891326000858/zk2634486.htm)).

## KQ6. Volume-based / tiered take rates, and whether a lower take for Filipino researchers is a credible differentiator

### Takeaway
Tiered take rates keyed to seller level or relationship tenure are standard (99designs 15→5%, Upwork 0–15% variable, Freelancer 10%→3% for preferred/invited, Fiverr clearance perks). A 10% researcher fee versus Fiverr's 20% + 14-day hold is a real, communicable advantage, but "0%" claims (Contra) have reset expectations, so the differentiator must be framed as "10% with instant PHP payouts" rather than just "lower".

### Cited Findings
- 99designs: 15% / 10% / 5% by designer level — [99designs Help](https://support.99designs.com/hc/en-us/articles/360022206031-What-is-a-platform-fee)
- Upwork: fee variable 0–15% per contract since May 2025, locked for contract life — [FreelanceCompare](https://freelancecompare.com/blog/upwork-fees-explained)
- Freelancer.com: 10% standard, 3% for Preferred Freelancers on invited projects — [Freelancer.com fees](https://www.freelancer.com/feesandcharges)
- Collabstr: 10% → 5% fee for Premium brand subscribers — [Collabstr pricing](https://collabstr.com/pricing)
- Fiverr: 20% flat, no tiering by fee; tiering by clearance speed (14 → 7 days) and Seller Plus perks — [Vaultleap](https://vaultleap.com/blog/fiverr-fees-explained-2026)
- Contra: 0% freelancer fee, subscription-funded — [Contra pricing](https://contra.com/pricing)
- Sellers increasingly leave Fiverr/Upwork citing fees ("kept 83% vs 80% vs 85%" comparisons) — [EarnifyHub fee analysis](https://earnifyhub.com/blog/freelance-platform-fees-analysis-upwork-fiverr-freelancer); [Jobbers: freelancers who left](https://www.jobbers.io/real-stories-100-freelancers-who-left-fiverr-upwork-in-2026-earnings-before-after/)

### Inferences
- Tiering CRENT's researcher fee by verified performance (e.g., 10% standard → 7% after 100 unlocked ideas with ≥4.5 rating → 5% for "Verified Pro") copies 99designs/Freelancer and rewards exactly the behaviour CRENT needs (proven ideas). The cost is small because the top tier is a minority of supply.
- A lower researcher fee is credible as a differentiator mainly in combination with (a) faster payout in PHP to GCash, and (b) the fact that CRENT supplies demand; on its own, "10% vs 20%" on a $8 ticket is $0.80 and will not move a researcher who has Fiverr orders.

### Gaps
- No public data on how much seller churn or supply growth incumbents attribute to fee changes.

## KQ7. Unit economics: GMV needed to cover $100–$300/month; processing cost on small tickets; should the minimum brief be raised?

### Takeaway
At a 5% + 10% take on an $8 idea CRENT earns $1.20 per idea; if each idea were charged to a card individually, PH card processing (~3.1–4.4% + ₱13–15 fixed) would consume ~40–50% of that fee. With prepaid escrow budgets of ≥$20–$25 funded once (ideally via GCash at 2.23% with no fixed fee), net margin is ~10–11% of GMV, so $100–$300/month of fixed cost requires roughly $950–$2,900 of monthly GMV (≈120–360 ideas at $8). The minimum *funded budget* should be raised to about $20–$25 even if the per-idea minimum stays at $3.

### Cited Findings
- PayMongo (official): Visa/Mastercard 3.125% + ₱13.39; international cards 4.02% + ₱13.39; GCash 2.23%; Maya 1.79%; QR Ph 1.34%; no setup/monthly fees; VAT-exclusive — [PayMongo pricing](https://www.paymongo.com/en/pricing); [HitPay comparison](https://hitpayapp.com/blog/best-payment-gateway-philippines)
- Xendit (PH): 3.2% + ₱10 local cards; 4.2% + ₱10 international cards; GCash 2.3%; Maya 1.8%; QR Ph 1.4% — [HitPay: PH gateway comparison](https://hitpayapp.com/blog/philippines-payment-gateway-comparison)
- Stripe PH: 3.4% + ₱15 per card charge, +1% for international cards; Stripe US 2.9% + $0.30 — [Digiocular: Razorpay vs PayMongo vs Stripe](https://www.digiocular.com/blog/payment-gateways-razorpay-paymongo-stripe); [NerdWallet: Stripe fees](https://www.nerdwallet.com/business/software/learn/stripe-fees)
- Stripe Connect adds $2/month per active Express/Custom connected account and 0.25% + $0.25 per payout, plus FX; low-AOV marketplaces pay disproportionately more — [Drop Desk: Stripe fees for marketplace operators](https://drop-desk.com/blog/guides/stripe-fees-for-marketplace-operators/); [Sharetribe: Stripe Connect overview](https://www.sharetribe.com/academy/marketplace-payments/stripe-connect-overview/)
- Freelancer.com's $5 minimum makes a $20 project an effective 25% fee — a precedent for protecting small tickets — [FreelanceCompare](https://freelancecompare.com/blog/freelancer-com-fees-explained)
- Fiverr adds $3.50 to orders under $200 — [Fiverr Help](https://help.fiverr.com/hc/en-us/articles/360050216133-Paying-for-orders-extras-or-custom-offers)
- Payout cost benchmarks: Upwork $0.99 to PH local bank; Fiverr $1–$3 via Payoneer; Payoneer→GCash free on the GCash side — [PinoyRemote](https://pinoyremote.com/withdraw-upwork-earnings-philippines/); [Vaultleap](https://vaultleap.com/blog/fiverr-fees-explained-2026); [Manila Shaker](https://manilashaker.com/gcash-and-payoneer-partner-to-support-freelancers/)

### Inferences (arithmetic on the cited fee rates; ₱58/USD)
- Per $8 idea: creator pays $8.40 (5%), researcher receives $7.20 (after 10%), CRENT gross fee $1.20 = 14.3% of gross or 15% of idea price.
- If the $8.40 is card-charged alone via PayMongo: 3.125% × $8.40 + ₱13.39 ($0.23) ≈ $0.49 (5.9% of gross) → 41% of CRENT's fee. Via Stripe PH international card (4.4% + ₱15): ≈ $0.63 → 53% of the fee. A $3 idea ($3.15 gross): ≈ $0.33 processing vs $0.45 fee → 73% of the fee gone.
- If instead the creator funds a $50 budget once by card: processing ≈ $1.79 (3.6%); by GCash: $1.12 (2.23%). Spread over ~6 ideas, processing falls to ~$0.19–$0.30 per idea (≈2.2–3.6% of gross).
- Payout side: one batched $100 withdrawal to GCash/Wise at ~$1–$3 fixed ≈ 1–3%; with a $20–$25 minimum withdrawal the worst case is ~4–6% of a single small payout, which is why a minimum threshold or a monthly free batch is needed.
- Net contribution ≈ 15% take − ~3.5% processing − ~1–1.5% payout ≈ 10–10.5% of GMV. Break-even GMV: $100/month ÷ 10.4% ≈ $960; $300/month ÷ 10.4% ≈ $2,900 — about 120–360 unlocked $8 ideas per month, or 20–60 creators each spending $50/month. Under per-idea card charging (net ≈ 8%) break-even rises to ≈ $1,250–$3,750 GMV.
- Raising the blended take to ~18–20% (e.g., 8% creator + 10% researcher, or 5% + 12%) would lower break-even GMV by ~20–25% without exceeding Upwork's 18.7% reported take.
- Recommendation: keep a $3 per-idea floor for cheap/simple ideas but require a minimum escrow top-up of $20 (≈₱1,160) by card or $10 (≈₱580) by GCash/QR Ph (no fixed fee), and push creators to $50/$100 top-ups with a small bonus credit (e.g., +3% credit on $100), which is cheaper than card fees on repeated small charges.

### Gaps
- Actual CRENT hosting/payment vendor quotes are not public; the $100–$300/month fixed cost is the brief's assumption. Chargeback/refund rates for digital-idea unlocks (which affect net margin) have no public benchmark.
- GCash and Maya *merchant* rates for marketplaces (vs standard PayMongo) and disbursement fees to GCash were not found.

## Recommended CRENT fee table (2026)

| Item | Recommendation | Rationale / benchmark |
|---|---|---|
| Creator (buyer) marketplace fee | **5% on escrow top-up** (consider 7% for card, 5% for GCash/QR Ph/bank) | Upwork client 5% (3% bank discount); Fiverr 5.5%; Collabstr 10% |
| Researcher (seller) service fee | **10% standard; 7% "Verified" (≥100 unlocks, ≥4.5★); 5% "Pro"** | 99designs 15→5%; Freelancer 10→3%; Upwork 0–15%; well under Fiverr 20% |
| Bring-your-own-creator | **0% creator fee + 5% researcher fee on invited creators for 12 months** | Upwork Direct Contracts 5% (0% on Plus); 99designs waives intro fee |
| Per-idea price band | **$3–$500; guide researchers to $5–$15; suggested defaults $5 / $8 / $12 / $25 (short/standard/premium/series)** | Fiverr idea bundles $5 for 10–25; CRE cost ≈ $5–$10 per vetted idea |
| Minimum escrow top-up | **$20 by card (≈₱1,160); $10 via GCash/Maya/QR Ph (≈₱580)**; top-up bonus +3% credit at $100 | PH card 3.125% + ₱13.39 fixed; GCash 2.23% no fixed fee; Freelancer $5 min, Fiverr $3.50 small-order fee |
| Small-ticket surcharge | None if funded via wallet; **₱15 (~$0.26) surcharge only for one-off card unlocks** | Fiverr/Etsy fixed surcharges |
| Creator review / dispute window | **72 hours to flag an idea as "not as described"; auto-release after** | Upwork 14-day auto-release is for bespoke work; idea unlock is instant/verifiable |
| Clearance before withdrawal | **7 days standard, 3 days Verified/Pro** | Fiverr 14/7 days; Upwork 5-day security hold |
| Minimum withdrawal | **$20 (≈₱1,160) or free monthly batch payout** | Fixed payout costs $1–$3; Payoneer→GCash free; Wise cap ₱50K per e-wallet payout |
| Payout rails | GCash/Maya/InstaPay via local gateway; Wise/Payoneer for larger balances | Upwork local bank $0.99; Fiverr Payoneer $1–$3 |
| Researcher Pro subscription | **₱499/month (~$9)**: 5% fee, 3-day clearance, 3 boosted ideas/month, analytics | Fiverr Seller Plus $25/$49; Upwork Plus $19.99; Contra $29 — scaled to PHP incomes |
| Creator Plus subscription (later) | **$19/month**: 0% creator fee, saved-search alerts, priority briefs | Collabstr Premium cuts fee 10→5%; SaaS alternatives $29–$69 |
| Featured / boosted idea | **$1 per idea for 7 days (flat), not CPC** | Fiverr Promoted Gigs CPC $0.10–$2.00; CRENT lacks auction volume |
| Creator referral (affiliate) | **25% of CRENT's fee on the referred creator's spend for 12 months, or $5 flat per first-funded creator** | Fiverr hybrid $10 + 10% rev share 12 mo; SaaS 20–30% recurring |
| Researcher referral (ambassador) | **₱300 at first 10 unlocked ideas + ₱700 at 50 ideas (≈$17 total); monthly leaderboard bonus for top PH ambassadors** | Payoneer/OnlineJobs milestone bonuses ($75–$250); GJobs/PasaJob hire-based referrals |
| Target blended take | **≈15% now; drift to 17–19% via card-funded creator fee (7%) and boosts/subscriptions, staying under Upwork's 18.7%** | Upwork 18.7%, Fiverr 27.7%, Cameo 25%, Collabstr 25% combined |
| Break-even GMV at $100–$300/mo fixed cost | **≈$950–$2,900 GMV/month (≈120–360 ideas at $8, or 20–60 creators at $50/month)** | Net ≈ 10–10.5% of GMV after processing and payouts (own calculation from cited fee rates) |
