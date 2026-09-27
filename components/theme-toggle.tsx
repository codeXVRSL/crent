'use client';
import { useEffect, useState } from 'react';

type Mode = 'system' | 'light' | 'dark';
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
    <label className="flex items-center gap-2 text-xs text-muted">
      <span className="sr-only">Theme</span>
      <select id="theme" value={mode} onChange={(e) => apply(e.target.value as Mode)}
        className="rounded border border-line bg-surface px-2 py-1 text-xs text-ink">
        <option value="system">System theme</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
