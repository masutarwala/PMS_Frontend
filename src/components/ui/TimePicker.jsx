import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Clock3, X } from 'lucide-react';
import { useDismiss, usePlacement } from './popover';

/*
 * Time picker used for every time field (instead of the browser's own picker, which looks
 * different per browser). Value in / out: 'HH:MM' (24 h) or ''. Shows "09:00 AM".
 * Hour, minute and AM/PM columns; picking a value updates the field straight away.
 */

const pad = (n) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1 … 12

const parse = (v) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(v ?? '');
  if (!m) return null;
  const h24 = Number(m[1]);
  return { h12: h24 % 12 || 12, min: Number(m[2]), pm: h24 >= 12 };
};
const toValue = ({ h12, min, pm }) => `${pad((h12 % 12) + (pm ? 12 : 0))}:${pad(min)}`;
export const formatPickerTime = (v) => {
  const p = parse(v);
  return p ? `${pad(p.h12)}:${pad(p.min)} ${p.pm ? 'PM' : 'AM'}` : '';
};

export function TimePicker({ value, onChange, onBlur, placeholder = 'Select time', step = 5, disabled, clearable = false, id, name }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const toggleRef = useRef(null);
  const menuRef = useRef(null);
  const sel = parse(value);
  // minutes in steps, plus the stored minute if it is off-step (e.g. 08:07)
  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step);
  if (sel && !minutes.includes(sel.min)) minutes.push(sel.min);
  minutes.sort((a, b) => a - b);

  const close = useCallback(() => {
    setOpen(false);
    onBlur?.();
  }, [onBlur]);
  usePlacement(open, toggleRef, menuRef, false, 260);
  useDismiss(open, rootRef, menuRef, close);

  // bring the selected hour / minute into view when the panel opens
  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    menuRef.current.querySelectorAll('.tp-col').forEach((col) => {
      const on = col.querySelector('.is-selected');
      if (on) col.scrollTop = on.offsetTop - col.clientHeight / 2 + on.offsetHeight / 2;
    });
  }, [open]);

  const set = (patch) => onChange?.(toValue({ h12: 9, min: 0, pm: false, ...(sel ?? {}), ...patch }));

  return (
    <div className={`dropdown datepicker timepicker${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        name={name}
        ref={toggleRef}
        className="dropdown-toggle"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        style={disabled ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
      >
        <Clock3 className="dp-ico" />
        <span className={`value${sel ? '' : ' is-placeholder'}`}>{sel ? formatPickerTime(value) : placeholder}</span>
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

      <div className="dropdown-menu tp-menu" ref={menuRef} role="dialog" aria-label="Choose time">
        <div className="tp-head">
          <span>Hour</span>
          <span>Min</span>
          <span />
        </div>
        <div className="tp-cols">
          <div className="tp-col" role="listbox" aria-label="Hour">
            {HOURS.map((h) => (
              <button key={h} type="button" className={`tp-cell${sel?.h12 === h ? ' is-selected' : ''}`} onClick={() => set({ h12: h })}>
                {pad(h)}
              </button>
            ))}
          </div>
          <div className="tp-col" role="listbox" aria-label="Minute">
            {minutes.map((m) => (
              <button key={m} type="button" className={`tp-cell${sel?.min === m ? ' is-selected' : ''}`} onClick={() => set({ min: m })}>
                {pad(m)}
              </button>
            ))}
          </div>
          <div className="tp-col tp-ampm" role="listbox" aria-label="AM or PM">
            {['AM', 'PM'].map((x) => (
              <button key={x} type="button" className={`tp-cell${sel && sel.pm === (x === 'PM') ? ' is-selected' : ''}`} onClick={() => set({ pm: x === 'PM' })}>
                {x}
              </button>
            ))}
          </div>
        </div>
        <div className="dropdown-foot">
          <span className="tp-preview">{sel ? formatPickerTime(value) : '—'}</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
