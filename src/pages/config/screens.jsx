import { Award, Briefcase, GitBranch, Globe, UsersRound, Building2, Clock3, FolderKanban, IndianRupee, Hash, Layers, ListChecks, Mail, MapPin, Phone, SlidersHorizontal, Tags, UserRound, Users } from 'lucide-react';
import { ActiveBadge, Badge, StageBadge } from '@/components/ui/Display';
import { PROJECT_STATUS, SCREENS, STAGE_CATEGORIES } from '@/lib/constants';

/*
 * Configuration screens rendered by ConfigListPage / ConfigFormPage.
 *
 * columns: [{ key, label, render?(row), className? }]
 * filters: [{ key (query param), placeholder, options | optionsFrom, multi? }]
 * sections: [{ title, sub, fields: [{ name, label, type, required?, help?, options|optionsFrom, span?, default? }] }]
 *   type: text | textarea | email | phone | number | time | switch | select | upper
 *   optionsFrom: { master: 'task-groups' } | { lookup: 'COUNTRY' } | { parameterTypes: true }
 * card(row) / listItem(row): { title, sub, meta: [[Icon, text]], badge }
 */

/** Compact effort split for a table cell. */
function SplitBar({ split }) {
  if (!split?.length) return <span className="muted small">No default split</span>;
  return (
    <div style={{ minWidth: 160 }} title={split.map((s) => `${s.taskGroupName} ${s.effortPercentage}%`).join(' · ')}>
      <div className="alloc-bar" style={{ height: 8 }}>
        {split.map((s, i) => (
          <span key={s.taskGroupName} className={`c${(i % 8) + 1}`} style={{ width: `${s.effortPercentage}%` }} />
        ))}
      </div>
      <div className="small muted" style={{ marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
        {split.slice(0, 3).map((s) => `${s.taskGroupName} ${s.effortPercentage}%`).join(' · ')}
        {split.length > 3 ? ` +${split.length - 3}` : ''}
      </div>
    </div>
  );
}

const yesNo = (v) => <Badge tone={v ? 'success' : undefined}>{v ? 'Yes' : 'No'}</Badge>;
const activeFilter = { key: 'isActive', placeholder: 'Active', options: [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }] };
const activeSwitch = { name: 'isActive', label: 'Active', type: 'switch', default: true };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const CONFIG_SCREENS = [
  {
    key: 'teams',
    screen: SCREENS.TEAMS,
    title: 'Teams',
    singular: 'team',
    icon: UsersRound,
    search: 'Search teams…',
    columns: [
      { key: 'name', label: 'Team', title: true },
      { key: 'countryName', label: 'Country', render: (r) => r.countryName ?? '—' },
      { key: 'gradeCount', label: 'Grades', className: 'num right' },
      { key: 'userCount', label: 'Users', className: 'num right' },
    ],
    filters: [{ key: 'countryId', placeholder: 'Country', optionsFrom: { lookup: 'COUNTRY' }, multi: true }],
    sections: [
      {
        title: 'Basic information',
        sub: 'e.g. Web India, SW UAE. Resource grades are set per team.',
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'countryId', label: 'Country', type: 'select', optionsFrom: { lookup: 'COUNTRY' } },
        ],
      },
    ],
    card: (r) => ({ title: r.name, sub: r.countryName ?? 'Team', meta: [[Globe, r.countryName ?? '—'], [Award, plural(r.gradeCount, 'grade')]] }),
  },
  {
    key: 'parameters',
    screen: SCREENS.PARAMETERS,
    title: 'Parameters',
    singular: 'parameter',
    icon: SlidersHorizontal,
    search: 'Search parameters…',
    columns: [
      { key: 'name', label: 'Parameter', title: true },
      { key: 'type', label: 'Type', render: (r) => <Badge>{r.type}</Badge> },
      { key: 'value', label: 'Value', render: (r) => r.value ?? '—' },
      { key: 'displayOrder', label: 'Display order', className: 'num right' },
      { key: 'isVisible', label: 'Is visible', render: (r) => yesNo(r.isVisible) },
    ],
    filters: [
      { key: 'type', placeholder: 'Type', optionsFrom: { parameterTypes: true }, multi: true },
      { key: 'isVisible', placeholder: 'Is visible', options: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }] },
    ],
    sections: [
      {
        title: 'Parameter',
        sub: 'Admin-editable list values used in dropdowns (user types, countries, currencies…).',
        fields: [
          { name: 'type', label: 'Type', type: 'select', required: true, optionsFrom: { parameterTypes: true }, help: 'which dropdown this value belongs to' },
          { name: 'name', label: 'Name', type: 'text', required: true, max: 150 },
          { name: 'value', label: 'Value', type: 'text', max: 150, help: 'optional code, e.g. INR for a currency' },
          { name: 'displayOrder', label: 'Display order', type: 'number', default: '0' },
          { name: 'isVisible', label: 'Visible in dropdowns', type: 'switch', default: true },
        ],
      },
    ],
    card: (r) => ({ title: r.name, sub: r.type, meta: [[Tags, r.value ?? '—'], [Hash, `Order ${r.displayOrder}`]], badge: yesNo(r.isVisible) }),
  },
  {
    key: 'sites',
    screen: SCREENS.SITES,
    title: 'Site Master',
    singular: 'site',
    icon: MapPin,
    search: 'Search site master…',
    columns: [
      { key: 'name', label: 'Site', title: true },
      { key: 'userCount', label: 'Users', className: 'num right' },
      { key: 'isActive', label: 'Active', render: (r) => <ActiveBadge active={r.isActive} /> },
    ],
    filters: [activeFilter],
    sections: [
      { title: 'Basic information', sub: 'Office site used on user records and holidays.', fields: [{ name: 'name', label: 'Name', type: 'text', required: true }] },
      { title: 'Settings', sub: 'Inactive sites are hidden from dropdowns.', fields: [activeSwitch] },
    ],
    card: (r) => ({ title: r.name, sub: 'Site', meta: [[Users, plural(r.userCount, 'user')]], badge: <ActiveBadge active={r.isActive} /> }),
  },
  {
    key: 'shifts',
    screen: SCREENS.SHIFTS,
    title: 'Shift Master',
    singular: 'shift',
    icon: Clock3,
    search: 'Search shift master…',
    columns: [
      { key: 'name', label: 'Shift', title: true },
      { key: 'startTime', label: 'Start time' },
      { key: 'endTime', label: 'End time' },
      { key: 'lateAfterMinutes', label: 'Late after (mins)', className: 'num right', render: (r) => r.lateAfterMinutes ?? '—' },
      { key: 'halfDayMinutes', label: 'Half day after (mins)', className: 'num right', render: (r) => r.halfDayMinutes ?? '—' },
      { key: 'userCount', label: 'Users', className: 'num right' },
    ],
    filters: [],
    sections: [
      {
        title: 'Shift timing',
        sub: 'Working hours used for attendance (late marks and half days).',
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'startTime', label: 'Start time', type: 'time', required: true },
          { name: 'endTime', label: 'End time', type: 'time', required: true },
          { name: 'lateAfterMinutes', label: 'Late after (mins)', type: 'number', help: 'minutes after the start time' },
          { name: 'halfDayMinutes', label: 'Half day after (mins)', type: 'number', help: 'minutes worked below which it is a half day' },
        ],
      },
    ],
    card: (r) => ({ title: r.name, sub: `${r.startTime} – ${r.endTime}`, meta: [[Clock3, `Late after ${r.lateAfterMinutes ?? 0} min`], [Users, plural(r.userCount, 'user')]] }),
  },
  {
    key: 'resource-grades',
    screen: SCREENS.RESOURCE_GRADES,
    title: 'Resource Grade & Cost',
    singular: 'resource grade',
    icon: Award,
    search: 'Search resource grades…',
    form: 'resourceGrade', // ResourceGradeFormPage (cost-per-hour history)
    columns: [
      { key: 'gradeName', label: 'Resource grade', title: true },
      { key: 'teamName', label: 'Team', render: (r) => r.teamName ?? <span className="muted">All teams</span> },
      { key: 'currentCost', label: 'Cost per hour', className: 'num right', render: (r) => (r.currentCost != null ? `${r.currentCurrency} ${r.currentCost}` : '—') },
      { key: 'userCount', label: 'Users', className: 'num right' },
    ],
    filters: [],
    card: (r) => ({
      title: r.gradeName,
      sub: r.teamName ?? 'All teams',
      meta: [[IndianRupee, r.currentCost != null ? `${r.currentCurrency} ${r.currentCost} / hour` : 'No cost'], [Users, plural(r.userCount, 'user')]],
    }),
  },
  {
    key: 'task-groups',
    screen: SCREENS.TASK_GROUPS,
    title: 'Task Groups',
    singular: 'task group',
    icon: Layers,
    search: 'Search task groups…',
    columns: [
      { key: 'name', label: 'Task group', title: true },
      { key: 'taskTypeCount', label: 'Sub-tasks', className: 'num right' },
    ],
    filters: [],
    sections: [{ title: 'Basic information', sub: 'Groups task types for estimates and reports.', fields: [{ name: 'name', label: 'Name', type: 'text', required: true }] }],
    card: (r) => ({ title: r.name, sub: 'Task group', meta: [[ListChecks, plural(r.taskTypeCount, 'task type')]] }),
  },
  {
    key: 'task-types',
    screen: SCREENS.TASK_TYPES,
    title: 'Task Types',
    singular: 'task type',
    icon: ListChecks,
    search: 'Search task types…',
    columns: [
      { key: 'name', label: 'Task type', title: true },
      { key: 'taskGroupName', label: 'Task group' },
      { key: 'description', label: 'Description', render: (r) => <span className="muted">{r.description || '—'}</span> },
      { key: 'isActive', label: 'Active', render: (r) => <ActiveBadge active={r.isActive} /> },
    ],
    filters: [{ key: 'taskGroupId', placeholder: 'Task group', optionsFrom: { master: 'task-groups' }, multi: true }, activeFilter],
    sections: [
      {
        title: 'Task type',
        sub: 'e.g. Analysis, UX/UI, Development, Post Live Support.',
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'taskGroupId', label: 'Task group', type: 'select', required: true, optionsFrom: { master: 'task-groups' } },
          { name: 'description', label: 'Description', type: 'textarea', span: 'all' },
          activeSwitch,
        ],
      },
    ],
    card: (r) => ({ title: r.name, sub: r.taskGroupName, meta: [[Layers, r.taskGroupName]], badge: <ActiveBadge active={r.isActive} /> }),
  },
  {
    key: 'project-divisions',
    screen: SCREENS.PROJECT_DIVISIONS,
    title: 'Project Divisions',
    singular: 'project division',
    icon: Building2,
    search: 'Search project divisions…',
    columns: [
      { key: 'name', label: 'Project division', title: true },
      { key: 'description', label: 'Description', render: (r) => <span className="muted">{r.description || '—'}</span> },
      { key: 'projectCount', label: 'Projects', className: 'num right' },
      { key: 'isActive', label: 'Active', render: (r) => <ActiveBadge active={r.isActive} /> },
    ],
    filters: [activeFilter],
    sections: [
      {
        title: 'Project division',
        sub: 'e.g. Web, Software.',
        fields: [{ name: 'name', label: 'Name', type: 'text', required: true }, { name: 'description', label: 'Description', type: 'textarea', span: 'all' }, activeSwitch],
      },
    ],
    card: (r) => ({ title: r.name, sub: r.description || 'Project division', meta: [[Layers, plural(r.projectCount, 'project')]], badge: <ActiveBadge active={r.isActive} /> }),
  },
  {
    key: 'project-types',
    screen: SCREENS.PROJECT_TYPES,
    title: 'Project Types',
    singular: 'project type',
    icon: Briefcase,
    search: 'Search project types…',
    form: 'projectType', // ProjectTypeFormPage (task template + effort split editors)
    columns: [
      { key: 'name', label: 'Project type', title: true, sub: (r) => `${r.taskCount} template task${r.taskCount === 1 ? '' : 's'}` },
      { key: 'split', label: 'Task-type split', render: (r) => <SplitBar split={r.split} />, className: '' },
      { key: 'description', label: 'Description', render: (r) => <span className="muted">{r.description || '—'}</span> },
      { key: 'projectCount', label: 'Projects', className: 'num right' },
      { key: 'isActive', label: 'Active', render: (r) => <ActiveBadge active={r.isActive} /> },
    ],
    filters: [activeFilter],
    card: (r) => ({
      title: r.name,
      sub: `${r.split.length} task groups`,
      meta: [[ListChecks, plural(r.taskCount, 'template task')], [FolderKanban, plural(r.projectCount, 'project')]],
      badge: <ActiveBadge active={r.isActive} />,
    }),
  },
  {
    key: 'project-stages',
    screen: SCREENS.PROJECT_STAGES,
    title: 'Project Stages',
    singular: 'project stage',
    icon: GitBranch,
    search: 'Search project stages…',
    columns: [
      { key: 'name', label: 'Stage', title: true },
      { key: 'value', label: 'Counts as', render: (r) => <StageBadge name={PROJECT_STATUS[r.value]?.label} status={r.value} /> },
      { key: 'displayOrder', label: 'Display order', className: 'num right' },
      { key: 'projectCount', label: 'Projects', className: 'num right' },
      { key: 'isVisible', label: 'Is visible', render: (r) => yesNo(r.isVisible) },
    ],
    filters: [
      { key: 'value', placeholder: 'Counts as', options: STAGE_CATEGORIES, multi: true },
      { key: 'isVisible', placeholder: 'Is visible', options: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }] },
    ],
    sections: [
      {
        title: 'Project stage',
        sub: 'Stages a project moves through (Draft, Analysis, Development, Live…).',
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true, max: 150 },
          { name: 'value', label: 'Counts as', type: 'select', required: true, options: STAGE_CATEGORIES, default: 'in_progress', help: 'used for the project summary and badge colour' },
          { name: 'displayOrder', label: 'Display order', type: 'number', default: '0' },
          { name: 'isVisible', label: 'Visible in dropdowns', type: 'switch', default: true },
        ],
      },
    ],
    card: (r) => ({
      title: r.name,
      sub: `Counts as ${PROJECT_STATUS[r.value]?.label ?? r.value}`,
      meta: [[FolderKanban, plural(r.projectCount, 'project')], [Hash, `Order ${r.displayOrder}`]],
      badge: yesNo(r.isVisible),
    }),
  },
  {
    key: 'customers',
    screen: SCREENS.CUSTOMERS,
    title: 'Customers',
    breadcrumb: 'Customers & Vendors',
    singular: 'customer',
    icon: Building2,
    search: 'Search customers…',
    summary: 'customers',
    columns: [
      { key: 'name', label: 'Customer', title: true, sub: (r) => r.code },
      { key: 'contactPerson', label: 'Contact person', render: (r) => r.contactPerson ?? '—' },
      { key: 'email', label: 'Email', render: (r) => r.email ?? '—' },
      { key: 'contactNumber', label: 'Contact number', render: (r) => r.contactNumber ?? '—' },
      { key: 'countryName', label: 'Country', render: (r) => r.countryName ?? '—' },
      { key: 'isActive', label: 'Active', render: (r) => <ActiveBadge active={r.isActive} /> },
    ],
    filters: [{ key: 'countryId', placeholder: 'Country', optionsFrom: { lookup: 'COUNTRY' }, multi: true }, activeFilter],
    sections: [
      {
        title: 'Basic information',
        sub: 'Customer name and code.',
        fields: [
          { name: 'code', label: 'Code', type: 'upper', required: true, max: 30, help: 'e.g. CUS-009' },
          { name: 'name', label: 'Name', type: 'text', required: true, max: 200 },
          { name: 'countryId', label: 'Country', type: 'select', optionsFrom: { lookup: 'COUNTRY' } },
        ],
      },
      {
        title: 'Contact & address',
        sub: 'Main contact at the customer.',
        fields: [
          { name: 'contactPerson', label: 'Contact person', type: 'text', max: 150 },
          { name: 'contactNumber', label: 'Contact number', type: 'phone', max: 30 },
          { name: 'email', label: 'Email', type: 'email' },
        ],
      },
      { title: 'Settings', sub: 'Inactive customers are hidden from dropdowns.', fields: [activeSwitch] },
    ],
    card: (r) => ({
      title: r.name,
      sub: r.code,
      meta: [[UserRound, r.contactPerson ?? '—'], [Mail, r.email ?? '—'], [Phone, r.contactNumber ?? '—']],
      badge: <ActiveBadge active={r.isActive} />,
    }),
  },
];
