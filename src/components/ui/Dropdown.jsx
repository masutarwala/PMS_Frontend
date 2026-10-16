import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useDismiss, usePlacement } from './popover';
import { ChipSelect } from './ChipSelect';
import { Check, ChevronDown, Search } from 'lucide-react';

/**
 * Select control from the UI kit (never a native <select>).
 *   options: [{ value, label }]
 *   multi:   value is an array; shown as chips in the field (ChipSelect)
 *   search:  filter box at the top
 *   pill / size="sm": filter-bar and compact variants
 */
export function Dropdown({
  options = [],
  value,
  onChange,
  placeholder = 'Select',
  multi = false,
  search = false,
  pill = false,
  size,
  disabled = false,
  clearable = false,
  id,
  onBlur,
  className = '',
}) {
  // multi-select everywhere = chips in the field (see ChipSelect)
  if (multi) {
    return <ChipSelect options={options} value={value ?? []} onChange={onChange} placeholder={placeholder} pill={pill} size={size} disabled={disabled} className={className} />;
  }
  return <SingleDropdown {...{ options, value, onChange, placeholder, search, pill, size, disabled, clearable, id, onBlur, className }} />;
}

function SingleDropdown({ options, value, onChange, placeholder, search, pill, size, disabled, clearable, id, onBlur, className }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const toggleRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const listId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    onBlur?.();
  }, [onBlur]);
  usePlacement(open, toggleRef, menuRef, false);
  useDismiss(open, rootRef, menuRef, close);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus({ preventScroll: true });
  }, [open]);

  const selected = useMemo(() => {
    const vals = value === null || value === undefined || value === '' ? [] : [value];
    return options.filter((o) => vals.some((v) => String(v) === String(o.value)));
  }, [value, options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => String(o.label).toLowerCase().includes(q)) : options;
  }, [options, query]);

  const isSelected = (o) => selected.some((s) => s.value === o.value);

  function pick(o) {
    onChange?.(o.value);
    close();
  }

  let label = placeholder;
  let isPlaceholder = true;
  if (selected.length === 1) {
    label = selected[0].label;
    isPlaceholder = false;
  }

  const cls = ['dropdown', pill && 'dropdown-pill', size === 'sm' && 'dropdown-sm', open && 'is-open', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} ref={rootRef}>
      <button
        type="button"
        id={id}
        ref={toggleRef}
        className="dropdown-toggle"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? close() : setOpen(true))}
        style={disabled ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
      >
        <span className={`value${isPlaceholder ? ' is-placeholder' : ''}`}>{label}</span>
        <span className="caret">
          <ChevronDown />
        </span>
      </button>
      <div className="dropdown-menu" ref={menuRef}>
        {search && (
          <div className="dropdown-search">
            <div className="input-group">
              <Search />
              <input ref={searchRef} className="input" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        )}
        <div className="dropdown-options" role="listbox" id={listId}>
          {clearable && selected.length > 0 && (
            <div className="dropdown-option" onClick={() => { onChange?.(null); close(); }}>
              <span className="muted">Clear selection</span>
            </div>
          )}
          {filtered.map((o) => (
            <div
              key={o.value}
              role="option"
              aria-selected={isSelected(o)}
              className={`dropdown-option${isSelected(o) ? ' is-selected' : ''}`}
              onClick={() => pick(o)}
            >
              {o.label}
              <span className="tick">
                <Check />
              </span>
            </div>
          ))}
          {!filtered.length && <div className="dropdown-empty">No options</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * Action menu (data-dropdown="menu" in the mock-ups).
 *   items: [{ label, icon: Component, onClick, danger, divider, hidden }]
 */
export function ActionMenu({ trigger, items = [], header, alignRight = true, minWidth = 170, title = 'More' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const toggleRef = useRef(null);
  const menuRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  usePlacement(open, toggleRef, menuRef, alignRight, minWidth);
  useDismiss(open, rootRef, menuRef, close);

  const visible = items.filter((i) => !i.hidden);
  if (!visible.length && !header) return null;

  return (
    <div className={`dropdown${open ? ' is-open' : ''}`} ref={rootRef}>
      <span ref={toggleRef} style={{ display: 'flex' }}>
        {trigger({ open, toggle: () => setOpen((o) => !o), title })}
      </span>
      <div className={`dropdown-menu${alignRight ? ' align-right' : ''}`} ref={menuRef}>
        {header}
        <div className="dropdown-options">
          {visible.map((item, i) =>
            item.divider ? (
              <div key={`d${i}`} className="dropdown-divider" />
            ) : (
              <div
                key={item.label}
                className={`dropdown-option${item.danger ? ' is-danger' : ''}`}
                onClick={() => {
                  close();
                  item.onClick?.();
                }}
              >
                {item.icon && <item.icon />}
                {item.label}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
