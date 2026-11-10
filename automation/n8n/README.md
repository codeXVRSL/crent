# Outlier Desk automations (n8n)

Nine n8n workflows: six run the admin side of Outlier Desk for you, three help it grow (a website chat assistant, waitlist welcome emails, one-time onboarding reminders). They use the app's database through a restricted role, so they never touch money or change briefs.

| File | Runs | What it does |
|---|---|---|
| `01-daily-digest.json` | 8:00 Manila, daily | Your to-do list (verifications, disputes, payouts, refunds, flags, feedback), 24h and 7-day numbers, and briefs where creators are sitting on pitches. |
| `02-live-alerts.json` | Every 5 min | One email listing anything new that needs you: disputes, payout requests, verifications, refunds needing a hand, off-platform attempts, bug reports, payment webhooks that failed to process. Each event is emailed once. |
| `03-ai-pitch-spot-check.json` | Every 15 min | Gemini checks the first 20 pitches of every new researcher (fake-looking numbers, link vs platform, hook leaks, low-effort copy, contact details). Medium or high risk becomes a flag in **Admin → Flags** plus an email. |
| `04-health-monitor.json` | Every 10 min | Alerts if the site stops answering or the scheduled jobs look stuck (overdue briefs still open, earnings not released, refunds stuck). At most one email per problem every 6 hours. |
| `05-weekly-report.json` | Mondays 8:30 Manila | Last week's numbers added as a row to a Google Sheet, plus an email. |
| `06-error-alerts.json` | When any of the above fails | Emails you the failed step and the error. |
| `07-website-chat.json` | Each visitor message | AI assistant (Gemini) in the chat bubble on the public pages. Answers only from the facts in its system message, remembers the last 8 exchanges per browser tab, and can add a visitor to the waitlist. If Gemini fails, the visitor gets a polite fallback. |
| `08-waitlist-welcome.json` | Every 15 min | Emails each new waitlist signup once (creator or researcher version) through Resend. A failed send is retried next run and you get one email about it. |
| `09-onboarding-nudges.json` | 10:17 Manila, daily | One-time reminders: finish setting up (after 1 day), researchers: get verified (after 1 day), creators: fund a started brief (after 1 day). Each person gets each reminder at most once. |

## Setup (about 20 minutes)

### 1. Database
1. Run the migrations `20261111000009_admin_automation.sql`, `20261111000010_security_audit_fixes.sql` and `20261111000011_growth_automation.sql` from `supabase/migrations/` (or `setup_all.sql` on a new project).
2. In the Supabase SQL editor, create the login n8n will use (choose your own strong password):
   ```sql
   create role n8n_admin login password 'CHANGE-ME-long-random' in role outlier_automation;
   ```
3. In Supabase → **Connect** → **Session pooler**, note the host (like `aws-0-ap-southeast-1.pooler.supabase.com`), port `5432`, and database `postgres`. With the pooler, the user is `n8n_admin.<your-project-ref>`.

### 2. Credentials in n8n
- **Postgres**, named `Outlier Desk DB (n8n_admin)`: the pooler host, port 5432, database `postgres`, the user from step 1.3, your password, SSL **require**.
- **Gmail** (OAuth2): the account that sends you the emails.
- **Gemini**: *Header Auth*, name `x-goog-api-key`, value = your Gemini API key (for workflow 03). A header keeps the key out of URLs, which end up in logs.
- **Google Sheets** (OAuth2): for workflow 05.
- **Gemini (chat)**: n8n's *Google Gemini (PaLM) API* credential with your API key (for workflow 07's chat model).
- **Outlier chat secret**: *Header Auth*, name `x-chat-secret`, value = a long random string (for example the output of `openssl rand -hex 32`). The same value goes in the app as `N8N_CHAT_SECRET`.
- **Resend API**: *Header Auth*, name `Authorization`, value `Bearer re_…` (the same Resend key the app uses), for workflows 08 and 09.

### 3. Import and connect
1. Import the JSON files (**Workflows → Import from file**).
2. In each workflow, open the **Config** node and set `app_url` (your live site) and `admin_email`. Workflow 05 also needs `sheet_id`; 08 and 09 need `from_email` (an address on a domain verified in Resend).
3. Select the credentials on the Postgres, Gmail, Gemini, Sheets, Resend and webhook nodes.
4. Workflow 05: create a Google Sheet with a tab named **Weekly** and these headers in row 1:
   `Week starting, New creators, New researchers, Researchers verified, Briefs live, Private briefs, Pitches, Unlocks, Unlock rate %, GMV ($), Revenue ($), Paid out ($), Disputes, Flags`
5. Workflow 06: put your email in **Email Error**.
6. **Publish all of them**, including 06. n8n 2.x silently skips an error workflow that isn't published.
7. Workflow 07: open **Chat Webhook**, copy the **Production URL**, and set it in the app (Vercel → Settings → Environment Variables) as `N8N_CHAT_WEBHOOK_URL`, plus `N8N_CHAT_SECRET`. Redeploy; the chat bubble appears on the public pages. Remove either variable to hide it.
8. When pricing or policies change, update the facts in **Assistant → System Message** (workflow 07) and in `build.py`.

### 4. Where to run n8n
These run on a schedule, so n8n has to be on all the time. The Mac mini works while it's awake. For something always on, a small VPS with Docker is better; the `n8n-self-hosting` skill has a ready setup.

## How the chat stays safe
- Visitors never talk to n8n directly. The site's `/api/chat` route checks the request came from your own pages, limits each visitor (20 messages per 10 minutes, 150 per day), caps message length, then calls n8n with the secret header. Without the secret, n8n answers 403.
- Replies are shown as plain text, so the AI can't inject links or code into the page.
- The waitlist tool can only add chat signups (the database refuses anything else), validates the email, and stops after 100 per hour.
- Conversations are kept only in n8n's memory and are cleared when n8n restarts. Nothing is stored in the database except emails people choose to give.

## How it was tested
On n8n 2.35.7, against a copy of the Outlier Desk database, connected as the restricted role:
- All workflows run end to end. The digest, alerts, spot-check, health and weekly report all produced the right emails and sheet row from seeded data.
- Re-runs send no duplicate alerts. A new event produces an email with only that event.
- A junk AI answer is retried on the next run, never marked as checked.
- A site outage alerts once, with no repeat on the next run.
- A real failure (the role losing access to a table) triggers the error workflow with the failed step and reason.
- Chat (with a stand-in Gemini server): the secret is enforced (403 without it), the system message and the waitlist tool reach the model, the tool adds the visitor as a researcher, memory is kept per visitor and not shared, and a Gemini outage returns the fallback reply.
- Welcome emails: each signup is emailed once; a bounced address isn't marked as welcomed and you get one email about it.
- Nudges: each reminder type is sent once; a second run sends nothing.
- `supabase/tests/70_growth.sql` checks the role can only add chat signups, can only mark welcomes, and that login emails stay hidden from the website's API roles.
- `supabase/tests/50_automation.sql` checks that the role can read admin data, can write only alert log and flags, and cannot change money or briefs or see payout account details.

## Rebuilding
The JSON files are generated by `build.py`. Change a query or an email there, run `python3 automation/n8n/build.py`, and re-import. That keeps all workflows consistent.
