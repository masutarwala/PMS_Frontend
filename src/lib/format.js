const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** 'YYYY-MM-DD' or ISO → '30 Nov 2026' */
export function formatDate(value) {
  if (!value) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFmt.format(d);
}

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
