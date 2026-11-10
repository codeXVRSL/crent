import json, uuid
import os
OUT = os.path.dirname(os.path.abspath(__file__))
# Deterministic IDs: rebuilding without changes produces identical files, so diffs show only real edits.
_seq = [0]
def nid():
    _seq[0] += 1
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"outlier-desk-n8n/{_seq[0]}"))
RETRY = dict(retryOnFail=True, maxTries=3, waitBetweenTries=5000)
PG_CRED = {"postgres": {"id": "", "name": "Outlier Desk DB (n8n_admin)"}}

class WF:
    def __init__(s, name, wid): s.name, s.wid, s.nodes, s.conns = name, wid, [], {}
    def node(s, name, t, v, pos, params, **extra):
        n = {"parameters": params, "id": nid(), "name": name, "type": t, "typeVersion": v, "position": pos}
        n.update(extra); s.nodes.append(n); return name
    def link(s, a, b, out=0):
        m = s.conns.setdefault(a, {"main": []})["main"]
        while len(m) <= out: m.append([])
        m[out].append({"node": b, "type": "main", "index": 0})
    def chain(s, *names):
        for a, b in zip(names, names[1:]): s.link(a, b)
    def save(s, fname, error_wf=True):
        names = {n["name"] for n in s.nodes}
        for k, v in s.conns.items():
            assert k in names, k
            for o in v["main"]:
                for c in o: assert c["node"] in names, c["node"]
        settings = {"executionOrder": "v1", "timezone": "Asia/Manila"}
        if error_wf: settings["errorWorkflow"] = "ODAdminErrors001"
        json.dump({"id": s.wid, "name": s.name, "nodes": s.nodes, "connections": s.conns, "settings": settings, "pinData": {}},
                  open(f"{OUT}/{fname}", "w"), indent=2, ensure_ascii=False)
        print(fname, len(s.nodes))

def a(name, value, t="string"): return {"id": nid(), "name": name, "value": value, "type": t}
def config(w, pos, extra=()):
    return w.node("Config", "n8n-nodes-base.set", 3.4, pos, {"assignments": {"assignments": [
        a("app_url", "https://YOUR-APP.vercel.app"), a("admin_email", "PASTE_YOUR_EMAIL"), *extra]}, "options": {}},
        notes="All settings in one place: your live site URL and the email that receives admin mail.")
def pg(w, name, pos, query, replacement=None, always=False, notes=None):
    opts = {}
    if replacement: opts["queryReplacement"] = replacement
    extra = dict(RETRY); extra["credentials"] = PG_CRED
    if always: extra["alwaysOutputData"] = True
    if notes: extra["notes"] = notes
    return w.node(name, "n8n-nodes-base.postgres", 2.6, pos, {"operation": "executeQuery", "query": query, "options": opts}, **extra)
def cond(l, t, op, r=""): return {"id": nid(), "leftValue": l, "rightValue": r, "operator": {"type": t, "operation": op}}
def iff(w, name, pos, *conds):
    return w.node(name, "n8n-nodes-base.if", 2.2, pos, {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
        "conditions": list(conds), "combinator": "and"}, "options": {}})
def gmail(w, name, pos, subject, html, once=True):
    extra = dict(RETRY)
    if once: extra["executeOnce"] = True
    return w.node(name, "n8n-nodes-base.gmail", 2.1, pos, {"sendTo": "={{ $('Config').first().json.admin_email }}",
        "subject": subject, "message": html, "options": {"appendAttribution": False}}, **extra)
def sticky(w, text, h=260, wdt=560):
    w.node("About", "n8n-nodes-base.stickyNote", 1, [-60, -320], {"content": text, "height": h, "width": wdt, "color": 4})
def schedule(w, rule, pos=[0, 0]):
    return w.node("Schedule", "n8n-nodes-base.scheduleTrigger", 1.2, pos, {"rule": {"interval": [rule]}})

C = "$('Config').first().json"
MONEY = "const m = (c) => '$' + (Number(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });"
ESC = "const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');"

# ================= 1. Daily digest =================
w = WF("Outlier Desk Admin · Daily Digest", "ODAdminDigest001")
schedule(w, {"triggerAtHour": 8})
config(w, [220, 0])
DIGEST_SQL = """select
  (select count(*) from cre_profiles where kyc_status = 'pending')::int                         as kyc_pending,
  (select count(*) from disputes where status = 'awaiting_admin')::int                          as disputes_admin,
  (select count(*) from disputes where status = 'awaiting_cre')::int                            as disputes_cre,
  (select count(*) from payouts where status = 'requested')::int                                as payouts_requested,
  (select coalesce(sum(amount_cents), 0) from payouts where status = 'requested')::bigint       as payouts_requested_cents,
  (select count(*) from refunds where status in ('manual', 'failed'))::int                      as refunds_attention,
  (select count(*) from flags where status = 'open')::int                                       as flags_open,
  (select count(*) from feedback where status = 'new')::int                                     as feedback_new,
  (select count(*) from briefs where status = 'open')::int                                      as briefs_open,
  (select count(*) from briefs where status = 'open' and deadline_at < now() + interval '24 hours')::int as briefs_closing_24h,
  (select count(*) from profiles where created_at > now() - interval '24 hours')::int           as signups_24h,
  (select count(*) from briefs where opened_at > now() - interval '24 hours')::int              as briefs_24h,
  (select count(*) from pitches where submitted_at > now() - interval '24 hours')::int          as pitches_24h,
  (select count(*) from unlocks where created_at > now() - interval '24 hours')::int            as unlocks_24h,
  (select coalesce(sum(budget_cents), 0) from briefs where opened_at > now() - interval '24 hours')::bigint as gmv_24h_cents,
  (select coalesce(sum(case when credit_account = 'platform:revenue' then amount_cents
                            when debit_account = 'platform:revenue' then -amount_cents end), 0)
     from ledger_entries where created_at > now() - interval '24 hours')::bigint                as revenue_24h_cents,
  (select count(*) from profiles where created_at > now() - interval '7 days')::int             as signups_7d,
  (select count(*) from unlocks where created_at > now() - interval '7 days')::int              as unlocks_7d,
  (select coalesce(sum(budget_cents), 0) from briefs where opened_at > now() - interval '7 days')::bigint as gmv_7d_cents,
  (select coalesce(sum(case when credit_account = 'platform:revenue' then amount_cents
                            when debit_account = 'platform:revenue' then -amount_cents end), 0)
     from ledger_entries where created_at > now() - interval '7 days')::bigint                  as revenue_7d_cents,
  (select coalesce(json_agg(x order by x.waiting_hours desc), '[]'::json) from (
     select b.id, b.title, count(p.id)::int as waiting,
            round(extract(epoch from now() - min(p.submitted_at)) / 3600)::int as waiting_hours
       from briefs b join pitches p on p.brief_id = b.id and p.status = 'submitted'
      where b.status = 'open' group by b.id, b.title
     having min(p.submitted_at) < now() - interval '48 hours' limit 5) x)                       as stale_briefs"""
pg(w, "Read Admin Numbers", [440, 0], DIGEST_SQL, notes="One read-only query: today's to-do counts plus 24h and 7-day numbers.")
DIGEST_HTML = ("={{ (() => { " + MONEY + ESC + " const d = $json; const a = " + C + ".app_url;"
  " const todo = [['Verifications to review', d.kyc_pending, '/admin/kyc'], ['Disputes waiting for you', d.disputes_admin, '/admin/disputes'],"
  " ['Payouts to approve (' + m(d.payouts_requested_cents) + ')', d.payouts_requested, '/admin/payouts'], ['Refunds needing a hand', d.refunds_attention, '/admin/payouts'],"
  " ['Open flags', d.flags_open, '/admin/flags'], ['New feedback', d.feedback_new, '/admin/feedback']];"
  " const total = todo.reduce((s, t) => s + Number(t[1]), 0);"
  " const row = (l, v, link) => `<tr><td style=\"padding:6px 12px 6px 0\">${link ? `<a href=\"${a}${link}\">${l}</a>` : l}</td><td style=\"padding:6px 0;text-align:right;font-weight:600\">${v}</td></tr>`;"
  " const stale = (d.stale_briefs || []).map(b => `<li><a href=\"${a}/briefs/${b.id}\">${esc(b.title)}</a>: ${b.waiting} pitch(es) waiting ${b.waiting_hours}h</li>`).join('');"
  " return `<div style=\"font-family:system-ui,sans-serif;max-width:560px\"><h2 style=\"margin:0 0 4px\">Outlier Desk · daily digest</h2>`"
  " + `<p style=\"color:#666;margin:0 0 16px\">${total ? total + ' thing(s) need you today.' : 'Nothing needs you today.'}</p>`"
  " + `<h3>To do</h3><table>${todo.map(t => row(t[0], t[1], t[2])).join('')}</table>`"
  " + `<h3>Last 24 hours</h3><table>${row('Sign-ups', d.signups_24h)}${row('Briefs live', d.briefs_24h)}${row('Pitches', d.pitches_24h)}${row('Unlocks', d.unlocks_24h)}${row('Briefs funded (GMV)', m(d.gmv_24h_cents))}${row('Revenue', m(d.revenue_24h_cents))}</table>`"
  " + `<h3>Last 7 days</h3><table>${row('Sign-ups', d.signups_7d)}${row('Unlocks', d.unlocks_7d)}${row('GMV', m(d.gmv_7d_cents))}${row('Revenue', m(d.revenue_7d_cents))}</table>`"
  " + `<h3>Marketplace</h3><table>${row('Open briefs', d.briefs_open)}${row('Closing within 24h', d.briefs_closing_24h)}</table>`"
  " + (stale ? `<h3>Creators sitting on pitches (48h+)</h3><ul>${stale}</ul><p style=\"color:#666\">Worth a nudge: researchers wait on these.</p>` : '')"
  " + `<p><a href=\"${a}/admin\">Open admin</a></p></div>`; })() }}")
w.node("Build Email", "n8n-nodes-base.set", 3.4, [660, 0], {"assignments": {"assignments": [
    a("html", DIGEST_HTML),
    a("subject", "={{ 'Outlier Desk digest: ' + ([$json.kyc_pending, $json.disputes_admin, $json.payouts_requested, $json.refunds_attention, $json.flags_open, $json.feedback_new].reduce((s, n) => s + Number(n), 0) || 'nothing') + ' to do · ' + $now.setZone('Asia/Manila').toFormat('MMM d') }}")]}, "options": {}})
gmail(w, "Email Digest", [880, 0], "={{ $json.subject }}", "={{ $json.html }}")
w.chain("Schedule", "Config", "Read Admin Numbers", "Build Email", "Email Digest")
sticky(w, "## Daily digest · 8:00 Manila\nYour admin to-do list (verifications, disputes, payouts, refunds, flags, feedback) plus 24-hour and 7-day numbers, and briefs where creators are sitting on pitches.\n\n**Setup:** Postgres credential (n8n_admin), Gmail credential, fill **Config**.")
w.save("01-daily-digest.json")

# ================= 2. Live alerts =================
w = WF("Outlier Desk Admin · Live Alerts", "ODAdminAlerts001")
schedule(w, {"field": "minutes", "minutesInterval": 5})
config(w, [220, 0])
ALERT_SQL = """with ev as (
  select 'dispute' as kind, d.id::text as entity_id, d.opened_at as at,
         'Dispute waiting for your decision' as title,
         d.reason || ': ' || left(coalesce(d.details, ''), 160) as detail, '/admin/disputes' as link
    from disputes d where d.status = 'awaiting_admin'
  union all
  select 'payout', p.id::text, p.requested_at,
         'Payout requested: $' || to_char(p.amount_cents / 100.0, 'FM999999990.00'),
         coalesce(pr.display_name, '') || coalesce(' @' || pr.handle, ''), '/admin/payouts'
    from payouts p left join profiles pr on pr.id = p.cre_id where p.status = 'requested'
  union all
  select 'kyc', c.user_id::text || ':' || coalesce((select max(s.submitted_at)::text from kyc_submissions s where s.user_id = c.user_id), ''),
         coalesce((select max(s.submitted_at) from kyc_submissions s where s.user_id = c.user_id), now()),
         'New researcher verification', coalesce(pr.display_name, '') || coalesce(' @' || pr.handle, ''), '/admin/kyc'
    from cre_profiles c join profiles pr on pr.id = c.user_id where c.kyc_status = 'pending'
  union all
  select 'refund', r.id::text || ':' || r.status, r.created_at,
         'Refund needs a hand (' || r.status || '): $' || to_char(r.amount_cents / 100.0, 'FM999999990.00'),
         coalesce(r.failure_reason, r.reason), '/admin/payouts'
    from refunds r where r.status in ('manual', 'failed')
  union all
  select 'offplatform', f.id::text, f.created_at, 'Possible off-platform deal',
         coalesce(pr.display_name, '') || ': ' || coalesce(f.excerpt, ''), '/admin/flags'
    from flags f left join profiles pr on pr.id = f.subject_user
   where f.kind = 'other' and f.entity_type = 'circumvention_alert' and f.status = 'open'
  union all
  select 'webhook', w.id, w.received_at, 'Payment webhook failed (' || w.provider || ' ' || w.type || ')',
         'Not processed after 10 minutes: ' || left(coalesce(w.error, 'no error recorded'), 200) || '. A payment may be paid but not credited — check the provider dashboard.', '/admin'
    from webhook_events w where w.processed_at is null and w.received_at < now() - interval '10 minutes'
  union all
  select 'bug', fb.id::text, fb.created_at, 'Bug report', left(fb.message, 200) || ' (' || coalesce(fb.page, '') || ')', '/admin/feedback'
    from feedback fb where fb.kind = 'bug' and fb.status = 'new'
)
select ev.* from ev
 where not exists (select 1 from admin_alert_log l where l.kind = ev.kind and l.entity_id = ev.entity_id)
 order by ev.at limit 50"""
pg(w, "Find New Events", [440, 0], ALERT_SQL, always=True,
   notes="Everything that needs an admin and hasn't been emailed yet. alwaysOutputData so 'nothing new' still reaches the check.")
iff(w, "Anything New?", [660, 0], cond("={{ $json.kind }}", "string", "notEmpty"))
w.node("Bundle Events", "n8n-nodes-base.aggregate", 1, [880, -100], {"aggregate": "aggregateAllItemData", "destinationFieldName": "events", "options": {}})
ALERT_HTML = ("={{ (() => { " + ESC + " const a = " + C + ".app_url;"
  " const items = $json.events.map(e => `<li style=\"margin-bottom:8px\"><b>${esc(e.title)}</b><br><span style=\"color:#555\">${esc(e.detail)}</span><br><a href=\"${a}${e.link}\">Open</a></li>`).join('');"
  " return `<div style=\"font-family:system-ui,sans-serif;max-width:560px\"><h2 style=\"margin:0 0 12px\">Needs you now</h2><ul style=\"padding-left:18px\">${items}</ul></div>`; })() }}")
gmail(w, "Email Alert", [1100, -100],
      "={{ $json.events.length === 1 ? 'Outlier Desk: ' + $json.events[0].title : 'Outlier Desk: ' + $json.events.length + ' things need you' }}", ALERT_HTML)
pg(w, "Mark as Sent", [1320, -100],
   "insert into admin_alert_log(kind, entity_id)\nselect e->>'kind', e->>'entity_id' from json_array_elements($1::json) e\non conflict do nothing",
   replacement="={{ [ JSON.stringify($('Bundle Events').first().json.events.map(e => ({ kind: e.kind, entity_id: e.entity_id }))) ] }}",
   notes="Runs only after the email went out, so a failed send is retried on the next run instead of being lost.")
w.chain("Schedule", "Config", "Find New Events", "Anything New?")
w.link("Anything New?", "Bundle Events", 0)
w.chain("Bundle Events", "Email Alert", "Mark as Sent")
sticky(w, "## Live alerts · every 5 minutes\nOne email per run listing anything new that needs you: disputes, payout requests, verifications, refunds needing a hand, off-platform attempts, bug reports, failed payment webhooks. Each event is emailed **once** (remembered in `admin_alert_log`).")
w.save("02-live-alerts.json")

# ================= 3. AI pitch spot-check =================
w = WF("Outlier Desk Admin · AI Pitch Spot-Check", "ODAdminSpotChk01")
schedule(w, {"field": "minutes", "minutesInterval": 15})
config(w, [220, 0], [a("gemini_model", "gemini-3.5-flash")])
SPOT_SQL = """select p.id, p.platform, p.format_label, p.hook_category, p.teaser, p.source_views, p.channel_median_views,
       p.multiplier::float as multiplier, p.source_posted_on::text as source_posted_on, p.duration_seconds,
       s.source_url, s.hook_text, s.why_it_worked, s.instructions, s.adaptation_notes,
       pr.id as cre_id, pr.display_name as cre_name, b.title as brief_title, b.platform as brief_platform,
       (select count(*) from pitches x where x.cre_id = p.cre_id)::int as cre_total_pitches
  from pitches p
  join pitch_secrets s on s.pitch_id = p.id
  join profiles pr on pr.id = p.cre_id
  join briefs b on b.id = p.brief_id
 where p.submitted_at > now() - interval '7 days'
   and (select count(*) from pitches x where x.cre_id = p.cre_id and x.submitted_at <= p.submitted_at) <= 20
   and not exists (select 1 from admin_alert_log l where l.kind = 'pitch_check' and l.entity_id = p.id::text)
 order by p.submitted_at
 limit 10"""
pg(w, "New Researchers' Pitches", [440, 0], SPOT_SQL, always=True,
   notes="The first 20 pitches of every researcher, not yet checked, 10 per run.")
iff(w, "Any to Check?", [660, 0], cond("={{ $json.id }}", "string", "notEmpty"))
REVIEW_PROMPT = r"""`You are the trust & safety reviewer for Outlier Desk, a marketplace where researchers sell proven short-form video ideas. Review this pitch from a NEW researcher for signs of fake or low-quality work.

Pitch (JSON):
${JSON.stringify({ platform: $json.platform, brief_platform: $json.brief_platform, format: $json.format_label, hook_type: $json.hook_category,
  teaser: $json.teaser, views: $json.source_views, channel_median: $json.channel_median_views, score: $json.multiplier,
  posted: $json.source_posted_on, length_s: $json.duration_seconds, source_url: $json.source_url, hook: $json.hook_text,
  why_it_worked: $json.why_it_worked, instructions: $json.instructions, adaptation_notes: $json.adaptation_notes })}

Check:
1. Numbers: implausible views vs channel median (e.g. median above views, score over 200x, round made-up numbers).
2. Source: does the URL's site match the stated platform (tiktok.com, instagram.com/reel, youtube.com/shorts, facebook.com)?
3. Hook leak: does the teaser give away the hook?
4. Effort: generic, copy-paste or nonsensical "why it worked" / instructions.
5. Contact details or attempts to move off-platform anywhere.

Return JSON only: {"risk": "low" | "medium" | "high", "kind": "fake_proof" | "other", "reasons": ["short, specific reasons"]}
Use "fake_proof" when the numbers or source look made up. Be fair: most pitches from honest new researchers are "low".`"""
w.node("Gemini: Review Pitch", "n8n-nodes-base.httpRequest", 4.2, [880, -100], {
    "method": "POST",
    "url": f"=https://generativelanguage.googleapis.com/v1beta/models/{{{{ {C}.gemini_model }}}}:generateContent",
    "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
    "sendBody": True, "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ contents: [{ role: 'user', parts: [{ text: " + REVIEW_PROMPT + " }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }) }}",
    "options": {"timeout": 60000}},
    onError="continueRegularOutput", notes="Why HTTP: Gemini JSON mode. Credential = Header Auth, name x-goog-api-key (keeps the key out of URLs and logs). Runs once per pitch. On failure the pitch is left unchecked and retried next run.", **RETRY)
w.node("Read Verdict", "n8n-nodes-base.set", 3.4, [1100, -100], {"assignments": {"assignments": [
    a("pitch_id", "={{ $('New Researchers\\' Pitches').item.json.id }}"),
    a("cre_id", "={{ $('New Researchers\\' Pitches').item.json.cre_id }}"),
    a("cre_name", "={{ $('New Researchers\\' Pitches').item.json.cre_name }}"),
    a("brief_title", "={{ $('New Researchers\\' Pitches').item.json.brief_title }}"),
    a("verdict", "={{ (() => { try { const v = JSON.parse($json.candidates[0].content.parts[0].text); return { risk: ['low','medium','high'].includes(v.risk) ? v.risk : 'unknown', kind: v.kind === 'fake_proof' ? 'fake_proof' : 'other', reasons: Array.isArray(v.reasons) ? v.reasons.slice(0, 5).map(String) : [] }; } catch (e) { return { risk: 'unknown', kind: 'other', reasons: [] }; } })() }}", "object")]},
    "options": {}}, notes="Bad or missing AI output becomes risk 'unknown' and is retried next run, never silently passed.")
iff(w, "Reviewed?", [1320, -100], cond("={{ $json.verdict.risk }}", "string", "notEquals", "unknown"))
pg(w, "Mark Checked", [1540, -200], "insert into admin_alert_log(kind, entity_id) values ('pitch_check', $1) on conflict do nothing",
   replacement="={{ [ $json.pitch_id ] }}")
iff(w, "Suspicious?", [1540, 0], cond("={{ ['medium','high'].includes($json.verdict.risk) }}", "boolean", "true"))
pg(w, "File Flag", [1760, 0],
   "insert into flags(kind, subject_user, entity_type, entity_id, excerpt)\nvalues ($1::flag_kind, $2::uuid, 'pitch', $3, $4)",
   replacement="={{ [ $json.verdict.kind, $json.cre_id, $json.pitch_id, ('AI spot-check (' + $json.verdict.risk + '): ' + $json.verdict.reasons.join(' · ')).slice(0, 1000) ] }}",
   always=True, notes="Shows up in Admin → Flags with the AI's reasons. alwaysOutputData: an INSERT returns no rows, and the email after it must still run.")
w.node("Bundle Findings", "n8n-nodes-base.aggregate", 1, [1980, 0], {"aggregate": "aggregateAllItemData", "destinationFieldName": "findings", "options": {}})
w.node("Collect Flagged", "n8n-nodes-base.set", 3.4, [1760, 160], {"assignments": {"assignments": [
    a("flagged", "={{ $('Suspicious?').all().map(i => i.json) }}", "array")]}, "options": {}}, executeOnce=True)
SPOT_HTML = ("={{ (() => { " + ESC + " const a = " + C + ".app_url; const f = $('Suspicious?').all().map(i => i.json);"
  " const items = f.map(x => `<li style=\"margin-bottom:8px\"><b>${esc(x.cre_name)}</b> on “${esc(x.brief_title)}” · risk <b>${x.verdict.risk}</b><br>${x.verdict.reasons.map(esc).join('<br>')}</li>`).join('');"
  " return `<div style=\"font-family:system-ui,sans-serif;max-width:560px\"><h2 style=\"margin:0 0 12px\">AI spot-check: ${f.length} pitch(es) to look at</h2><ul style=\"padding-left:18px\">${items}</ul><p><a href=\"${a}/admin/flags\">Open flags</a></p></div>`; })() }}")
gmail(w, "Email Findings", [2200, 0], "={{ 'Outlier Desk: AI flagged ' + $json.findings.length + ' pitch(es) to review' }}", SPOT_HTML)
w.chain("Schedule", "Config", "New Researchers' Pitches", "Any to Check?")
w.link("Any to Check?", "Gemini: Review Pitch", 0)
w.chain("Gemini: Review Pitch", "Read Verdict", "Reviewed?")
w.link("Reviewed?", "Mark Checked", 0)
w.link("Reviewed?", "Suspicious?", 0)
w.link("Suspicious?", "File Flag", 0)
w.chain("File Flag", "Bundle Findings", "Email Findings")
w.nodes = [n for n in w.nodes if n["name"] != "Collect Flagged"]
sticky(w, "## AI pitch spot-check · every 15 minutes\nChecks the **first 20 pitches of every new researcher** (numbers, source link vs platform, hook leaks, low-effort copy, contact details). Medium/high risk → a flag in **Admin → Flags** + an email. Each pitch is checked once.\n\n**Setup:** Gemini credential (Header Auth `x-goog-api-key`).", h=280)
w.save("03-ai-pitch-spot-check.json")

# ================= 4. Health monitor =================
w = WF("Outlier Desk Admin · Health Monitor", "ODAdminHealth001")
schedule(w, {"field": "minutes", "minutesInterval": 10})
config(w, [220, 0])
w.node("Ping Site", "n8n-nodes-base.httpRequest", 4.2, [440, 0], {"method": "GET", "url": f"={{{{ {C}.app_url }}}}/api/health",
    "options": {"timeout": 15000}}, onError="continueRegularOutput", alwaysOutputData=True, retryOnFail=True, maxTries=2, waitBetweenTries=10000,
    notes="Errors are kept as data (not failures) so the check below can report them.")
HEALTH_SQL = """with issues as (
  select 'site_down' as issue, 'Site is not responding' as title, $1::text as detail where $2::boolean = false
  union all
  select 'jobs_briefs', 'Scheduled jobs look stuck: briefs past their deadline are still open',
         count(*) || ' brief(s), oldest ' || round(extract(epoch from now() - min(deadline_at)) / 3600) || 'h overdue'
    from briefs where status = 'open' and deadline_at < now() - interval '2 hours' having count(*) > 0
  union all
  select 'jobs_holds', 'Scheduled jobs look stuck: researcher earnings not released',
         count(*) || ' earning(s) past their hold by 2h+'
    from unlocks where status = 'held' and available_at < now() - interval '2 hours' having count(*) > 0
  union all
  select 'refunds_pending', 'Refunds stuck in pending for over a day',
         count(*) || ' refund(s)'
    from refunds where status = 'pending' and created_at < now() - interval '24 hours' having count(*) > 0
)
select i.*, i.issue || ':' || to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD') || '-' || (extract(hour from now() at time zone 'Asia/Manila')::int / 6) as alert_key
  from issues i
 where not exists (select 1 from admin_alert_log l where l.kind = 'health'
                     and l.entity_id = i.issue || ':' || to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD') || '-' || (extract(hour from now() at time zone 'Asia/Manila')::int / 6))"""
pg(w, "Check Jobs & Site", [660, 0], HEALTH_SQL,
   replacement="={{ [ String($json.error?.message || ($json.ok === true ? 'ok' : 'Unexpected answer from /api/health')).slice(0, 300), $json.ok === true ] }}",
   always=True, notes="Each problem alerts at most once every 6 hours while it lasts.")
iff(w, "Any Problem?", [880, 0], cond("={{ $json.issue }}", "string", "notEmpty"))
w.node("Bundle Problems", "n8n-nodes-base.aggregate", 1, [1100, -100], {"aggregate": "aggregateAllItemData", "destinationFieldName": "problems", "options": {}})
HEALTH_HTML = ("={{ (() => { " + ESC + " const a = " + C + ".app_url;"
  " const items = $json.problems.map(p => `<li><b>${esc(p.title)}</b><br><span style=\"color:#555\">${esc(p.detail)}</span></li>`).join('');"
  " return `<div style=\"font-family:system-ui,sans-serif;max-width:560px\"><h2 style=\"margin:0 0 12px;color:#b42318\">Outlier Desk health problem</h2><ul style=\"padding-left:18px\">${items}</ul>`"
  " + `<p>Stuck jobs? Open <a href=\"${a}/admin\">Admin</a> and press <b>Run scheduled jobs now</b>, then check the Vercel cron logs.</p></div>`; })() }}")
gmail(w, "Email Problem", [1320, -100], "={{ 'Outlier Desk health: ' + $json.problems.map(p => p.title).join('; ').slice(0, 120) }}", HEALTH_HTML)
pg(w, "Remember Alert", [1540, -100],
   "insert into admin_alert_log(kind, entity_id)\nselect 'health', k from json_array_elements_text($1::json) k\non conflict do nothing",
   replacement="={{ [ JSON.stringify($('Bundle Problems').first().json.problems.map(p => p.alert_key)) ] }}")
w.chain("Schedule", "Config", "Ping Site", "Check Jobs & Site", "Any Problem?")
w.link("Any Problem?", "Bundle Problems", 0)
w.chain("Bundle Problems", "Email Problem", "Remember Alert")
sticky(w, "## Health monitor · every 10 minutes\nAlerts if the site's `/api/health` stops answering, or the scheduled jobs look stuck (overdue briefs still open, earnings not released, refunds stuck). Each problem emails at most once every 6 hours.")
w.save("04-health-monitor.json")

# ================= 5. Weekly report =================
w = WF("Outlier Desk Admin · Weekly Report", "ODAdminWeekly001")
schedule(w, {"field": "weeks", "triggerAtDay": [1], "triggerAtHour": 8, "triggerAtMinute": 30})
config(w, [220, 0], [a("sheet_id", "PASTE_GOOGLE_SHEET_ID")])
WEEK_SQL = """with r as (select now() - interval '7 days' as since)
select to_char((now() at time zone 'Asia/Manila')::date - 7, 'YYYY-MM-DD') as week_start,
  (select count(*) from profiles, r where created_at > r.since and role = 'creator')::int        as new_creators,
  (select count(*) from profiles, r where created_at > r.since and role = 'cre')::int            as new_researchers,
  (select count(*) from cre_profiles, r where kyc_status = 'approved' and kyc_reviewed_at > r.since)::int as researchers_verified,
  (select count(*) from briefs, r where opened_at > r.since)::int                                as briefs_live,
  (select count(*) from briefs, r where opened_at > r.since and invited_cre_id is not null)::int as private_briefs,
  (select count(*) from pitches, r where submitted_at > r.since)::int                            as pitches,
  (select count(*) from unlocks, r where created_at > r.since)::int                              as unlocks,
  (select round(100.0 * count(*) filter (where status = 'unlocked') / nullif(count(*) filter (where status <> 'withdrawn'), 0))
     from pitches, r where submitted_at > r.since)::int                                          as unlock_rate_pct,
  (select coalesce(sum(budget_cents), 0) from briefs, r where opened_at > r.since)::bigint       as gmv_cents,
  (select coalesce(sum(case when credit_account = 'platform:revenue' then amount_cents
                            when debit_account = 'platform:revenue' then -amount_cents end), 0)
     from ledger_entries, r where created_at > r.since)::bigint                                  as revenue_cents,
  (select coalesce(sum(amount_cents), 0) from payouts, r where paid_at > r.since)::bigint        as paid_out_cents,
  (select count(*) from disputes, r where opened_at > r.since)::int                              as disputes,
  (select count(*) from flags, r where created_at > r.since)::int                                as flags"""
pg(w, "Read Week", [440, 0], WEEK_SQL)
cols = ["week_start", "new_creators", "new_researchers", "researchers_verified", "briefs_live", "private_briefs", "pitches", "unlocks",
        "unlock_rate_pct", "gmv_cents", "revenue_cents", "paid_out_cents", "disputes", "flags"]
heads = {"week_start": "Week starting", "new_creators": "New creators", "new_researchers": "New researchers", "researchers_verified": "Researchers verified",
         "briefs_live": "Briefs live", "private_briefs": "Private briefs", "pitches": "Pitches", "unlocks": "Unlocks", "unlock_rate_pct": "Unlock rate %",
         "gmv_cents": "GMV ($)", "revenue_cents": "Revenue ($)", "paid_out_cents": "Paid out ($)", "disputes": "Disputes", "flags": "Flags"}
def colval(k): return f"={{{{ (Number($json.{k} || 0) / 100).toFixed(2) }}}}" if k.endswith("_cents") else f"={{{{ $json.{k} ?? 0 }}}}"
w.node("Add to Sheet", "n8n-nodes-base.googleSheets", 4.5, [660, -100], {"operation": "append",
    "documentId": {"__rl": True, "mode": "id", "value": f"={{{{ {C}.sheet_id }}}}"},
    "sheetName": {"__rl": True, "mode": "name", "value": "Weekly"},
    "columns": {"mappingMode": "defineBelow", "value": {heads[k]: colval(k) for k in cols}, "matchingColumns": [],
                "schema": [{"id": heads[k], "displayName": heads[k], "required": False, "defaultMatch": False, "display": True, "type": "string", "canBeUsedToMatch": True} for k in cols]},
    "options": {}}, notes="Tab 'Weekly' with these headers in row 1. One row per week, so you can chart growth.", **RETRY)
WEEK_HTML = ("={{ (() => { " + MONEY + " const d = $('Read Week').first().json; const L = " + json.dumps(heads) + ";"
  " const rows = " + json.dumps(cols[1:]) + ".map(k => `<tr><td style=\"padding:4px 16px 4px 0\">${L[k].replace(' ($)', '').replace(' %', '')}</td><td style=\"text-align:right;font-weight:600\">${k.endsWith('_cents') ? m(d[k]) : (d[k] ?? '–') + (k === 'unlock_rate_pct' && d[k] != null ? '%' : '')}</td></tr>`).join('');"
  " return `<div style=\"font-family:system-ui,sans-serif;max-width:520px\"><h2 style=\"margin:0 0 12px\">Outlier Desk · week of ${d.week_start}</h2><table>${rows}</table></div>`; })() }}")
gmail(w, "Email Report", [880, -100], "={{ 'Outlier Desk weekly: ' + $('Read Week').first().json.unlocks + ' unlocks, $' + (Number($('Read Week').first().json.revenue_cents) / 100).toFixed(2) + ' revenue' }}", WEEK_HTML)
w.chain("Schedule", "Config", "Read Week", "Add to Sheet", "Email Report")
sticky(w, "## Weekly report · Mondays 8:30 Manila\nLast 7 days (sign-ups, verifications, briefs, private briefs, pitches, unlocks, unlock rate, GMV, revenue, payouts, disputes, flags) → a new row in your Google Sheet + an email.\n\n**Setup:** Google Sheets credential; a tab named **Weekly** with the column headers from *Add to Sheet*.", h=280)
w.save("05-weekly-report.json")

# ================= 6. Error alerts =================
w = WF("Outlier Desk Admin · Error Alerts", "ODAdminErrors001")
w.node("Error Trigger", "n8n-nodes-base.errorTrigger", 1, [0, 0], {})
w.node("Email Error", "n8n-nodes-base.gmail", 2.1, [240, 0], {"sendTo": "PASTE_YOUR_EMAIL",
    "subject": "=n8n workflow failed: {{ $json.workflow.name }}",
    "message": "=<b>Workflow:</b> {{ $json.workflow.name }}<br><b>Failed step:</b> {{ $json.execution.lastNodeExecuted }}<br><b>Error:</b> {{ $json.execution.error.message }}<br><a href=\"{{ $json.execution.url }}\">Open the execution</a>",
    "options": {"appendAttribution": False}}, **RETRY)
w.link("Error Trigger", "Email Error")
sticky(w, "## Error alerts\nAll Outlier Desk admin workflows send failures here. **Publish this workflow** (n8n 2.x skips unpublished error workflows) and put your email in *Email Error*.", h=200)
w.save("06-error-alerts.json", error_wf=False)
