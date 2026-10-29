import { useCallback, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { useDismiss, usePlacement } from './popover';

const PILL_CHIPS = 2; // chips shown in a filter-bar pill before "+N"

/**
 * Multi-select shown as chips inside the field (the UI kit's .chips-input).
 * Click the field or type to open a searchable list of the options not chosen yet.
 *   options: [{ value, label }], value: [ids]
 */
export function ChipSelect({ options = [], value = [], onChange, placeholder = 'Add…', disabled, pill = false, size, className = '' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const boxRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);
  usePlacement(open, boxRef, menuRef, false, 240);
  useDismiss(open, rootRef, menuRef, close);

  const selected = useMemo(() => value.map((v) => options.find((o) => o.value === v)).filter(Boolean), [value, options]);
  const remaining = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => !value.includes(o.value) && (!q || o.label.toLowerCase().includes(q)));
  }, [options, value, query]);

  const add = (v) => {
    onChange?.([...value, v]);
    setQuery('');
    inputRef.current?.focus();
  };
  const remove = (v) => onChange?.(value.filter((x) => x !== v));
  const shownSelected = useMemo(() => {
    const q = query.trim().toLowerCase();
    return selected.filter((o) => !q || o.label.toLowerCase().includes(q));
  }, [selected, query]);

  const onKeyDown = (e) => {
    if (e.key === 'Backspace' && !query && value.length) remove(value[value.length - 1]);
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (remaining[0]) add(remaining[0].value);
    } else if (e.key === 'Escape') {
      e.stopPropagation(); // close just this list, not the drawer / modal around it
      close();
    }
    else if (!open) setOpen(true);
  };

  return (
    <div className={['dropdown chip-select', pill && 'is-pill', size === 'sm' && 'is-sm', open && 'is-open', className].filter(Boolean).join(' ')} ref={rootRef}>
      <div
        ref={boxRef}
        className="chips-input"
        onClick={() => {
          if (disabled) return;
          inputRef.current?.focus();
          setOpen(true);
        }}
        aria-disabled={disabled || undefined}
      >
        {(pill ? selected.slice(0, PILL_CHIPS) : selected).map((o) => (
          <span key={o.value} className="chip" title={o.label}>
            <span className="chip-label">{o.label}</span>
            <button
              type="button"
              title={`Remove ${o.label}`}
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                remove(o.value);
              }}
            >
              <X />
            </button>
          </span>
        ))}
        {pill && selected.length > PILL_CHIPS && (
          <span className="chip chip-more" title={selected.slice(PILL_CHIPS).map((o) => o.label).join(', ')}>
            +{selected.length - PILL_CHIPS}
          </span>
        )}
        <input
          ref={inputRef}
          value={query}
          disabled={disabled}
          placeholder={selected.length ? '' : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          aria-label={placeholder}
        />
        <span className="caret">
          <ChevronDown />
        </span>
      </div>
      <div className="dropdown-menu" ref={menuRef} role="listbox">
        <div className="dropdown-options">
          {shownSelected.map((o) => (
            <div key={o.value} role="option" aria-selected="true" className="dropdown-option is-selected" onMouseDown={(e) => e.preventDefault()} onClick={() => remove(o.value)}>
              {o.label}
              <span className="tick">
                <Check />
              </span>
            </div>
          ))}
          {shownSelected.length > 0 && remaining.length > 0 && <div className="dropdown-divider" />}
          {remaining.map((o) => (
            <div key={o.value} role="option" aria-selected="false" className="dropdown-option" onMouseDown={(e) => e.preventDefault()} onClick={() => add(o.value)}>
              {o.label}
            </div>
          ))}
          {!remaining.length && !shownSelected.length && <div className="dropdown-empty">{query ? 'No match' : 'Nothing to add'}</div>}
        </div>
      </div>
    </div>
  );
}
