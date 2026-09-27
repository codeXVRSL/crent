import { requireViewer } from '@/lib/auth';
import { Logo } from '@/components/logo';
import { AppNav, type NavItem } from '@/components/app-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { Notice } from '@/components/ui';
import Link from 'next/link';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const v = await requireViewer();
  const items: NavItem[] =
    v.role === 'creator' ? [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/briefs', label: 'My briefs' },
      { href: '/unlocks', label: 'Unlocked ideas' },
      { href: '/messages', label: 'Messages' },
      { href: '/billing', label: 'Billing' },
      { href: '/notifications', label: 'Notifications', badge: v.unreadCount },
      { href: '/settings', label: 'Settings' },
    ] : v.role === 'cre' ? [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/briefs', label: 'Open briefs' },
      { href: '/pitches', label: 'My pitches' },
      { href: '/messages', label: 'Messages' },
      { href: '/wallet', label: 'Wallet' },
      { href: '/notifications', label: 'Notifications', badge: v.unreadCount },
      { href: '/settings', label: 'Settings' },
    ] : [
      { href: '/admin', label: 'Overview' },
      { href: '/admin/kyc', label: 'Verifications' },
      { href: '/admin/disputes', label: 'Disputes' },
      { href: '/admin/payouts', label: 'Payouts & refunds' },
      { href: '/admin/flags', label: 'Flags' },
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/settings', label: 'Settings' },
      { href: '/notifications', label: 'Notifications', badge: v.unreadCount },
    ];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="grid content-start gap-4 border-b border-line bg-surface px-4 py-3 lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0 lg:py-5">
        <div className="flex items-center justify-between"><Logo href="/dashboard" /></div>
        <AppNav items={items} />
        <div className="hidden gap-3 border-t border-line pt-4 text-xs text-muted lg:grid">
          <span className="truncate">{v.email}</span>
          <ThemeToggle />
          <form action="/auth/signout" method="post"><button className="hover:text-ink">Log out</button></form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        {v.role === 'cre' && v.kycStatus !== 'approved' && (
          <div className="mb-6">
            <Notice>
              {v.kycStatus === 'pending' ? 'Your verification is under review. You can pitch once it’s approved.'
                : v.kycStatus === 'rejected' ? <>Your verification needs changes. <Link href="/onboarding/cre" className="underline">Update it</Link>.</>
                : <>Finish your profile and verification to start pitching. <Link href="/onboarding/cre" className="underline">Continue setup</Link>.</>}
            </Notice>
          </div>
        )}
        {children}
        <form action="/auth/signout" method="post" className="mt-12 lg:hidden"><button className="text-sm text-muted">Log out</button></form>
      </main>
    </div>
  );
}
