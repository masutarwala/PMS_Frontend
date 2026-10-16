import { useLayoutEffect, useRef } from 'react';

/** Grouping per currency: Indian lakh/crore commas for INR, thousands for the rest. */
const localeFor = (currency) => (!currency || currency === 'INR' ? 'en-IN' : 'en-US');

/** "200000.5" → "2,00,000.5" (keeps a trailing "." or partial decimals while typing). */
export function formatAmount(raw, currency) {
  if (raw === '' || raw == null) return '';
  const [int, dec] = String(raw).split('.');
  const grouped = int === '' ? '' : new Intl.NumberFormat(localeFor(currency), { maximumFractionDigits: 0 }).format(Number(int));
  return dec !== undefined ? `${grouped || '0'}.${dec}` : grouped;
}

/**
 * Money box that shows commas while typing. `value` / `onChange` use the plain number string
 * ("200000.50"), so forms and validation stay unchanged.
 */
export function AmountInput({ value, onChange, onBlur, currency, placeholder = '0.00', className = '', ...rest }) {
  const ref = useRef(null);
  const caret = useRef(null); // digits before the caret, restored after re-formatting

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caret.current == null || document.activeElement !== el) return;
    let digits = caret.current;
    let pos = 0;
    while (pos < el.value.length && digits > 0) {
      if (/[\d.]/.test(el.value[pos])) digits -= 1;
      pos += 1;
    }
    el.setSelectionRange(pos, pos);
    caret.current = null;
  });

  const handle = (e) => {
    const typed = e.target.value;
    const before = typed.slice(0, e.target.selectionStart ?? typed.length);
    let raw = typed.replace(/[^\d.]/g, '');
    const dot = raw.indexOf('.');
    if (dot !== -1) raw = `${raw.slice(0, dot + 1)}${raw.slice(dot + 1).replace(/\./g, '').slice(0, 2)}`; // one dot, 2 decimals
    raw = raw.replace(/^0+(?=\d)/, '');
    if (raw.replace('.', '').length > 12) return; // numeric(14,2)
    caret.current = before.replace(/[^\d.]/g, '').length;
    onChange(raw);
  };

  return (
    <input
      ref={ref}
      className={`input ${className}`.trim()}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={formatAmount(value, currency)}
      onChange={handle}
      onBlur={onBlur}
      {...rest}
    />
  );
}
