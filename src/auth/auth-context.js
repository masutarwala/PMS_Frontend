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
