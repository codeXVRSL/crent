import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkYouTubeStats, compareStats, youtubeVideoId } from '../lib/youtube';
vi.mock('server-only', () => ({}));

const ID = 'dQw4w9WgXcQ';
const ok = (items: unknown[]) => vi.fn(async () => new Response(JSON.stringify({ items })));
const video = (views: string | undefined, publishedAt = '2026-09-01T15:00:00Z') => ({ statistics: views === undefined ? {} : { viewCount: views }, snippet: { publishedAt } });
const claim = { url: `https://youtu.be/${ID}`, views: 1_000_000, postedOn: '2026-09-01' };

describe('youtubeVideoId', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://youtube.com/live/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `  https://music.youtube.com/watch?v=${ID}  `,
  ])('reads %s', (url) => expect(youtubeVideoId(url)).toBe(ID));

  it.each([
    'https://www.tiktok.com/@a/video/123',
    'https://evil.example/watch?v=' + ID,
    'https://youtube.com.evil.example/watch?v=' + ID,
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/@channel',
    'not a url',
  ])('rejects %s', (url) => expect(youtubeVideoId(url)).toBeNull());
});

describe('compareStats', () => {
  it('passes when views are at least the claim and the date matches', () => {
    expect(compareStats({ views: 100, postedOn: '2026-09-01' }, { views: 150, publishedAt: '2026-09-01T23:00:00Z' })).toBe('verified');
  });
  it('allows a small drop in views and a time-zone day', () => {
    expect(compareStats({ views: 100, postedOn: '2026-09-02' }, { views: 91, publishedAt: '2026-09-01T20:00:00Z' })).toBe('verified');
  });
  it('flags inflated views', () => {
    expect(compareStats({ views: 100, postedOn: '2026-09-01' }, { views: 89, publishedAt: '2026-09-01T00:00:00Z' })).toBe('mismatch');
  });
  it('flags a wrong post date', () => {
    expect(compareStats({ views: 100, postedOn: '2026-08-01' }, { views: 500, publishedAt: '2026-09-01T00:00:00Z' })).toBe('mismatch');
  });
});

describe('checkYouTubeStats', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does nothing without a key or for other platforms', async () => {
    const f = ok([video('1')]);
    expect(await checkYouTubeStats(claim, undefined, f)).toBeNull();
    expect(await checkYouTubeStats({ ...claim, url: 'https://www.tiktok.com/@a/video/1' }, 'k', f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('asks for the right video and reports a match', async () => {
    const f = ok([video('1200000')]);
    expect(await checkYouTubeStats(claim, 'k&x', f)).toEqual({ status: 'verified', actualViews: 1_200_000, actualPostedOn: '2026-09-01' });
    const url = String((f.mock.calls[0] as unknown[])[0]);
    expect(url).toContain(`id=${ID}`);
    expect(url).toContain('key=k%26x');
    expect(url.startsWith('https://www.googleapis.com/youtube/v3/videos?')).toBe(true);
  });

  it('reports a mismatch with the real numbers', async () => {
    expect(await checkYouTubeStats(claim, 'k', ok([video('40000')]))).toEqual({ status: 'mismatch', actualViews: 40_000, actualPostedOn: '2026-09-01' });
  });

  it('reports a missing video', async () => {
    expect(await checkYouTubeStats(claim, 'k', ok([]))).toEqual({ status: 'not_found', actualViews: null, actualPostedOn: null });
  });

  it('never judges a pitch when YouTube fails or hides the count', async () => {
    expect(await checkYouTubeStats(claim, 'k', vi.fn(async () => new Response('quota', { status: 403 })))).toBeNull();
    expect(await checkYouTubeStats(claim, 'k', vi.fn(async () => { throw new Error('network'); }))).toBeNull();
    expect(await checkYouTubeStats(claim, 'k', vi.fn(async () => new Response('not json')))).toBeNull();
    expect(await checkYouTubeStats(claim, 'k', ok([video(undefined)]))).toBeNull();
  });
});

describe('runViewsCheck', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.doUnmock('@/lib/supabase/admin'); });

  async function setup(items: unknown[]) {
    const updates: unknown[] = [], flags: unknown[] = [];
    const row = (table: string) => table === 'pitches'
      ? { cre_id: 'cre-1', source_views: 1_000_000, source_posted_on: '2026-09-01' }
      : { source_url: `https://www.youtube.com/watch?v=${ID}` };
    vi.doMock('@/lib/supabase/admin', () => ({
      createAdminClient: () => ({
        from: (table: string) => ({
          select: () => ({ eq: () => ({ single: async () => ({ data: row(table) }) }) }),
          update: (v: unknown) => { updates.push(v); return { eq: async () => ({}) }; },
          insert: async (v: unknown) => { flags.push(v); return {}; },
        }),
      }),
    }));
    const { runViewsCheck } = await import('../lib/views-check');
    const f = ok(items);
    return { run: () => runViewsCheck('pitch-1', f), updates, flags, f };
  }

  it('is off without YOUTUBE_API_KEY', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', '');
    const s = await setup([video('2000000')]);
    await s.run();
    expect(s.f).not.toHaveBeenCalled();
    expect(s.updates).toHaveLength(0);
  });

  it('records a match without a flag', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'k');
    const s = await setup([video('2000000')]);
    await s.run();
    expect(s.updates).toEqual([expect.objectContaining({ views_check: 'verified', views_check_actual: 2_000_000, views_check_posted_on: '2026-09-01' })]);
    expect(s.flags).toHaveLength(0);
  });

  it('records a mismatch and opens a flag for the admins', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'k');
    const s = await setup([video('30000')]);
    await s.run();
    expect(s.updates).toEqual([expect.objectContaining({ views_check: 'mismatch' })]);
    expect(s.flags).toEqual([expect.objectContaining({ kind: 'fake_proof', subject_user: 'cre-1', entity_type: 'pitch', entity_id: 'pitch-1' })]);
    expect((s.flags[0] as { excerpt: string }).excerpt).toContain('YouTube shows 30k views');
  });
});
