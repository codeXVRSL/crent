# CRENT brand-name availability (domains, handles, trademarks, existing users, alternatives)

Research date: 2026-10-03. Environment note that governs every section below: the research sandbox's egress proxy blocked direct access to every WHOIS/RDAP service (rdap.org, who.is, whois.com, viewdns.info, whois.dot.ph), every registrar search page (Namecheap, Porkbun, GoDaddy, Dynadot, Hostinger, instantdomainsearch), every trademark register (USPTO TSDR/TESS, EUIPO eSearch, TMview/tmdn.org, WIPO Global Brand Database, IPOPHL online services), DTI BNRS, companieshouse.ph, Crunchbase, Tracxn, both app stores, and every social network (Instagram, TikTok, X, Facebook, YouTube, LinkedIn, Threads, Reddit). Public DNS-over-HTTPS (dns.google, cloudflare-dns.com) was also blocked and no `dig`/`whois` binary exists in the sandbox. The only direct page loads that succeeded were github.com pages. Everything else below therefore comes from web-search result snippets (which are secondary evidence), and per the assignment's constraint those items are marked **could not verify from the primary page**. A human should re-run the exact URLs listed before relying on any "available" claim.

## Key Question 1: Domains (crent.com, .io, .co, .app, .ph, .com.ph, getcrent.com, crent.xyz, trycrent.com, crenthq.com)

### Takeaway
No domain status could be verified from a registrar or WHOIS page because every such service was blocked by the sandbox proxy. Secondary evidence strongly indicates crent.com is held by Crent Inc. (Los Angeles fintech, "build credit from monthly payments") and crent.fi by Applirent Oy (Finland); crent.de is a live German car-rental-software site. The remaining eight domains have no indexed web presence at all, which is consistent with (but not proof of) being unregistered or parked.

### Cited Findings
- crent.com: Web search for "crent.com" returns Crent Inc. (credit-building fintech, Los Angeles, founded 2015, founder Michael Koshet) as the top-associated company, with its Crunchbase profile, Instagram @crent, Facebook /crent and LinkedIn page — [Crunchbase search snippet](https://www.crunchbase.com/organization/crent); [Tracxn](https://tracxn.com/d/companies/crent/__nmX9P6kFrvDw7yQUOaMFI1WSpHMJuqO2D3CaymbkixU). Direct WHOIS/registrar lookups attempted at https://rdap.org/domain/crent.com, https://who.is/whois/crent.com, https://www.whois.com/whois/crent.com, https://viewdns.info/whois/?domain=crent.com, https://www.godaddy.com/domainsearch/find?domainToCheck=crent.com, https://www.namecheap.com/domains/registration/results/?domain=crent, https://porkbun.com/checkout/search?q=crent, https://www.dynadot.com/domain/search?domain=crent.com, https://www.hostinger.com/domain-name-search?domain=crent.com — all returned EGRESS_BLOCKED on 2026-10-03. **Could not verify.** No "for sale" listing for crent.com surfaced in a search for "crent.com domain for sale" — [search results](https://www.namecheap.com/market/) (generic marketplace pages only; no crent.com listing found).
- crent.de: A live site "C-Rent: Software for car rental and fleet management" exists at https://www.crent.de/en/ (German company, Minden; 11-50 employees per Crunchbase) — [crent.de search result](https://www.crent.de/en/); [C Rent on Crunchbase](https://www.crunchbase.com/organization/c-rent). Direct fetch of crent.de was blocked.
- crent.fi: Applirent Oy (Kajaani, Finland) lists its contact email as info@crent.fi, implying it holds crent.fi — [Applirent contact info via search](https://applirent.com/en/applirent-rental-mobile/).
- crent.io / crent.co / crent.app: A search for `"crent.io" OR "crent.co" OR "crent.app"` returned zero matching pages (only unrelated Cribl.io, Cred, Criteo results) — [search](https://en.wikipedia.org/wiki/Cribl.io). RDAP lookups at https://rdap.org/domain/crent.io, /crent.co, /crent.app blocked. **Could not verify.**
- crent.ph / crent.com.ph: dot.ph WHOIS at https://whois.dot.ph/?utf8=%E2%9C%93&search=crent.ph and ...search=crent.com.ph both returned EGRESS_BLOCKED. No search results reference either domain. **Could not verify.**
- getcrent.com, crent.xyz, trycrent.com, crenthq.com: RDAP lookups at https://rdap.org/domain/{getcrent.com, crent.xyz, trycrent.com, crenthq.com} blocked; no web-search hits for any of these names. **Could not verify.**

### Inferences
- crent.com is almost certainly unavailable (held by an operating US company since ~2015); even if it were purchasable, buying it would not cure the trademark conflict described in KQ3.
- The absence of any indexed content for crent.io/.co/.app/.ph/.xyz and the get/try/hq variants makes it plausible they are free or merely parked, but this is inference only; "available" must come from a registrar page before anyone relies on it.
- .ph and .com.ph are low-contention TLDs; if the team keeps the name, those are the most likely registrable ones, but still unverified.

### Gaps
- Registration status, registrar, creation/expiry and asking price for all 10 requested domains: not obtainable in this sandbox (all WHOIS/registrar endpoints blocked). Re-run: `whois crent.com`, https://rdap.org/domain/crent.io, https://whois.dot.ph/?search=crent.ph, https://www.namecheap.com/domains/registration/results/?domain=crent.
- DNS resolution via public resolvers: blocked (dns.google, cloudflare-dns.com) and no dig binary.

## Key Question 2: Social handles (@crent on Instagram, TikTok, X, Facebook, YouTube, LinkedIn, Threads, Reddit; GitHub)

### Takeaway
The only handle verified from the live page is GitHub, where user "crent" exists (0 public repos). Search snippets show Instagram @crent and facebook.com/crent are taken by Crent Inc., and LinkedIn's slug for that company is /company/crent-inc- (so /company/crent itself is unconfirmed). A large Canadian TikTok/Instagram creator brands as "THE CRENT" at @officialcrent (1.2M TikTok followers), which will dominate social search for the word.

### Cited Findings
- GitHub: https://github.com/crent exists; profile shows "crent doesn't have any public repositories yet" (fetched directly 2026-10-03) — [GitHub /crent](https://github.com/crent). GitHub org endpoint `orgs/crent` could not be queried through the session's repo-scoped API proxy.
- Instagram @crent: search index lists "Crent (@crent) • Instagram photos and videos" at https://www.instagram.com/crent/ (associated with Crent Inc.) — [search result](https://www.instagram.com/crent/). Direct fetch blocked. **Could not verify live status.**
- Facebook facebook.com/crent: search index lists a page titled "Crent" at https://www.facebook.com/crent/ — [search result](https://www.facebook.com/crent/). Direct fetch blocked. **Could not verify.**
- LinkedIn: Crent Inc.'s page is at https://www.linkedin.com/company/crent-inc- (35 followers; Technology, Information and Internet; 2-10 employees; Los Angeles; founded 2015; Seed round Jan 2017, $750,000) — [LinkedIn via search](https://www.linkedin.com/company/crent-inc-). Fetch of https://www.linkedin.com/company/crent blocked, so whether the bare slug /company/crent is free is **unverified**.
- TikTok @crent: direct fetch of https://www.tiktok.com/@crent blocked. Related: @officialcrent ("THE CRENT 👑", Canada, Environment & Safety Engineer) has 1.2M followers and 29M likes on TikTok and 63K on Instagram — [TikTok @officialcrent](https://www.tiktok.com/@officialcrent?lang=en); [Instagram @officialcrent](https://www.instagram.com/officialcrent/). **@crent itself could not be verified.**
- X/Twitter @crent: https://x.com/crent blocked; no search result surfaced an @crent X account. **Could not verify.**
- YouTube @crent: https://www.youtube.com/@crent blocked. A channel titled "Crent" / "Crent MC" exists at https://www.youtube.com/channel/UClAmq-grUmqHlubfikCoCbw (legacy channel URL, so the @crent handle status is unknown) — [YouTube channel via search](https://www.youtube.com/channel/UClAmq-grUmqHlubfikCoCbw). **Could not verify handle.**
- Threads @crent: https://www.threads.net/@crent — fetch tool cannot access threads.net. **Could not verify.** (Threads handles mirror Instagram usernames, so if @crent is taken on Instagram it is taken on Threads.)
- Reddit u/crent: https://www.reddit.com/user/crent/ — fetch tool cannot access reddit.com. **Could not verify.**
- Apple Music has an artist named "Crent" (id 1058813673) — [Apple Music via search](https://music.apple.com/us/artist/crent/1058813673).

### Inferences
- The clean @crent handle set is effectively unobtainable: Instagram and Facebook appear taken by a live fintech; Threads follows Instagram; GitHub is taken.
- Any Filipino creator searching "crent" on TikTok/Instagram will land on @officialcrent (a Canadian entertainment creator with >1M followers), which creates discoverability drag for a new brand.

### Gaps
- Live status of @crent on Instagram, TikTok, X, Facebook, YouTube, Threads, Reddit and LinkedIn /company/crent: all blocked. Re-check by opening each URL in a browser.

## Key Question 3: Trademarks (Philippines IPOPHL, USPTO, EUIPO, WIPO) for CRENT / KRENT / similar in classes 35, 42, 9

### Takeaway
A live US registration for the word mark CRENT exists (Reg. No. 5,686,508, Serial 86873602, registered 2019-02-26, owner Crent Inc.) covering credit-reporting/financial services and "providing a website featuring technology that enables users to make rent payments, pay bills, make payments, split payments with others, and build credit." This is a direct word-for-word conflict in the US, and its services (online payments platform) overlap conceptually with a marketplace that processes payments. No Philippine, EU or WIPO register could be queried from the sandbox.

### Cited Findings
- USPTO: "CRENT - Trademark Details": Status 700 Registered; Serial 86873602; Registration 5686508; filed 2016-01-13; registered 2019-02-26; first use in commerce 2019-01-01; services: credit reporting; credit processing; credit agencies; and "providing a website featuring technology that enables users to make rent payments, pay bills, make payments, split payments with others, and build credit" — [Justia Trademarks](https://trademarks.justia.com/868/73/crent-86873602.html) (page content via search snippet; direct fetch blocked; TSDR at https://tsdrapi.uspto.gov/ts/cd/casestatus/sn86873602/info.json also blocked). The international class numbers were not shown in the snippet; a "website featuring technology" recitation is typically Class 42 and credit services Class 36, but **class assignment could not be verified**.
- Because the mark registered 2019-02-26, its Section 8 declaration of continued use was due between 2024-02-26 and 2025-02-26 (plus 6-month grace to 2025-08-26). Whether it was filed, and therefore whether the registration is still live in Oct 2026, **could not be verified** (TSDR blocked). The Justia snippet says "Registered" but Justia status can lag.
- Owner identity: Crent Inc., Los Angeles/Encino CA, founded 2015 by Michael Koshet — [Crunchbase](https://www.crunchbase.com/organization/crent); [Yellow Pages: Crent, Inc., Encino CA 91436](https://www.yellowpages.com/encino-ca/mip/crent-inc-524120369).
- Other US marks surfaced by search near the name: TRACTSECRET (owner Creneft Inc., Reg. 6265531), Crexent L.L.C. marks, CERTENT (Serial 86468848) — [Justia](https://trademarks.justia.com/900/40/tractsecret-90040635.html); [Trademarkia CERTENT](https://www.trademarkia.com/certent-86468848). These are phonetically distinct and not likely conflicts.
- KRENT: a Nigerian real-estate/short-let app "Krent" by KRENT APP LIMITED (Lagos) is live on Google Play (com.krent.krent) and the App Store (id6755475197) — [Google Play Krent](https://play.google.com/store/apps/details?id=com.krent.krent&hl=en_US); [App Store Krent](https://apps.apple.com/us/app/krent/id6755475197). No trademark record for KRENT surfaced in search.
- EUIPO/TMview: searches for "crent" with EUIPO/TMview/Unionsmarke terms returned only generic how-to-search pages, no CRENT record — [EUIPO availability page](https://www.euipo.europa.eu/en/trade-marks/before-applying/availability). Direct queries at https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/crent and https://www.tmdn.org/tmview/api/search/results?...basicSearch=crent were blocked. **Could not verify EU status.**
- WIPO Global Brand Database: https://branddb.wipo.int/en/quicksearch?by=brandName&v=crent and https://www3.wipo.int/branddb/en/ blocked. A site-restricted search of wipo.int and ipophil.gov.ph for "crent" returned only unrelated gazette PDFs (e.g., "CLEAN CURRENT LIMITED") — [IPOPHL patent gazette hit](https://onlineservices.ipophil.gov.ph/patgazette/attachment/NNP_I201707.PDF). **Could not verify PH/WIPO status.**
- C-Rent (Germany) operates a car-rental-software product under the "C-Rent" name worldwide — [crent.de](https://www.crent.de/en/); whether it holds an EU/DE mark **could not be verified** (site fetch blocked).

### Inferences
- In the United States, launching "CRENT" for an online marketplace with built-in payments would face a likelihood-of-confusion objection against Reg. 5686508 (identical word; overlapping "website featuring technology ... make payments" services) if that registration is still alive. Even if the Philippine launch never files in the US, US app-store distribution and US-based creator customers raise practical exposure.
- IPOPHL examines on relative grounds, so a Philippine filing would be examined against existing PH/Madrid marks, not the US one; however, the PH register could not be checked, so a conflict there is unknown.
- Overall trademark risk rating (my assessment): HIGH in the US (identical live-looking word mark in adjacent services), UNKNOWN in PH/EU/WIPO (registers unreachable). The brand also sits in a crowded "C-Rent / Crent / Krent" rental-naming cluster, which weakens distinctiveness and enforceability even where no registration conflicts.

### Gaps
- IPOPHL eSearch results for CRENT/KRENT/CRENTA in classes 9, 35, 42: not obtainable. Re-run at https://onlineservices.ipophil.gov.ph (TM search) and https://branddb.wipo.int.
- EUIPO/TMview results: not obtainable.
- Current live/dead status and Nice classes of US Reg. 5686508 (Section 8 filing): check https://tsdr.uspto.gov/#caseNumber=86873602&caseType=SERIAL_NO&searchType=statusSearch.

## Key Question 4: Existing businesses, apps and products named Crent (incl. DTI/SEC Philippines, crypto, GitHub)

### Takeaway
"Crent" is already used by at least four unrelated live operations: Crent Inc. (US fintech, crent.com), Crent by Applirent Oy (Finnish equipment-rental app on iOS and Android, com.crent.asmob / App Store id1491327816), C-Rent (German car-rental software, crent.de) and CRent (a Malaysian university car-rental IoT project). No "CRENT" cryptocurrency was found. DTI BNRS and SEC could not be queried; a search for Philippine companies named Crent returned none (only CRENSERV Industrial Corp., unrelated).

### Cited Findings
- Crent Inc. (US): online platform to build credit from monthly bill payments; sends consumer-permissioned data to all three bureaus; founded 2015; LA; Seed $750K Jan 2017 — [Crunchbase](https://www.crunchbase.com/organization/crent); [LinkedIn](https://www.linkedin.com/company/crent-inc-); [TheOrg](https://theorg.com/org/crent). Whether the company is still operating in 2026 **could not be verified** (Crunchbase/Tracxn pages blocked; a search for "crent inc" 2025/2026 returned no news).
- Crent app (Finland): "Manage rental equipment by site and make return orders"; developer Applirent Oy, Kajaani, Finland (founded 2017); business category; Finnish-language — [App Store id1491327816](https://apps.apple.com/us/app/crent/id1491327816); [Google Play com.crent.asmob](https://play.google.com/store/apps/details?id=com.crent.asmob&hl=en_US); [Applirent](https://applirent.com/en/applirent-rental-mobile/). So the app-store name "Crent" is already occupied on both stores.
- C-Rent (Germany): "professional software for car rental companies used worldwide"; C-Rent Web 6; Minden, 11-50 employees — [crent.de](https://www.crent.de/en/); [Crunchbase C Rent](https://www.crunchbase.com/organization/c-rent).
- CRent (Malaysia): "CRent: intelligent car rental services for optimised resources and safety in IIUM community" — academic IoT car-rental system — [IIUM Repository](http://irep.iium.edu.my/111664/).
- Krent (Nigeria): property rental/short-let app, KRENT APP LIMITED, Lagos — [Google Play](https://play.google.com/store/apps/details?id=com.krent.krent&hl=en_US); [X @krent_inc](https://x.com/krent_inc/status/2037066119467466901).
- Crypto: no token named CRENT found; nearest are Crendan (CRN), Creta World (CRETA), CREAT'OR (CRET), Crescent (CRE) — [Crendan](https://www.crendan.com/); [CoinGecko Creta](https://www.coingecko.com/en/coins/creta-world). CoinGecko search page fetch blocked.
- GitHub: besides user /crent, the only repo named "crent" surfaced is the team's own https://github.com/codeXVRSL/crent (public; product-branded "Outlier Desk"; Next.js 15 + Supabase + Xendit; 7 commits) — [codeXVRSL/crent](https://github.com/codeXVRSL/crent) (fetched directly). Also "CRENT370" is a legacy name of the mvslovers/libc370 C library — [libc370 PR #311](https://github.com/mvslovers/libc370/pull/311). A user "crenta" exists on GitHub — [github.com/crenta](https://github.com/crenta).
- Philippines: search for "crent" Philippines company returned only CRENSERV INDUSTRIAL CORP. (Bustos, Bulacan; importer) and unrelated CREIT — [Companies House PH: Crenserv](https://companieshouse.ph/crenserv-industrial-corp); [CREIT](https://creit.com.ph/). DTI BNRS (https://bnrs.dti.gov.ph/search) and companieshouse.ph search were blocked. **Could not verify DTI/SEC availability.**
- Note: the public GitHub repo already exposes the "crent" codename publicly, so the name is discoverable in connection with this project.

### Inferences
- App-store naming: an app simply titled "Crent" will collide with Applirent's existing "Crent" listing on both stores; Apple in particular rejects or disambiguates duplicate names, so the team would need a qualifier (e.g., "Crent: Content Research").
- The Philippine corporate name "CRENT" is plausibly free (no PH company surfaced), but DTI/SEC reserve checks are unverified.

### Gaps
- DTI BNRS and SEC company-name search results for CRENT: blocked. Re-run at https://bnrs.dti.gov.ph/search and SEC eSPARC/CRS name verification.
- Whether Crent Inc. (US) is still an active business in 2026.

## Key Question 5: Linguistic check (Filipino, Spanish, English; search confusion with rent/cent)

### Takeaway
"Crent" has no dictionary meaning in Tagalog/Filipino, Spanish, Dutch or German per web search; it is a coined word. Its main linguistic liability is that it reads as a contraction of "c-rent" and is used that way by multiple rental businesses, so search engines and listeners will associate it with renting rather than content research.

### Cited Findings
- No Tagalog/Filipino or Spanish meaning found for "crent"; searches return only near-words like "cringe" — [tagalog.com cringe](https://www.tagalog.com/dictionary/cringe); [Tagaloglang](https://www.tagaloglang.com/credence-to-creek/).
- No Dutch or German meaning found — [search](https://en.wikipedia.org/wiki/List_of_English_words_of_Dutch_origin).
- "Rent" and "cent" share the short /e/ vowel; "crent" is not a standard English word — [Collins: rent](https://www.collinsdictionary.com/dictionary/english-pronunciations/rent); [Collins: cent](https://www.collinsdictionary.com/dictionary/english-pronunciations/cent).
- Searching "crent" returns rental businesses (C-Rent car software, Crent equipment-rental app, Krent property app, CRent car rental) and a credit/rent-payment fintech — see KQ4 sources.
- Google-style "crent" searches also surface credenza desks and Crozdesk for "crent desk" — [search](https://en.wikipedia.org/wiki/Credenza_desk).

### Inferences
- Pronunciation is unambiguous in Filipino English (/krɛnt/) and carries no offensive meaning, but the "C + rent" parse (rent cars, rent equipment, pay rent) is the dominant semantic field online, which fights the "content research expert" (CRE) origin the team intends.
- The acronym CRE is already used as a job title "Content Research Expert" in the Young Publisher/Max Tornow ecosystem, so "CRE" + "-nt" may read as intended only to insiders.

### Gaps
- No native-speaker check was possible; a quick survey of Filipino creators on what "Crent" means to them is recommended.

## Key Question 6: Alternative names (checked the same way)

### Takeaway
None of the proposed alternatives' .com/.ph domains or Instagram handles could be verified (registrar/WHOIS/Instagram blocked). Web-presence checks show: "HookDesk" is already a Chrome extension brand (Moqlabs, 2025); "IdeaScout" is used by at least three companies/products (Innography/CPA Global, Ideascout Oy Finland, an agent.ai agent); "Crenta" is used by Crenta Digital (Kenya) and a GitHub user; "PitchFile", "Crent Desk", "Crentive" and "Outlier Desk" have no competing brand in search results (Outlier Desk is near the crowded "Outlier" family: Outlier AI, Outlier.org, Outlier Kit).

### Cited Findings
- **Crentive**: no company or product found; nearest are Crenotive Digital Solution (Dhaka agency, est. 2021) and Creitive — [Crenotive](https://crenotive.com/); [Creitive on Dealroom](https://app.dealroom.co/companies/creitive). crentive.com / crentive.ph / @crentive: **could not verify** (blocked).
- **Crenta**: "Crenta Digital — Kenya's top digital marketing agency in Nairobi" at crentadigital.com — [Crenta Digital](https://crentadigital.com/); GitHub user "crenta" exists — [github.com/crenta](https://github.com/crenta). crenta.com / crenta.ph / @crenta: **could not verify**.
- **HookDesk**: Chrome extension "HookDesk" by Moqlabs, v1.0.3 updated 2025-02-15, triggers Make/Zapier/n8n webhooks, 7-day trial — [Chrome Web Store](https://chromewebstore.google.com/detail/hookdesk/eoiafkoagpingjahdebhncmbdnkeebim). hookdesk.com / .ph / @hookdesk: **could not verify**.
- **IdeaScout**: (a) IdeaScout software by Innography/CPA Global for capturing ideas into IP — [press release](https://pressreleases.responsesource.com/news/92670/cpa-global-launches-ideascout-software-that-increases-innovation-efficiency/); (b) Ideascout Oy, innovation company, Tampere, Finland, founded 2011 — [b2match](https://www.b2match.com/e/sustainablesolutionsmatch2026/participations/660968); [LinkedIn Ideascout](https://il.linkedin.com/company/ideascout); (c) "IdeaScout" research agent on agent.ai — [agent.ai](https://agent.ai/agent/IdeaScout); (d) GitHub dhigu4/ideascout — [GitHub](https://github.com/dhigu4/ideascout). ideascout.com / .ph / @ideascout: **could not verify**; given three prior users, treat as high-collision.
- **PitchFile**: search returns only audio-processing "pitch file" technical docs (CDP, MATLAB), no brand — [CDP guide](https://www.composersdesktop.com/docs/guide/print/CDPGuide3-PitchData.pdf). pitchfile.com / .ph / @pitchfile: **could not verify**.
- **Outlier Desk** (current product name in repo): no product called "Outlier Desk"/"OutlierDesk" found; adjacent brands: Outlier AI (BI SaaS), Outlier (tryoutlier.zendesk.com, Scale AI's freelance platform), Outlier.org (education), Outlier Kit (YouTube analytics/niche research tool — closest in function) — [Capterra Outlier AI](https://www.capterra.com/p/199861/Outlier-AI/); [Outlier Kit on Crozdesk](https://crozdesk.com/software/outlier-kit); [Outlier.org](https://www.outlier.org/). outlierdesk.com / .ph / @outlierdesk: **could not verify**.
- **Crent Desk / CrentDesk**: no matches; search redirects to "credenza desk" and Crozdesk — [search](https://en.wikipedia.org/wiki/Crozdesk). Inherits the CRENT trademark conflict from KQ3. Domains/handles: **could not verify**.
- A combined search for `"ideascout.com" OR "hookdesk.com" OR "pitchfile.com" OR "crentive.com" OR "crenta.com"` returned no page from any of those domains — [search](https://github.com/YangyangQu/research-idea-scout); this is weak evidence they are unused but not evidence they are unregistered.

### Inferences
- Ranking by collision risk from what could be seen: lowest = PitchFile, Crentive; low-moderate = Outlier Desk (distinct two-word mark but "Outlier Kit" is a functionally similar YouTube-research tool); moderate = Crenta (one Kenyan agency, different class), Crent Desk (carries CRENT conflict); high = HookDesk (live software brand in a close class), IdeaScout (multiple live software users, one in Class 42).
- Additional coined options worth a quick check that avoid the "rent" parse (not checked here): "Crentory", "Hookline", "Ideabank PH". These are suggestions only, unverified.

### Gaps
- .com and .ph registration status and Instagram handle status for every alternative: blocked. Re-run at https://www.namecheap.com/domains/registration/results/?domain=<name>, https://whois.dot.ph/?search=<name>.ph and https://www.instagram.com/<name>/.
- No trademark register could be searched for any alternative.

## Overall risk rating for "CRENT"

### Takeaway
HIGH overall. Verified or strongly indicated: (1) identical US word mark CRENT registered 2019 to a payments/credit website (Reg. 5686508); (2) "Crent" app already on both app stores (Applirent Oy); (3) crent.com, Instagram @crent and facebook.com/crent appear held by Crent Inc.; (4) three other live rental businesses use Crent/C-Rent/Krent; (5) a 1.2M-follower creator brands as "THE CRENT". Unknown: PH/EU/WIPO register status and all domain/handle availability (sandbox blocked). The only clean signals are the absence of a Philippine company named Crent and the absence of any indexed use of crent.io/.co/.app/.ph.

### Cited Findings
- See KQ1-KQ5 sources above.

### Inferences
- If the team keeps CRENT for a Philippines-only launch, the minimum mitigations are: file an IPOPHL application in classes 35 and 42 after a proper eSearch; avoid US filing; use a qualified app-store title; and accept non-@crent handles (e.g., @crentph, @getcrent). Otherwise, pivot to a coined mark with no "rent" parse (PitchFile or Crentive scored cleanest here, pending verification).

### Gaps
- Every "available" determination in this report requires re-verification from the primary registrar/register pages listed, because the sandbox could not load them on 2026-10-03.
