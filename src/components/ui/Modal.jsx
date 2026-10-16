import { useEffect } from 'react';
import { Trash2, X } from 'lucide-react';

export function Modal({ open, onClose, title, children, footer, size }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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

/** Destructive actions always go through this confirmation (design rule 10). */
export function ConfirmDeleteModal({ open, onClose, onConfirm, title, message, busy, confirmLabel = 'Delete' }) {
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
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            <Trash2 />
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-2">{message}</p>
    </Modal>
  );
}
