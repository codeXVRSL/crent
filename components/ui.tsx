import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const btnBase = 'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const btnVariants = {
  primary: 'bg-accent text-accent-ink hover:opacity-90',
  secondary: 'border border-line bg-surface text-ink hover:border-accent hover:text-accent',
  danger: 'bg-bad text-white hover:opacity-90',
  ghost: 'text-muted hover:text-ink',
};
type Variant = keyof typeof btnVariants;

export function Button({ variant = 'primary', className, ...p }: ComponentProps<'button'> & { variant?: Variant }) {
  return <button className={cx(btnBase, btnVariants[variant], className)} {...p} />;
}

export function LinkButton({ variant = 'primary', className, ...p }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(btnBase, btnVariants[variant], className)} {...p} />;
}

const fieldCls = 'w-full rounded-md border border-line bg-surface px-3 py-2 text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none';

export function Input({ className, ...p }: ComponentProps<'input'>) {
  return <input className={cx(fieldCls, className)} {...p} />;
}
export function Textarea({ className, ...p }: ComponentProps<'textarea'>) {
  return <textarea className={cx(fieldCls, 'min-h-24', className)} {...p} />;
}
export function Select({ className, ...p }: ComponentProps<'select'>) {
  return <select className={cx(fieldCls, className)} {...p} />;
}

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: ReactNode; htmlFor: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Card({ className, ...p }: ComponentProps<'div'>) {
  return <div className={cx('rounded-lg border border-line bg-surface p-5', className)} {...p} />;
}

const pillTones = {
  neutral: 'bg-line/60 text-ink',
  accent: 'bg-accent-soft text-accent',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  good: 'bg-good-soft text-good',
  muted: 'bg-transparent text-muted border border-line',
};
export type Tone = keyof typeof pillTones;
export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[0.72rem] whitespace-nowrap', pillTones[tone])}>{children}</span>;
}

export function PageHeader({ title, eyebrow, children, description }: { title: string; eyebrow?: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        {eyebrow && <span className="label">{eyebrow}</span>}
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && <p className="max-w-2xl text-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid justify-items-start gap-2 rounded-lg border border-dashed border-line p-8">
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <p className="max-w-xl text-muted">{children}</p>}
      {action}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="grid gap-1 border-t-2 border-ink pt-2">
      <span className="label">{label}</span>
      <span className="num text-2xl font-semibold">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

export function Notice({ tone = 'warn', children }: { tone?: 'warn' | 'bad' | 'good' | 'accent'; children: ReactNode }) {
  const t = { warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad', good: 'bg-good-soft text-good', accent: 'bg-accent-soft text-accent' }[tone];
  return <div className={cx('rounded-md px-4 py-3 text-sm', t)}>{children}</div>;
}

export { cx };
