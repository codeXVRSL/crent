'use client';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); } catch { /* clipboard blocked */ }
  }
  return (
    <button type="button" onClick={copy} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[12px] text-ink-2 hover:bg-surface-2">
      {done ? <Check className="size-3.5 text-good" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {done ? 'Copied' : label}
    </button>
  );
}
