'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavItem = { href: string; label: string; badge?: number };

export function AppNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((i) => {
        const active = path === i.href || (i.href !== '/dashboard' && i.href !== '/admin' && path.startsWith(i.href + '/')) || (i.href === '/admin' && path === '/admin');
        return (
          <Link key={i.href} href={i.href}
            className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm ${active ? 'bg-accent-soft font-semibold text-accent' : 'text-muted hover:text-ink'}`}>
            {i.label}
            {!!i.badge && <span className="num rounded-full bg-accent px-1.5 text-[0.7rem] text-accent-ink">{i.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
