export const PLATFORMS = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram_reels', label: 'Instagram Reels' },
  { value: 'youtube_shorts', label: 'YouTube Shorts' },
  { value: 'youtube_long', label: 'YouTube (long-form)' },
  { value: 'facebook_reels', label: 'Facebook Reels' },
  { value: 'other', label: 'Other' },
] as const;
export type Platform = (typeof PLATFORMS)[number]['value'];
export const platformLabel = (v: string) => PLATFORMS.find((p) => p.value === v)?.label ?? v;

export const HOOK_CATEGORIES = [
  { value: 'question', label: 'Question' },
  { value: 'bold_claim', label: 'Bold claim' },
  { value: 'number_list', label: 'Number / list' },
  { value: 'story', label: 'Story' },
  { value: 'before_after', label: 'Before and after' },
  { value: 'myth_bust', label: 'Myth bust' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'reaction', label: 'Reaction' },
  { value: 'pov', label: 'POV' },
  { value: 'challenge', label: 'Challenge' },
  { value: 'controversy', label: 'Controversial take' },
  { value: 'other', label: 'Other' },
] as const;
export const hookLabel = (v: string) => HOOK_CATEGORIES.find((h) => h.value === v)?.label ?? v;

export const SIZE_BANDS = ['<10k', '10k-50k', '50k-200k', '200k-1M', '1M+'] as const;

export const ID_TYPES = [
  { value: 'philsys', label: 'PhilSys National ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: "Driver's license" },
  { value: 'umid', label: 'UMID' },
  { value: 'prc', label: 'PRC ID' },
  { value: 'postal', label: 'Postal ID' },
  { value: 'voters', label: "Voter's ID" },
  { value: 'other', label: 'Other government ID' },
] as const;

export const DISPUTE_REASONS = [
  { value: 'source_dead', label: 'The source video is gone' },
  { value: 'stats_false', label: 'The views or median were wrong' },
  { value: 'not_matching_card', label: "The idea doesn't match the card" },
  { value: 'duplicate_of_other_unlock', label: 'Same idea as another unlock' },
  { value: 'instructions_missing', label: 'Instructions are missing or unusable' },
  { value: 'plagiarized', label: "Copied from someone else's write-up" },
  { value: 'other', label: 'Something else' },
] as const;

export const INSTRUCTIONS_TEMPLATE = `HOOK (0–3s):

ON-SCREEN TEXT:

SHOT LIST:
1.
2.
3.

KEY BEATS / SCRIPT:

CTA:

CAPTION + HASHTAGS:
`;

export const IDEA_STAGES = [
  { value: 'saved', label: 'To do' },
  { value: 'scripting', label: 'Scripting' },
  { value: 'filming', label: 'Filming' },
  { value: 'posted', label: 'Posted' },
  { value: 'skipped', label: 'Skipped' },
] as const;
export type IdeaStage = (typeof IDEA_STAGES)[number]['value'];
export const stageLabel = (v: string) => IDEA_STAGES.find((s) => s.value === v)?.label ?? v;

export const PASS_REASONS = [
  { value: 'not_my_style', label: "Not my style" },
  { value: 'seen_it', label: 'I already have this idea' },
  { value: 'score_too_low', label: 'Score too low for me' },
  { value: 'off_brief', label: "Doesn't match the brief" },
  { value: 'too_hard_to_film', label: 'Too hard for me to film' },
  { value: 'other', label: 'Something else' },
] as const;
export const passReasonLabel = (v: string) => PASS_REASONS.find((r) => r.value === v)?.label ?? v;

/** Starting points for the brief form. Creators edit everything before posting. */
export const BRIEF_TEMPLATES = [
  {
    id: 'talking-head',
    label: 'Talking-head tips',
    title: 'Talking-head tip videos for my audience',
    description: 'I film solo, face to camera, usually 30–45 seconds. I want ideas where one strong, specific tip carries the video. My audience is beginners who want quick wins. Great ideas have a clear promise in the first line and something visual I can show on screen.',
    must_include: 'Face on camera. Filmable alone at home or in one location.',
    avoid: 'Skits with more than one person. Anything that needs expensive gear.',
  },
  {
    id: 'storytime',
    label: 'Storytime',
    title: 'Storytime ideas that keep people to the end',
    description: 'I want outlier story videos: a personal or client story with a twist, told in under 60 seconds. Show me formats where the hook sets up a question that only the ending answers. Include why the pacing worked.',
    must_include: 'A clear open loop in the first 3 seconds.',
    avoid: 'Stories that depend on a famous person or private information.',
  },
  {
    id: 'tutorial',
    label: 'Tutorial / how-to',
    title: 'Step-by-step tutorial ideas that get saved',
    description: 'I teach practical skills. I want tutorial formats that got far more saves and views than the channel usually gets: numbered steps, before/after results, screen recordings with voice-over. Tell me the exact step structure.',
    must_include: 'A visible result at the start or end.',
    avoid: 'Tutorials longer than 90 seconds.',
  },
  {
    id: 'trend-remix',
    label: 'Trend remix',
    title: 'Recent trends I can remix for my niche',
    description: 'Find formats trending in the last few weeks (sounds, edits, memes) that a creator outside the niche turned into an outlier, and explain how to adapt the format to my topic. Speed matters, so recent sources only.',
    must_include: 'Source posted in the last 30 days.',
    avoid: 'Sounds that are only licensed for personal accounts.',
  },
] as const;
