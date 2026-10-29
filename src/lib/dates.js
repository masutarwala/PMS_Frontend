import { todayIso } from './timezone';

// Quick date ranges for the "Date" filter pill. Returns { from, to } as 'YYYY-MM-DD',
// counted from today in the user's time zone.
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const userToday = () => {
  const [y, m, d] = todayIso().split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'custom', label: 'Custom range…' },
];

export function rangeFor(key, now = userToday()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case 'today':
      return { from: iso(now), to: iso(now) };
    case 'this_week': {
      const monday = new Date(y, m, now.getDate() - ((now.getDay() + 6) % 7));
      return { from: iso(monday), to: iso(new Date(y, m, monday.getDate() + 6)) };
    }
    case 'this_month':
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'last_month':
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'this_quarter': {
      const q = Math.floor(m / 3) * 3;
      return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) };
    }
    default:
      return null;
  }
}
