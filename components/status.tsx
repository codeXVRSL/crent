import { Pill } from './ui';

const brief: Record<string, { tone: 'neutral' | 'accent' | 'warn' | 'muted' | 'good'; label: string }> = {
  draft: { tone: 'neutral', label: 'Draft' },
  awaiting_payment: { tone: 'warn', label: 'Awaiting payment' },
  open: { tone: 'accent', label: 'Live' },
  closed: { tone: 'neutral', label: 'Closed · refund pending' },
  settled: { tone: 'muted', label: 'Completed' },
  cancelled: { tone: 'muted', label: 'Cancelled' },
};
export function BriefStatus({ status }: { status: string }) {
  const s = brief[status] ?? { tone: 'neutral', label: status };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

const unlock: Record<string, { tone: 'warn' | 'good' | 'muted' | 'bad' | 'neutral'; label: string }> = {
  held: { tone: 'warn', label: 'On hold' },
  available: { tone: 'good', label: 'Available' },
  paid_out: { tone: 'muted', label: 'Paid out' },
  disputed: { tone: 'bad', label: 'Disputed' },
  reversed: { tone: 'bad', label: 'Reversed' },
};
export function UnlockStatus({ status }: { status: string }) {
  const s = unlock[status] ?? { tone: 'neutral', label: status };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'closed';
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `${Math.max(h, 1)}h left`;
  return `${Math.floor(h / 24)}d left`;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formats a date for display. A plain calendar date ("2026-10-08") is shown as that same day for every
 * viewer; parsing it as a moment would shift it a day back west of UTC and break hydration.
 * Timestamps with a time of day should use <When>, which renders in the viewer's own time zone.
 */
export function fmtDate(iso: string, withTime = false) {
  if (DATE_ONLY.test(iso)) return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return new Date(iso).toLocaleString('en-US', withTime
    ? { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }
    : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Manila' });
}
