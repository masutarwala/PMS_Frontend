import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Check, ChartPie, Clock3, Download, FolderKanban, Pencil, Plus, Search, Trash2, UserRound, Users } from 'lucide-react';
import { timesheetsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAuth, usePermissions } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { EmptyState, UserCell } from '@/components/ui/Display';
import { Dropdown } from '@/components/ui/Dropdown';
import { ActiveFilters } from '@/components/ui/ListKit';
import { DonutCard, GaugeCard, KpiSection, WatermarkCard } from '@/components/ui/MetricCards';
import { ConfirmDeleteModal } from '@/components/ui/Modal';
import { TableFoot } from '@/components/ui/Pager';
import { TableLoading } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useDebounce } from '@/hooks/useDebounce';
import { useMasterOptions } from '@/hooks/useOptions';
import { SCREENS } from '@/lib/constants';
import { downloadCsv } from '@/lib/csv';
import { DATE_RANGES, rangeFor } from '@/lib/dates';
import { formatDate, formatNumber } from '@/lib/format';

const WEEK_TARGET = 40; // hours a week for the "This week" gauge
const RANGES = DATE_RANGES.filter((r) => r.value !== 'custom');
const EMPTY_FILTERS = { projectId: [], taskGroupId: [], isBillable: null, dateRange: 'this_week' };

function Summary({ s }) {
  const week = s?.weekHours ?? 0;
  const billPct = week ? (s.billableHours / week) * 100 : 0;
  return (
    <KpiSection storageKey="timesheet">
      <GaugeCard
        title="This week"
        icon={Clock3}
        pill={week >= WEEK_TARGET ? 'Great result' : week >= WEEK_TARGET * 0.75 ? 'On track' : 'Keep going'}
        value={week}
        max={WEEK_TARGET}
        unit="h"
      />
      <DonutCard
        title="Billable"
        icon={ChartPie}
        pill={`${Math.round(billPct)}%`}
        percent={billPct}
        value={s?.billableHours ?? 0}
        unit="h"
        legend={[
          ['Billable', billPct, '#16A34A'],
          ['Non-billable', week ? 100 - billPct : 0, 'var(--surface-3)'],
        ]}
      />
      <WatermarkCard
        title="Today"
        icon={CalendarCheck}
        value={s?.todayHours ?? 0}
        unit="h"
        subs={s && [[s.daysLogged, 'Days this week'], [s.nonBillableHours, 'Non-billable h']]}
      />
      <WatermarkCard
        title="Projects"
        icon={FolderKanban}
        value={s?.projects ?? 0}
        subs={s && [[s.clientProjects, 'Client'], [s.internalProjects, 'Internal']]}
      />
    </KpiSection>
  );
}

export default function TimesheetListPage() {
  const perms = usePermissions(SCREENS.TIMESHEET);
  const { user } = useAuth();
  // Team tab: Project Managers and the Super Admin only (the API checks it too)
  const tabs = user.isSuperAdmin
    ? [['team', 'All timesheets', Users]]
    : [['mine', 'My timesheet', UserRound], ...(user.role.code === 'PROJECT_MANAGER' ? [['team', 'Team', Users]] : [])];
  const toast = useToast();
  const queryClient = useQueryClient();
  // the Super Admin only reviews time: everyone's entries, no "My timesheet"
  const [scope, setScope] = useState(user.isSuperAdmin ? 'team' : 'mine');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [toDelete, setToDelete] = useState(null);
  const debouncedSearch = useDebounce(search);

  const groups = useMasterOptions('task-groups');
  // filter: all projects for the Super Admin, otherwise the projects the user is on
  const filterProjects = useQuery({ queryKey: ['timesheets', 'filter-projects'], queryFn: timesheetsApi.projects });
  const projectOptions = (filterProjects.data ?? []).map((p) => ({ value: p.id, label: p.title }));

  const range = filters.dateRange ? rangeFor(filters.dateRange) : null;
  const params = {
    scope,
    search: debouncedSearch,
    projectId: filters.projectId,
    taskGroupId: filters.taskGroupId,
    isBillable: filters.isBillable ?? undefined,
    from: range?.from,
    to: range?.to,
    page,
    pageSize,
  };
  const list = useQuery({ queryKey: ['timesheets', 'list', params], queryFn: () => timesheetsApi.list(params), placeholderData: keepPreviousData });
  const summary = useQuery({ queryKey: ['timesheets', 'summary', scope], queryFn: () => timesheetsApi.summary(scope) });
  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  const remove = useMutation({
    mutationFn: (id) => timesheetsApi.remove(id),
    onSuccess: () => toast.success('Time entry deleted'),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => {
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const setFilter = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const chips = useMemo(() => {
    const out = [];
    if (filters.dateRange) out.push({ key: 'date', label: 'Date', value: RANGES.find((r) => r.value === filters.dateRange)?.label, onRemove: () => setFilter('dateRange', null) });
    if (filters.isBillable !== null) out.push({ key: 'bill', label: 'Billable', value: filters.isBillable ? 'Yes' : 'No', onRemove: () => setFilter('isBillable', null) });
    return out;
  }, [filters]);

  const exportRows = () =>
    downloadCsv(
      'timesheet.csv',
      ['Date', 'User', 'Project', 'Code', 'Task group', 'Task type', 'Task', 'Minutes', 'Billable', 'Work done'],
      items.map((t) => [t.workDate, t.userName, t.projectTitle, t.projectCode, t.taskGroupName, t.taskTypeName, t.taskName, t.minutes, t.isBillable ? 'Yes' : 'No', t.comment]),
    );

  const team = scope === 'team';
  const colSpan = team ? 9 : 8;

  return (
    <>
      <Topbar title="Timesheet" breadcrumb={['Timesheet']} />
      <Summary s={summary.data} />

      <div className="page-head">
        <div className="tabs" role="tablist">
          {tabs.map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={scope === key}
              className={`tab${scope === key ? ' is-active' : ''}`}
              onClick={() => {
                setScope(key);
                setFilters((f) => ({ ...f, projectId: [] }));
                setPage(1);
              }}
            >
              <span className="tab-ico">
                <Icon />
              </span>
              {label}
            </button>
          ))}
        </div>
        <div className="actions">
          {perms.export && (
            <button type="button" className="btn btn-secondary" onClick={exportRows} disabled={!items.length}>
              <Download />
              Export
            </button>
          )}
          {perms.create && (
            <Link className="btn btn-primary" to="/timesheet/new">
              <Plus />
              Log time
            </Link>
          )}
        </div>
      </div>

      <div className="card card-flush">
        <div className="filter-bar">
          <div className="input-group search">
            <Search />
            <input
              className="input"
              placeholder="Search by project, task type or work done…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Dropdown pill multi search placeholder="Project" options={projectOptions} value={filters.projectId} onChange={(v) => setFilter('projectId', v)} />
          <Dropdown pill multi search placeholder="Task group" options={groups.options} value={filters.taskGroupId} onChange={(v) => setFilter('taskGroupId', v)} />
          <Dropdown
            pill
            clearable
            placeholder="Billable"
            options={[
              { value: 'yes', label: 'Billable' },
              { value: 'no', label: 'Non-billable' },
            ]}
            value={filters.isBillable === null ? null : filters.isBillable ? 'yes' : 'no'}
            onChange={(v) => setFilter('isBillable', v === null ? null : v === 'yes')}
          />
          <Dropdown pill clearable placeholder="Date" options={RANGES} value={filters.dateRange} onChange={(v) => setFilter('dateRange', v)} />
        </div>

        <ActiveFilters chips={chips} show={chips.length > 0} onClearAll={() => setFilters({ ...EMPTY_FILTERS, dateRange: null })} />

        {!list.isLoading && items.length === 0 ? (
          <EmptyState icon={Clock3} title="No time logged" action={perms.create && scope === 'mine' ? <Link className="btn btn-primary btn-sm" to="/timesheet/new"><Plus />Log time</Link> : undefined}>
            {debouncedSearch || filters.projectId.length || filters.taskGroupId.length || filters.isBillable !== null ? 'No entries match the filters.' : 'No entries in this period.'}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  {team && <th>User</th>}
                  <th>Project</th>
                  <th>Task group / type</th>
                  <th>Task</th>
                  <th>Work done</th>
                  <th className="right">Time spent</th>
                  <th className="center">Billable</th>
                  <th className="col-actions" />
                </tr>
              </thead>
              <tbody>
                {list.isLoading && <TableLoading colSpan={colSpan} />}
                {items.map((t) => {
                  const own = t.userId === user.id;
                  return (
                    <tr key={t.id}>
                      <td className="nowrap">
                        <b>{formatDate(t.workDate)}</b>
                      </td>
                      {team && (
                        <td>
                          <UserCell name={t.userName} />
                        </td>
                      )}
                      <td>
                        <Link className="cell-title" to={`/projects/${t.projectId}`} style={{ color: 'var(--ink)' }}>
                          {t.projectTitle}
                        </Link>
                        <div className="cell-sub">{t.projectCode}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{t.taskGroupName}</div>
                        <div className="cell-sub">{t.taskTypeName}</div>
                      </td>
                      <td>{t.taskName ?? <span className="muted">—</span>}</td>
                      <td className="pl-comment">
                        <div className="pl-comment-text" style={{ fontWeight: 500 }} title={t.comment ?? ''}>
                          {t.comment || <span className="muted">—</span>}
                        </div>
                      </td>
                      <td className="num right">
                        <b>{formatNumber(t.minutes)} mins</b>
                      </td>
                      <td className="center">{t.isBillable ? <Check className="yes-ico" /> : <span className="muted">—</span>}</td>
                      <td className="col-actions">
                        {own && (
                          <div className="row-actions">
                            {perms.edit && (
                              <Link className="btn btn-ghost btn-icon" to={`/timesheet/${t.id}/edit`} title="Edit">
                                <Pencil />
                              </Link>
                            )}
                            {perms.delete && (
                              <button type="button" className="btn btn-ghost btn-icon" title="Delete" onClick={() => setToDelete(t)}>
                                <Trash2 />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {items.length > 0 && (
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <td colSpan={team ? 6 : 5}>
                      <b>Total</b> <span className="muted small">({total} entr{total === 1 ? 'y' : 'ies'})</span>
                    </td>
                    <td className="num right">
                      <b>{formatNumber(list.data?.totalMinutes ?? 0)} mins</b>
                    </td>
                    <td colSpan={2} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <TableFoot
            page={page}
            pageSize={pageSize}
            total={total}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        )}
      </div>

      <ConfirmDeleteModal
        open={!!toDelete}
        title="Delete time entry?"
        message={toDelete ? `${formatNumber(toDelete.minutes)} mins on ${toDelete.projectTitle} (${formatDate(toDelete.workDate)}) will be removed and no longer count in the project analysis.` : ''}
        busy={remove.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => remove.mutate(toDelete.id)}
      />
    </>
  );
}
