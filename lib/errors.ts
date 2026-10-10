// Maps database error codes to messages people can act on.
const MESSAGES: Record<string, string> = {
  NOT_SIGNED_IN: 'Please sign in again.',
  ROLE_ALREADY_SET: 'Your account type is already set.',
  NOT_CREATOR: 'Only creator accounts can do this.',
  NOT_CRE: 'Only researcher accounts can do this.',
  NOT_ADMIN: 'Only admins can do this.',
  NOT_ALLOWED: "You don't have access to do that.",
  NOT_VERIFIED: 'Your verification must be approved before you can do this.',
  ALREADY_VERIFIED: "You're already verified.",
  ALREADY_PENDING: 'Your verification is already under review.',
  PORTFOLIO_TOO_SMALL: 'Add at least 3 portfolio finds before submitting for verification.',
  INVALID_MOBILE: 'Enter a Philippine mobile number like 09171234567 or +639171234567.',
  INVALID_UPLOAD_PATH: 'Upload your ID photos again.',
  REASON_REQUIRED: 'Add a reason so the person knows what to fix.',
  NOT_PENDING: 'This verification was already reviewed.',
  PRICE_OUT_OF_RANGE: 'Price per idea is outside the allowed range.',
  MAX_UNLOCKS_OUT_OF_RANGE: 'Max unlocks must be between 1 and 100.',
  DEADLINE_OUT_OF_RANGE: 'Pick a deadline between 1 and 30 days from now.',
  TOO_MANY_OPEN_BRIEFS: 'You have 10 open briefs. Close one before posting another.',
  CONTACT_DETAILS_NOT_ALLOWED: 'Remove emails, phone or account numbers, links, @handles and messaging app names (WhatsApp, Telegram, Viber…). Contact details stay private so both sides keep escrow protection.',
  BRIEF_NOT_FOUND: "We couldn't find that brief.",
  BRIEF_ALREADY_PAID: 'This brief is already paid for.',
  DEADLINE_TOO_CLOSE: 'The deadline is too close to pay for this brief. Post a new one.',
  BRIEF_NOT_OPEN: 'This brief is closed.',
  TOO_MANY_PITCHES: "You've reached the pitch limit for this brief.",
  INVALID_VIEWS: 'Views and median views must be greater than zero.',
  MULTIPLIER_TOO_LOW: "The outlier score is below this brief's minimum.",
  POSTED_DATE_IN_FUTURE: "The posted date can't be later than today.",
  NOT_THREAD_MEMBER: "You're not part of this conversation.",
  ROLE_CHANGE_NOT_ALLOWED: "Your account type can't be changed. Use a separate account for the other role.",
  INVALID_ROLE: 'Pick creator or researcher.',
  SOURCE_TOO_OLD: 'The source video is older than this brief allows.',
  TEASER_REVEALS_HOOK: 'Your teaser gives away the hook. Describe the angle without the exact words.',
  INVALID_SOURCE_URL: 'Enter the full link to the source video, starting with https://',
  DUPLICATE_SOURCE: 'Someone already pitched this video on this brief.',
  PITCH_NOT_FOUND: "We couldn't find that pitch.",
  PITCH_NOT_AVAILABLE: 'This pitch was withdrawn or already unlocked.',
  NOT_BRIEF_OWNER: 'Only the creator who posted this brief can unlock pitches.',
  NO_UNLOCKS_LEFT: "You've used all unlocks for this brief. Post a new brief to get more ideas.",
  PAYOUT_METHOD_NOT_FOUND: 'Add a payout method first.',
  PAYOUT_ALREADY_PENDING: 'You already have a payout in progress.',
  BELOW_MIN_PAYOUT: "Your available balance is below the withdrawal minimum.",
  PAYOUT_NOT_CANCELLABLE: 'This payout is already being processed.',
  PAYOUT_NOT_APPROVABLE: 'This payout was already handled.',
  UNLOCK_NOT_FOUND: "We couldn't find that unlock.",
  DISPUTE_WINDOW_CLOSED: 'The 72-hour dispute window for this idea has closed.',
  DISPUTE_NOT_FOUND: "We couldn't find that dispute.",
  DISPUTE_NOT_AWAITING_RESPONSE: 'This dispute is no longer waiting for your reply.',
  DISPUTE_NOT_OPEN: 'This dispute is already resolved.',
  ALREADY_REVIEWED: "You've already reviewed this.",
  CRE_NOT_FOUND: "We couldn't find that researcher, or they're not verified yet.",
  TOO_MANY_INVITES: 'You can invite up to 25 researchers to one brief.',
  RETAINER_NEEDS_FUNDED_BRIEF: 'Fund this brief first. A monthly brief repeats one that has been live.',
  RETAINER_DAY_OUT_OF_RANGE: 'Pick a day between 1 and 28.',
  TOO_MANY_RETAINERS: 'You can have up to 10 monthly briefs running. Pause or delete one first.',
  RETAINER_EXISTS: 'This brief already repeats monthly with that researcher.',
  RETAINER_NOT_FOUND: "We couldn't find that monthly brief.",
  RETAINER_NEEDS_RELATIONSHIP: 'Save this researcher or unlock one of their ideas first. Retainers are for people you already work with.',
  RETAINER_RESEARCHER_LEFT: 'The researcher left this monthly brief, so it can’t restart with them. Repeat the brief with someone else.',
  VARIATION_ALREADY_REQUESTED: "You've already asked for a variation on this idea. It's one per unlock.",
  VARIATION_ALREADY_ANSWERED: 'This variation was already answered.',
  VARIATION_NOT_FOUND: "We couldn't find that variation request.",
  VARIATION_NOTE_TOO_SHORT: 'Say what you want changed in at least 10 characters.',
  VARIATION_RESPONSE_TOO_SHORT: 'Write the variation in at least 10 characters.',
  ACCOUNT_SUSPENDED: 'Your account is suspended, so this is not available. Contact support if you think this is a mistake.',
  CRE_SUSPENDED: 'This researcher\'s account is suspended, so their ideas can\'t be unlocked right now. Nothing was charged.',
  ADMIN_CANNOT_CLOSE: 'Admin accounts are closed by another admin.',
  EARNINGS_PENDING: 'You still have earnings on hold or available. Withdraw them first, then close the account.',
  PAYOUT_PENDING: 'A withdrawal is still being processed. Close the account once it has been paid.',
  BRIEF_OPEN: 'You still have a live or unpaid brief. Close it (unused budget is refunded) and wait for the refund, then try again.',
  DISPUTE_OPEN: 'An open dispute involves this account. It can be closed once the dispute is resolved.',
};

export function friendlyError(err: unknown): string {
  const raw = typeof err === 'string' ? err : (err as { message?: string })?.message ?? '';
  const code = Object.keys(MESSAGES).find((k) => raw === k || raw.startsWith(k));
  if (code) return MESSAGES[code];
  if (raw.includes('duplicate key') && raw.includes('handle')) return 'That handle is taken. Try another.';
  if (raw.includes('violates check constraint')) {
    // e.g. 'violates check constraint "pitches_format_label_check"' → name the field so people know what to fix
    const m = raw.match(/constraint "([a-z_]+)_check"/);
    const names: Record<string, string> = {
      instructions: 'Instructions', hook_text: 'Hook', teaser: 'Angle (teaser)', why_it_worked: 'Why it worked', adaptation_notes: 'How to adapt it',
      format_label: 'Format', title: 'Title', description: 'What you need', must_include: 'Must include', avoid: 'Avoid', bio: 'About you',
      headline: 'Headline', display_name: 'Display name', handle: 'Handle', notes: 'Notes', body: 'Message', details: 'Details', source_url: 'Video link',
      reviews_body: 'Review', source_channel_url: 'Channel link', channel_url: 'Channel link', account_name: 'Account name', board: 'Board',
      note: 'Note', result_note: 'Result', brand_name: 'Brand or channel name', posted_url: 'Posted link', reason: 'Reason',
    };
    // Longest key first so "source_channel_url" wins over "channel_url", and a table-specific key over a column.
    const col = Object.keys(names).sort((a, b) => b.length - a.length).find((k) => m?.[1] === k || m?.[1]?.endsWith('_' + k));
    const field = col ? names[col] : m?.[1]?.split('_').slice(-1)[0];
    console.error('[check constraint]', raw);
    return field ? `${field}: too short, too long or in the wrong format. Check the limit shown under that field.` : 'Some fields are too short or too long. Check the limits under each field.';
  }
  console.error('[unmapped error]', raw);
  return 'That didn’t work. Try again, and contact support if it keeps happening.';
}

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };
export const fail = (message: string): ActionResult => ({ ok: false, message });
