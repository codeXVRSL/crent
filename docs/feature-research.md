# Feature research: what creators and content researchers need

September 2026. The goal was to find what Outlier Desk was missing for its two sides, by comparing it with outlier-finding tools (1of10, vidIQ, Viewstats, Sandcastles, OutlierKit, Subscribr, Spotter Studio), freelance marketplaces (Fiverr, Upwork, Contra) and how creators and agencies actually run content research.

## What we learned

- **Every outlier tool has four basics:** saved filters, "more like this", save-to-board, and alerts for a niche. 1of10 has Pinterest-style boards ([review](https://1of10.com/review/)). Spotter links an Idea Bank to projects ([Spotter](https://www.spotterstudio.com/blog/what-creators-can-now-do-in-spotter-studio)).
- **Creators keep a separate spreadsheet or Notion board** for each idea's stage, filming date, publish date and views ([Notion template](https://www.notion.com/templates/content-idea-tracker-681), [Retable](https://www.retable.io/templates/content-idea-tracking-spreadsheet-template)). Outlier Desk sold the idea and then lost track of it.
- **Idea fatigue drives creator burnout.** In surveys, 40% of creators named creative fatigue as the main cause, and 51% said having to keep coming up with ideas ([ION / Vibely](https://www.ion.co/90-percent-of-content-creators-report-experiencing-burnout-vibely)).
- **Marketplaces build trust through results and repeat business, more than star ratings:**
  - Fiverr seller levels: [overview](https://fiverrtutorials.com/fiverr-seller-levels) and [repeat business score](https://help.fiverr.com/hc/en-us/articles/4404431241617-Repeat-business-score).
  - Upwork's Job Success Score, which decides who gets invited ([Upwork](https://support.upwork.com/hc/en-us/articles/211063558-Job-Success-Score)).
- **Researchers and agencies keep a swipe file** so they "never start from zero" ([example](https://aisolo.beehiiv.com/p/how-i-created-a-personalized-24-7-viral-content-researcher)).
- **Good short-form briefs are structured:** hook type, reference videos, things to avoid, deliverables ([Influencers-Time](https://www.influencers-time.com/creator-briefs-for-short-form-video-hook-and-cta-strategy/), [Influee](https://influee.co/blog/ugc-brief-template)).

**Where Outlier Desk can lead:** no outlier tool can show that an idea worked *for the creator who bought it*. A marketplace can. That turns "trust me, it's a 12× outlier" into "creators who used this researcher's ideas got 2.4× their usual views".

## Built in this round

| Feature | For | Where |
|---|---|---|
| Idea board: To do → Scripting → Filming → Posted, boards, film dates, private notes | Creators | `/ideas` |
| Results loop: log views after posting; researcher is notified and sees the result multiple only | Both | `/ideas`, `/pitches` |
| Public track record: creators served, repeat buyers, ideas posted, average result | Both | `/cres/[handle]`, directory, pitch bylines |
| Researcher levels: New / Rising / Pro / Top rated (`lib/level.ts`) | Both | Profiles, directory, pitch cards |
| Pitch review: sort by score or date, filter by hook type, private shortlist, pass with a reason | Creators → researchers | `/briefs/[id]` |
| Saved researchers and invite to brief (up to 25 per brief; invited researchers see the brief outside their niches) | Both | `/favorites`, brief sidebar, researcher feed |
| Swipe file with "fits N open briefs" and one-click prefilled pitch | Researchers | `/swipe` |
| Brief templates and "Post a similar brief" | Creators | `/briefs/new` |
| Researcher feed filters: platform, minimum pay, sort, invited only | Researchers | `/briefs` |
| Hook library search, stage and result on each unlocked idea, "Copy as AI script prompt", new CSV columns | Creators | `/unlocks` |
| Fix: "pitch unlocked" notifications linked to a page that didn't exist | Researchers | `/pitches/[id]` now redirects to the brief |

## Next, ranked

1. **Request a variation.** One free alternate hook or angle per unlock, answered through the existing thread. This is the Fiverr "revision" pattern. (M)
2. **Saved-search alerts.** Notify researchers only for briefs above a price they set, or on specific platforms. This needs a small change to `mark_payment_paid`. (S)
3. **Response time badge.** Median time for a researcher's first reply in threads, and time from a brief opening to their first pitch. (M)
4. **Creator persona.** Audience, voice and banned topics, saved once, prefilled into every brief and into the AI prompt. (S)
5. **"More like this"** on unlocked ideas, matched by hook type, format and niche. (S)
6. **Weekly digest email.** For creators: ideas past their film date and posted ideas with no views logged. For researchers: new briefs and results. (S, reuses Resend)
7. **Retainers.** Recurring briefs sent to a saved researcher (spec Phase 9). (L)
8. **Team seats for agencies.** An editor or manager can view the idea board. (L)
9. **Platform API auto-stats.** Use the YouTube Data API to check views and median, which cuts down on disputes (spec Phase 10). (M)
