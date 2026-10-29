import { useCallback, useMemo, useRef, useState } from 'react';
import { Columns3, EllipsisVertical, GripVertical, RotateCcw } from 'lucide-react';
import { ActionMenu } from './Dropdown';
import { useDismiss, usePlacement } from './popover';

/*
 * Customisable table columns: which columns show and in what order, remembered per table in this
 * browser (localStorage).
 *   const cols = useColumns('projects', [{ key: 'title', label: 'Project', locked: true }, …]);
 *   cols.columns  → the visible column defs, in the user's order
 *   <ColumnPicker cols={cols} />  → the "Columns" button with the show / hide / reorder menu
 * A `locked` column is always shown (e.g. the record's name); `defaultHidden` ones start switched off.
 */

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
};

export function useColumns(tableKey, defs) {
  const storageKey = `pms.cols.${tableKey}`;
  const [saved, setSaved] = useState(() => read(storageKey));
  const keys = defs.map((d) => d.key).join('|');

  // saved order first (dropping columns that no longer exist), then any new columns
  const all = useMemo(() => {
    const byKey = new Map(defs.map((d) => [d.key, d]));
    const order = [...(saved?.order ?? []).filter((k) => byKey.has(k)), ...defs.map((d) => d.key).filter((k) => !saved?.order?.includes(k))];
    // before the user customises: the columns marked defaultHidden are off
    const hidden = new Set(saved ? saved.hidden : defs.filter((d) => d.defaultHidden).map((d) => d.key));
    return order.map((k) => ({ ...byKey.get(k), hidden: !byKey.get(k).locked && hidden.has(k) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defs change identity every render; their keys are what matter
  }, [saved, keys]);

  const store = useCallback(
    (next) => {
      setSaved(next);
      try {
        if (next) localStorage.setItem(storageKey, JSON.stringify(next));
        else localStorage.removeItem(storageKey);
      } catch {
        /* storage unavailable */
      }
    },
    [storageKey],
  );
  const snapshot = (list) => ({ order: list.map((c) => c.key), hidden: list.filter((c) => c.hidden).map((c) => c.key) });

  return {
    all,
    columns: all.filter((c) => !c.hidden),
    isCustom: Boolean(saved),
    toggle: (key) => store(snapshot(all.map((c) => (c.key === key && !c.locked ? { ...c, hidden: !c.hidden } : c)))),
    moveTo: (key, index) => {
      const list = all.filter((c) => c.key !== key);
      list.splice(Math.max(0, Math.min(index, list.length)), 0, all.find((c) => c.key === key));
      store(snapshot(list));
    },
    reset: () => store(null),
  };
}

/** "Columns" button: tick to show / hide, drag to change the order, Reset to the default. */
export function ColumnPicker({ cols }) {
  const [open, setOpen] = useState(false);
  const [dragKey, setDragKey] = useState(null);
  const rootRef = useRef(null);
  const toggleRef = useRef(null);
  const menuRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  usePlacement(open, toggleRef, menuRef, true, 280);
  useDismiss(open, rootRef, menuRef, close);
  const shown = cols.columns.length;

  return (
    <div className={`dropdown${open ? ' is-open' : ''}`} ref={rootRef}>
      <button ref={toggleRef} type="button" className={`btn btn-secondary btn-sm${cols.isCustom ? ' is-custom' : ''}`} onClick={() => setOpen((o) => !o)} title="Choose and order the table columns">
        <Columns3 />
        Columns
      </button>
      <div className="dropdown-menu align-right col-picker" ref={menuRef}>
        <div className="col-picker-head">
          <b>Table columns</b>
          <span className="muted small">
            {shown} of {cols.all.length} shown · drag to reorder
          </span>
        </div>
        <ul>
          {cols.all.map((c, i) => (
            <li
              key={c.key}
              draggable
              className={`${dragKey === c.key ? 'is-dragging' : ''}${c.hidden ? ' is-hidden' : ''}`}
              onDragStart={(e) => {
                setDragKey(c.key);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', c.key); // the dragged column travels with the drag
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = e.dataTransfer.getData('text/plain') || dragKey;
                if (from && from !== c.key) cols.moveTo(from, i);
                setDragKey(null);
              }}
              onDragEnd={() => setDragKey(null)}
            >
              <GripVertical className="col-grip" />
              <label>
                <input type="checkbox" checked={!c.hidden} disabled={c.locked} onChange={() => cols.toggle(c.key)} />
                <span>{c.label}</span>
                {c.locked && <small className="muted"> · always shown</small>}
              </label>
            </li>
          ))}
        </ul>
        <div className="col-picker-foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={cols.reset} disabled={!cols.isCustom}>
            <RotateCcw />
            Reset to default
          </button>
        </div>
      </div>
    </div>
  );
}

/** Row actions as one ⋯ menu – the first column of every list table. */
export function RowMenu({ items }) {
  return (
    <ActionMenu
      alignRight={false}
      trigger={({ toggle, title }) => (
        <button type="button" className="dropdown-toggle btn btn-ghost btn-icon" style={{ width: 32, height: 32, border: 0, padding: 0, justifyContent: 'center' }} title={title} onClick={toggle}>
          <EllipsisVertical />
        </button>
      )}
      items={items}
    />
  );
}
