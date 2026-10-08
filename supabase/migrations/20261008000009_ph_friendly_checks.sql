-- Outlier Desk — fewer false alarms in forms used from the Philippines.

-- 1. "Posted on" dates are checked against today's date in the Philippines, not UTC. Between midnight
--    and 8 am Manila time, UTC is still on yesterday, so a video posted this morning was rejected.
alter function submit_pitch set timezone = 'Asia/Manila';
alter function save_idea_tracking set timezone = 'Asia/Manila';
alter table swipe_items drop constraint if exists swipe_items_source_posted_on_check;
alter table swipe_items add constraint swipe_items_source_posted_on_check
  check (source_posted_on <= (now() at time zone 'Asia/Manila')::date);

-- 2. Payment app names (GCash, PayPal, Maya...) are everyday topics for Filipino finance creators
--    ("Budgeting with GCash"), so they no longer count as contact details on their own. Account numbers,
--    emails, links and handles are still caught by the other patterns; messaging apps still count.
create or replace function mask_contacts(p_text text, out masked text, out hit boolean)
language plpgsql immutable as $$
declare
  patterns text[] := array[
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}',                                    -- email
    '[a-z0-9._-]+\s*(\(at\)|\[at\]| at )\s*[a-z0-9-]+\s*(\(dot\)|\[dot\]| dot )\s*[a-z]{2,}', -- spelled-out email
    'https?://\S+',                                                                      -- url
    'www\.\S+',
    '\m[a-z0-9-]+\.(com|net|org|io|co|me|ph|ly|gg|link|bio|app|xyz|to)\M(/\S*)?',        -- bare domain
    '(\+?63|\m0)[\s.-]*9\d{2}[\s.-]*\d{3}[\s.-]*\d{4}',                                  -- PH mobile
    '\+\d{1,3}[\s.-]*\(?\d{2,4}\)?[\s.-]*\d{3,4}[\s.-]*\d{3,4}',                         -- international
    '\m(whatsapp|telegram|viber|discord|skype|wechat)\M'                       -- messaging apps
  ];
  p text;
begin
  masked := coalesce(p_text, '');
  foreach p in array patterns loop
    masked := regexp_replace(masked, p, '[hidden]', 'gi');
  end loop;
  masked := regexp_replace(masked, '(^|\s)@[A-Za-z0-9_.]{3,}', '\1[hidden]', 'g');     -- @handles
  hit := masked is distinct from coalesce(p_text, '');
end $$;
