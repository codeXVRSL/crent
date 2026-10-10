import { NextResponse } from 'next/server';

/** One CSV cell, quoted. Values starting with = + - @, tab or CR get a leading ' so spreadsheets don't run them as formulas. */
export function csvCell(v: unknown) {
  const s = v == null ? '' : String(v);
  // Plain numbers (including negatives like -12.50) stay numbers so spreadsheet sums work.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** A CSV download with a BOM so Excel opens accented names correctly. */
export function csvResponse(name: string, header: string[], rows: unknown[][]) {
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="outlier-desk-${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

export const cents = (c: number | null | undefined) => (c == null ? '' : (c / 100).toFixed(2));
