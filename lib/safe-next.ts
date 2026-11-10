// Where to send someone after login. Only same-site paths are allowed: no "//host", no "/\host",
// no control characters, and the parsed URL must stay on this site.
const PROBE = 'https://outlier-desk.invalid';

export function safeNext(next: unknown, fallback = '/dashboard'): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const u = new URL(next, PROBE);
    if (u.origin !== PROBE) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
