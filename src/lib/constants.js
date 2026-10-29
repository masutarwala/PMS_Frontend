// Screen keys = menus.url on the server; the same keys guard routes and API calls.
export const SCREENS = Object.freeze({
  USERS: '/administration/users',
  ROLES: '/administration/roles',
  TEAMS: '/administration/teams',
  PARAMETERS: '/administration/parameters', // Parameters tab (the lists)
  PARAMETER_VALUES: '/administration/parameters/values', // Parameter Values tab (permissions: PARAMETERS)
  USD_RATES: '/administration/parameters/usd-rates', // USD Rates tab (permissions: PARAMETERS)
  SITES: '/administration/sites',
  RESOURCE_GRADES: '/administration/resource-grades',
  TASK_GROUPS: '/administration/task-groups',
  TASK_TYPES: '/administration/task-groups/types', // Task Types tab (permissions: TASK_GROUPS)
  PROJECT_TYPES: '/administration/project-divisions/types', // Project Types tab (permissions: PROJECT_DIVISIONS)
  TASK_TEMPLATES: '/administration/project-divisions/templates', // Task Templates tab (permissions: PROJECT_DIVISIONS)
  PROJECT_DIVISIONS: '/administration/project-divisions',
  PROJECT_STAGES: '/administration/project-stages',
  CUSTOMERS: '/customers',
  PROJECTS: '/projects',
  TASK_CATEGORIES: '/administration/task-groups/categories', // Task Categories tab (permissions: TASK_GROUPS)
  TASKS: '/tasks',
  TASK_135: '/task-135', // 1-3-5 daily planner
  TASK_MASTER: '/administration/task-master', // who can see whose tasks / timesheets
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

// Task status / priority → label and badge colour
export const TASK_STATUS = {
  to_do: { label: 'To do', badge: '' },
  in_progress: { label: 'In progress', badge: 'badge-info' },
  hold: { label: 'Hold', badge: 'badge-warning' },
  completed: { label: 'Completed', badge: 'badge-success' },
};
export const TASK_PRIORITY = {
  low: { label: 'Low', badge: '' },
  medium: { label: 'Medium', badge: 'badge-info' },
  high: { label: 'High', badge: 'badge-warning' },
  urgent: { label: 'Urgent', badge: 'badge-danger' },
};
export const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS).map(([value, x]) => ({ value, label: x.label, tone: value }));
// tone = chip colour on the task form (grey / blue / amber / red)
export const TASK_PRIORITY_OPTIONS = Object.entries(TASK_PRIORITY).map(([value, x]) => ({ value, label: x.label, tone: value }));

export const DATA_SCOPES = [
  { value: 'all', label: 'All' },
  { value: 'team', label: 'Team' },
  { value: 'own', label: 'Own' },
  { value: 'customer', label: 'Customer' },
  { value: 'vendor', label: 'Vendor' },
];

export const TIME_ZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York'];

export const PAGE_SIZES = [10, 25, 50, 100];
