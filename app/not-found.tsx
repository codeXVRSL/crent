import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Logo } from '@/components/logo';
import { LinkButton } from '@/components/ui';

export const metadata = { title: 'Page not found', robots: { index: false } };

export default function NotFound() {
  return (
    <main className="grid min-h-screen content-center justify-items-center px-4 py-16">
      <div className="anim-fade-up grid w-full max-w-md gap-6 text-center">
        <div className="justify-self-center"><Logo /></div>
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent"><Compass className="size-7" aria-hidden="true" /></div>
        <div className="grid gap-2">
          <h1 className="text-[28px] font-semibold tracking-tight">This page doesn&apos;t exist</h1>
          <p className="text-muted">The link may be old, or the brief or profile was removed. Check the address, or start from one of these.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <LinkButton href="/dashboard">Go to dashboard</LinkButton>
          <LinkButton href="/" variant="secondary">Home</LinkButton>
        </div>
        <p className="text-sm text-muted">Looking for someone? <Link href="/cres" className="font-medium text-accent">Browse researchers</Link> · <Link href="/help" className="font-medium text-accent">Help</Link></p>
      </div>
    </main>
  );
}
