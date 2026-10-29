import { createContext, useContext } from 'react';

export const ConfirmContext = createContext(null);

/**
 * Asks before something is deleted / removed:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Remove member?', message: '…', confirmLabel: 'Remove' })) { … }
 * tone: 'primary' for a non-destructive confirmation (green button).
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
