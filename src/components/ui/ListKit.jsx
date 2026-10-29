import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, Table2, X } from 'lucide-react';
import { Checkbox } from './Field';
import { Dropdown } from './Dropdown';

/*
 * Pieces every list screen uses, in the order the design rules prescribe:
 * .card.card-flush → .filter-bar → .active-filters → .bulk-bar → table / cards / list → .table-foot
 */

const VIEWS = [
  { key: 'table', label: 'Table', icon: Table2 },
  { key: 'cards', label: 'Cards', icon: LayoutGrid },
  { key: 'list', label: 'List', icon: List },
];

/** Table / Cards / List switch, remembered per screen. */
export function useViewMode(screenKey) {
  const key = `pms.view.${screenKey}`;
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem(key) || 'table';
    } catch {
      return 'table';
    }
  });
  const change = (v) => {
    setView(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      /* storage unavailable */
    }
  };
  return [view, change];
}

export function ViewSwitch({ value, onChange }) {
  return (
    <div className="segmented">
      {VIEWS.map((v) => (
        <button key={v.key} type="button" className={value === v.key ? 'is-active' : ''} onClick={() => onChange(v.key)}>
          <v.icon />
          {v.label}
        </button>
      ))}
    </div>
  );
}

/** Row selection for the current page; cleared whenever the rows change. */
const NONE = new Set();
export function useSelection(items) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const idsKey = ids.join(',');
  // the selection belongs to one set of rows; a new page / filter starts empty
  const [state, setState] = useState({ key: idsKey, set: NONE });
  const selected = state.key === idsKey ? state.set : NONE;
  const update = (fn) => setState((st) => ({ key: idsKey, set: fn(st.key === idsKey ? st.set : NONE) }));

  const count = ids.filter((id) => selected.has(id)).length;
  return {
    selected,
    count,
    ids: ids.filter((id) => selected.has(id)),
    isSelected: (id) => selected.has(id),
    toggle: (id) =>
      update((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    toggleAll: (on) => update(() => (on ? new Set(ids) : NONE)),
    clear: () => update(() => NONE),
    allChecked: ids.length > 0 && count === ids.length,
    someChecked: count > 0 && count < ids.length,
  };
}

export function SelectAllCell({ selection }) {
  return (
    <th className="col-check">
      <Checkbox
        checked={selection.allChecked}
        indeterminate={selection.someChecked}
        onChange={(on) => selection.toggleAll(on)}
        title="Select all"
      />
    </th>
  );
}

export function SelectRowCell({ selection, id }) {
  return (
    <td className="col-check">
      <Checkbox checked={selection.isSelected(id)} onChange={() => selection.toggle(id)} />
    </td>
  );
}

/** Dark bar shown while rows are selected. */
export function BulkBar({ count, children }) {
  return (
    <div className={`bulk-bar${count > 0 ? ' is-visible' : ''}`}>
      <span>
        <span>{count}</span> selected
      </span>
      <span className="grow" />
      {children}
    </div>
  );
}

/** chips: [{ key, label, value, onRemove }] */
export function ActiveFilters({ chips, onClearAll, show }) {
  if (!chips.length && !show) return null;
  return (
    <div className="active-filters">
      {chips.map((c) => (
        <span key={c.key} className="chip">
          {c.label}: <b>{c.value}</b>
          <button type="button" title="Remove" onClick={c.onRemove}>
            <X />
          </button>
        </span>
      ))}
      <button type="button" className="clear" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  );
}

/** Side drawer from the UI kit (.drawer-backdrop > .drawer). */
export function Drawer({ open, onClose, title, children, footer, className = '', bare = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={`drawer-backdrop${open ? ' is-open' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      {open && (
        <div className={`drawer ${className}`} role="dialog" aria-modal="true" aria-label={title}>
          {!bare && (
            <div className="modal-head">
              <h2>{title}</h2>
              <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} title="Close">
                <X />
              </button>
            </div>
          )}
          {children}
          {footer && <div className="modal-foot">{footer}</div>}
        </div>
      )}
    </div>
  );
}

/** Card colour tones cycle like the mock-ups. */
export const CARD_TONES = ['rc-deep', '', 'rc-lime', 'rc-mint', 'rc-sage'];

/**
 * A single-choice list filter (clearable) whose value stays a one-item list, as the list pages and the API
 * work with lists. Multi-select is kept for the filters where several values are really needed (status, priority, stage).
 */
export function SingleFilter({ value, onChange, ...props }) {
  const one = Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  return <Dropdown pill clearable {...props} value={one} onChange={(v) => onChange(v === null || v === undefined ? [] : [v])} />;
}
