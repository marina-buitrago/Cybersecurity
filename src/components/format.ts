const TZ = 'Europe/Madrid';

const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "6 Nov 2026". Accepts a Date or an ISO date / date-time string. */
export function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d) : d;
  return dateFmt.format(date);
}

/** "5 Nov 2026, 09:30" in Europe/Madrid. */
export function fmtDateTime(d: Date | string): string {
  return dateTimeFmt.format(typeof d === 'string' ? new Date(d) : d);
}

/** Convert a datetime-local value ("2026-11-02T09:30"), read as Europe/Madrid wall time, to a UTC ISO string. */
export function madridLocalToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Offset of Madrid at that instant, from the formatted wall time of the guess.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  return new Date(guess - (wall - guess)).toISOString();
}
