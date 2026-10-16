import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

/**
 * .field wrapper from the UI kit: label (+ required star), control, help text.
 * An error replaces the help text and turns the control red (.field.has-error).
 */
export function Field({ label, required, help, error, htmlFor, span, className = '', style, children }) {
  const cls = ['field', error && 'has-error', span === 'all' && 'span-all', span === 2 && 'span-2', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} style={style}>
      {label && (
        <label htmlFor={htmlFor}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {(error || help) && (
        <span className="help" role={error ? 'alert' : undefined}>
          {error || help}
        </span>
      )}
    </div>
  );
}

/** Input with a leading icon (.input-group). */
export function IconInput({ icon: Icon, className = '', ...props }) {
  return (
    <div className="input-group">
      {Icon && <Icon />}
      <input className={`input ${className}`} {...props} />
    </div>
  );
}

/** Password input with a show / hide toggle at the end. */
export function PasswordInput({ icon: Icon = Lock, className = '', ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-group">
      {Icon && <Icon />}
      <input className={`input has-trail ${className}`} {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="trail trail-btn"
        onClick={() => setVisible((v) => !v)}
        title={visible ? 'Hide password' : 'Show password'}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

export function Switch({ label, checked, onChange, disabled }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      {label}
    </label>
  );
}

export function Checkbox({ label, checked, onChange, disabled, indeterminate, title }) {
  return (
    <label className={`check${label ? '' : ' no-label'}`} title={title}>
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        ref={(el) => el && (el.indeterminate = !!indeterminate)}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="box" />
      {label}
    </label>
  );
}

/** Choice chips for 2–4 fixed values. */
export function ChoiceGroup({ name, options, value, onChange }) {
  return (
    <div className="choice-group">
      {options.map((o) => (
        <label key={o.value} className="choice">
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}
