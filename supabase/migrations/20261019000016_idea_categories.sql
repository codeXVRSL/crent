-- Outlier Desk — idea categories, the four content types researchers spread a batch across:
-- hero story, educational, entertaining, promotional. Shown before unlock, so creators can see the mix.

alter table pitches add column idea_category text not null default 'educational'
  check (idea_category in ('hero_story','educational','entertaining','promotional'));
grant select (idea_category) on pitches to authenticated;

-- submit_pitch gains a category. The old 16-argument form is dropped (a defaulted argument on a second
-- overload would make every existing call ambiguous); callers that leave it out get 'educational'.
drop function submit_pitch(uuid, content_platform, text, int, text, text, bigint, bigint, date, text, text, text, text, text, text, text);
create or replace function submit_pitch(
  p_brief_id uuid, p_platform content_platform, p_format_label text, p_duration_seconds int,
  p_hook_category text, p_teaser text, p_source_views bigint, p_channel_median_views bigint,
  p_source_posted_on date, p_source_channel_size_band text,
  p_source_url text, p_source_channel_url text, p_hook_text text, p_why_it_worked text,
  p_instructions text, p_adaptation_notes text, p_idea_category text default 'educational'
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare b briefs; s platform_settings; cp cre_profiles; v_mult numeric; v_count int; v_id uuid; v_key text; m record;
begin
  if my_role() is distinct from 'cre' then raise exception 'NOT_CRE'; end if;
  select * into cp from cre_profiles where user_id = auth.uid();
  if cp.kyc_status <> 'approved' then raise exception 'NOT_VERIFIED'; end if;
  if p_idea_category not in ('hero_story','educational','entertaining','promotional') then raise exception 'INVALID_CATEGORY'; end if;
  select * into s from platform_settings where id;
  select * into b from briefs where id = p_brief_id for share;
  if not found then raise exception 'BRIEF_NOT_FOUND'; end if;
  if b.status <> 'open' or b.deadline_at <= now() then raise exception 'BRIEF_NOT_OPEN'; end if;
  if b.creator_id = auth.uid() then raise exception 'NOT_ALLOWED'; end if;

  select count(*) into v_count from pitches where brief_id = b.id and cre_id = auth.uid() and status <> 'withdrawn';
  if v_count >= s.max_pitches_per_cre_per_brief then raise exception 'TOO_MANY_PITCHES'; end if;

  if p_source_views <= 0 or p_channel_median_views <= 0 then raise exception 'INVALID_VIEWS'; end if;
  v_mult := round(p_source_views::numeric / p_channel_median_views, 1);
  if v_mult < b.min_multiplier then raise exception 'MULTIPLIER_TOO_LOW'; end if;
  if p_source_posted_on > current_date then raise exception 'POSTED_DATE_IN_FUTURE'; end if;
  if b.max_video_age_days is not null and p_source_posted_on < current_date - b.max_video_age_days then
    raise exception 'SOURCE_TOO_OLD'; end if;

  select * into m from mask_contacts(coalesce(p_teaser,'') || ' ' || coalesce(p_format_label,''));
  if m.hit then raise exception 'CONTACT_DETAILS_NOT_ALLOWED'; end if;
  if position(lower(btrim(p_hook_text)) in lower(p_teaser)) > 0
     or similarity(lower(p_teaser), lower(p_hook_text)) > 0.5 then
    raise exception 'TEASER_REVEALS_HOOK';
  end if;

  v_key := source_key_from_url(p_source_url);
  begin
    insert into pitches(brief_id, cre_id, platform, format_label, duration_seconds, hook_category, teaser,
                        source_views, channel_median_views, source_posted_on, source_channel_size_band, source_key, idea_category)
    values (b.id, auth.uid(), p_platform, btrim(p_format_label), p_duration_seconds, p_hook_category, btrim(p_teaser),
            p_source_views, p_channel_median_views, p_source_posted_on, p_source_channel_size_band, v_key, p_idea_category)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'DUPLICATE_SOURCE';
  end;
  insert into pitch_secrets(pitch_id, source_url, source_channel_url, hook_text, why_it_worked, instructions, adaptation_notes)
  values (v_id, btrim(p_source_url), nullif(btrim(p_source_channel_url),''), btrim(p_hook_text), btrim(p_why_it_worked),
          btrim(p_instructions), nullif(btrim(p_adaptation_notes),''));

  perform notify(b.creator_id, 'new_pitch', 'New pitch on ' || b.title,
                 v_mult || '× · ' || btrim(p_format_label), '/briefs/' || b.id);
  return v_id;
end $$;
alter function submit_pitch(uuid, content_platform, text, int, text, text, bigint, bigint, date, text, text, text, text, text, text, text, text) set timezone = 'Asia/Manila';
revoke execute on function submit_pitch(uuid, content_platform, text, int, text, text, bigint, bigint, date, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function submit_pitch(uuid, content_platform, text, int, text, text, bigint, bigint, date, text, text, text, text, text, text, text, text) to authenticated;
