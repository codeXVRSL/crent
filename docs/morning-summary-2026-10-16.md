# Good morning: night 2

Everything is on `claude/hopeful-edison-rfuv5k`, pushed. All suites pass on the latest commit.

## What changed

| # | Change | What it does for you |
|---|---|---|
| 1 | **Pitches written the way a real content researcher writes them** (using your CRE playbook) | The write-up template now runs in the order a creator films: style, the first 3 seconds (what's said, what's on screen, the headline text), filming and editing with timings, audio, rules, a CTA with the word "Follow", caption, adjustment note. As the researcher types, quiet tips point out a CTA without "Follow", missing timings, empty sections, or writing *about* the creator instead of *to* them. |
| 2 | **Briefs tell researchers what the creator can actually make** | Every brief ends with a short setup block: gear, editing level, tone, hard no's. Two new templates: "Simple clip + text" (faceless) and "Screen recording". Hint lines the creator leaves untouched are dropped before posting, so researchers never read placeholders as answers. |
| 3 | **The six checks a pitch is judged on, in the open** | A checklist on the pitch page, the For-researchers page and Help: it's an outlier, it's recent, the idea carried it (not the person), this creator can make it, nothing on the no list, and written so they can follow it tonight. |
| 4 | **UI audit: 148 screenshots, every page, phone and desktop, light and dark** | Fixed: the swipe file overflowed a phone screen; wide tables now show scroll shadows; the feedback button no longer covers the last line of any page; the theme switch shows which theme is on; scores read "15×" instead of "15.0×"; the unlocked idea's source link is a short readable label; "Send pitch" is full width on phones; the getting-started list highlights the step still open; empty portfolios read as empty; hold copy no longer says "0 hours". Before shots are in `docs/screenshots/ui-audit/`. |
| 5 | **The rare React warning, mostly fixed** | Root cause of the main case found: the dashboard's loading skeleton made the page stream, and redirects from inside a streaming page race with the browser. The skeleton is gone (the page was fast anyway). Since then: three 15-round stress loops and four full click-through runs clean, with one single occurrence on the wallet page in one run. I'm chasing that last one with the development build, which prints the exact mismatch. |
| 6 | **Reviews** | A code review found 10 issues in the night's work (all fixed, e.g. one-line sections confused the write-up checker, YouTube links lost their video id in the label). A security review of all new code since the charts, retainers and team seats found nothing exploitable. A clean-up pass removed duplicated helpers. |

## Test results (latest commit)

| Suite | Result |
|---|---|
| Database tests | All pass |
| Unit tests | 95 pass |
| Full click-through test (every page, every role) | 46 / 46, 0 browser errors, twice in a row |
| End-to-end marketplace specs | 2 / 2 |
| Accessibility audit (82 page views, light and dark) | 0 problems |
| Deploy dry run | Pass |

## Fresh screenshots

`docs/screenshots/` was regenerated on the final build, so the set you send to your boss shows the new pitch form and the UI fixes.

## What still needs you

Unchanged from the last summary: deploying (network allow-list plus the two tokens in the environment settings, then "deploy" in a new session), the optional YouTube key, migrations 12 to 15 on any existing database, and the business items (DTI/SEC and BIR, lawyer review, Xendit, the name).

One thing for your judgement: the CRE playbook's filter rules (under 100k followers, 500k+ views, US/EU) are agency-specific. I wrote the app's checklist in general terms ("well above what the channel usually gets", "recent", "the idea carried it") rather than hard-coding those numbers, because creators set their own minimum score per brief. Say the word if you'd like those exact thresholds as the defaults instead.

## Things I did not do

- A larger refactor of the e2e helpers (three test scripts share copied login/admin plumbing). Worth doing, but it touches the test suite only.
- Settings page save buttons are still three different styles; a cosmetic item for a later pass.
