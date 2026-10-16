# emQube PMS – Frontend

React 19 + Vite 8 app built on the design system from `git2/Screens` (`theme.css` is used as-is, so the screens match the mock-ups).

## Requirements

- Node.js **22.12+** (tested on 24.15 — `nvm use 24.15.0`)
- The backend running on http://localhost:4000

## Setup

```bash
npm install
cp .env.example .env      # optional – defaults work with the backend on :4000
npm run dev               # http://localhost:5173
```

Vite proxies `/api` to the backend, so the browser talks to one origin and the httpOnly refresh cookie works with `SameSite=Strict`. In production, serve `dist/` and the API behind the same domain (e.g. nginx: `/` → `dist`, `/api` → Node).

| Script | |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build to `dist/` (one chunk per screen) |
| `npm run preview` | Serve the build |
| `npm run lint` | ESLint (incl. React hooks / compiler rules) |

## Stack

React Router 8 (data router) · TanStack Query 5 (server state) · React Hook Form + Zod 4 (forms) · Axios · lucide-react icons.

## Structure

```
src/
├── main.jsx                  providers: React Query → Toasts → Auth → Router
├── router.jsx                routes; every screen wrapped in RequirePermission
├── api/
│   ├── client.js             axios instance, in-memory access token, single-flight refresh on 401
│   └── endpoints.js          authApi, usersApi, rolesApi, projectsApi, mastersApi
├── auth/
│   ├── AuthProvider.jsx      session restore (refresh cookie), login, logout, can()
│   ├── auth-context.js       useAuth(), usePermissions(screen)
│   └── guards.jsx            RequireAuth, RedirectIfAuthenticated, RequirePermission, <Can>
├── components/
│   ├── layout/               AppLayout, Sidebar (menus from the API), Topbar
│   └── ui/                   Dropdown/ActionMenu, Field/Switch/Checkbox, Modal, Toast, Pager, …
├── hooks/                    useOptions (dropdown data), useDebounce, useApiFormError
├── lib/                      constants (SCREENS, statuses), formatters, CSV export, password rules
├── pages/                    auth, account, dashboard, admin/users, admin/roles, projects, errors
└── styles/                   theme.css (from Screens/_shared) + app.css (React-only additions)
```

## RBAC in the UI

- The **left menu is built from `/auth/me`** – a role only sees the modules/screens it can view.
- Routes are guarded with the same screen keys the API uses (`/projects`, `/administration/users`, `/administration/roles`); a direct URL without permission shows the “no access” page.
- Buttons (New, Edit, Delete, Export) are shown only when the role has that action.
- The API enforces all of this again – the UI checks are for usability, not security.

## Screens in this phase

| Menu | Screens |
|---|---|
| Account | Login, Change password |
| Overview | Welcome + project summary |
| Administration → Users | List (search, filters, unlock, delete), New / Edit user |
| Administration → Roles & Permissions | List, New / Edit role with the permission matrix |
| Projects → Project List | List (summary cards, tabs, filters, table / cards, export), New project, Project details, Edit project |
