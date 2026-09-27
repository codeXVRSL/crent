-- Brief with 1 unlock slot and 2 pitches; two sessions then try to unlock at the same moment.
\set QUIET 1
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set r1 '00000000-0000-0000-0000-0000000000e1'
\set r2 '00000000-0000-0000-0000-0000000000e2'
select set_config('request.jwt.claim.sub', :'c1', false) \gset
set role authenticated;
select create_brief('Race condition brief test', repeat('Only one unlock slot is available here. ', 2),
  'tiktok', 1, null, null, '{}', 3.0, null, 1000, 1, now() + interval '2 days') as b3 \gset
select external_id as ext3 from prepare_brief_payment(:'b3', 'mock') \gset
reset role;
set role service_role; select mark_payment_paid(:'ext3', 'prov_3', 1050, 'card') \gset
reset role;
select set_config('request.jwt.claim.sub', :'r1', false) \gset
set role authenticated;
select submit_pitch(:'b3','tiktok','Format one',30,'story','A teaser about the first racing idea here',900000,90000,current_date-3,null,
  'https://www.tiktok.com/@r/video/5550001',null,'Hook number one words','Why it worked explanation long enough here.',repeat('Instructions long enough to pass. ',3),null) as p1 \gset
reset role;
select set_config('request.jwt.claim.sub', :'r2', false) \gset
set role authenticated;
select submit_pitch(:'b3','tiktok','Format two',30,'story','A teaser about the second racing idea here',900000,90000,current_date-3,null,
  'https://www.tiktok.com/@r/video/5550002',null,'Hook number two words','Why it worked explanation long enough here.',repeat('Instructions long enough to pass. ',3),null) as p2 \gset
reset role;
create table race_ids as select :'b3'::uuid as brief_id, :'p1'::uuid as p1, :'p2'::uuid as p2;
