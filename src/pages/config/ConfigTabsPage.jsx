import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Briefcase, Building2, ClipboardList, DollarSign, Download, Layers, ListChecks, ListTree, Plus, SlidersHorizontal } from 'lucide-react';
import { usePermissions } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { downloadCsv } from '@/lib/csv';
import { SCREENS } from '@/lib/constants';
import ConfigListPage from './ConfigListPage';
import { CONFIG_SCREENS } from './screens';

/*
 * One menu, several tabs – each tab a configuration list with its own URL, so the menu, the page
 * title and the tab always agree. All tabs of a page share the menu's permissions, and each tab keeps
 * its own search, filters and page (the screens' keepState).
 */
const PAGES = [
  {
    title: 'Parameters',
    screen: SCREENS.PARAMETERS,
    tabs: [
      { key: 'parameter-types', label: 'Parameters', icon: SlidersHorizontal },
      { key: 'parameters', label: 'Parameter Values', icon: ListTree },
      { key: 'usd-rates', label: 'USD Rates', icon: DollarSign },
    ],
  },
  {
    title: 'Task Groups & Types',
    screen: SCREENS.TASK_GROUPS,
    tabs: [
      { key: 'task-groups', label: 'Task Groups', icon: Layers },
      { key: 'task-types', label: 'Task Types', icon: ListChecks },
      { key: 'task-categories', label: 'Task Categories', icon: ClipboardList },
    ],
  },
  {
    title: 'Business Division',
    screen: SCREENS.PROJECT_DIVISIONS,
    tabs: [
      { key: 'project-divisions', label: 'Project Divisions', icon: Building2 },
      { key: 'project-types', label: 'Project Types', icon: Briefcase },
      { key: 'task-templates', label: 'Task Templates', icon: ClipboardList },
    ],
  },
];
export const TABBED_KEYS = PAGES.flatMap((pg) => pg.tabs.map((t) => t.key));

const defOf = (key) => CONFIG_SCREENS.find((s) => s.key === key);
const urlOf = (def) => def.path ?? def.screen;
const text = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? '' : String(v));

export default function ConfigTabsPage({ def }) {
  const page = PAGES.find((pg) => pg.tabs.some((t) => t.key === def.key));
  const navigate = useNavigate();
  const perms = usePermissions(page.screen);

  // the rows of the visible tab, for the Export button in the header
  const [rows, setRows] = useState({ items: [], total: 0 });
  const handleRows = useCallback((items, total) => setRows({ items, total }), []);
  const exportRows = () =>
    downloadCsv(
      `${def.key}.csv`,
      def.columns.map((c) => c.label),
      rows.items.map((r) => def.columns.map((c) => text(r[c.key]))),
    );

  return (
    <>
      <Topbar
        title={page.title}
        breadcrumb={['Administration']}
        actions={
          <>
            {perms.export && (
              <button type="button" className="btn btn-secondary" disabled={!rows.items.length} onClick={exportRows}>
                <Download />
                Export
              </button>
            )}
            {perms.create && !def.noCreate && (
              <Link className="btn btn-primary" to={`${urlOf(def)}/new`}>
                <Plus />
                New {def.singular}
              </Link>
            )}
          </>
        }
      />

      <div className="page-head">
        <div className="tabs" role="tablist">
          {perms.view &&
            page.tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={def.key === t.key}
                className={`tab${def.key === t.key ? ' is-active' : ''}`}
                onClick={() => navigate(urlOf(defOf(t.key)))}
              >
                <span className="tab-ico">
                  <t.icon />
                </span>
                {t.label}
              </button>
            ))}
        </div>
      </div>

      <ConfigListPage def={def} embedded onRows={handleRows} />
    </>
  );
}
