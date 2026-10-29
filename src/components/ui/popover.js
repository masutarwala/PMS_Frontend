import { useEffect, useLayoutEffect } from 'react';

/**
 * Positions an open menu with `position: fixed` against the viewport (same as the
 * mock-ups' app.js) so tables and cards with overflow never clip it; opens upwards
 * when there is no room below. With `exact`, the menu is exactly minWidth wide (e.g. the calendar),
 * otherwise at least as wide as its field.
 */
export function usePlacement(open, toggleRef, menuRef, alignRight, minWidth = 0, exact = false) {
  useLayoutEffect(() => {
    if (!open || !toggleRef.current || !menuRef.current) return;
    const menu = menuRef.current;
    const r = toggleRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    Object.assign(menu.style, {
      position: 'fixed',
      minWidth: `${exact ? minWidth : Math.max(r.width, minWidth)}px`,
      maxWidth: `${exact ? minWidth : Math.max(r.width, minWidth, 340)}px`,
      top: '0px',
      left: '0px',
      right: 'auto',
    });
    const mh = menu.offsetHeight;
    const mw = menu.offsetWidth;
    const below = vh - r.bottom - 12;
    const above = r.top - 12;
    const top = mh > below && above > below ? Math.max(8, r.top - mh - 6) : r.bottom + 6;
    let left = alignRight ? r.right - mw : r.left;
    left = Math.min(Math.max(8, left), vw - mw - 8);
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }, [open, toggleRef, menuRef, alignRight, minWidth, exact]);
}

/** Closes on outside click, Escape, scroll outside the menu and resize. */
export function useDismiss(open, rootRef, menuRef, close) {
  useEffect(() => {
    if (!open) return undefined;
    // the click that opened the menu may scroll it into view; don't treat that as a scroll away
    const openedAt = performance.now();
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) close();
    };
    const onKey = (e) => e.key === 'Escape' && close();
    const onScroll = (e) => {
      if (performance.now() - openedAt > 250 && !menuRef.current?.contains(e.target)) close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open, rootRef, menuRef, close]);
}
