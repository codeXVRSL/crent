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

/** The four kinds of idea a healthy content batch spreads across. Shown before unlock. */
export const IDEA_CATEGORIES = [
  { value: 'hero_story', label: 'Hero story', hint: 'A personal or customer transformation, an origin story.' },
  { value: 'educational', label: 'Educational', hint: 'How-to, tips, myth-bust, explaining one thing well.' },
  { value: 'entertaining', label: 'Entertaining', hint: 'Funny, relatable, riding a trend.' },
  { value: 'promotional', label: 'Promotional', hint: 'Leads to an offer, a freebie or a clear call to action.' },
] as const;
export const categoryLabel = (v: string) => IDEA_CATEGORIES.find((c) => c.value === v)?.label ?? v;

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

/**
 * The write-up the creator gets after unlocking. Written to them as "you", in short plain sentences,
 * in the order they film: format, the first 3 seconds, how to edit, audio, rules, CTA, caption.
 */
export const INSTRUCTIONS_TEMPLATE = `STYLE / FORMAT:
(one line: simple clip + on-screen text, talking head, voice-over, screen recording)

HOOK (first 3 seconds):
• What you say:
• What's on screen (the first clip, with movement in the first frame):
• On-screen headline text, upper center, exactly as written:

HOW TO FILM AND EDIT (with seconds):
1.
2.
3.

AUDIO:
(the original sound and how to save it, or a trending sound to search for, and the music volume)

NOTES:
• Vertical 9:16, filling the screen.
• Keep it between __ and __ seconds.

CTA (include the word "Follow"):

CAPTION + HASHTAGS:

ADJUSTMENT NOTE (how to make it work with your setup):
`;

/**
 * Soft checks on a pitch write-up, shown while the researcher types. None of them block sending;
 * they catch the things creators complain about most: no "Follow" in the CTA, no timings,
 * sections of the template left empty, and writing about the creator instead of to them.
 */
// Lines the template itself contains never count as content, however the researcher edits around them.
const TEMPLATE_LINES = new Set(INSTRUCTIONS_TEMPLATE.split('\n').map((l) => l.trim()).filter(Boolean));

export function instructionWarnings(text: string): string[] {
  const out: string[] = [];
  const sections = new Map<string, string[]>();
  const body: string[] = [];
  let current = '';
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    // A heading is UPPER CASE words ending in a colon ("CTA:", "HOOK (first 3 seconds):"); text after the colon is content.
    const h = line.match(/^([A-Z][A-Z /+]+?)(?:\s*\([^)]*\))?:\s*(.*)$/);
    if (h) { current = h[1].trim(); if (!sections.has(current)) sections.set(current, []); }
    if (TEMPLATE_LINES.has(line)) continue;
    const content = h ? h[2] : line.replace(/^[•\-\d.)]+\s*/, '');
    if (!content) continue;
    body.push(content);
    if (current) sections.get(current)!.push(content);
  }
  const filled = (name: string) => (sections.has(name) ? sections.get(name)!.join(' ').trim() : null);
  const cta = filled('CTA');
  if (cta != null && !/follow/i.test(cta)) out.push('Add "Follow" to the CTA: it is the one ask that grows the account.');
  if (!/\b\d+\s*(s|sec|secs|seconds?)\b/i.test(body.join('\n'))) out.push('Say how long each part should be, in seconds.');
  const hook = filled('HOOK');
  if (hook != null && hook.length < 15) out.push("Fill in the hook: what's said and what's on screen in the first 3 seconds.");
  const filming = filled('HOW TO FILM AND EDIT');
  if (filming != null && filming.length < 20) out.push('Fill in the filming and editing steps.');
  if (/\b(the creator|the client)\s+(should|will|can|needs?|must|has to)\b|\b(he|she|they)\s+should\b/i.test(text)) out.push('Write to the creator as "you", not about them.');
  return out;
}

/** Drops setup lines the creator left as the template's hints, so researchers never read placeholders as answers. */
export function stripUnfilledSetup(description: string): string {
  return description.replace(/\r\n/g, '\n').split('\n').filter((l) => !SETUP_HINTS.has(l.trim())).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

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

/** A short block creators fill in so researchers can judge whether they can actually make the idea. */
export const SETUP_BLOCK = `My setup: (phone, tripod, ring light, camera)
Editing level: (beginner / comfortable with CapCut / advanced)
Tone: (calm, warm, bold, playful)
Hard no's: (dancing, skits, anything inauthentic)`;
/** The first setup line, used to tell whether a description already has the block. */
export const SETUP_MARKER = 'My setup:';
const SETUP_HINTS = new Set(SETUP_BLOCK.split('\n').map((l) => l.trim()));

/** Starting points for the brief form. Creators edit everything before posting. */
export const BRIEF_TEMPLATES = [
  {
    id: 'clip-text',
    label: 'Simple clip + text',
    title: 'Faceless clip-and-text ideas I can make in an hour',
    description: 'I don\'t show my face. I make short videos from one clip (my own B-roll or stock footage) with a headline on screen and a trending or calm sound. I want ideas where the on-screen text carries the video and the clip just needs movement in the first frame. Tell me the exact headline and where to get the clip.',
    must_include: 'Faceless. One clip plus on-screen text. Makeable in CapCut on a phone.',
    avoid: 'Anything that needs a face on camera, a crew or advanced editing.',
  },
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
    id: 'screen-recording',
    label: 'Screen recording',
    title: 'Screen-recording ideas that show exactly what to tap',
    description: 'I teach a tool or an app. My audience needs to see a hand doing it on screen, one task per video, with plain words and no jargon. I want ideas where the result is visible in the first 3 seconds and the steps are short enough to follow along.',
    must_include: 'A screen recording with the result shown first. One tool, one task, one win per video.',
    avoid: 'Fast-paced edits. Jargon without a plain-English explanation.',
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
