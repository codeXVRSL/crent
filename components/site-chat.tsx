'use client';
import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/ui';
import { CHAT_MAX_CHARS } from '@/lib/chat';

type Msg = { from: 'you' | 'bot'; text: string };

const STARTERS = ['How does it work?', 'How much does it cost?', 'How do researchers get paid?', 'Add me to the waitlist'];
const GREETING: Msg = { from: 'bot', text: "Hi! I'm the Outlier Desk assistant. Ask me how it works, pricing, or how to join as a creator or researcher." };

/** A visitor-scoped id so the assistant remembers the conversation. Kept for this tab only. */
function sessionId(): string {
  try {
    const k = 'od-chat-session';
    let v = sessionStorage.getItem(k);
    if (!v) { v = crypto.randomUUID(); sessionStorage.setItem(k, v); }
    return v;
  } catch {
    return crypto.randomUUID();
  }
}

export function SiteChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const sid = useRef<string>('');
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [msgs, open]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  async function send(raw: string) {
    const message = raw.trim();
    if (!message || busy) return;
    if (!sid.current) sid.current = sessionId();
    setMsgs((m) => [...m, { from: 'you', text: message }]);
    setText('');
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: sid.current, message }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = typeof data.reply === 'string' ? data.reply : "Sorry, I couldn't answer that. Please try again.";
      setMsgs((m) => [...m, { from: 'bot', text: reply }]);
    } catch {
      setMsgs((m) => [...m, { from: 'bot', text: 'Connection problem. Check your internet and try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed right-4 z-50" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
      {open && (
        <div role="dialog" aria-label="Chat with Outlier Desk" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          className="mb-3 flex h-[min(560px,calc(100vh-7rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="grid">
              <span className="font-semibold">Outlier Desk assistant</span>
              <span className="text-xs text-muted">AI answers · may make mistakes</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat"
              className="rounded-lg px-2 py-1 text-muted hover:bg-surface-2 hover:text-ink">✕</button>
          </div>
          <div ref={list} className="grid flex-1 content-start gap-2 overflow-y-auto p-4" aria-live="polite">
            {msgs.map((m, i) => (
              <p key={i} className={cx('max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
                m.from === 'you' ? 'justify-self-end bg-accent text-accent-ink' : 'justify-self-start bg-surface-2 text-ink')}>
                {m.text}
              </p>
            ))}
            {busy && <p className="justify-self-start rounded-2xl bg-surface-2 px-3 py-2 text-sm text-muted">Typing…</p>}
            {msgs.length === 1 && !busy && (
              <div className="mt-1 flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)}
                    className="rounded-full border border-line px-3 py-1 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink">{s}</button>
                ))}
              </div>
            )}
          </div>
          <form className="flex items-end gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <label htmlFor="site-chat-input" className="sr-only">Your message</label>
            <textarea id="site-chat-input" ref={input} value={text} rows={1} maxLength={CHAT_MAX_CHARS}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }}
              placeholder="Ask a question…"
              className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
            <button type="submit" disabled={busy || !text.trim()}
              className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-50">Send</button>
          </form>
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="ml-auto flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-semibold text-accent-ink shadow-lg hover:bg-accent-hover">
        {open ? 'Close' : 'Questions? Chat with us'}
      </button>
    </div>
  );
}
