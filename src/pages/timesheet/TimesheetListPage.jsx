import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Check, ChartPie, Clock3, Download, ExternalLink, FolderKanban, Lock, Pencil, Plus, Search, Trash2, UserRound, Users } from 'lucide-react';
import { taskAccessApi, timesheetsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAuth, usePermissions } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { EmptyState, UserCell } from '@/components/ui/Display';
import { Dropdown } from '@/components/ui/Dropdown';
import { ActiveFilters, SingleFilter } from '@/components/ui/ListKit';
import { DonutCard, GaugeCard, KpiSection, WatermarkCard } from '@/components/ui/MetricCards';
import { ConfirmDeleteModal } from '@/components/ui/Modal';
import { TableFoot } from '@/components/ui/Pager';
import { ColumnPicker, RowMenu, useColumns } from '@/components/ui/ColumnPicker';
import { TableLoading } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useDebounce } from '@/hooks/useDebounce';
import { useSessionState } from '@/hooks/useSessionState';
import { useMasterOptions } from '@/hooks/useOptions';
import { SCREENS } from '@/lib/constants';
import { downloadCsv } from '@/lib/csv';
import { DATE_RANGES, rangeFor } from '@/lib/dates';
import { formatDate, formatNumber } from '@/lib/format';

const WEEK_TARGET = 40; // hours a week for the "This week" gauge
const RANGES = DATE_RANGES.filter((r) => r.value !== 'custom');
const EMPTY_FILTERS = { categoryId: [], projectId: [], taskGroupId: [], userId: [], isBillable: null, dateRange: 'today' };

function Summary({ s, actions }) {
  const week = s?.weekHours ?? 0;
  const billPct = week ? (s.billableHours / week) * 100 : 0;
  return (
    <KpiSection storageKey="timesheet" actions={actions}>
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
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  // no tabs: my own entries, or the people picked in the Employee filter (the Super Admin reviews everyone's)
  const scope = user.isSuperAdmin ? 'team' : 'mine';
  const [search, setSearch] = useSessionState('timesheet.search', '');
  const [filters, setFilters] = useSessionState('timesheet.filters', EMPTY_FILTERS);
  const [page, setPage] = useSessionState('timesheet.page', 1);
  const [pageSize, setPageSize] = useSessionState('timesheet.pageSize', 10);
  const [toDelete, setToDelete] = useState(null);
  const debouncedSearch = useDebounce(search);

  const groups = useMasterOptions('task-groups');
  // filter: all projects for the Super Admin, otherwise the projects the user is on
  const filterProjects = useQuery({ queryKey: ['timesheets', 'filter-projects'], queryFn: timesheetsApi.projects });
  const projectOptions = (filterProjects.data ?? []).map((p) => ({ value: p.id, label: p.title }));
  // task categories (Project, Personal, Activity …)
  const meta = useQuery({ queryKey: ['timesheets', 'meta'], queryFn: timesheetsApi.meta, staleTime: 5 * 60 * 1000 });
  const categoryOptions = (meta.data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }));
  const categoryIds = filters.categoryId ?? []; // filters saved before the category filter have none
  // Employee filter: people whose time I can see (role scope, my projects, Task Master)
  const people = useQuery({ queryKey: ['task-access', 'visible-users'], queryFn: taskAccessApi.visibleUsers, staleTime: 5 * 60 * 1000 });
  const employeeOptions = (people.data ?? []).map((u) => ({ value: u.id, label: u.id === user?.id ? `${u.name} (me)` : u.name }));
  const employeeIds = filters.userId ?? [];

  const range = filters.dateRange ? rangeFor(filters.dateRange) : null;
  const params = {
    scope,
    search: debouncedSearch,
    categoryId: categoryIds,
    userId: employeeIds,
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

  const setFilter = useCallback(
    (k, v) => {
      setFilters((f) => ({ ...f, [k]: v }));
      setPage(1);
    },
    [setFilters, setPage],
  );

  const chips = useMemo(() => {
    const out = [];
    if (filters.dateRange) out.push({ key: 'date', label: 'Date', value: RANGES.find((r) => r.value === filters.dateRange)?.label, onRemove: () => setFilter('dateRange', null) });
    if (filters.isBillable !== null) out.push({ key: 'bill', label: 'Billable', value: filters.isBillable ? 'Yes' : 'No', onRemove: () => setFilter('isBillable', null) });
    return out;
  }, [filters, setFilter]);

  const exportRows = () =>
    downloadCsv(
      'timesheet.csv',
      ['Date', 'User', 'Category', 'Project', 'Code', 'Task group', 'Task type', 'Task', 'Minutes', 'Billable', 'Work done'],
      items.map((t) => [t.workDate, t.userName, t.categoryName, t.projectTitle, t.projectCode, t.taskGroupName, t.taskTypeName, t.taskName, t.minutes, t.isBillable ? 'Yes' : 'No', t.comment]),
    );

  const team = scope === 'team';

  const rowMenu = (t) => (
    <RowMenu
      items={[
        { label: 'Open project', icon: ExternalLink, onClick: () => navigate(`/projects/${t.projectId}`) },
        { label: 'Edit', icon: Pencil, hidden: t.userId !== user.id || !perms.edit, onClick: () => navigate(`/timesheet/${t.id}/edit`) },
        { divider: true, hidden: t.userId !== user.id || !perms.delete },
        { label: 'Delete', icon: Trash2, danger: true, hidden: t.userId !== user.id || !perms.delete, onClick: () => setToDelete(t) },
      ]}
    />
  );

  // table columns – shown / hidden and ordered by the user (Columns button); "User" for the Super Admin or with the Employee filter
  const cols = useColumns(
    'timesheet',
    [
      {
        key: 'date',
        label: 'Date',
        locked: true,
        td: (t) => (
          <td key="date" className="nowrap">
            <b>{formatDate(t.workDate)}</b>
          </td>
        ),
      },
      {
        key: 'user',
        label: 'User',
        td: (t) => (
          <td key="user">
            <UserCell name={t.userName} />
          </td>
        ),
      },
      {
        key: 'category',
        label: 'Category',
        td: (t) => (
          <td key="category" className="nowrap">
            {t.categoryName ?? <span className="muted">—</span>}
          </td>
        ),
      },
      {
        key: 'project',
        label: 'Project',
        // project time links to the project; Personal / Activity … time has none
        td: (t) => (
          <td key="project">
            {t.projectId ? (
              <Link className="cell-title" to={`/projects/${t.projectId}`} style={{ color: 'var(--ink)' }}>
                {t.projectTitle}
              </Link>
            ) : (
              <span className="muted">—</span>
            )}
          </td>
        ),
      },
      {
        key: 'group',
        label: 'Task group / type',
        td: (t) => (
          <td key="group">
            <div style={{ fontWeight: 600 }}>{t.taskGroupName ?? <span className="muted">—</span>}</div>
            {t.taskTypeName && <div className="cell-sub">{t.taskTypeName}</div>}
          </td>
        ),
      },
      {
        key: 'comment',
        label: 'Work done',
        td: (t) => (
          <td key="comment" className="pl-comment">
            <div className={`pl-comment-text${t.isMasked ? ' is-private' : ''}`} style={{ fontWeight: 500 }} title={t.isMasked ? 'Personal – the details are private' : (t.comment ?? '')}>
              {t.isMasked && <Lock className="private-ico" />}
              {t.comment || <span className="muted">—</span>}
            </div>
          </td>
        ),
      },
      {
        key: 'minutes',
        label: 'Time spent',
        className: 'right',
        td: (t) => (
          <td key="minutes" className="num right">
            <b>{formatNumber(t.minutes)} mins</b>
          </td>
        ),
      },
      {
        key: 'billable',
        label: 'Billable',
        className: 'center',
        td: (t) => (
          <td key="billable" className="center">
            {t.isBillable ? <Check className="yes-ico" /> : <span className="muted">—</span>}
          </td>
        ),
      },
    ].filter((c) => team || employeeIds.length > 0 || c.key !== 'user'), // "User" on the team view or with the Employee filter
  );

  return (
    <>
      <Topbar title="Timesheet" breadcrumb={['Timesheet']} />
      {/* the buttons share the summary's row when the cards are hidden */}
      <Summary
        s={summary.data}
        actions={
          (perms.export || perms.create) && (
            <>
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
            </>
          )
        }
      />

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
          <SingleFilter placeholder="Task category" options={categoryOptions} value={categoryIds} onChange={(v) => setFilter('categoryId', v)} />
          {employeeOptions.length > 1 && <SingleFilter search placeholder="Employee" options={employeeOptions} value={employeeIds} onChange={(v) => setFilter('userId', v)} />}
          <SingleFilter search placeholder="Project" options={projectOptions} value={filters.projectId} onChange={(v) => setFilter('projectId', v)} />
          <SingleFilter search placeholder="Task group" options={groups.options} value={filters.taskGroupId} onChange={(v) => setFilter('taskGroupId', v)} />
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
          <span className="spacer" />
          <ColumnPicker cols={cols} />
        </div>

        <ActiveFilters chips={chips} show={chips.length > 0} onClearAll={() => setFilters({ ...EMPTY_FILTERS, dateRange: null })} />

        {!list.isLoading && items.length === 0 ? (
          <EmptyState icon={Clock3} title="No time logged" action={perms.create && scope === 'mine' ? <Link className="btn btn-primary btn-sm" to="/timesheet/new"><Plus />Log time</Link> : undefined}>
            {debouncedSearch || categoryIds.length || filters.projectId.length || filters.taskGroupId.length || filters.isBillable !== null ? 'No entries match the filters.' : 'No entries in this period.'}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-menu" />
                  {cols.columns.map((c) => (
                    <th key={c.key} className={c.className}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.isLoading && <TableLoading colSpan={cols.columns.length + 1} />}
                {items.map((t) => (
                  <tr key={t.id}>
                    <td className="col-menu">{rowMenu(t)}</td>
                    {cols.columns.map((c) => c.td(t))}
                  </tr>
                ))}
                {items.length > 0 && (
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <td className="col-menu" />
                    {cols.columns.map((c, i) =>
                      c.key === 'minutes' ? (
                        <td key={c.key} className="num right">
                          <b>{formatNumber(list.data?.totalMinutes ?? 0)} mins</b>
                        </td>
                      ) : i === 0 ? (
                        <td key={c.key}>
                          <b>Total</b> <span className="muted small">({total} entr{total === 1 ? 'y' : 'ies'})</span>
                        </td>
                      ) : (
                        <td key={c.key} />
                      ),
                    )}
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
        message={toDelete ? `${formatNumber(toDelete.minutes)} mins on ${toDelete.projectTitle ?? toDelete.categoryName} (${formatDate(toDelete.workDate)}) will be removed${toDelete.projectId ? ' and no longer count in the project analysis' : ''}.` : ''}
        busy={remove.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => remove.mutate(toDelete.id)}
      />
    </>
  );
}
