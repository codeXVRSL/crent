import { Logo } from '@/components/logo';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Logo href="/dashboard" />
          <form action="/auth/signout" method="post"><button className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-ink">Log out</button></form>
        </div>
      </header>
      <main className="anim-fade-up mx-auto max-w-4xl px-4 py-10">{children}</main>
    </div>
  );
}
