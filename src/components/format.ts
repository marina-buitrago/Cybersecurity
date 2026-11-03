const TZ = 'Europe/Madrid';

const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });

/** "6 Nov 2026". Accepts a Date or an ISO date / date-time string. */
export function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d) : d;
  return dateFmt.format(date);
}
