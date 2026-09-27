'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CornerDownLeft, Search } from 'lucide-react';
import { ICONS, type IconKey } from './app-nav';

export type Command = { id: string; label: string; href: string; icon: IconKey; group: string; keywords?: string };

/** ⌘K / Ctrl+K palette: jump anywhere or start a common action without the mouse. */
export function CommandPalette({ commands }: { commands: Command[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('od:open-palette', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('od:open-palette', onOpen); };
  }, []);
  useEffect(() => { if (open) { setQ(''); setI(0); setTimeout(() => input.current?.focus(), 0); } }, [open]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return commands;
    return commands.filter((c) => `${c.label} ${c.group} ${c.keywords ?? ''}`.toLowerCase().includes(t));
  }, [q, commands]);

  const go = useCallback((c: Command | undefined) => {
    if (!c) return;
    setOpen(false);
    router.push(c.href);
  }, [router]);

  if (!open) return null;
  let last = '';
  return (
    <div className="fixed inset-0 z-[60] grid items-start justify-items-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command menu">
      <button className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => setOpen(false)} />
      <div className="anim-pop relative w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-lg">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="size-4 text-muted" aria-hidden="true" />
          <input ref={input} id="palette-q" value={q} onChange={(e) => { setQ(e.target.value); setI(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
              if (e.key === 'Enter') { e.preventDefault(); go(results[i]); }
            }}
            placeholder="Search pages and actions…" aria-label="Search pages and actions"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted focus-visible:outline-none" />
          <span className="kbd">Esc</span>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox" aria-label="Results">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nothing matches “{q}”.</li>}
          {results.map((c, idx) => {
            const Icon = ICONS[c.icon];
            const header = c.group !== last ? (last = c.group) : null;
            return (
              <li key={c.id} role="option" aria-selected={idx === i}>
                {header && <div className="label px-3 pb-1 pt-2.5">{header}</div>}
                <button type="button" onMouseMove={() => setI(idx)} onClick={() => go(c)}
                  className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm ${idx === i ? 'bg-surface-2 text-ink' : 'text-ink-2'}`}>
                  <Icon className={`size-4 ${idx === i ? 'text-accent' : 'text-muted'}`} aria-hidden="true" />
                  <span className="flex-1">{c.label}</span>
                  {idx === i ? <CornerDownLeft className="size-3.5 text-muted" aria-hidden="true" /> : <ArrowRight className="size-3.5 opacity-0" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-muted">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> to move</span>
          <span><span className="kbd">↵</span> to open</span>
        </div>
      </div>
    </div>
  );
}
