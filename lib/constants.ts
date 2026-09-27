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
