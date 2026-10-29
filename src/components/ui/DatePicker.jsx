import { useCallback, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useDismiss, usePlacement } from './popover';
import { todayIso } from '@/lib/timezone';

/*
 * Date picker used for every date field in the app (instead of the browser's own picker,
 * which looks different per browser and locale). Value in / out: 'YYYY-MM-DD' or ''.
 * Shows dates as "15 Oct 2026". Click the month title for a month grid, again for a year grid.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const pad = (n) => String(n).padStart(2, '0');
const toIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? '');
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
};
export const formatPickerDate = (v) => {
  const p = parse(v);
  return p ? `${pad(p.d)} ${MONTHS[p.m]} ${p.y}` : '';
};

/** 6 weeks of days for a month, Monday first; days outside the month are flagged. */
function monthGrid(y, m) {
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(y, m, 1 - offset + i);
    return { iso: toIso(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: d.getMonth() === m };
  });
}

export function DatePicker({ value, onChange, onBlur, placeholder = 'Select date', min, max, disabled, clearable = true, id, name }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('days'); // days | months | years
  const sel = parse(value);
  const base = sel ?? parse(todayIso());
  const [cursor, setCursor] = useState({ y: base.y, m: base.m });
  const rootRef = useRef(null);
  const toggleRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setView('days');
    onBlur?.();
  }, [onBlur]);
  usePlacement(open, toggleRef, menuRef, false, 300, true); // the same 300px calendar on every field
  useDismiss(open, rootRef, menuRef, close);

  // open on the selected month (or this month)
  const openPicker = () => {
    const b = parse(value) ?? parse(todayIso());
    setCursor({ y: b.y, m: b.m });
    setOpen(true);
  };

  const outOfRange = (iso) => (min && iso < min) || (max && iso > max);
  const pick = (iso) => {
    if (outOfRange(iso)) return;
    onChange?.(iso);
    close();
  };
  const shiftMonth = (n) => setCursor(({ y, m }) => ({ y: y + Math.floor((m + n) / 12), m: (((m + n) % 12) + 12) % 12 }));
  const decadeStart = Math.floor(cursor.y / 12) * 12;
  const today = todayIso();

  return (
    <div className={`dropdown datepicker${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        name={name}
        ref={toggleRef}
        className="dropdown-toggle"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : openPicker())}
        style={disabled ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
      >
        <Calendar className="dp-ico" />
        <span className={`value${sel ? '' : ' is-placeholder'}`}>{sel ? formatPickerDate(value) : placeholder}</span>
        {clearable && sel && !disabled ? (
          <span
            className="dp-clear"
            role="button"
            tabIndex={-1}
            title="Clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange?.('');
            }}
          >
            <X />
          </span>
        ) : (
          <span className="caret">
            <ChevronDown />
          </span>
        )}
      </button>

      <div className="dropdown-menu dp-menu" ref={menuRef} role="dialog" aria-label="Choose date">
        <div className="mini-cal">
          <div className="cal-head">
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              title={view === 'days' ? 'Previous month' : view === 'months' ? 'Previous year' : 'Previous years'}
              onClick={() => (view === 'days' ? shiftMonth(-1) : setCursor((c) => ({ ...c, y: c.y - (view === 'months' ? 1 : 12) })))}
            >
              <ChevronLeft />
            </button>
            <button type="button" className="month dp-title" onClick={() => setView(view === 'days' ? 'months' : view === 'months' ? 'years' : 'days')}>
              {view === 'days' && `${MONTHS[cursor.m]} ${cursor.y}`}
              {view === 'months' && cursor.y}
              {view === 'years' && `${decadeStart} – ${decadeStart + 11}`}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              title={view === 'days' ? 'Next month' : view === 'months' ? 'Next year' : 'Next years'}
              onClick={() => (view === 'days' ? shiftMonth(1) : setCursor((c) => ({ ...c, y: c.y + (view === 'months' ? 1 : 12) })))}
            >
              <ChevronRight />
            </button>
          </div>

          {view === 'days' && (
            <div className="grid7">
              {DOW.map((d) => (
                <span key={d} className="dow">
                  {d}
                </span>
              ))}
              {monthGrid(cursor.y, cursor.m).map((c) => {
                const cls = ['d', !c.inMonth && 'off', c.iso === value && 'is-selected', c.iso === today && 'is-today', outOfRange(c.iso) && 'is-disabled']
                  .filter(Boolean)
                  .join(' ');
                return (
                  <button key={c.iso} type="button" className={cls} disabled={outOfRange(c.iso)} onClick={() => pick(c.iso)} aria-label={formatPickerDate(c.iso)} aria-pressed={c.iso === value}>
                    {c.day}
                  </button>
                );
              })}
            </div>
          )}

          {view === 'months' && (
            <div className="dp-grid3">
              {MONTHS.map((mName, m) => (
                <button
                  key={mName}
                  type="button"
                  className={`dp-cell${sel && sel.y === cursor.y && sel.m === m ? ' is-selected' : ''}`}
                  onClick={() => {
                    setCursor((c) => ({ ...c, m }));
                    setView('days');
                  }}
                >
                  {mName}
                </button>
              ))}
            </div>
          )}

          {view === 'years' && (
            <div className="dp-grid3">
              {Array.from({ length: 12 }, (_, i) => decadeStart + i).map((y) => (
                <button
                  key={y}
                  type="button"
                  className={`dp-cell${sel?.y === y ? ' is-selected' : ''}`}
                  onClick={() => {
                    setCursor((c) => ({ ...c, y }));
                    setView('months');
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="dropdown-foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => (clearable ? (onChange?.(''), close()) : close())}>
            {clearable ? 'Clear' : 'Close'}
          </button>
          <button type="button" className="btn btn-soft btn-sm" disabled={!!outOfRange(today)} onClick={() => pick(today)}>
            Today
          </button>
        </div>
      </div>
    </div>
  );
}
