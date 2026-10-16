// Screen keys = menus.url on the server; the same keys guard routes and API calls.
export const SCREENS = Object.freeze({
  USERS: '/administration/users',
  ROLES: '/administration/roles',
  TEAMS: '/administration/teams',
  PARAMETERS: '/administration/parameters',
  SITES: '/administration/sites',
  SHIFTS: '/administration/shifts',
  RESOURCE_GRADES: '/administration/resource-grades',
  TASK_GROUPS: '/administration/task-groups',
  TASK_TYPES: '/administration/task-types',
  PROJECT_DIVISIONS: '/administration/project-divisions',
  PROJECT_TYPES: '/administration/project-types',
  PROJECT_STAGES: '/administration/project-stages',
  CUSTOMERS: '/customers',
  PROJECTS: '/projects',
  TIMESHEET: '/timesheet',
});

export const PERMISSION_ACTIONS = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'approve', label: 'Approve' },
  { key: 'export', label: 'Export' },
];

// Status → badge colour follows the design rules (info = in progress, warning = on hold, …).
export const PROJECT_STATUS = {
  not_started: { label: 'Not started', badge: '' },
  in_progress: { label: 'In progress', badge: 'badge-info' },
  on_hold: { label: 'On hold', badge: 'badge-warning' },
  completed: { label: 'Completed', badge: 'badge-success' },
  cancelled: { label: 'Cancelled', badge: 'badge-danger' },
};

// What a project stage "counts as" (lookups.value of a PROJECT_STAGE) – drives the badge colour and summaries.
export const STAGE_CATEGORIES = Object.entries(PROJECT_STATUS).map(([value, s]) => ({ value, label: s.label }));

export const DATA_SCOPES = [
  { value: 'all', label: 'All' },
  { value: 'team', label: 'Team' },
  { value: 'own', label: 'Own' },
  { value: 'customer', label: 'Customer' },
  { value: 'vendor', label: 'Vendor' },
];

export const TIME_ZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York'];

export const PAGE_SIZES = [10, 25, 50, 100];
