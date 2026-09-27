import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Inbox, Info, XCircle } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ---------- Buttons: 6 designed states (default, hover, focus, active, disabled, loading) ---------- */
const btnBase =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-brand ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50';
const btnSize = { sm: 'h-8 px-3 text-[13px]', md: 'h-9 px-4 text-sm', lg: 'h-11 px-5 text-[15px]' };
const btnVariants = {
  primary: 'bg-accent text-accent-ink shadow-sm hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-surface text-ink shadow-sm hover:bg-surface-2',
  danger: 'bg-bad text-white shadow-sm hover:opacity-90',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
};
type Variant = keyof typeof btnVariants;
type Size = keyof typeof btnSize;

export function Button({ variant = 'primary', size = 'md', className, ...p }: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button className={cx(btnBase, btnSize[size], btnVariants[variant], className)} {...p} />;
}

export function LinkButton({ variant = 'primary', size = 'md', className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={cx(btnBase, btnSize[size], btnVariants[variant], className)} {...p} />;
}

/* ---------- Form controls ---------- */
const fieldCls =
  'w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[14px] text-ink shadow-sm ' +
  'placeholder:text-muted/70 transition-[border-color,box-shadow] duration-150 ease-brand ' +
  'hover:border-muted/50 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft ' +
  'disabled:opacity-60';

export function Input({ className, ...p }: ComponentProps<'input'>) {
  const isFile = p.type === 'file';
  return <input className={cx(fieldCls, isFile ? 'py-2 file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-sm file:text-ink' : 'h-10', className)} {...p} />;
}
export function Textarea({ className, ...p }: ComponentProps<'textarea'>) {
  return <textarea className={cx(fieldCls, 'min-h-24 py-2.5 leading-relaxed', className)} {...p} />;
}
export function Select({ className, ...p }: ComponentProps<'select'>) {
  return <select className={cx(fieldCls, 'h-10 pr-8', className)} {...p} />;
}

export function Field({ label, hint, htmlFor, children }: { label: string; hint?: ReactNode; htmlFor: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/* ---------- Surfaces ---------- */
export function Card({ className, ...p }: ComponentProps<'div'>) {
  return <div data-card="" className={cx('rounded-2xl border border-line bg-surface p-5 shadow-sm', className)} {...p} />;
}

const pillTones = {
  neutral: 'bg-surface-2 text-ink-2 ring-1 ring-inset ring-line',
  accent: 'bg-accent-soft text-accent',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  good: 'bg-good-soft text-good',
  muted: 'text-muted ring-1 ring-inset ring-line',
};
export type Tone = keyof typeof pillTones;
export function Pill({ tone = 'neutral', dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium', pillTones[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function PageHeader({ title, eyebrow, children, description }: { title: string; eyebrow?: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1.5">
        {eyebrow && <span className="label">{eyebrow}</span>}
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
        {description && <p className="max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action, icon = <Inbox className="size-5" /> }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="relative grid justify-items-center gap-3 overflow-hidden rounded-2xl border border-dashed border-line-strong bg-surface/50 px-6 py-12 text-center">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      {icon && <div className="relative grid size-11 place-items-center rounded-xl border border-line bg-surface text-accent shadow-sm">{icon}</div>}
      <h3 className="relative text-base font-semibold">{title}</h3>
      {children && <p className="relative max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="relative mt-1">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon, emphasis }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; emphasis?: boolean }) {
  return (
    <div data-card="" className={cx('grid content-between gap-3 rounded-2xl border p-4 shadow-sm', emphasis ? 'border-transparent bg-accent text-accent-ink' : 'border-line bg-surface')}>
      <div className="flex items-center justify-between gap-2">
        <span className={cx('label', emphasis && '!text-accent-ink/80')}>{label}</span>
        {icon && <span className={cx('opacity-70', emphasis ? '' : 'text-muted')}>{icon}</span>}
      </div>
      <div className="grid gap-0.5">
        <span className="num text-[26px] font-medium leading-none tracking-tight">{value}</span>
        {sub && <span className={cx('text-xs', emphasis ? 'text-accent-ink/80' : 'text-muted')}>{sub}</span>}
      </div>
    </div>
  );
}

export function Notice({ tone = 'warn', children }: { tone?: 'warn' | 'bad' | 'good' | 'accent'; children: ReactNode }) {
  const t = { warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad', good: 'bg-good-soft text-good', accent: 'bg-accent-soft text-accent' }[tone];
  const Icon = { warn: AlertTriangle, bad: XCircle, good: CheckCircle2, accent: Info }[tone];
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={cx('anim-fade-up flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm', t)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-ink [&_a]:underline">{children}</div>
    </div>
  );
}
