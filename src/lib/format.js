import { zonedFormat } from './timezone';

// Timestamps are shown in the signed-in user's time zone (lib/timezone). A calendar date
// ('YYYY-MM-DD') has no zone and is shown as it is.
const DATE = { day: '2-digit', month: 'short', year: 'numeric' };
const isDateOnly = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const calendarFmt = (opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts });

function show(value, opts) {
  if (!value) return '—';
  if (isDateOnly(value)) return calendarFmt(opts).format(new Date(`${value}T00:00:00Z`));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : zonedFormat(opts).format(d);
}

/** 'YYYY-MM-DD' or ISO → '30 Nov 2026' */
export const formatDate = (value) => show(value, DATE);

/** ISO → '30 Nov 2026, 14:05' (user's time zone) */
export const formatDateTime = (value) => (isDateOnly(value) ? formatDate(value) : show(value, { ...DATE, hour: '2-digit', minute: '2-digit' }));

/** → '30 Nov' */
export const formatDayMonth = (value) => show(value, { day: 'numeric', month: 'short' });

/** ISO → '30 Nov, 14:05' (user's time zone) */
export const formatDayMonthTime = (value) => show(value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function formatMoney(amount, currency = 'INR') {
  if (amount === null || amount === undefined) return '—';
  try {
    // exact amount: paise / cents shown when there are any (₹42.50), whole amounts without (₹2,00,000)
    const whole = Number.isInteger(Math.round(Number(amount) * 100) / 100);
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export const formatNumber = (n) => (n === null || n === undefined ? '—' : new Intl.NumberFormat('en-IN').format(n));

/** "Priya Sharma" → "PS" */
export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
