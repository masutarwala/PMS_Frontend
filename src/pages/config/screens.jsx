import { Award, Briefcase, ClipboardList, DollarSign, ListTree, GitBranch, Globe, UsersRound, Building2, Clock3, FolderKanban, Hash, Layers, ListChecks, Mail, MapPin, Phone, SlidersHorizontal, Tags, UserRound, Users } from 'lucide-react';
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

/** Project types of a division as chips (inactive ones muted). */
function ProjectTypeChips({ types }) {
  if (!types?.length) return <span className="muted small">No project types</span>;
  return (
    <div className="tpl-role-chips" style={{ maxWidth: 460 }}>
      {types.slice(0, 5).map((t) => (
        <span key={t.id} className="chip" style={t.isActive ? undefined : { opacity: 0.55, textDecoration: 'line-through' }}>
          {t.name}
        </span>
      ))}
      {types.length > 5 && (
        <span className="chip chip-more" title={types.slice(5).map((t) => t.name).join(', ')}>
          +{types.length - 5}
        </span>
      )}
    </div>
  );
}

/** Task groups of a category as chips, up to 4 then "+N". */
function GroupChips({ names }) {
  if (!names?.length) return <span className="muted small">Any task group</span>;
  return (
    <div className="tpl-role-chips" style={{ maxWidth: 420 }} title={names.join(', ')}>
      {names.slice(0, 4).map((n) => (
        <span key={n} className="chip">
          {n}
        </span>
      ))}
      {names.length > 4 && <span className="chip chip-more">+{names.length - 4}</span>}
    </div>
  );
}

/** Task types of a group as chips (inactive ones muted), up to 4 then "+N". */
export function TypeChips({ types }) {
  if (!types?.length) return <span className="muted small">No task types</span>;
  return (
    <div className="tpl-role-chips" style={{ maxWidth: 420 }} title={types.map((t) => t.name).join(', ')}>
      {types.slice(0, 4).map((t) => (
        <span key={t.id} className="chip" style={t.isActive ? undefined : { opacity: 0.55, textDecoration: 'line-through' }}>
          {t.name}
        </span>
      ))}
      {types.length > 4 && <span className="chip chip-more">+{types.length - 4}</span>}
    </div>
  );
}

/** Shifts of a site as chips: "Morning Shift 09:00–18:00" (inactive ones muted). */
function ShiftChips({ shifts }) {
  if (!shifts?.length) return <span className="muted small">No shifts</span>;
  return (
    <div className="tpl-role-chips" style={{ maxWidth: 520 }}>
      {shifts.map((x) => (
        <span key={x.id} className="chip" style={x.isActive ? undefined : { opacity: 0.55, textDecoration: 'line-through' }} title={x.lateAfterMinutes != null ? `Late after ${x.lateAfterMinutes} min` : undefined}>
          {x.name} <span className="muted">{x.startTime}–{x.endTime}</span>
        </span>
      ))}
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
      { key: 'userCount', label: 'Users', className: 'num right' },
    ],
    filters: [{ key: 'countryId', placeholder: 'Country', optionsFrom: { lookup: 'COUNTRY' } }],
    sections: [
      {
        title: 'Basic information',
        sub: 'e.g. Web India, SW UAE.',
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'countryId', label: 'Country', type: 'select', optionsFrom: { lookup: 'COUNTRY' } },
        ],
      },
    ],
    card: (r) => ({ title: r.name, sub: r.countryName ?? 'Team', meta: [[Globe, r.countryName ?? '—'], [Users, plural(r.userCount, 'user')]] }),
  },
  // Parameters → Parameters tab: the lists themselves (COUNTRY, CURRENCY, SKILL …)
  {
    key: 'parameter-types',
    screen: SCREENS.PARAMETERS,
    keepState: true,
    title: 'Parameters',
    singular: 'parameter',
    icon: SlidersHorizontal,
    search: 'Search parameters…',
    columns: [
      { key: 'name', label: 'Parameter', title: true, sub: (r) => r.description || undefined },
      { key: 'code', label: 'Code', render: (r) => <Badge>{r.code}</Badge> },
      { key: 'valueCount', label: 'Values', className: 'num right' },
      { key: 'isSystem', label: 'Built-in', render: (r) => (r.isSystem ? <Badge tone="info">Built-in</Badge> : <span className="muted">—</span>) },
      { key: 'displayOrder', label: 'Display order', className: 'num right' },
    ],
    filters: [],
    sections: [
      {
        title: 'Parameter',
        sub: 'A list of values used in dropdowns. Add its values on the Parameter Values tab. Built-in parameters keep their code.',
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true, max: 100, help: 'e.g. Lead Source' },
          { name: 'code', label: 'Code', type: 'upper', required: true, max: 50, help: 'e.g. LEAD_SOURCE – letters, digits and _' },
          { name: 'description', label: 'Description', type: 'textarea', span: 'all' },
          { name: 'displayOrder', label: 'Display order', type: 'number', default: '0' },
        ],
      },
    ],
    card: (r) => ({ title: r.name, sub: r.code, meta: [[ListTree, plural(r.valueCount, 'value')], [Hash, `Order ${r.displayOrder}`]], badge: r.isSystem ? <Badge tone="info">Built-in</Badge> : null }),
  },
  // Parameters → USD Rates tab: one current rate per currency
  {
    key: 'usd-rates',
    screen: SCREENS.PARAMETERS,
    path: SCREENS.USD_RATES,
    back: SCREENS.USD_RATES,
    keepState: true,
    noCreate: true, // one row per currency – add currencies on the Parameter Values tab
    noDelete: true,
    editLabel: 'Set rate',
    canEdit: (r) => !r.isFixed, // USD is always 1
    title: 'USD Rates',
    singular: 'USD rate',
    icon: DollarSign,
    search: 'Search currencies…',
    columns: [
      { key: 'name', label: 'Currency', title: true, sub: (r) => r.code ?? undefined },
      {
        key: 'usdRate',
        label: 'USD rate',
        render: (r) => (r.usdRate != null ? <b>{`1 ${r.code ?? ''} = ${r.usdRate} USD`}</b> : <Badge tone="danger">Missing – set the rate</Badge>),
      },
      { key: 'isFixed', label: 'Note', render: (r) => (r.isFixed ? <span className="muted small">always 1</span> : <span className="muted">—</span>) },
      { key: 'updatedByName', label: 'Updated by', render: (r) => r.updatedByName ?? <span className="muted">—</span> },
      { key: 'updatedAt', label: 'Updated', render: (r) => (r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—') },
    ],
    filters: [{ key: 'missing', placeholder: 'Rate', options: [{ value: true, label: 'Missing' }, { value: false, label: 'Set' }] }],
    sections: [
      {
        title: 'USD rate',
        sub: 'How many US dollars 1 unit of this currency is worth. Used to show project values, costs and rates in USD.',
        fields: [{ name: 'usdRate', label: 'USD rate', type: 'decimal', required: true, placeholder: 'e.g. 0.2723', help: '1 unit of the currency = this many USD' }],
      },
    ],
    card: (r) => ({ title: r.name, sub: r.code, meta: [[DollarSign, r.usdRate != null ? `1 = ${r.usdRate} USD` : 'Missing']], badge: null }),
  },
  // Parameters → Parameter Values tab
  {
    key: 'parameters',
    screen: SCREENS.PARAMETERS,
    path: SCREENS.PARAMETER_VALUES,
    back: SCREENS.PARAMETER_VALUES,
    keepState: true,
    title: 'Parameter Values',
    singular: 'parameter value',
    icon: ListTree,
    search: 'Search parameter values…',
    columns: [
      { key: 'name', label: 'Value', title: true },
      { key: 'type', label: 'Parameter', render: (r) => <Badge>{r.typeName ?? r.type}</Badge> },
      { key: 'value', label: 'Code', render: (r) => r.value ?? '—' },
      { key: 'displayOrder', label: 'Display order', className: 'num right' },
      { key: 'isVisible', label: 'Is visible', render: (r) => yesNo(r.isVisible) },
    ],
    filters: [
      { key: 'type', placeholder: 'Type', optionsFrom: { parameterTypes: true } },
      { key: 'isVisible', placeholder: 'Is visible', options: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }] },
    ],
    sections: [
      {
        title: 'Parameter value',
        sub: 'A value of one of the parameters (Parameters tab). The USD rate of a currency is set on the USD Rates tab.',
        fields: [
          { name: 'type', label: 'Parameter', type: 'select', required: true, optionsFrom: { parameterTypes: true }, help: 'which dropdown this value belongs to' },
          { name: 'name', label: 'Name', type: 'text', required: true, max: 150 },
          { name: 'value', label: 'Code', type: 'text', max: 150, help: 'optional code, e.g. INR for a currency' },
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
    form: 'site', // SiteFormPage (the site with its shifts)
    columns: [
      { key: 'name', label: 'Site', title: true, sub: (r) => plural(r.shifts.filter((x) => x.isActive).length, 'active shift') },
      { key: 'shifts', label: 'Shifts', className: '', render: (r) => <ShiftChips shifts={r.shifts} /> },
      { key: 'userCount', label: 'Users', className: 'num right' },
      { key: 'isActive', label: 'Active', render: (r) => <ActiveBadge active={r.isActive} /> },
    ],
    filters: [activeFilter],
    card: (r) => ({
      title: r.name,
      sub: r.shifts.map((x) => x.name).join(' · ') || 'Site',
      meta: [[Clock3, plural(r.shifts.length, 'shift')], [Users, plural(r.userCount, 'user')]],
      badge: <ActiveBadge active={r.isActive} />,
    }),
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
      { key: 'userCount', label: 'Users', className: 'num right' },
    ],
    filters: [],
    card: (r) => ({
      title: r.gradeName,
      sub: 'Resource grade',
      meta: [[Users, plural(r.userCount, 'user')]],
    }),
  },
  {
    key: 'task-groups',
    screen: SCREENS.TASK_GROUPS,
    title: 'Task Groups',
    singular: 'task group',
    icon: Layers,
    search: 'Search task groups…',
    keepState: true, // the tab keeps its search, filters and page when the user switches tabs
    columns: [
      { key: 'name', label: 'Task group', title: true, sub: (r) => plural(r.activeTypeCount, 'active task type') },
      { key: 'taskTypes', label: 'Task types', className: '', render: (r) => <TypeChips types={r.taskTypes} /> },
      { key: 'taskTypeCount', label: 'Types', className: 'num right' },
    ],
    filters: [],
    sections: [
      {
        title: 'Task group',
        sub: 'Groups task types for project estimates, timesheets and reports.',
        fields: [{ name: 'name', label: 'Name', type: 'text', required: true, max: 100, placeholder: 'e.g. Development' }],
      },
    ],
    // the task types of a group are managed on the Task Types screen
    rowActions: (r) => [{ label: 'Task types', icon: ListChecks, to: `${SCREENS.TASK_TYPES}?taskGroupId=${r.id}` }],
    card: (r) => ({ title: r.name, sub: 'Task group', meta: [[ListChecks, plural(r.taskTypeCount, 'task type')]] }),
  },
  {
    key: 'task-types',
    // the Task Types tab of "Task Groups & Types": its own pages, the menu's permissions
    screen: SCREENS.TASK_GROUPS,
    path: SCREENS.TASK_TYPES,
    back: SCREENS.TASK_TYPES,
    title: 'Task Types',
    singular: 'task type',
    icon: ListChecks,
    search: 'Search task types…',
    keepState: true, // the tab keeps its search, filters and page when the user switches tabs
    columns: [
      { key: 'name', label: 'Task type', title: true },
      { key: 'taskGroupName', label: 'Task group', render: (r) => <span className="badge">{r.taskGroupName}</span> },
      { key: 'description', label: 'Description', render: (r) => <span className="muted">{r.description || '—'}</span> },
      { key: 'isActive', label: 'Active', render: (r) => <ActiveBadge active={r.isActive} /> },
    ],
    filters: [
      { key: 'taskGroupId', placeholder: 'Task group', optionsFrom: { master: 'task-groups' } },
      activeFilter,
    ],
    sections: [
      {
        title: 'Task type',
        sub: 'A specific category of work logged in timesheets and project tasks.',
        fields: [
          { name: 'taskGroupId', label: 'Task group', type: 'select', required: true, optionsFrom: { master: 'task-groups' }, help: 'The task group this type belongs to' },
          { name: 'name', label: 'Name', type: 'text', required: true, max: 100, placeholder: 'e.g. Front-end Development' },
          { name: 'description', label: 'Description', type: 'textarea', max: 5000, placeholder: 'What this work covers (optional)' },
          activeSwitch,
        ],
      },
    ],
    card: (r) => ({
      title: r.name,
      sub: r.taskGroupName,
      badge: <ActiveBadge active={r.isActive} />,
    }),
  },
  {
    key: 'project-divisions',
    screen: SCREENS.PROJECT_DIVISIONS,
    title: 'Project Divisions',
    singular: 'division',
    icon: Building2,
    search: 'Search divisions…',
    keepState: true, // a tab of Business Division: keeps its search, filters and page
    form: 'division', // DivisionFormPage (the division with its quote rates)
    rowActions: (r) => [{ label: 'Add project type', icon: Briefcase, to: `${SCREENS.PROJECT_TYPES}/new?divisionId=${r.id}` }],
    columns: [
      { key: 'name', label: 'Division', title: true, sub: (r) => r.description || undefined },
      { key: 'projectTypes', label: 'Project types', className: '', render: (r) => <ProjectTypeChips types={r.projectTypes} /> },
      { key: 'projectCount', label: 'Projects', className: 'num right' },
      { key: 'isActive', label: 'Active', render: (r) => <ActiveBadge active={r.isActive} /> },
    ],
    filters: [activeFilter],
    card: (r) => ({
      title: r.name,
      sub: r.description || 'Division',
      meta: [[Briefcase, plural(r.projectTypes.length, 'project type')], [Layers, plural(r.projectCount, 'project')]],
      badge: <ActiveBadge active={r.isActive} />,
    }),
  },
  {
    key: 'project-types',
    // the Project Types tab of Business Division: its own pages, the division menu's permissions
    screen: SCREENS.PROJECT_DIVISIONS,
    path: SCREENS.PROJECT_TYPES,
    back: SCREENS.PROJECT_TYPES,
    keepState: true,
    title: 'Project Types',
    singular: 'project type',
    icon: Briefcase,
    search: 'Search project types or divisions…',
    form: 'projectType', // ProjectTypeFormPage (name, division, description)
    columns: [
      { key: 'name', label: 'Project type', title: true, sub: (r) => `${r.taskCount} template task${r.taskCount === 1 ? '' : 's'}` },
      { key: 'divisionName', label: 'Division', render: (r) => (r.divisionName ? <span className="badge">{r.divisionName}</span> : '—') },
      { key: 'split', label: 'Task-type split', render: (r) => <SplitBar split={r.split} />, className: '' },
      { key: 'description', label: 'Description', render: (r) => <span className="muted">{r.description || '—'}</span> },
      { key: 'projectCount', label: 'Projects', className: 'num right' },
      { key: 'isActive', label: 'Active', render: (r) => <ActiveBadge active={r.isActive} /> },
    ],
    filters: [{ key: 'divisionId', placeholder: 'Division', optionsFrom: { master: 'project-divisions' } }, activeFilter],
    card: (r) => ({
      title: r.name,
      sub: `${r.split.length} task groups`,
      meta: [[ListChecks, plural(r.taskCount, 'template task')], [FolderKanban, plural(r.projectCount, 'project')]],
      badge: <ActiveBadge active={r.isActive} />,
    }),
  },
  {
    key: 'task-templates',
    // the Task Templates tab of Business Division: one row per project type, edits its template
    screen: SCREENS.PROJECT_DIVISIONS,
    path: SCREENS.TASK_TEMPLATES,
    back: SCREENS.TASK_TEMPLATES,
    apiKey: 'project-types',
    keepState: true,
    // "New task template" picks the project type (a template belongs to one) – see TaskTemplateFormPage
    noDelete: true,
    editLabel: 'Edit template',
    title: 'Task Templates',
    singular: 'task template',
    icon: ListChecks,
    search: 'Search project types or divisions…',
    form: 'taskTemplate', // the template editor of a project type
    columns: [
      { key: 'name', label: 'Project type', title: true, sub: (r) => r.divisionName ?? undefined },
      { key: 'taskCount', label: 'Template tasks', className: 'num right' },
      {
        key: 'templateGroups',
        label: 'Task groups',
        className: '',
        render: (r) =>
          r.templateGroups?.length ? (
            <div className="tpl-role-chips" style={{ maxWidth: 460 }}>
              {r.templateGroups.map((g) => (
                <span key={g.name} className="chip">
                  {g.name} <span className="muted">{g.count}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="muted small">No template tasks</span>
          ),
      },
      { key: 'isActive', label: 'Active', render: (r) => <ActiveBadge active={r.isActive} /> },
    ],
    filters: [{ key: 'divisionId', placeholder: 'Division', optionsFrom: { master: 'project-divisions' } }],
    card: (r) => ({
      title: r.name,
      sub: r.divisionName ?? 'Project type',
      meta: [[ListChecks, plural(r.taskCount, 'template task')], [Layers, plural(r.templateGroups?.length ?? 0, 'task group')]],
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
      { key: 'value', placeholder: 'Counts as', options: STAGE_CATEGORIES },
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
    key: 'task-categories',
    // the Task Categories tab of "Task Groups & Types": its own pages, the menu's permissions
    screen: SCREENS.TASK_GROUPS,
    path: SCREENS.TASK_CATEGORIES,
    back: SCREENS.TASK_CATEGORIES,
    title: 'Task Categories',
    singular: 'task category',
    icon: ClipboardList,
    search: 'Search task categories…',
    keepState: true, // the tab keeps its search, filters and page when the user switches tabs
    columns: [
      { key: 'name', label: 'Category', title: true, sub: (r) => r.description || undefined },
      { key: 'taskGroupNames', label: 'Task groups', render: (r) => <GroupChips names={r.taskGroupNames} /> },
      { key: 'isProject', label: 'Needs a project', render: (r) => yesNo(r.isProject) },
      { key: 'displayOrder', label: 'Display order', className: 'num right' },
      { key: 'taskCount', label: 'Tasks', className: 'num right' },
      { key: 'isActive', label: 'Active', render: (r) => <ActiveBadge active={r.isActive} /> },
    ],
    filters: [activeFilter],
    sections: [
      {
        title: 'Task category',
        sub: 'e.g. Project, Personal, Activity. Tasks of a "needs a project" category are added to a project.',
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true, max: 100 },
          { name: 'displayOrder', label: 'Display order', type: 'number', default: '0' },
          { name: 'description', label: 'Description', type: 'textarea', span: 'all' },
          { name: 'taskGroupIds', label: 'Task groups', type: 'multiselect', optionsFrom: { master: 'task-groups' }, span: 'all', help: 'the task groups tasks of this category can use – leave empty to allow any group' },
          { name: 'isProject', label: 'Needs a project', type: 'switch', default: false, help: 'the task form asks for the project' },
          activeSwitch,
        ],
      },
    ],
    card: (r) => ({
      title: r.name,
      sub: r.taskGroupNames?.length ? r.taskGroupNames.join(', ') : r.isProject ? 'Project tasks' : 'Not tied to a project',
      meta: [[ListChecks, plural(r.taskCount, 'task')], [Hash, `Order ${r.displayOrder}`]],
      badge: <ActiveBadge active={r.isActive} />,
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
    filters: [{ key: 'countryId', placeholder: 'Country', optionsFrom: { lookup: 'COUNTRY' } }, activeFilter],
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
