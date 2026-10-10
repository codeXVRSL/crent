# Good morning: what got built overnight

Everything is on the branch `claude/hopeful-edison-rfuv5k`, pushed to GitHub. All test suites pass on the latest commit.

## What's new

| # | Feature | What it does for you |
|---|---|---|
| 1 | **Faster setup for future sessions** | Cloud Claude sessions now install the app's packages automatically, so tests and checks work straight away. |
| 2 | **Trend charts on the admin Overview** | Two charts: money funded per week and ideas unlocked per week, for the last 12 weeks (Manila weeks). Hover or use the arrow keys to read any week, or open "Show as table". They work in light and dark mode and on phones. |
| 3 | **Automatic YouTube views check** | When a researcher pitches with a YouTube link, the app checks the real view count and post date with YouTube. Creators see **"Views checked with YouTube"** or a warning, and if the numbers don't match, a flag appears in Admin → Flags. It's **off until you add a free YouTube API key** (steps below). |
| 4 | **Monthly retainers** | On a brief that has been live, a creator can choose **"Repeat every month"** with a researcher they saved or bought from. On the chosen day they get a ready-made draft to fund (nothing is charged until they press Pay), and the researcher is invited as soon as it's live. Creators can pause or stop. Researchers can see their retainers and leave one. |
| 5 | **Code review and clean-up** | A full review of the night's work found 10 issues, all fixed. Examples: the charts could undercount once there were more than 1,000 sales, and a monthly brief paid late lost pitching time. A clean-up pass then made the pages load with fewer database calls. |

## Test results (latest commit)

| Suite | Result |
|---|---|
| Database tests (money, security, retainers, trends) | All pass |
| Unit tests | 88 pass |
| Full click-through test of every page and role | 45 / 45 steps pass, 0 browser errors |
| End-to-end marketplace tests | 2 / 2 pass |
| Accessibility audit (80 page views, light and dark) | 0 problems |
| Deploy dry run | Pass |

## What needs you

1. **Going live (deploying).** This still can't be done from here. In the Claude Code environment settings, allow `api.vercel.com`, `vercel.com` and `api.supabase.com` on the network list. Add `SUPABASE_ACCESS_TOKEN` and `VERCEL_TOKEN` as environment variables (never paste tokens in chat), then start a new session and say "deploy".
2. **YouTube key (optional, free).**
   1. In Google Cloud console, go to APIs & Services and enable **YouTube Data API v3**.
   2. Under Credentials, create an API key and restrict it to that API.
   3. Add it as `YOUTUBE_API_KEY` in Vercel. Each pitch uses 1 of the 10,000 free daily units.
3. **Database update on any existing project.** If a database was already set up before last night, run migration files 12, 13 and 14 from `supabase/migrations/` in the Supabase SQL editor. A new project only needs `supabase/setup_all.sql`.
4. **Business items, unchanged:**
   - Register with DTI/SEC and the BIR.
   - Have a Philippine lawyer review the legal pages and the escrow setup.
   - Set up a Xendit account for real payments.
   - Make the final choice on the name (check with IPOPHL).
5. **Review and merge.** When you're happy, open a pull request from the branch, or ask me to.

## Known small issue

A rare React warning (#418) sometimes appears during very fast page switching in the automated test. Users don't see it and it doesn't affect anything. It is noted in the QA report.
