/**
 * Normalizes a pasted link to https. The database only stores https links (so a stored link can
 * never be a javascript: or data: URL), so http:// and scheme-less links like "tiktok.com/@x" are
 * upgraded here. Anything else is returned unchanged and will be rejected.
 */
export function toHttps(raw: string): string {
  const u = raw.trim();
  if (!u) return u;
  const m = /^https?:\/\/(.*)$/i.exec(u);
  if (m) return `https://${m[1]}`;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(u)) return `https://${u}`;
  return u;
}

export const isHttps = (u: string) => /^https:\/\/[^\s]+$/.test(u);
