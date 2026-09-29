import Link from 'next/link';
import { Bell, LogOut, Plus } from 'lucide-react';
import { requireViewer } from '@/lib/auth';
import { Logo } from '@/components/logo';
import { MobileNav, NavList, SearchTrigger, type NavGroup } from '@/components/app-nav';
import { CommandPalette, type Command } from '@/components/command-palette';
import { ThemeToggle } from '@/components/theme-toggle';
import { LinkButton, Notice } from '@/components/ui';
import { FeedbackButton } from '@/components/feedback-button';
import { env } from '@/lib/env';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const v = await requireViewer();
  const bell = v.unreadCount;

  const groups: NavGroup[] =
    v.role === 'creator' ? [
      { title: 'Work', items: [
        { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { href: '/briefs', label: 'My briefs', icon: 'briefs' },
        { href: '/ideas', label: 'Idea board', icon: 'board' },
        { href: '/unlocks', label: 'Unlocked ideas', icon: 'unlocks' },
        { href: '/favorites', label: 'Saved researchers', icon: 'favorites' },
        { href: '/messages', label: 'Messages', icon: 'messages' },
      ] },
      { title: 'Account', items: [
        { href: '/billing', label: 'Billing', icon: 'billing' },
        { href: '/notifications', label: 'Notifications', icon: 'notifications', badge: bell },
        { href: '/settings', label: 'Settings', icon: 'settings' },
      ] },
    ] : v.role === 'cre' ? [
      { title: 'Work', items: [
        { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { href: '/briefs', label: 'Open briefs', icon: 'inbox' },
        { href: '/pitches', label: 'My pitches', icon: 'pitches' },
        { href: '/swipe', label: 'Swipe file', icon: 'swipe' },
        { href: '/messages', label: 'Messages', icon: 'messages' },
      ] },
      { title: 'Account', items: [
        { href: '/wallet', label: 'Wallet', icon: 'wallet' },
        { href: '/notifications', label: 'Notifications', icon: 'notifications', badge: bell },
        { href: '/settings', label: 'Settings', icon: 'settings' },
      ] },
    ] : [
      { title: 'Admin', items: [
        { href: '/admin', label: 'Overview', icon: 'admin' },
        { href: '/admin/kyc', label: 'Verifications', icon: 'kyc' },
        { href: '/admin/disputes', label: 'Disputes', icon: 'disputes' },
        { href: '/admin/payouts', label: 'Payouts & refunds', icon: 'payouts' },
        { href: '/admin/flags', label: 'Flags', icon: 'flags' },
        { href: '/admin/users', label: 'Users', icon: 'users' },
        { href: '/admin/feedback', label: 'Feedback', icon: 'inbox' },
        { href: '/admin/settings', label: 'Settings', icon: 'settings' },
      ] },
      { title: 'Account', items: [{ href: '/notifications', label: 'Notifications', icon: 'notifications', badge: bell }] },
    ];

  const commands: Command[] = [
    ...(v.role === 'creator' ? [
      { id: 'new-brief', label: 'Post a brief', href: '/briefs/new', icon: 'briefs', group: 'Actions', keywords: 'create new template' } as Command,
      { id: 'find-cres', label: 'Find researchers', href: '/cres', icon: 'users', group: 'Actions', keywords: 'directory hire invite' } as Command,
    ] : []),
    ...(v.role === 'cre' ? [
      { id: 'browse', label: 'Browse open briefs', href: '/briefs', icon: 'inbox', group: 'Actions', keywords: 'find work pitch' } as Command,
      { id: 'invited', label: 'Briefs I was invited to', href: '/briefs?invited=1', icon: 'inbox', group: 'Actions', keywords: 'invite' } as Command,
      { id: 'swipe-add', label: 'Save a find to my swipe file', href: '/swipe', icon: 'swipe', group: 'Actions', keywords: 'outlier save idea bank' } as Command,
      { id: 'profile', label: 'Edit researcher profile', href: '/onboarding/cre', icon: 'settings', group: 'Actions', keywords: 'portfolio niches verification' } as Command,
      ...(v.handle ? [{ id: 'public', label: 'View my public profile', href: `/cres/${v.handle}`, icon: 'users', group: 'Actions' } as Command] : []),
    ] : []),
    ...groups.flatMap((g) => g.items.map((i) => ({ id: i.href, label: i.label, href: i.href, icon: i.icon, group: 'Go to' }))),
    { id: 'help', label: 'Help and FAQ', href: '/help', icon: 'inbox', group: 'Go to', keywords: 'support' },
  ];

  const initials = (v.displayName || v.email).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const roleLabel = v.role === 'cre' ? 'Researcher' : v.role === 'creator' ? 'Creator' : 'Admin';
  const accountFooter = (
    <div className="grid min-w-0 gap-3 border-t border-line pt-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent" aria-hidden="true">{initials}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-medium">{v.displayName || 'You'}</div>
          <div className="truncate text-[12px] text-muted">{roleLabel} · {v.email}</div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <ThemeToggle />
        <form action="/auth/signout" method="post">
          <button className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-muted hover:bg-surface-2 hover:text-ink">
            <LogOut className="size-3.5" aria-hidden="true" /> Log out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-5 lg:overflow-y-auto lg:px-4 lg:py-5">
        <Logo href="/dashboard" />
        <SearchTrigger />
        {v.role === 'creator' && <LinkButton href="/briefs/new" className="w-full"><Plus className="size-4" aria-hidden="true" /> Post a brief</LinkButton>}
        <NavList groups={groups} />
        <div className="mt-auto">{accountFooter}</div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-line bg-surface/95 px-3 py-2 lg:hidden"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
        <div className="flex items-center gap-1">
          <MobileNav groups={groups} footer={accountFooter} />
          <Logo href="/dashboard" />
        </div>
        <div className="flex items-center gap-1">
          <SearchTrigger compact />
          <Link href="/notifications" aria-label={`Notifications${bell ? `, ${bell} unread` : ''}`} className="relative grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2">
            <Bell className="size-4" />
            {bell > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-accent ring-2 ring-surface" />}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1160px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        {env.isTestMode && (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-warn/40 bg-warn-soft px-3.5 py-2 text-[13px] text-ink-2">
            <span className="rounded-md bg-warn px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">Test mode</span>
            Payments are simulated. No real money moves. Use the Feedback button to report anything odd.
          </div>
        )}
        {v.role === 'cre' && v.kycStatus !== 'approved' && (
          <div className="mb-6">
            <Notice>
              {v.kycStatus === 'pending' ? 'Your verification is under review. You can pitch once it’s approved.'
                : v.kycStatus === 'rejected' ? <>Your verification needs changes. <Link href="/onboarding/cre">Update it</Link>.</>
                : <>Finish your profile and verification to start pitching. <Link href="/onboarding/cre">Continue setup</Link>.</>}
            </Notice>
          </div>
        )}
        <div className="anim-fade-up">{children}</div>
      </main>
      <CommandPalette commands={commands} />
      <FeedbackButton />
    </div>
  );
}
