// Automatic check of a pitch's claimed YouTube stats against the YouTube Data API.
// Off unless YOUTUBE_API_KEY is set. Pure helpers here; lib/views-check.ts records the result.

export type ViewsCheck = 'verified' | 'mismatch' | 'not_found';
type ViewsCheckResult = { status: ViewsCheck; actualViews: number | null; actualPostedOn: string | null };

const ID = /^[A-Za-z0-9_-]{11}$/;

/** The 11-character video ID from any common YouTube link (watch, youtu.be, shorts, live, embed, mobile). */
export function youtubeVideoId(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const [, kind, rest] = u.pathname.split('/');
      if (['shorts', 'live', 'embed', 'v'].includes(kind)) id = rest ?? null;
    }
  }
  return id && ID.test(id) ? id : null;
}

/** Views rarely go down, so a small drop is allowed (YouTube removes spam views); anything below this share of the claim is a mismatch. */
const VIEWS_TOLERANCE = 0.9;
/** Days the post date may differ by (the researcher's time zone versus YouTube's UTC timestamp). */
const DATE_TOLERANCE_DAYS = 2;

/** Compares what the researcher claimed with what YouTube reports. */
export function compareStats(claimed: { views: number; postedOn: string }, actual: { views: number; publishedAt: string }): ViewsCheck {
  const actualDay = Date.parse(actual.publishedAt.slice(0, 10) + 'T00:00:00Z');
  const claimedDay = Date.parse(claimed.postedOn + 'T00:00:00Z');
  const dateOk = Number.isFinite(actualDay) && Number.isFinite(claimedDay) && Math.abs(actualDay - claimedDay) <= DATE_TOLERANCE_DAYS * 86_400_000;
  return dateOk && actual.views >= claimed.views * VIEWS_TOLERANCE ? 'verified' : 'mismatch';
}

/**
 * Looks the video up. Returns null when the check could not run (not a YouTube link, no key, network
 * or quota error), so a pitch is never marked wrong because YouTube was unreachable.
 */
export async function checkYouTubeStats(
  claimed: { url: string; views: number; postedOn: string },
  key: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<ViewsCheckResult | null> {
  const id = youtubeVideoId(claimed.url);
  if (!key || !id) return null;
  try {
    // YOUTUBE_API_BASE exists only so end-to-end tests can point at a local stand-in.
    const base = process.env.YOUTUBE_API_BASE ?? 'https://www.googleapis.com';
    const res = await fetchImpl(`${base}/youtube/v3/videos?part=statistics,snippet&id=${id}&key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json() as { items?: { statistics?: { viewCount?: string }; snippet?: { publishedAt?: string } }[] };
    const item = body.items?.[0];
    if (!item) return { status: 'not_found', actualViews: null, actualPostedOn: null };
    const views = Number(item.statistics?.viewCount);
    const publishedAt = item.snippet?.publishedAt ?? '';
    if (!Number.isFinite(views)) return null; // the channel hides its view count
    return { status: compareStats(claimed, { views, publishedAt }), actualViews: views, actualPostedOn: publishedAt.slice(0, 10) || null };
  } catch {
    return null;
  }
}
