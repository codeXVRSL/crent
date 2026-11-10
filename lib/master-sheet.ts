// Builds the CRE master sheet: one row per unlocked idea, in the order a creator films from.
// Pure (no server imports) so it can be unit tested.
import { hookLabel, platformLabel } from './constants';

export type SheetUnlock = { pitch_id: string; created_at: string; brief_title: string | null };
export type SheetPitch = {
  id: string; platform: string; format_label: string; hook_category: string; teaser: string;
  multiplier: number | string; source_views: number; channel_median_views: number;
  source_posted_on: string; duration_seconds: number | null; cre_name: string | null;
};
export type SheetSecret = {
  pitch_id: string; source_url: string; hook_text: string; why_it_worked: string;
  instructions: string; adaptation_notes: string | null;
};

export const MASTER_COLUMNS = [
  { key: 'n', header: '#', width: 5 },
  { key: 'hook', header: 'Hook (say / show on screen)', width: 40 },
  { key: 'reference', header: 'Reference video', width: 38 },
  { key: 'why', header: 'Why it works', width: 50 },
  { key: 'howTo', header: 'How to film and edit', width: 60 },
  { key: 'adapt', header: 'Make it yours', width: 40 },
  { key: 'platform', header: 'Platform', width: 16 },
  { key: 'format', header: 'Format', width: 22 },
  { key: 'hookType', header: 'Hook type', width: 16 },
  { key: 'length', header: 'Length', width: 9 },
  { key: 'score', header: 'Outlier score', width: 12 },
  { key: 'views', header: 'Views', width: 12 },
  { key: 'median', header: 'Channel median', width: 14 },
  { key: 'posted', header: 'Source posted', width: 13 },
  { key: 'angle', header: 'Angle', width: 40 },
  { key: 'researcher', header: 'Researcher', width: 18 },
  { key: 'brief', header: 'Brief', width: 28 },
  { key: 'unlocked', header: 'Unlocked on', width: 12 },
  { key: 'status', header: 'Status', width: 12 },
] as const;

export type MasterRow = Record<(typeof MASTER_COLUMNS)[number]['key'], string | number>;
export const STATUS_OPTIONS = ['To film', 'Filmed', 'Posted'];

export function buildMasterRows(unlocks: SheetUnlock[], pitches: SheetPitch[], secrets: SheetSecret[]): MasterRow[] {
  const p = new Map(pitches.map((x) => [x.id, x]));
  const s = new Map(secrets.map((x) => [x.pitch_id, x]));
  return unlocks
    .filter((u) => p.has(u.pitch_id) && s.has(u.pitch_id))
    .map((u, i) => {
      const pi = p.get(u.pitch_id)!; const se = s.get(u.pitch_id)!;
      return {
        n: i + 1,
        hook: se.hook_text,
        reference: se.source_url,
        why: se.why_it_worked,
        howTo: se.instructions,
        adapt: se.adaptation_notes ?? '',
        platform: platformLabel(pi.platform),
        format: pi.format_label,
        hookType: hookLabel(pi.hook_category),
        length: pi.duration_seconds ? `${pi.duration_seconds}s` : '',
        score: `${Number(pi.multiplier).toFixed(1)}×`,
        views: pi.source_views,
        median: pi.channel_median_views,
        posted: pi.source_posted_on,
        angle: pi.teaser,
        researcher: pi.cre_name ?? '',
        brief: u.brief_title ?? '',
        unlocked: u.created_at.slice(0, 10),
        status: 'To film',
      };
    });
}

/** CSV only: stops spreadsheet formula injection (text starting with = + - @, even after spaces, or a tab/newline). */
export function safeCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /^[\s]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s) ? `'${s}` : s;
}

export function toCsv(rows: MasterRow[]): string {
  const cell = (v: unknown) => `"${safeCell(v).replace(/"/g, '""')}"`;
  const lines = [MASTER_COLUMNS.map((c) => cell(c.header)).join(',')];
  for (const r of rows) lines.push(MASTER_COLUMNS.map((c) => cell(r[c.key])).join(','));
  return '﻿' + lines.join('\r\n');
}
