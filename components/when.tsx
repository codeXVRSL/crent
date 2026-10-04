'use client';
import { useEffect, useState } from 'react';

const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' };

/**
 * A date with a time, shown in the viewer's own time zone. The server renders UTC with a label;
 * the browser replaces it after mount, so a researcher in Manila and a creator in New York each see their local time.
 */
export function When({ iso }: { iso: string }) {
  const [text, setText] = useState(() => new Date(iso).toLocaleString('en-US', { ...opts, timeZone: 'UTC' }) + ' UTC');
  useEffect(() => { setText(new Date(iso).toLocaleString('en-US', opts)); }, [iso]);
  return <time dateTime={iso} suppressHydrationWarning>{text}</time>;
}
