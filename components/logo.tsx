import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect x="1" y="13" width="4" height="8" rx="1" fill="var(--muted)" />
        <rect x="7" y="11" width="4" height="10" rx="1" fill="var(--muted)" />
        <rect x="13" y="2" width="4" height="19" rx="1" fill="var(--accent)" />
      </svg>
      Outlier Desk
    </Link>
  );
}
