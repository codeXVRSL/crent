'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Banknote, Bell, CreditCard, FileText, Flag, Gauge, Inbox, LayoutDashboard, LockOpen, Menu, MessageSquare,
  Scale, Search, Settings, ShieldCheck, Sparkles, Users, Wallet, X, KanbanSquare, Heart, Bookmark,
} from 'lucide-react';
import { LogoMark } from './logo';

export const ICONS = {
  dashboard: LayoutDashboard, briefs: FileText, unlocks: LockOpen, messages: MessageSquare, billing: CreditCard,
  notifications: Bell, settings: Settings, pitches: Sparkles, wallet: Wallet, admin: Gauge, kyc: ShieldCheck,
  disputes: Scale, payouts: Banknote, flags: Flag, users: Users, inbox: Inbox,
  board: KanbanSquare, favorites: Heart, swipe: Bookmark,
} as const;
export type IconKey = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: IconKey; badge?: number };
export type NavGroup = { title: string; items: NavItem[] };

function isActive(path: string, href: string) {
  if (href === '/dashboard' || href === '/admin') return path === href;
  return path === href || path.startsWith(href + '/');
}

export function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="grid gap-5">
      {groups.map((g) => (
        <div key={g.title} className="grid gap-0.5">
          <span className="label px-2.5 pb-1.5">{g.title}</span>
          {g.items.map((i) => {
            const Icon = ICONS[i.icon];
            const active = isActive(path, i.href);
            return (
              <Link key={i.href} href={i.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
                className={`group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] transition-colors duration-150 ${
                  active ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2 hover:bg-surface-2/70 hover:text-ink'}`}>
                {active && <span className="absolute inset-y-2 -left-3 w-[3px] rounded-r bg-accent" aria-hidden="true" />}
                <Icon className={`size-4 ${active ? 'text-accent' : 'text-muted group-hover:text-ink-2'}`} aria-hidden="true" />
                <span className="flex-1">{i.label}</span>
                {!!i.badge && <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-medium text-accent-ink">{i.badge}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Button that opens the command palette (it listens for this event). */
export function SearchTrigger({ compact }: { compact?: boolean }) {
  const open = () => window.dispatchEvent(new Event('od:open-palette'));
  if (compact) {
    return (
      <button type="button" onClick={open} aria-label="Search" className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2">
        <Search className="size-4" />
      </button>
    );
  }
  return (
    <button type="button" onClick={open}
      className="flex h-9 w-full items-center gap-2 rounded-2xl border border-line bg-surface shadow-sm-2/60 px-2.5 text-left text-[13px] text-muted transition-colors hover:border-line-strong hover:text-ink-2">
      <Search className="size-3.5" aria-hidden="true" />
      <span className="flex-1">Search or jump to…</span>
      <span className="kbd">⌘K</span>
    </button>
  );
}

export function MobileNav({ groups, footer }: { groups: NavGroup[]; footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2">
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="anim-fade-up absolute inset-y-0 left-0 grid w-[280px] max-w-[85vw] content-start gap-6 overflow-y-auto border-r border-line bg-surface p-4"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold"><LogoMark /> Outlier Desk</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid size-9 place-items-center rounded-lg hover:bg-surface-2"><X className="size-5" /></button>
            </div>
            <NavList groups={groups} onNavigate={() => setOpen(false)} />
            {footer}
          </div>
        </div>
      )}
    </>
  );
}
