/** Every pitch column a signed-in user may read (source_key is database-only). Use instead of select('*'). */
export const PITCH_COLUMNS = 'id, brief_id, cre_id, status, platform, format_label, duration_seconds, hook_category, teaser, source_views, channel_median_views, multiplier, source_posted_on, source_channel_size_band, submitted_at, unlocked_at, views_check';
