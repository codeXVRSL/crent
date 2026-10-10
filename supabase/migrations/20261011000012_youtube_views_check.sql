-- Outlier Desk — automatic YouTube views check on pitches.
-- When the app has a YouTube Data API key, it looks up the source video right after a pitch is
-- submitted and records whether the claimed views and post date match. Everyone who can see the
-- pitch sees the result (a badge); the real numbers stay with admins, since an exact view count
-- could help someone find the locked video.

alter table pitches
  add column views_check            text check (views_check in ('verified','mismatch','not_found')),
  add column views_checked_at       timestamptz,
  add column views_check_actual     bigint,
  add column views_check_posted_on  date;

grant select (views_check, views_checked_at) on pitches to authenticated;
-- views_check_actual and views_check_posted_on are written and read with the service key only.
