// A percent box accepts 0–100 with up to 2 decimals: a keystroke that would go past that is
// undone (the box keeps its last valid value). Use with onFocus={rememberValue} onInput={keepPercentInRange}.
const PERCENT = /^(100(\.0{0,2})?|\d{1,2}(\.\d{0,2})?)?$/;

export function keepPercentInRange(e) {
  const el = e.target;
  if (PERCENT.test(el.value)) el.dataset.last = el.value;
  else el.value = el.dataset.last ?? '';
}

export const rememberValue = (e) => {
  e.target.dataset.last = e.target.value;
};

export const blockNonNumericKeys = (e) => {
  if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
};

export const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? 0 : Number(v));
