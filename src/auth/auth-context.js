import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** permissions for one screen: { view, create, edit, delete, approve, export } */
export function usePermissions(screen) {
  const { session } = useAuth();
  const p = session?.permissions?.[screen] ?? {};
  return {
    view: !!p.view,
    create: !!p.create,
    edit: !!p.edit,
    delete: !!p.delete,
    approve: !!p.approve,
    export: !!p.export,
  };
}

/**
 * The user's access to the project tabs and Project-tab fields (Roles & Permissions → Project access):
 * tab('users') / field('estimatedAmount') → 'hidden' | 'view' | 'edit'.
 */
export function useProjectAccess() {
  const { session } = useAuth();
  const a = session?.projectAccess;
  return {
    tab: (key) => a?.tabs?.[key] ?? 'edit',
    field: (key) => a?.fields?.[key] ?? 'edit',
  };
}
