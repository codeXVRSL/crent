/** Shared rules for the website chat assistant (used by the API route and the widget). */
export const CHAT_MAX_CHARS = 600;
export const CHAT_REPLY_MAX = 2000;

export type ChatRequest = { sessionId: string; message: string };

/** Validates the JSON body from the widget. Returns null when it's not acceptable. */
export function parseChatRequest(body: unknown): ChatRequest | null {
  if (!body || typeof body !== 'object') return null;
  const { sessionId, message } = body as Record<string, unknown>;
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(sessionId)) return null;
  if (typeof message !== 'string') return null;
  // Strip control characters (except newlines/tabs) before the length check.
  const clean = message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!clean || clean.length > CHAT_MAX_CHARS) return null;
  return { sessionId, message: clean };
}

/** Pulls the reply text out of the n8n response; anything unexpected becomes null. */
export function readReply(data: unknown): string | null {
  const reply = data && typeof data === 'object' ? (data as Record<string, unknown>).reply : null;
  if (typeof reply !== 'string' || !reply.trim()) return null;
  return reply.trim().slice(0, CHAT_REPLY_MAX);
}

/** Only accept requests sent by our own pages, so other sites can't use the assistant (and our AI budget). */
export function sameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
