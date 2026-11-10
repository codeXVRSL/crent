// Profile photo helpers (pure; safe on server and client).
const PATH_RE = /^([0-9a-f-]{36})\/[A-Za-z0-9_-]{1,40}\.(jpg|png|webp)$/;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES: Record<string, 'jpg' | 'png' | 'webp'> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** True when the path is a photo inside this user's own folder (mirrors the database check). */
export function isValidAvatarPath(path: string, userId: string): boolean {
  const m = PATH_RE.exec(path);
  return !!m && m[1] === userId;
}

export function avatarUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base || !PATH_RE.test(path)) return null;
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/avatars/${path}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
