import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown, ArrowUp, ArrowUpRight, Building2, Calendar, ChartPie, ChevronRight, ChevronsUpDown, Clock3, Copy, Crown, Download,
  ExternalLink, Eye, FolderKanban, LayoutGrid, Pencil, Plus, Search, SlidersHorizontal, Trash2,
  TriangleAlert, UserRound,
} from 'lucide-react';
import { projectsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { usePermissions } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { Dropdown } from '@/components/ui/Dropdown';
import { Avatar, EmptyState, ErrorAlert, StageBadge, UserCell } from '@/components/ui/Display';
import { Field, Switch } from '@/components/ui/Field';
import { DatePicker } from '@/components/ui/DatePicker';
import {
  ActiveFilters, CARD_TONES, Drawer, ViewSwitch, useSelection, useViewMode, SingleFilter } from '@/components/ui/ListKit';
import { AlertCard, AreaCard, ColumnsCard, KpiSection, PieCard } from '@/components/ui/MetricCards';
import { ConfirmDeleteModal, Modal } from '@/components/ui/Modal';
import { TableFoot } from '@/components/ui/Pager';
import { ColumnPicker, RowMenu, useColumns } from '@/components/ui/ColumnPicker';
import { TableLoading } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useDebounce } from '@/hooks/useDebounce';
import { useSessionState } from '@/hooks/useSessionState';
import { useMasterOptions, useStageOptions } from '@/hooks/useOptions';
import { SCREENS } from '@/lib/constants';
import { downloadCsv } from '@/lib/csv';
import { DATE_RANGES, rangeFor } from '@/lib/dates';
import { formatDate, formatNumber } from '@/lib/format';
import { ProjectQuickView } from './ProjectQuickView';
import { todayWeekday } from '@/lib/timezone';

const EMPTY_FILTERS = {
  stageId: [], divisionId: [], typeId: [], ownerId: [], customerId: [], isRetainerProject: null,
  dateRange: null, startFrom: '', startTo: '', endFrom: '', endTo: '', overdue: false,
};
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Bar colour follows hours burned: amber close to the estimate, red over it. */
function burnClass(p) {
  if (!p.estimatedHours) return '';
  const r = p.loggedHours / p.estimatedHours;
  return r > 1 ? ' is-danger' : r >= 0.85 ? ' is-warning' : '';
}

function SortHeader({ label, field, sort, onSort }) {
  const active = sort.by === field;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={`sortable${active ? ' is-sorted' : ''}${active && sort.dir === 'asc' ? ' is-asc' : ''}`}>
      <button type="button" className="th-sort" onClick={() => onSort(field)}>
        {label}
        <span className="sort">
          <Icon />
        </span>
      </button>
    </th>
  );
}

function ProjectSummary({ s, onFilter, onStage }) {
  const weekTotal = s?.hoursThisMonth.week ?? [];
  const today = todayWeekday(); // Monday = 0, user's time zone
  return (
    <KpiSection storageKey="projects">
      <AreaCard
        title="Active projects"
        icon={FolderKanban}
        value={s?.active}
        trend={s?.createdThisMonth ? { value: s.createdThisMonth, label: 'this month' } : null}
        subs={s && [[s.activeHealth.onTrack, 'On track'], [s.activeHealth.atRisk, 'At risk'], [s.activeHealth.late, 'Late']]}
        series={s?.createdByMonth}
      />
      <PieCard
        title="Project stages"
        icon={ChartPie}
        caption="projects"
        pill={s ? formatNumber(s.total) : undefined}
        items={(s?.byStage ?? []).filter((x) => x.count > 0).map((x) => ({ key: x.id, label: x.name, value: x.count }))}
        onSelect={(it) => onStage(it.key)}
      />
      <AlertCard
        title="Over allocation"
        icon={TriangleAlert}
        value={s?.overAllocation.total}
        items={(s?.overAllocation.items ?? []).map((o) => ({ key: o.id, name: o.ownerName, label: o.title, percent: o.percent }))}
        emptyText="No project is over its estimate"
        action={s?.overAllocation.total ? { label: 'Review projects', onClick: onFilter } : null}
        more={(s?.overAllocation.total ?? 0) - (s?.overAllocation.items.length ?? 0)}
      />
      <ColumnsCard
        title="Hours this month"
        icon={Clock3}
        value={s?.hoursThisMonth.total}
        pill={s ? formatNumber(s.hoursThisMonth.total) : undefined}
        subs={s && [[s.hoursThisMonth.billable, 'Billable'], [s.hoursThisMonth.internal, 'Internal']]}
        bars={weekTotal.map((h) => ({ value: h, label: `${formatNumber(h)}h` }))}
        days={DAYS}
        highlight={weekTotal[today] > 0 ? today : undefined}
      />
    </KpiSection>
  );
}

/** "More filters" drawer: start / end date ranges and overdue only. */
function MoreFilters({ open, onClose, filters, onApply }) {
  const [draft, setDraft] = useState(filters);
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target ? e.target.value : e }));
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="More filters"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => setDraft({ ...draft, startFrom: '', startTo: '', endFrom: '', endTo: '', overdue: false, dateRange: null })}>
            Reset
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onApply(draft)}>
            Apply filters
          </button>
        </>
      }
    >
      <div className="modal-body">
        <div className="col" style={{ gap: 16 }}>
          <div className="form-grid">
            <Field label="Start date from">
              <DatePicker value={draft.startFrom} onChange={set('startFrom')} max={draft.startTo || undefined} placeholder="Any" />
            </Field>
            <Field label="Start date to">
              <DatePicker value={draft.startTo} onChange={set('startTo')} min={draft.startFrom || undefined} placeholder="Any" />
            </Field>
            <Field label="End date from">
              <DatePicker value={draft.endFrom} onChange={set('endFrom')} max={draft.endTo || undefined} placeholder="Any" />
            </Field>
            <Field label="End date to">
              <DatePicker value={draft.endTo} onChange={set('endTo')} min={draft.endFrom || undefined} placeholder="Any" />
            </Field>
          </div>
          <Switch label="Overdue only (past end date, not completed)" checked={draft.overdue} onChange={set('overdue')} />
        </div>
      </div>
    </Drawer>
  );
}

/** Long text in a table cell: cut with … at a fixed width, full text on hover. */
function Trunc({ text, width = 200 }) {
  if (!text) return <span className="muted">—</span>;
  return (
    <span className="cell-trunc" style={{ maxWidth: width }} title={text}>
      {text}
    </span>
  );
}

export default function ProjectListPage() {
  const perms = usePermissions(SCREENS.PROJECTS);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useSessionState('projects.tab', 'all');
  const [view, setView] = useViewMode('projects');
  const [search, setSearch] = useSessionState('projects.search', '');
  const [filters, setFilters] = useSessionState('projects.filters', EMPTY_FILTERS);
  const [sort, setSort] = useSessionState('projects.sort', { by: 'createdAt', dir: 'desc' });
  const [page, setPage] = useSessionState('projects.page', 1);
  const [pageSize, setPageSize] = useSessionState('projects.pageSize', 10);
  const [toDelete, setToDelete] = useState(null); // project or 'bulk'
  const [quick, setQuick] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [bulk, setBulk] = useState(null); // 'stage' | 'owner'
  const [bulkValue, setBulkValue] = useState(null);
  const debouncedSearch = useDebounce(search);

  const divisions = useMasterOptions('project-divisions');
  const types = useMasterOptions('project-types');
  const owners = useMasterOptions('users');
  const customers = useMasterOptions('customers');
  const stages = useStageOptions();

  const { dateRange: _dr, ...apiFilters } = filters;
  const params = { tab, search: debouncedSearch, ...apiFilters, overdue: filters.overdue || undefined, sortBy: sort.by, sortDir: sort.dir, page, pageSize };
  const list = useQuery({ queryKey: ['projects', 'list', params], queryFn: () => projectsApi.list(params), placeholderData: keepPreviousData });
  const summary = useQuery({ queryKey: ['projects', 'summary'], queryFn: projectsApi.summary });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const total = list.data?.total ?? 0;
  const selection = useSelection(items);
  const s = summary.data;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'options'] }); // status / people feed the task and timesheet forms
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
  };

  const remove = useMutation({
    mutationFn: async (ids) => {
      const results = await Promise.allSettled(ids.map((id) => projectsApi.remove(id)));
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) throw Object.assign(failed[0].reason, { failedCount: failed.length, total: ids.length });
      return ids.length;
    },
    onSuccess: (n) => toast.success(n > 1 ? `${n} projects deleted` : 'Project deleted'),
    onError: (err) => toast.error(err.total > 1 ? `${err.failedCount} of ${err.total} could not be deleted: ${errorMessage(err)}` : errorMessage(err)),
    onSettled: () => {
      setToDelete(null);
      refresh();
    },
  });

  const bulkUpdate = useMutation({
    mutationFn: async ({ ids, body }) => {
      const results = await Promise.allSettled(ids.map((id) => projectsApi.update(id, body)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed) throw new Error(`${failed} of ${ids.length} projects could not be updated`);
      return ids.length;
    },
    onSuccess: (n) => toast.success(`${n} project${n > 1 ? 's' : ''} updated`),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => {
      setBulk(null);
      setBulkValue(null);
      refresh();
    },
  });

  const setFilter = useCallback(
    (key, value) => {
      setFilters((f) => ({ ...f, [key]: value }));
      setPage(1);
    },
    [setFilters, setPage],
  );
  const setDateRange = (key) => {
    if (key === 'custom') {
      setMoreOpen(true);
      return;
    }
    const r = rangeFor(key);
    setFilters((f) => ({ ...f, dateRange: key, startFrom: r?.from ?? '', startTo: r?.to ?? '' }));
    setPage(1);
  };
  const onSort = (field) => {
    setSort((x) => ({ by: field, dir: x.by === field && x.dir === 'asc' ? 'desc' : 'asc' }));
    setPage(1);
  };

  const chips = useMemo(() => {
    const out = [];
    // multi-select filters show their picks as chips in the filter bar itself
    if (filters.isRetainerProject !== null) {
      out.push({ key: 'ret', label: 'Retainer', value: filters.isRetainerProject ? 'Yes' : 'No', onRemove: () => setFilter('isRetainerProject', null) });
    }
    if (filters.startFrom || filters.startTo) {
      const label = filters.dateRange ? DATE_RANGES.find((d) => d.value === filters.dateRange)?.label : `${formatDate(filters.startFrom)} – ${formatDate(filters.startTo)}`;
      out.push({
        key: 'start',
        label: 'Start date',
        value: label,
        onRemove: () => setFilters((f) => ({ ...f, dateRange: null, startFrom: '', startTo: '' })),
      });
    }
    if (filters.endFrom || filters.endTo) {
      out.push({
        key: 'end',
        label: 'End date',
        value: `${formatDate(filters.endFrom)} – ${formatDate(filters.endTo)}`,
        onRemove: () => setFilters((f) => ({ ...f, endFrom: '', endTo: '' })),
      });
    }
    if (filters.overdue) out.push({ key: 'overdue', label: 'Overdue', value: 'Yes', onRemove: () => setFilter('overdue', false) });
    return out;
  }, [filters, setFilter, setFilters]);

  const exportRows = (rows) =>
    downloadCsv(
      'projects.csv',
      ['Code', 'Project', 'Customer', 'Division', 'Type', 'Owner', 'Progress %', 'Logged hrs', 'Estimated hrs', 'Start', 'End', 'Stage'],
      rows.map((p) => [p.code, p.title, p.customerName, p.divisionName, p.typeName, p.ownerName, p.progress, p.loggedHours, p.estimatedHours, p.startDate, p.endDate, p.stageName]),
    );

  const duplicate = (p) => navigate('/projects/new', { state: { duplicateOf: p } });

  const rowMenu = (p) => (
    <RowMenu
      items={[
        { label: 'Quick view', icon: Eye, onClick: () => setQuick(p) },
        { label: 'Open details', icon: ExternalLink, onClick: () => navigate(`/projects/${p.id}`) },
        { label: 'Edit', icon: Pencil, hidden: !perms.edit, onClick: () => navigate(`/projects/${p.id}/edit`) },
        { label: 'Duplicate', icon: Copy, hidden: !perms.create, onClick: () => duplicate(p) },
        { divider: true, hidden: !perms.delete },
        { label: 'Delete', icon: Trash2, danger: true, hidden: !perms.delete, onClick: () => setToDelete(p) },
      ]}
    />
  );

  // table columns – shown / hidden and ordered by the user (Columns button)
  const columnDefs = [
    {
      key: 'title',
      label: 'Project',
      locked: true,
      th: () => <SortHeader key="title" label="Project" field="title" sort={sort} onSort={onSort} />,
      td: (p) => (
        <td key="title">
          <Link className="cell-title" to={`/projects/${p.id}`} style={{ color: 'var(--ink)' }}>
            {p.title}
          </Link>
          <div className="cell-sub">{p.code}</div>
        </td>
      ),
    },
    {
      key: 'startDate',
      label: 'Start date',
      th: () => <SortHeader key="startDate" label="Start date" field="startDate" sort={sort} onSort={onSort} />,
      td: (p) => <td key="startDate" className="nowrap">{formatDate(p.startDate)}</td>,
    },
    { key: 'client', label: 'Client', td: (p) => <td key="client"><Trunc text={p.customerName} /></td> },
    { key: 'division', label: 'Project division', defaultHidden: true, td: (p) => <td key="division"><Trunc text={p.divisionName} width={160} /></td> },
    { key: 'type', label: 'Project type', td: (p) => <td key="type"><Trunc text={p.typeName} width={180} /></td> },
    {
      key: 'stage',
      label: 'Stage',
      td: (p) => (
        <td key="stage">
          <StageBadge name={p.stageName} status={p.status} />
        </td>
      ),
    },
    {
      key: 'progress',
      label: 'Progress',
      td: (p) => (
        <td key="progress" style={{ minWidth: 150 }}>
          <div className="row" style={{ gap: 8 }}>
            <div className={`progress grow${burnClass(p)}`}>
              <span style={{ width: `${Math.min(100, p.progress)}%` }} />
            </div>
            <span className="small num">{p.progress}%</span>
          </div>
        </td>
      ),
    },
    {
      key: 'lastReview',
      label: 'Last review',
      td: (p) => (
        <td key="lastReview" className="nowrap">
          {p.lastReviewDate ? formatDate(p.lastReviewDate) : <span className="muted">—</span>}
        </td>
      ),
    },
    {
      key: 'info',
      label: 'Info',
      td: (p) => (
        <td key="info" className="pl-comment">
          {p.lastComment ? (
            <div className="pl-comment-text" title={p.lastComment}>
              {p.lastComment}
            </div>
          ) : (
            <span className="muted">—</span>
          )}
        </td>
      ),
    },
    {
      key: 'owner',
      label: 'Project owner',
      td: (p) => (
        <td key="owner">
          <UserCell name={p.ownerName} />
        </td>
      ),
    },
    {
      key: 'endDate',
      label: 'End date',
      defaultHidden: true,
      th: () => <SortHeader key="endDate" label="End date" field="endDate" sort={sort} onSort={onSort} />,
      td: (p) => <td key="endDate" className="nowrap">{p.endDate ? formatDate(p.endDate) : <span className="muted">—</span>}</td>,
    },
    {
      key: 'hours',
      label: 'Hours (logged / est.)',
      className: 'right',
      td: (p) => (
        <td key="hours" className="num right">
          {formatNumber(p.loggedHours)} / {p.estimatedHours != null ? formatNumber(p.estimatedHours) : '—'}
        </td>
      ),
    },
  ];
  const cols = useColumns('projects', columnDefs);

  const hasFilters = JSON.stringify({ ...filters, dateRange: null }) !== JSON.stringify({ ...EMPTY_FILTERS, dateRange: null });
  const isFiltered = debouncedSearch || hasFilters;
  const deleteIds = toDelete === 'bulk' ? selection.ids : toDelete ? [toDelete.id] : [];

  return (
    <>
      <Topbar title="Projects" breadcrumb={['Projects']} />

      <ProjectSummary
        s={s}
        onFilter={() => {
          setTab('all');
          setFilters({ ...EMPTY_FILTERS, stageId: stages.options.filter((o) => o.status === 'not_started' || o.status === 'in_progress').map((o) => o.value) });
          setSort({ by: 'endDate', dir: 'asc' });
          setPage(1);
        }}
        onStage={(stageId) => {
          setTab('all');
          setFilters({ ...EMPTY_FILTERS, stageId: [stageId] });
          setPage(1);
        }}
      />

      <div className="page-head">
        <div className="tabs" role="tablist">
          {[
            ['all', 'All projects', LayoutGrid, s?.total],
            ['mine', 'My projects', UserRound, s?.mine],
            ['owned', 'Owned by me', Crown, s?.owned],
          ].map(([key, label, Icon, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`tab${tab === key ? ' is-active' : ''}`}
              onClick={() => {
                setTab(key);
                setPage(1);
              }}
            >
              <span className="tab-ico">
                <Icon />
              </span>
              {label} {count !== undefined && <span className="count">{count}</span>}
            </button>
          ))}
        </div>
        <div className="actions">
          {perms.export && (
            <button type="button" className="btn btn-secondary" onClick={() => exportRows(items)} disabled={!items.length}>
              <Download />
              Export
            </button>
          )}
          {perms.create && (
            <Link className="btn btn-primary" to="/projects/new">
              <Plus />
              New project
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
              placeholder="Search by project, code or customer…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Dropdown pill multi search placeholder="Stage" options={stages.options} value={filters.stageId} onChange={(v) => setFilter('stageId', v)} />
          <SingleFilter search placeholder="Project division" options={divisions.options} value={filters.divisionId} onChange={(v) => setFilter('divisionId', v)} />
          <SingleFilter search placeholder="Project type" options={types.options} value={filters.typeId} onChange={(v) => setFilter('typeId', v)} />
          <Dropdown
            pill
            clearable
            placeholder="Retainer project"
            options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
            value={filters.isRetainerProject === null ? null : filters.isRetainerProject ? 'yes' : 'no'}
            onChange={(v) => setFilter('isRetainerProject', v === null ? null : v === 'yes')}
          />
          <SingleFilter search placeholder="Project owner" options={owners.options} value={filters.ownerId} onChange={(v) => setFilter('ownerId', v)} />
          <SingleFilter search placeholder="Customer" options={customers.options} value={filters.customerId} onChange={(v) => setFilter('customerId', v)} />
          <Dropdown pill clearable placeholder="Date" options={DATE_RANGES} value={filters.dateRange} onChange={(v) => (v ? setDateRange(v) : setFilters((f) => ({ ...f, dateRange: null, startFrom: '', startTo: '' })))} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMoreOpen(true)}>
            <SlidersHorizontal />
            More filters
          </button>
          <span className="spacer" />
          {view === 'table' && <ColumnPicker cols={cols} />}
          <ViewSwitch value={view} onChange={setView} />
        </div>

        <ActiveFilters
          chips={chips}
          show={hasFilters}
          onClearAll={() => {
            setFilters(EMPTY_FILTERS);
            setPage(1);
          }}
        />


        {list.isError && (
          <div style={{ padding: '12px 20px 0' }}>
            <ErrorAlert>{errorMessage(list.error)}</ErrorAlert>
          </div>
        )}

        {view === 'table' && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-menu" />
                  {cols.columns.map((c) => (c.th ? c.th() : <th key={c.key} className={c.className}>{c.label}</th>))}
                </tr>
              </thead>
              <tbody>
                {list.isLoading && <TableLoading colSpan={cols.columns.length + 1} />}
                {items.map((p) => (
                  <tr key={p.id}>
                    <td className="col-menu">{rowMenu(p)}</td>
                    {cols.columns.map((c) => c.td(p))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'cards' && items.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <div className="rec-grid">
              {items.map((p, i) => (
                <Link key={p.id} className={`rec-card ${CARD_TONES[i % CARD_TONES.length]}`} to={`/projects/${p.id}`}>
                  <div className="rc-top">
                    <FolderKanban />
                    <span>{p.code}</span>
                    <span className="rc-go">
                      <ArrowUpRight />
                    </span>
                  </div>
                  <div className="rc-title">{p.title}</div>
                  <div className="rc-meta">
                    <span>
                      <Building2 />
                      {p.customerName ?? 'Internal'}
                    </span>
                    <span>
                      <UserRound />
                      {p.ownerName}
                    </span>
                    <span>
                      <Calendar />
                      {formatDate(p.endDate)}
                    </span>
                  </div>
                  <div className="rc-progress">
                    <div className="row between">
                      <span>Progress</span>
                      <span>{p.progress}%</span>
                    </div>
                    <div className="progress">
                      <span style={{ width: `${Math.min(100, p.progress)}%` }} />
                    </div>
                  </div>
                  <div className="rc-foot">
                    <Avatar name={p.ownerName} />
                    <span className="small" style={{ fontWeight: 600 }}>
                      {p.ownerName}
                    </span>
                    <StageBadge name={p.stageName} status={p.status} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {view === 'list' && items.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <div className="list">
              {items.map((p) => (
                <Link key={p.id} className="list-item" to={`/projects/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span className="lead">
                    <FolderKanban />
                  </span>
                  <div className="body">
                    <div className="title">{p.title}</div>
                    <div className="meta">
                      <span>
                        <Building2 />
                        {p.customerName ?? 'Internal'}
                      </span>
                      <span>
                        <UserRound />
                        {p.ownerName}
                      </span>
                      <span>
                        <Calendar />
                        {formatDate(p.endDate)}
                      </span>
                    </div>
                  </div>
                  <div className="trail">
                    <StageBadge name={p.stageName} status={p.status} />
                    <ChevronRight />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!list.isLoading && !items.length && (
          <EmptyState
            icon={FolderKanban}
            title={isFiltered ? 'No projects match your filters' : 'No projects yet'}
            action={
              perms.create && !isFiltered && (
                <button type="button" className="btn btn-primary" onClick={() => navigate('/projects/new')}>
                  <Plus />
                  New project
                </button>
              )
            }
          />
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

      <ProjectQuickView project={quick} onClose={() => setQuick(null)} canEdit={perms.edit} />

      <MoreFilters
        key={moreOpen ? 'open' : 'closed'}
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        filters={filters}
        onApply={(f) => {
          setFilters({ ...f, dateRange: f.startFrom === filters.startFrom && f.startTo === filters.startTo ? f.dateRange : null });
          setPage(1);
          setMoreOpen(false);
        }}
      />

      <Modal
        open={!!bulk}
        onClose={() => setBulk(null)}
        title={bulk === 'owner' ? 'Change owner' : 'Change stage'}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setBulk(null)} disabled={bulkUpdate.isPending}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!bulkValue || bulkUpdate.isPending}
              onClick={() => bulkUpdate.mutate({ ids: selection.ids, body: bulk === 'owner' ? { ownerId: bulkValue } : { stageId: bulkValue } })}
            >
              {bulkUpdate.isPending ? 'Updating…' : `Update ${selection.count} project${selection.count > 1 ? 's' : ''}`}
            </button>
          </>
        }
      >
        <Field label={bulk === 'owner' ? 'New project owner' : 'New stage'}>
          <Dropdown
            search
            placeholder={bulk === 'owner' ? 'Select project owner' : 'Select stage'}
            options={bulk === 'owner' ? owners.options : stages.options}
            value={bulkValue}
            onChange={setBulkValue}
          />
        </Field>
      </Modal>

      <ConfirmDeleteModal
        open={deleteIds.length > 0}
        title={deleteIds.length > 1 ? `Delete ${deleteIds.length} projects?` : 'Delete project?'}
        message={`${deleteIds.length > 1 ? 'These projects' : 'This project'} will be removed with ${deleteIds.length > 1 ? 'their' : 'its'} template tasks. Projects with logged time cannot be deleted – set their stage to Cancelled instead. This action is written to the audit log.`}
        busy={remove.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => remove.mutate(deleteIds)}
      />
    </>
  );
}
