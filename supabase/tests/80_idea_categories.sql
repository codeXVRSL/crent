-- Idea categories on pitches. Reuses the open brief and verified researchers from earlier tests.
\set ON_ERROR_STOP 1
\set QUIET 1
-- Any verified researcher and an open brief they have not pitched on yet.
select c.user_id as r3 from cre_profiles c join profiles pr on pr.id = c.user_id
 where c.kyc_status = 'approved' and pr.suspended_at is null and pr.role = 'cre' order by c.user_id limit 1 \gset
select b.id as ob from briefs b where b.status = 'open' and b.deadline_at > now() and b.creator_id <> :'r3'
  and not exists (select 1 from pitches p where p.brief_id = b.id and p.cre_id = :'r3') limit 1 \gset
select set_config('my.ob', :'ob', false) \gset
select set_config('request.jwt.claim.sub', :'r3', false); set role authenticated;
select submit_pitch(:'ob', 'tiktok', 'Origin story to camera', 45, 'story', 'How a missed rent payment became a budgeting system',
  900000, 50000, current_date - 3, '10k-50k', 'https://www.tiktok.com/@cat/video/9100000000000000001', null,
  'The month I could not pay rent changed how I budget', 'A real low point in the first line makes people stay for the turnaround.',
  'HOOK: say the line to camera, 3 seconds. HOW TO FILM AND EDIT: 1. Face to camera for 20 seconds. CTA: Follow for the full system.', null, 'hero_story') as hp \gset
select case when idea_category = 'hero_story' then '✓ a pitch carries its idea category' else 'FAIL: category ' || idea_category end from pitches where id = :'hp';
select submit_pitch(:'ob', 'tiktok', 'Quick tip', 30, 'number_list', 'Three app settings that quietly save money every month',
  800000, 50000, current_date - 3, '10k-50k', 'https://www.tiktok.com/@cat/video/9100000000000000002', null,
  'Turn these three settings off tonight', 'A numbered promise with an instant payoff gets saved and shared.',
  'HOOK: say the line, 3 seconds. HOW TO FILM AND EDIT: 1. Screen recording for 15 seconds. CTA: Follow and save this.', null) as dp \gset
select case when idea_category = 'educational' then '✓ leaving the category out means educational' else 'FAIL: default ' || idea_category end from pitches where id = :'dp';
do $$ begin
  perform submit_pitch(current_setting('my.ob')::uuid, 'tiktok', 'Odd one', 30, 'story', 'A category that does not exist should be refused',
    800000, 50000, current_date - 3, '10k-50k', 'https://www.tiktok.com/@cat/video/9100000000000000003', null,
    'Nobody says this out loud', 'Long enough reason to pass the minimum length check for this test.', 'HOOK: one. HOW TO FILM: two. CTA: Follow.', null, 'viral');
  raise exception 'FAIL: unknown category accepted';
exception when others then if sqlerrm <> 'INVALID_CATEGORY' then raise; end if; end $$;
\echo '✓ unknown categories are refused'
reset role;
-- The brief's creator sees the category on locked pitches (it is part of the proof, not the secret).
select creator_id as oc from briefs where id = :'ob' \gset
select set_config('request.jwt.claim.sub', :'oc', false); set role authenticated;
select case when (select idea_category from pitches where id = :'hp') = 'hero_story' then '✓ creators see the category before unlocking' else 'FAIL: category hidden' end;
reset role;

-- Weekly earnings: only the researcher's own unlocks, 12 Monday weeks.
select u.cre_id as ec from unlocks u where u.status <> 'reversed' group by u.cre_id order by count(*) desc limit 1 \gset
select set_config('request.jwt.claim.sub', :'ec', false); set role authenticated;
select case when count(*) = 12 and extract(isodow from min(week_start)) = 1
             and (select sum(earned_cents) from my_weekly_earnings(12)) = (select coalesce(sum(net_cents), 0) from unlocks where cre_id = :'ec' and status <> 'reversed' and created_at >= (select min(week_start) from manila_weeks(12))::timestamp at time zone 'Asia/Manila')
  then '✓ weekly earnings: 12 Monday weeks, own unlocks only' else 'FAIL: weekly earnings ' || count(*) end from my_weekly_earnings(12);
reset role;
select set_config('request.jwt.claim.sub', :'r3', false); set role authenticated;
select case when (select coalesce(sum(earned_cents), 0) from my_weekly_earnings(12)) = (select coalesce(sum(net_cents), 0) from unlocks where cre_id = :'r3' and status <> 'reversed')
  then '✓ weekly earnings never include another researcher''s money' else 'FAIL: cross-researcher earnings' end;
reset role;
