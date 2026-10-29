import { useCallback, useState } from 'react';

/*
 * useState that is kept for the browser tab's session (sessionStorage), so a list keeps its search,
 * filters, page and sort while the user opens one of its records (edit / new / details) and comes back.
 * Opening the list any other way (menu, another page) starts it fresh.
 * Falls back to plain state when storage is unavailable.
 */

// the previous and current path, updated by the app layout on every navigation (see trackNavigation)
const nav = { current: null, previous: null };

/** Called while the app layout renders – before the page – so a list knows where the user came from. */
export function trackNavigation(pathname) {
  if (pathname === nav.current) return;
  nav.previous = nav.current;
  nav.current = pathname;
}

/** True when the user comes back to this list from one of its own pages, e.g. /x/5/edit → /x. */
const returningFromRecord = () => {
  const here = window.location.pathname.replace(/\/$/, '');
  return Boolean(nav.previous && nav.previous.startsWith(`${here}/`));
};

const read = (key, initial, keep) => {
  try {
    // "keep" states (the tabs of a page) survive every navigation, so switching tabs keeps them
    if (!keep && !returningFromRecord()) {
      sessionStorage.removeItem(key);
      return initial;
    }
    const raw = sessionStorage.getItem(key);
    return raw == null ? initial : JSON.parse(raw);
  } catch {
    return initial;
  }
};

export function useSessionState(key, initial, { keep = false } = {}) {
  const storageKey = `pms.list.${key}`;
  const [value, setValue] = useState(() => read(storageKey, initial, keep));
  const set = useCallback(
    (next) =>
      setValue((prev) => {
        const v = typeof next === 'function' ? next(prev) : next;
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(v));
        } catch {
          /* storage unavailable */
        }
        return v;
      }),
    [storageKey],
  );
  return [value, set];
}

/** Forgets every remembered list state (on sign-out, so the next user starts fresh). */
export function clearSessionStates() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith('pms.list.'))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}
