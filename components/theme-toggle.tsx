'use client';
import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

type Mode = 'system' | 'light' | 'dark';
const OPTIONS: { mode: Mode; label: string; Icon: typeof Sun }[] = [
  { mode: 'system', label: 'System theme', Icon: Monitor },
  { mode: 'light', label: 'Light theme', Icon: Sun },
  { mode: 'dark', label: 'Dark theme', Icon: Moon },
];

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('system');
  useEffect(() => {
    try { const t = localStorage.getItem('od-theme'); if (t === 'light' || t === 'dark') setMode(t); } catch {}
  }, []);
  function apply(m: Mode) {
    setMode(m);
    const root = document.documentElement;
    if (m === 'system') delete root.dataset.theme; else root.dataset.theme = m;
    try { if (m === 'system') localStorage.removeItem('od-theme'); else localStorage.setItem('od-theme', m); } catch {}
  }
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-2xl border border-line bg-surface shadow-sm-2 p-0.5">
      {OPTIONS.map(({ mode: m, label, Icon }) => (
        <button key={m} type="button" role="radio" aria-checked={mode === m} aria-label={label} title={label} onClick={() => apply(m)}
          className={`grid size-7 place-items-center rounded-md transition-colors duration-150 ${mode === m ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
