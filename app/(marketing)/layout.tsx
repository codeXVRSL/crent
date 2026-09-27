import Link from 'next/link';
import { Logo } from '@/components/logo';
import { LinkButton } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { getViewer } from '@/lib/auth';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer().catch(() => null);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/#how" className="text-muted hover:text-ink">How it works</Link>
            <Link href="/cres" className="text-muted hover:text-ink">Researchers</Link>
            <Link href="/for-cres" className="text-muted hover:text-ink">For researchers</Link>
            <Link href="/pricing" className="text-muted hover:text-ink">Pricing</Link>
            {viewer ? (
              <LinkButton href="/dashboard">Dashboard</LinkButton>
            ) : (
              <>
                <Link href="/login" className="font-semibold">Log in</Link>
                <LinkButton href="/signup">Sign up</LinkButton>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-[1fr_auto]">
          <div className="grid gap-2">
            <Logo />
            <p className="max-w-md">A marketplace for proven content ideas, researched by verified Content Research Experts.</p>
            <ThemeToggle />
          </div>
          <nav className="grid grid-cols-2 gap-x-8 gap-y-2">
            <Link href="/#how">How it works</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/for-cres">For researchers</Link>
            <Link href="/help">Help</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/refunds">Refunds</Link>
            <Link href="/legal/cre-agreement">Researcher agreement</Link>
          </nav>
          <p className="sm:col-span-2">© {new Date().getFullYear()} Outlier Desk. Business registration details: add your DTI/SEC and BIR numbers here before launch.</p>
        </div>
      </footer>
    </div>
  );
}
