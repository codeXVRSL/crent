// Parsing for numbers people type the way they read them on TikTok, YouTube and price tags.
// Shared by the forms (live preview) and the server actions (the real check), so both agree.

/**
 * View counts: "1300000", "1,300,000", "1 300 000", "1.3M", "92k", "92.5K", "1.2B".
 * Returns a whole number, or null if it isn't one (empty, negative, letters, "1500.5").
 */
export function parseViews(input: string): number | null {
  const s = input.trim().replace(/[\s,]/g, '').toLowerCase();
  const m = /^(\d+(?:\.\d+)?)([kmb])?$/.exec(s);
  if (!m) return null;
  const mult = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : m[2] === 'b' ? 1e9 : 1;
  const n = Number(m[1]) * mult;
  if (!m[2] && !Number.isInteger(n)) return null; // "1500.5" views isn't a thing
  const v = Math.round(n);
  return Number.isSafeInteger(v) ? v : null;
}

export const VIEWS_HINT = 'Use a whole number like 1300000, 1,300,000 or 1.3M.';

/**
 * Money in dollars → cents: "8", "8.5", "$8.50", "1,250.00". A comma is only accepted as a thousands
 * separator ("1,250"); "5,00" or "8,5" is rejected instead of being read as $500 or $85.
 */
export function parseDollarsToCents(input: string): number | null {
  const s = input.trim().replace(/^\$\s*/, '').replace(/\s/g, '');
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s.replace(/,/g, '')) * 100);
}

/** Today's date in the Philippines (YYYY-MM-DD). Used as the latest allowed "posted on" date. */
export function manilaToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
