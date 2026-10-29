import { useEffect } from 'react';
import { Check, Trash2, X } from 'lucide-react';

// open popups – the page behind does not scroll while any is open
let openCount = 0;
function lockPage() {
  openCount += 1;
  if (openCount === 1) document.documentElement.classList.add('has-modal');
  return () => {
    openCount -= 1;
    if (openCount === 0) document.documentElement.classList.remove('has-modal');
  };
}

export function Modal({ open, onClose, title, children, footer, size }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  useEffect(() => (open ? lockPage() : undefined), [open]);

  return (
    <div
      className={`modal-backdrop${open ? ' is-open' : ''}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      {open && (
        <div className={`modal${size === 'lg' ? ' modal-lg' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
          <div className="modal-head">
            <h2>{title}</h2>
            <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} title="Close">
              <X />
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </div>
      )}
    </div>
  );
}

/** Destructive actions always go through this confirmation (design rule 10). tone="primary" for non-destructive confirmations. */
export function ConfirmDeleteModal({ open, onClose, onConfirm, title, message, busy, confirmLabel = 'Delete', tone = 'danger' }) {
  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={`btn btn-${tone}`} onClick={onConfirm} disabled={busy}>
            {tone === 'danger' ? <Trash2 /> : <Check />}
            {busy ? (tone === 'danger' ? 'Deleting…' : 'Saving…') : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-2">{message}</p>
    </Modal>
  );
}
