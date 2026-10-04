import Link from 'next/link';
import { Logo } from '@/components/logo';
import { LinkButton } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { getViewer } from '@/lib/auth';
import { BRAND } from '@/lib/brand';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer().catch(() => null);
  const links = [['/#how', 'How it works'], ['/cres', 'Researchers'], ['/for-cres', 'For researchers'], ['/pricing', 'Pricing']];
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 text-[14px] md:flex" aria-label="Main">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-lg px-3 py-1.5 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">{label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {viewer ? (
              <LinkButton href="/dashboard" size="sm">Dashboard</LinkButton>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-1.5 text-[14px] font-medium text-ink-2 hover:text-ink">Log in</Link>
                <LinkButton href="/signup" size="sm">Sign up</LinkButton>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="grid content-start gap-3">
            <Logo />
            <p className="max-w-xs text-sm text-muted">Proven content ideas, researched by verified Content Research Experts.</p>
            <ThemeToggle />
          </div>
          {[
            ['Product', [['/#how', 'How it works'], ['/pricing', 'Pricing'], ['/cres', 'Researchers']]],
            ['Researchers', [['/for-cres', 'Apply'], ['/legal/cre-agreement', 'Researcher agreement'], ['/help', 'Help']]],
            ['Legal', [['/legal/terms', 'Terms'], ['/legal/privacy', 'Privacy'], ['/legal/refunds', 'Refunds']]],
          ].map(([title, items]) => (
            <div key={title as string} className="grid content-start gap-2 text-sm">
              <span className="label mb-1">{title as string}</span>
              {(items as string[][]).map(([href, label]) => <Link key={href} href={href} className="text-ink-2 hover:text-ink">{label}</Link>)}
            </div>
          ))}
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted sm:px-6">
            © {new Date().getFullYear()} {BRAND} · Naga City, Philippines. Business registration details (DTI/SEC, BIR) go here before launch.
          </p>
        </div>
      </footer>
    </div>
  );
}
