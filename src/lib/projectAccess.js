/*
 * Project tabs and Project-tab fields a role may see / edit (Roles & Permissions → Project access).
 * The same lists as the API (modules/projects/project-access.js); the signed-in user's resolved
 * access comes with the session (useProjectAccess).
 */

export const ACCESS_LEVELS = [
  { value: 'hidden', label: 'Hidden' },
  { value: 'view', label: 'View' },
  { value: 'edit', label: 'Edit' },
];

// tabs without their own editing only have Hidden / View
export const PROJECT_TABS = [
  { key: 'update', label: 'Update', editable: true },
  { key: 'project', label: 'Project', editable: true },
  { key: 'users', label: 'Users', editable: true },
  { key: 'estimate', label: 'Estimate', editable: true },
  { key: 'plan', label: 'Plan', editable: true, note: 'weekly plan, task progress – project owner only' },
  { key: 'commercial', label: 'Commercial', editable: true, note: 'project value, costs, rates' },
  { key: 'analysis', label: 'Analysis', editable: false },
  { key: 'history', label: 'History', editable: false },
];

// required fields can't be hidden – every project needs them
export const PROJECT_FIELDS = [
  { key: 'title', label: 'Project title', required: true },
  { key: 'customerId', label: 'Customer' },
  { key: 'ownerId', label: 'Project owner', required: true },
  { key: 'projectDivisionId', label: 'Project division', required: true },
  { key: 'projectTypeId', label: 'Project type', required: true },
  { key: 'startDate', label: 'Start date', required: true },
  { key: 'endDate', label: 'End date' },
  { key: 'estimatedAmount', label: 'Total amount' },
  { key: 'estimatedAmountCurrency', label: 'Currency' },
  { key: 'sharepointLink', label: 'SharePoint link' },
  { key: 'isRetainerProject', label: 'Retainer project' },
  { key: 'isBillable', label: 'Billable' },
  { key: 'detail', label: 'Detail' },
];
export const REQUIRED_FIELDS = PROJECT_FIELDS.filter((f) => f.required).map((f) => f.key);
