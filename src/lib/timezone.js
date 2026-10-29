/*
 * The signed-in user's time zone (Administration → Users → Time zone). Every date / time the app
 * shows, and "today", follow it – not the browser's zone. Set from the session (AuthProvider).
 *
 * Calendar dates ('YYYY-MM-DD': work date, due date …) have no time zone and are never shifted;
 * timestamps (ISO: planned start, created at …) are shown in the user's zone.
 */

let zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function setUserTimeZone(tz) {
  if (!tz) return;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    zone = tz;
  } catch {
    // unknown zone name – keep the current one
  }
}

export const userTimeZone = () => zone;

const cache = new Map();
/** Intl formatter in the user's zone (cached per zone + options). */
export function zonedFormat(options, locale = 'en-GB') {
  const key = `${zone}|${locale}|${JSON.stringify(options)}`;
  if (!cache.has(key)) cache.set(key, new Intl.DateTimeFormat(locale, { timeZone: zone, ...options }));
  return cache.get(key);
}

/** Wall clock of an instant in the user's zone: { date: 'YYYY-MM-DD', time: 'HH:MM' }. */
export function zonedParts(value = new Date()) {
  const p = Object.fromEntries(
    zonedFormat({ year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, 'en-CA')
      .formatToParts(new Date(value))
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
}

/** Today in the user's zone, 'YYYY-MM-DD'. */
export const todayIso = () => zonedParts().date;

/** Day of the week of today in the user's zone, Monday = 0. */
export function todayWeekday() {
  const [y, m, d] = todayIso().split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** A date + time typed by the user (their zone) → ISO instant for the API. */
export function zonedToIso(date, time = '00:00') {
  if (!date) return null;
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = (time || '00:00').split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // offset of the zone at that moment (two passes cover a DST change)
  const offset = (t) => {
    const p = zonedParts(t);
    const [py, pm, pd] = p.date.split('-').map(Number);
    const [ph, pmi] = p.time.split(':').map(Number);
    return Date.UTC(py, pm - 1, pd, ph, pmi) - t;
  };
  let t = wall - offset(wall);
  t = wall - offset(t);
  return new Date(t).toISOString();
}
