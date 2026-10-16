import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth, RequirePermission } from '@/auth/guards';
import { AppLayout } from '@/components/layout/AppLayout';
import { SCREENS } from '@/lib/constants';
import LoginPage from '@/pages/auth/LoginPage';
import NotFoundPage from '@/pages/errors/NotFoundPage';
import { CONFIG_SCREENS } from '@/pages/config/screens';

// Screens are loaded on demand (one chunk per page).
const ChangePasswordPage = lazy(() => import('@/pages/account/ChangePasswordPage'));
const OverviewPage = lazy(() => import('@/pages/dashboard/OverviewPage'));
const UserListPage = lazy(() => import('@/pages/admin/users/UserListPage'));
const UserFormPage = lazy(() => import('@/pages/admin/users/UserFormPage'));
const RoleListPage = lazy(() => import('@/pages/admin/roles/RoleListPage'));
const RoleFormPage = lazy(() => import('@/pages/admin/roles/RoleFormPage'));
const ProjectListPage = lazy(() => import('@/pages/projects/ProjectListPage'));
const ProjectFormPage = lazy(() => import('@/pages/projects/ProjectFormPage'));
const ProjectDetailsPage = lazy(() => import('@/pages/projects/ProjectDetailsPage'));
const ProjectEditPage = lazy(() => import('@/pages/projects/ProjectEditPage'));
const ConfigListPage = lazy(() => import('@/pages/config/ConfigListPage'));
const ConfigFormPage = lazy(() => import('@/pages/config/ConfigFormPage'));
const ProjectTypeFormPage = lazy(() => import('@/pages/config/ProjectTypeFormPage'));
const ResourceGradeFormPage = lazy(() => import('@/pages/config/ResourceGradeFormPage'));
const CUSTOM_FORMS = { projectType: ProjectTypeFormPage, resourceGrade: ResourceGradeFormPage };

// Every screen route is wrapped in RequirePermission with the same screen key the API checks.
const guard = (screen, action, element) => (
  <RequirePermission screen={screen} action={action}>
    {element}
  </RequirePermission>
);

// Configuration masters: list / new / edit for each screen in pages/config/screens.jsx
const configRoutes = CONFIG_SCREENS.flatMap((def) => {
  const base = def.screen.slice(1);
  const Form = CUSTOM_FORMS[def.form] ?? ConfigFormPage;
  return [
    { path: base, element: guard(def.screen, 'view', <ConfigListPage key={def.key} def={def} />) },
    { path: `${base}/new`, element: guard(def.screen, 'create', <Form key={`${def.key}-new`} def={def} />) },
    { path: `${base}/:id/edit`, element: guard(def.screen, 'edit', <Form key={`${def.key}-edit`} def={def} />) },
  ];
});

export const router = createBrowserRouter([
  {
    element: <RedirectIfAuthenticated />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: 'account/change-password', element: <ChangePasswordPage /> },

          { path: 'administration/users', element: guard(SCREENS.USERS, 'view', <UserListPage />) },
          { path: 'administration/users/new', element: guard(SCREENS.USERS, 'create', <UserFormPage key="new" />) },
          { path: 'administration/users/:id/edit', element: guard(SCREENS.USERS, 'edit', <UserFormPage />) },

          { path: 'administration/roles', element: guard(SCREENS.ROLES, 'view', <RoleListPage />) },
          { path: 'administration/roles/new', element: guard(SCREENS.ROLES, 'create', <RoleFormPage key="new" />) },
          { path: 'administration/roles/:id/edit', element: guard(SCREENS.ROLES, 'edit', <RoleFormPage />) },

          ...configRoutes,

          { path: 'projects', element: guard(SCREENS.PROJECTS, 'view', <ProjectListPage />) },
          { path: 'projects/new', element: guard(SCREENS.PROJECTS, 'create', <ProjectFormPage key="new" />) },
          { path: 'projects/:id', element: guard(SCREENS.PROJECTS, 'view', <ProjectDetailsPage />) },
          { path: 'projects/:id/edit', element: guard(SCREENS.PROJECTS, 'edit', <ProjectEditPage />) },

          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
