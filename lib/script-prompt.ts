import { hookLabel, platformLabel } from './constants';

type Idea = {
  platform: string; format_label: string; hook_category: string; duration_seconds: number | null; teaser: string;
  multiplier: number | string; hook_text: string; why_it_worked: string; instructions: string; adaptation_notes: string | null;
};

/** A ready-to-paste prompt for any AI writing assistant. Text only; nothing is sent anywhere. */
export function buildScriptPrompt(i: Idea, creator?: { brand?: string | null; audience?: string | null; voice?: string | null; avoid_topics?: string | null }): string {
  const lines = [
    `Write a ${platformLabel(i.platform)} script${i.duration_seconds ? ` of about ${i.duration_seconds} seconds` : ''} based on a proven outlier video.`,
    creator?.brand ? `It's for my channel: ${creator.brand}.` : '',
    creator?.audience ? `My audience: ${creator.audience}` : '',
    creator?.voice ? `My voice and style: ${creator.voice}` : '',
    creator?.avoid_topics ? `Never mention: ${creator.avoid_topics}` : '',
    '',
    `The original got ${Number(i.multiplier).toFixed(1)}× its channel's usual views.`,
    `Format: ${i.format_label}`,
    `Hook type: ${hookLabel(i.hook_category)}`,
    `Original hook: "${i.hook_text}"`,
    `Angle: ${i.teaser}`,
    '',
    'Why it worked:',
    i.why_it_worked,
    '',
    "Researcher's filming notes:",
    i.instructions,
    i.adaptation_notes ? `\nHow to adapt it:\n${i.adaptation_notes}` : '',
    '',
    'Give me:',
    '1. Five alternative hooks for the first 3 seconds, same hook type, in my own words (not a copy of the original).',
    '2. A beat-by-beat script with on-screen text for each beat.',
    '3. A shot list I can film on my phone.',
    '4. One call to action and a caption with 3–5 hashtags.',
    'Keep what made the original work, but make it clearly my own take.',
  ];
  return lines.filter((l, idx, arr) => !(l === '' && arr[idx - 1] === '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
