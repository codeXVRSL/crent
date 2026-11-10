import { describe, expect, it } from 'vitest';
import { buildMasterRows, safeCell, toCsv, MASTER_COLUMNS } from '../lib/master-sheet';

const unlocks = [
  { pitch_id: 'p1', created_at: '2026-11-02T10:00:00Z', brief_title: 'Finance ideas' },
  { pitch_id: 'p2', created_at: '2026-11-03T10:00:00Z', brief_title: 'Finance ideas' },
  { pitch_id: 'gone', created_at: '2026-11-04T10:00:00Z', brief_title: 'x' },
];
const pitches = [
  { id: 'p1', platform: 'tiktok', format_label: 'Talking head', hook_category: 'number_list', teaser: 'Angle one',
    multiplier: '14.1', source_views: 1300000, channel_median_views: 92000, source_posted_on: '2026-10-01', duration_seconds: 38, cre_name: 'Jam' },
  { id: 'p2', platform: 'instagram_reels', format_label: 'POV', hook_category: 'pov', teaser: 'Angle two',
    multiplier: 8, source_views: 800000, channel_median_views: 100000, source_posted_on: '2026-09-01', duration_seconds: null, cre_name: null },
];
const secrets = [
  { pitch_id: 'p1', source_url: 'https://www.tiktok.com/@a/video/1', hook_text: '=HYPERLINK("evil")', why_it_worked: 'Numbers.', instructions: 'Film receipts.', adaptation_notes: null },
  { pitch_id: 'p2', source_url: 'https://www.instagram.com/reel/x', hook_text: 'POV: payday', why_it_worked: 'Relatable.', instructions: 'Phone on tripod.', adaptation_notes: 'Use your bank app' },
];

describe('CRE master sheet', () => {
  it('puts the filmable fields first and numbers the ideas', () => {
    expect(MASTER_COLUMNS.slice(1, 6).map((c) => c.header)).toEqual(
      ['Hook (say / show on screen)', 'Reference video', 'Why it works', 'How to film and edit', 'Make it yours']);
    const rows = buildMasterRows(unlocks, pitches, secrets);
    expect(rows).toHaveLength(2); // the idea with no pitch/secret is skipped
    expect(rows[0]).toMatchObject({ n: 1, reference: 'https://www.tiktok.com/@a/video/1', score: '14.1×', length: '38s', status: 'To film', unlocked: '2026-11-02' });
    expect(rows[1]).toMatchObject({ n: 2, platform: expect.any(String), adapt: 'Use your bank app', length: '', researcher: '' });
  });
  it('blocks spreadsheet formula injection', () => {
    expect(safeCell('=1+1')).toBe("'=1+1");
    expect(safeCell('@cmd')).toBe("'@cmd");
    expect(safeCell('Normal hook')).toBe('Normal hook');
    expect(safeCell('  =cmd')).toBe("'  =cmd");
    expect(safeCell('\n=cmd')).toBe("'\n=cmd");
    const csv = toCsv(buildMasterRows(unlocks, pitches, secrets));
    expect(csv.startsWith('﻿"#"')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`);
  });
});
