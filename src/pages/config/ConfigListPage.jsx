import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, ChevronRight, Download, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { configApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { usePermissions } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { Dropdown } from '@/components/ui/Dropdown';
import { EmptyState, ErrorAlert } from '@/components/ui/Display';
import { CARD_TONES, ViewSwitch, useSelection, useViewMode } from '@/components/ui/ListKit';
import { ConfirmDeleteModal } from '@/components/ui/Modal';
import { TableFoot } from '@/components/ui/Pager';
import { ColumnPicker, RowMenu, useColumns } from '@/components/ui/ColumnPicker';
import { TableLoading } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useDebounce } from '@/hooks/useDebounce';
import { useSessionState } from '@/hooks/useSessionState';
import { useOptionsFrom } from '@/hooks/useOptions';
import { downloadCsv } from '@/lib/csv';
import { CustomerSummary } from './CustomerSummary';

const SUMMARIES = { customers: CustomerSummary };
const text = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? '' : String(v));

/** The value of a static option that matches the given text (for filters coming from the URL). */
const matchOption = (options, raw) => options.find((o) => String(o.value) === String(raw))?.value ?? raw;

/** Filters the screen was opened with, e.g. /administration/task-types?taskGroupId=3 */
function filtersFromUrl(def, searchParams) {
  const out = {};
  for (const f of def.filters) {
    const raw = searchParams.get(f.key);
    if (raw === null || raw === '') continue;
    if (f.multi) {
      const vals = raw
        .split(',')
        .filter(Boolean)
        .map((v) => (f.options ? matchOption(f.options, v) : /^\d+$/.test(v) ? Number(v) : v));
      if (vals.length) out[f.key] = vals;
    } else {
      out[f.key] = f.options ? matchOption(f.options, raw) : raw;
    }
  }
  return out;
}

/** One filter pill; options come from the screen definition. */
function FilterPill({ filter, value, onChange }) {
  const options = useOptionsFrom(filter.optionsFrom, filter.options);
  return (
    <Dropdown
      pill
      multi={filter.multi}
      clearable={!filter.multi}
      search={options.length > 6}
      placeholder={filter.placeholder}
      options={options}
      value={!filter.multi && Array.isArray(value) ? (value[0] ?? null) : value /* a list saved before the filter became single */}
      onChange={onChange}
    />
  );
}

/** Label of a filter value for the chips row. */
function useChipLabel(filter, value) {
  const options = useOptionsFrom(filter.optionsFrom, filter.options);
  const vals = Array.isArray(value) ? value : [value];
  const names = vals.map((v) => options.find((o) => String(o.value) === String(v))?.label ?? v);
  return names.length > 2 ? `${names.length} selected` : names.join(', ');
}
function Chip({ filter, value, onRemove }) {
  const label = useChipLabel(filter, value);
  return (
    <span className="chip">
      {filter.placeholder}: <b>{label}</b>
      <button type="button" title="Remove" onClick={onRemove}>
        <X />
      </button>
    </span>
  );
}

/**
 * List screen for a configuration master (see screens.jsx), laid out like every list in the design:
 * filter bar → active filters → bulk bar → table / cards / list → footer.
 */
export default function ConfigListPage({ def, embedded = false, onRows }) {
  const perms = usePermissions(def.screen);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const api = useMemo(() => configApi(def.apiKey ?? def.key), [def.apiKey, def.key]); // apiKey: a tab over another screen's API

  const [view, setView] = useViewMode(def.key);
  const [search, setSearch] = useSessionState(`${def.key}.search`, '', { keep: def.keepState });
  // filters the screen was opened with (a link from another screen) are the starting filters
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilters = filtersFromUrl(def, searchParams);
  const [storedFilters, setStoredFilters] = useSessionState(`${def.key}.filters`, urlFilters, { keep: def.keepState });
  // a filter in the URL wins over the remembered one
  const filters = { ...storedFilters, ...urlFilters };
  const [page, setPage] = useSessionState(`${def.key}.page`, 1, { keep: def.keepState });
  const [pageSize, setPageSize] = useSessionState(`${def.key}.pageSize`, 10, { keep: def.keepState });
  const [toDelete, setToDelete] = useState(null); // row or 'bulk'
  const debouncedSearch = useDebounce(search);

  const params = { search: debouncedSearch, ...filters, page, pageSize };
  const list = useQuery({ queryKey: ['config', def.key, 'list', params], queryFn: () => api.list(params), placeholderData: keepPreviousData });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const total = list.data?.total ?? 0;
  const selection = useSelection(items);

  // a page that hosts this list in a tab (Task Groups & Types) shows the rows in its own header
  useEffect(() => {
    onRows?.(items, total);
  }, [items, total, onRows]);

  const remove = useMutation({
    mutationFn: async (ids) => {
      const results = await Promise.allSettled(ids.map((id) => api.remove(id)));
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) throw Object.assign(failed[0].reason, { failedCount: failed.length, total: ids.length });
      return ids.length;
    },
    onSuccess: (n) => toast.success(n > 1 ? `${n} records deleted` : `${def.singular[0].toUpperCase()}${def.singular.slice(1)} deleted`),
    onError: (err) => toast.error(err.total > 1 ? `${err.failedCount} of ${err.total} could not be deleted: ${errorMessage(err)}` : errorMessage(err)),
    onSettled: () => {
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['config', def.key] });
      queryClient.invalidateQueries({ queryKey: ['masters'] });
      queryClient.invalidateQueries({ queryKey: ['lookups'] });
    },
  });

  const setFilter = (key, value) => {
    setStoredFilters((f) => {
      const n = { ...f };
      if (value === null || value === undefined || (Array.isArray(value) && !value.length)) delete n[key];
      else n[key] = value;
      return n;
    });
    dropUrlFilter(key);
    setPage(1);
  };

  /** Takes a filter out of the URL, so it does not come back on the next visit. */
  const dropUrlFilter = (key) => {
    if (!searchParams.has(key)) return;
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    setStoredFilters({});
    if ([...searchParams.keys()].length) setSearchParams(new URLSearchParams(), { replace: true });
    setPage(1);
  };

  const titleCol = def.columns.find((c) => c.title) ?? def.columns[0];
  const base = def.path ?? def.screen;
  const editUrl = (r) => `${base}/${r.id}/edit`;
  // table columns – shown / hidden and ordered by the user (Columns button); the name column always shows
  const cols = useColumns(
    def.key,
    def.columns.map((c) => ({ ...c, locked: c === titleCol })),
  );
  const rowMenu = (r) => (
    <RowMenu
      items={[
        // extra actions the screen defines (e.g. "Task types" of a task group)
        ...(def.rowActions?.(r) ?? []).map((a) => ({ ...a, onClick: a.onClick ?? (() => navigate(a.to)) })),
        { label: def.editLabel ?? 'Edit', icon: Pencil, hidden: !perms.edit || def.canEdit?.(r) === false, onClick: () => navigate(editUrl(r)) },
        { divider: true, hidden: !perms.delete || def.noDelete },
        { label: 'Delete', icon: Trash2, danger: true, hidden: !perms.delete || def.noDelete, onClick: () => setToDelete(r) },
      ]}
    />
  );
  const cellValue = (c, r) => (c.render ? c.render(r) : r[c.key] ?? '—');

  const exportRows = (rows) =>
    downloadCsv(
      `${def.key}.csv`,
      def.columns.map((c) => c.label),
      rows.map((r) => def.columns.map((c) => text(r[c.key]))),
    );

  const deleteIds = toDelete === 'bulk' ? selection.ids : toDelete ? [toDelete.id] : [];
  const Summary = def.summary ? SUMMARIES[def.summary] : null;
  const isFiltered = debouncedSearch || Object.keys(filters).length > 0;

  return (
    <>
      {!embedded && (
        <Topbar
          title={def.title}
          breadcrumb={[def.breadcrumb ?? 'Administration']}
          actions={
            <>
              {perms.export && (
                <button type="button" className="btn btn-secondary" disabled={!items.length} onClick={() => exportRows(items)}>
                  <Download />
                  Export
                </button>
              )}
              {perms.create && def.extraCreate && (
                <Link className="btn btn-secondary" to={def.extraCreate.to}>
                  <Plus />
                  {def.extraCreate.label}
                </Link>
              )}
              {perms.create && (
                <Link className="btn btn-primary" to={`${base}/new`}>
                  <Plus />
                  New {def.singular}
                </Link>
              )}
            </>
          }
        />
      )}

      {Summary && <Summary />}

      <div className="card card-flush">
        <div className="filter-bar">
          <div className="input-group search">
            <Search />
            <input
              className="input"
              placeholder={def.search}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {def.filters.map((f) => (
            <FilterPill key={f.key} filter={f} value={filters[f.key] ?? (f.multi ? [] : null)} onChange={(v) => setFilter(f.key, v)} />
          ))}
          <span className="spacer" />
          {view === 'table' && <ColumnPicker cols={cols} />}
          <ViewSwitch value={view} onChange={setView} />
        </div>

        {Object.keys(filters).length > 0 && (
          <div className="active-filters">
            {def.filters
              .filter((f) => filters[f.key] !== undefined && !f.multi) // multi filters show chips in the bar
              .map((f) => (
                <Chip key={f.key} filter={f} value={filters[f.key]} onRemove={() => setFilter(f.key, null)} />
              ))}
            <button
              type="button"
              className="clear"
              onClick={clearFilters}
            >
              Clear all
            </button>
          </div>
        )}


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
                  {cols.columns.map((c) => (
                    <th key={c.key} className={c.className?.includes('right') ? 'right' : ''}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.isLoading && <TableLoading colSpan={cols.columns.length + 1} />}
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="col-menu">{rowMenu(r)}</td>
                    {cols.columns.map((c) =>
                      c.key === titleCol.key ? (
                        <td key={c.key}>
                          {perms.edit && def.canEdit?.(r) !== false ? (
                            <Link className="cell-title" to={editUrl(r)} style={{ color: 'var(--ink)' }}>
                              {r[titleCol.key]}
                            </Link>
                          ) : (
                            <span className="cell-title">{r[titleCol.key]}</span>
                          )}
                          {titleCol.sub && <div className="cell-sub">{titleCol.sub(r)}</div>}
                        </td>
                      ) : (
                        <td key={c.key} className={c.className ?? 'nowrap'}>
                          {cellValue(c, r)}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'cards' && items.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <div className="rec-grid">
              {items.map((r, i) => {
                const c = def.card(r);
                return (
                  <Link key={r.id} className={`rec-card ${CARD_TONES[i % CARD_TONES.length]}`} to={perms.edit ? editUrl(r) : '#'}>
                    <div className="rc-top">
                      <def.icon />
                      <span>{c.sub}</span>
                      <span className="rc-go">
                        <ArrowUpRight />
                      </span>
                    </div>
                    <div className="rc-title">{c.title}</div>
                    <div className="rc-meta">
                      {c.meta.map(([Icon, t], k) => (
                        <span key={k}>
                          <Icon />
                          {t}
                        </span>
                      ))}
                    </div>
                    {c.badge && <div className="rc-foot">{c.badge}</div>}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {view === 'list' && items.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <div className="list">
              {items.map((r) => {
                const c = def.card(r);
                return (
                  <Link key={r.id} className="list-item" to={perms.edit ? editUrl(r) : '#'} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="lead">
                      <def.icon />
                    </span>
                    <div className="body">
                      <div className="title">{c.title}</div>
                      <div className="meta">
                        {c.meta.map(([Icon, t], k) => (
                          <span key={k}>
                            <Icon />
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="trail">
                      {c.badge}
                      <ChevronRight />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {!list.isLoading && !items.length && (
          <EmptyState
            icon={def.icon}
            title={isFiltered ? `No ${def.title.toLowerCase()} match your filters` : `No ${def.singular}s yet`}
            action={
              perms.create && !def.noCreate && !isFiltered && (
                <Link className="btn btn-primary" to={`${base}/new`}>
                  <Plus />
                  New {def.singular}
                </Link>
              )
            }
          />
        )}
        {total > 0 && (
          <TableFoot page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        )}
      </div>

      <ConfirmDeleteModal
        open={deleteIds.length > 0}
        title={deleteIds.length > 1 ? `Delete ${deleteIds.length} records?` : `Delete ${def.singular}?`}
        message={`${deleteIds.length > 1 ? 'These records' : `"${toDelete?.[titleCol.key] ?? ''}"`} will be removed. Records that are in use cannot be deleted – deactivate them instead where possible.`}
        busy={remove.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => remove.mutate(deleteIds)}
      />
    </>
  );
}
