const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** 'YYYY-MM-DD' → 'mon 19 oct' */
export function dayLabel(day: string): string {
  const d = new Date(day + 'T00:00:00Z');
  return `${DAYS[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** 'YYYY-MM-DD' → 'tue' */
export const shortDay = (day: string) => DAYS[(new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7];

/** ISO time → 'HH:MM' in the local zone of the device. */
export function clock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Days mask → 'MTWTF··' */
export function daysText(mask: number): string {
  return 'MTWTFSS'.split('').map((c, i) => (mask & (1 << i) ? c : '·')).join('');
}
