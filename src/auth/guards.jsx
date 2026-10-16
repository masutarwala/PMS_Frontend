import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './auth-context';
import { FullPageLoader } from '@/components/ui/Loader';
import ForbiddenPage from '@/pages/errors/ForbiddenPage';

/** Signed-in users only; others go to /login and come back afterwards. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** Signed-out users only (login page). */
export function RedirectIfAuthenticated() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated') return <Navigate to={location.state?.from?.pathname || '/'} replace />;
  return <Outlet />;
}

/** Route guard by RBAC permission on a screen (menus.url). */
export function RequirePermission({ screen, action = 'view', children }) {
  const { can } = useAuth();
  if (!can(screen, action)) return <ForbiddenPage />;
  return children ?? <Outlet />;
}

/** Renders children only when the permission is granted (buttons, menu items). */
export function Can({ screen, action = 'view', children, fallback = null }) {
  const { can } = useAuth();
  return can(screen, action) ? children : fallback;
}
