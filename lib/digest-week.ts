import { manilaToday } from './parse';

/** Monday of the current week in Manila, as YYYY-MM-DD. */
export function manilaWeekStart(now = new Date()): string {
  const today = new Date(`${manilaToday(now)}T00:00:00Z`);
  const back = (today.getUTCDay() + 6) % 7; // Monday = 0
  today.setUTCDate(today.getUTCDate() - back);
  return today.toISOString().slice(0, 10);
}
