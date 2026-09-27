import Link from 'next/link';

/** Mark: three bars, the last one an outlier. */
export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-lg bg-ink text-bg ${className}`} aria-hidden="true">
      <svg viewBox="0 0 20 20" className="size-[62%]">
        <rect x="2" y="12" width="4" height="6" rx="1.2" fill="currentColor" opacity="0.55" />
        <rect x="8" y="10" width="4" height="8" rx="1.2" fill="currentColor" opacity="0.55" />
        <rect x="14" y="2" width="4" height="16" rx="1.2" fill="var(--accent)" />
      </svg>
    </span>
  );
}

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
      <LogoMark />
      Outlier Desk
    </Link>
  );
}
