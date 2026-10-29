import { useCallback, useRef, useState } from 'react';
import { ConfirmContext } from './confirm-context';
import { ConfirmDeleteModal } from './Modal';

/** One confirmation popup for the whole app (see useConfirm). */
export function ConfirmProvider({ children }) {
  const [ask, setAsk] = useState(null); // { title, message, confirmLabel }
  const resolver = useRef(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setAsk({ title: 'Are you sure?', confirmLabel: 'Delete', ...options });
      }),
    [],
  );
  const answer = (ok) => {
    resolver.current?.(ok);
    resolver.current = null;
    setAsk(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDeleteModal
        open={!!ask}
        title={ask?.title}
        message={ask?.message}
        confirmLabel={ask?.confirmLabel}
        tone={ask?.tone}
        onClose={() => answer(false)}
        onConfirm={() => answer(true)}
      />
    </ConfirmContext.Provider>
  );
}
