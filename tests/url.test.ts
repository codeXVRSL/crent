import { describe, expect, it } from 'vitest';
import { isHttps, toHttps } from '../lib/url';

describe('toHttps', () => {
  it('upgrades http and scheme-less links', () => {
    expect(toHttps('http://tiktok.com/@a/video/1')).toBe('https://tiktok.com/@a/video/1');
    expect(toHttps('HTTPS://youtube.com/shorts/x')).toBe('https://youtube.com/shorts/x');
    expect(toHttps('  www.instagram.com/reel/abc ')).toBe('https://www.instagram.com/reel/abc');
  });
  it('leaves dangerous or unknown schemes alone so they get rejected', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x.com/a']) {
      expect(isHttps(toHttps(bad))).toBe(false);
    }
  });
});
