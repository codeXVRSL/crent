import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { allow, clientIp } from '@/lib/rate-limit';
import { parseChatRequest, readReply, sameOrigin } from '@/lib/chat';

const FALLBACK = "Sorry, I can't answer right now. You can read our Help page, or email us and we'll get back to you.";

/**
 * Website chat assistant. The browser talks only to this route; it forwards to the n8n workflow with a
 * shared secret, so the n8n address and secret never reach visitors, and every request is rate-limited.
 */
export async function POST(req: Request) {
  if (!env.chatEnabled) return NextResponse.json({ error: 'disabled' }, { status: 404 });
  if (!sameOrigin(req.headers.get('origin'), req.headers.get('host'))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const input = parseChatRequest(await req.json().catch(() => null));
  if (!input) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const ip = await clientIp();
  if (!(await allow('chat', ip)) || !(await allow('chatDaily', ip)))
    return NextResponse.json({ reply: "You've sent a lot of messages. Please wait a few minutes before asking more." }, { status: 429 });

  try {
    const res = await fetch(env.chatWebhookUrl!, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-chat-secret': env.chatSecret! },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    });
    const reply = res.ok ? readReply(await res.json().catch(() => null)) : null;
    if (!reply) console.error('[chat] n8n returned', res.status);
    return NextResponse.json({ reply: reply ?? FALLBACK });
  } catch (e) {
    console.error('[chat]', e);
    return NextResponse.json({ reply: FALLBACK });
  }
}
