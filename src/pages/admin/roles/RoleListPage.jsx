import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, ChevronRight, Download, EllipsisVertical, Eye, Pencil, Plus, Search, Shield, Tag, Trash2, Users } from 'lucide-react';
import { rolesApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { usePermissions } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { ActionMenu, Dropdown } from '@/components/ui/Dropdown';
import { ActiveBadge, Badge, EmptyState, ErrorAlert } from '@/components/ui/Display';
import { ActiveFilters, BulkBar, CARD_TONES, SelectAllCell, SelectRowCell, ViewSwitch, useSelection, useViewMode } from '@/components/ui/ListKit';
import { ConfirmDeleteModal } from '@/components/ui/Modal';
import { TableFoot } from '@/components/ui/Pager';
import { TableLoading } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useDebounce } from '@/hooks/useDebounce';
import { DATA_SCOPES, SCREENS } from '@/lib/constants';
import { downloadCsv } from '@/lib/csv';

const scopeLabel = (v) => DATA_SCOPES.find((s) => s.value === v)?.label ?? v;
const typeLabel = (v) => (v === 'internal' ? 'Internal' : 'External');
const TYPE_OPTIONS = [{ value: 'internal', label: 'Internal' }, { value: 'external', label: 'External' }];
const ACTIVE_OPTIONS = [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }];

export default function RoleListPage() {
  const perms = usePermissions(SCREENS.ROLES);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useViewMode('roles');
  const [search, setSearch] = useState('');
  const [roleType, setRoleType] = useState([]);
  const [dataScope, setDataScope] = useState([]);
  const [active, setActive] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [toDelete, setToDelete] = useState(null); // role or 'bulk'
  const debouncedSearch = useDebounce(search);

  const params = {
    search: debouncedSearch,
    // one type selected filters; both = no filter
    roleType: roleType.length === 1 ? roleType[0] : undefined,
    dataScope,
    isActive: active === null ? undefined : active === 'active',
    page,
    pageSize,
  };
  const list = useQuery({ queryKey: ['roles', 'list', params], queryFn: () => rolesApi.list(params), placeholderData: keepPreviousData });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const total = list.data?.total ?? 0;
  const selection = useSelection(items);

  const remove = useMutation({
    mutationFn: async (ids) => {
      const results = await Promise.allSettled(ids.map((id) => rolesApi.remove(id)));
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) throw Object.assign(failed[0].reason, { failedCount: failed.length, total: ids.length });
      return ids.length;
    },
    onSuccess: (n) => toast.success(n > 1 ? `${n} roles deleted` : 'Role deleted'),
    onError: (err) => toast.error(err.total > 1 ? `${err.failedCount} of ${err.total} could not be deleted: ${errorMessage(err)}` : errorMessage(err)),
    onSettled: () => {
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  const resetPage = (fn) => (v) => {
    fn(v);
    setPage(1);
  };

  const chips = [];
  // role type / data scope show as chips in the filter bar
  if (active) chips.push({ key: 'active', label: 'Active', value: active === 'active' ? 'Active' : 'Inactive', onRemove: () => resetPage(setActive)(null) });

  const exportRows = (rows) =>
    downloadCsv(
      'roles.csv',
      ['Role', 'Code', 'Level', 'Role type', 'Data scope', 'Users', 'Active'],
      rows.map((r) => [r.name, r.code, r.level, typeLabel(r.roleType), scopeLabel(r.dataScope), r.userCount, r.isActive ? 'Yes' : 'No']),
    );

  const deletable = (r) => !r.isSystem && r.userCount === 0;
  const deleteIds = toDelete === 'bulk' ? items.filter((r) => selection.isSelected(r.id) && deletable(r)).map((r) => r.id) : toDelete ? [toDelete.id] : [];
  const skipped = toDelete === 'bulk' ? selection.count - deleteIds.length : 0;
  const editUrl = (r) => `/administration/roles/${r.id}/edit`;

  return (
    <>
      <Topbar
        title="Roles & Permissions"
        breadcrumb={['Administration']}
        actions={
          <>
            {perms.export && (
              <button type="button" className="btn btn-secondary" disabled={!items.length} onClick={() => exportRows(items)}>
                <Download />
                Export
              </button>
            )}
            {perms.create && (
              <Link className="btn btn-primary" to="/administration/roles/new">
                <Plus />
                New role
              </Link>
            )}
          </>
        }
      />
      <div className="card card-flush">
        <div className="filter-bar">
          <div className="input-group search">
            <Search />
            <input className="input" placeholder="Search roles & permissions…" value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} />
          </div>
          <Dropdown pill multi placeholder="Role type" options={TYPE_OPTIONS} value={roleType} onChange={resetPage(setRoleType)} />
          <Dropdown pill multi placeholder="Data scope" options={DATA_SCOPES} value={dataScope} onChange={resetPage(setDataScope)} />
          <Dropdown pill clearable placeholder="Active" options={ACTIVE_OPTIONS} value={active} onChange={resetPage(setActive)} />
          <span className="spacer" />
          <ViewSwitch value={view} onChange={setView} />
        </div>

        <ActiveFilters
          chips={chips}
          show={roleType.length > 0 || dataScope.length > 0 || !!active}
          onClearAll={() => {
            setRoleType([]);
            setDataScope([]);
            setActive(null);
            setPage(1);
          }}
        />

        <BulkBar count={selection.count}>
          {perms.export && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => exportRows(items.filter((r) => selection.isSelected(r.id)))}>
              Export selected
            </button>
          )}
          {perms.delete && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setToDelete('bulk')}>
              <Trash2 />
              Delete
            </button>
          )}
        </BulkBar>

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
                  <SelectAllCell selection={selection} />
                  <th>Role</th>
                  <th>Code</th>
                  <th className="right">Level</th>
                  <th>Role type</th>
                  <th>Data scope</th>
                  <th className="right">Users</th>
                  <th>Active</th>
                  <th className="col-actions" />
                </tr>
              </thead>
              <tbody>
                {list.isLoading && <TableLoading colSpan={9} />}
                {items.map((r) => (
                  <tr key={r.id} className={selection.isSelected(r.id) ? 'is-selected' : ''}>
                    <SelectRowCell selection={selection} id={r.id} />
                    <td>
                      <Link className="cell-title" to={editUrl(r)} style={{ color: 'var(--ink)' }}>
                        {r.name}
                      </Link>
                      <div className="cell-sub">{r.code}</div>
                    </td>
                    <td className="nowrap">{r.code}</td>
                    <td className="num right">{r.level}</td>
                    <td>
                      <Badge tone={r.roleType === 'internal' ? 'success' : 'info'}>{typeLabel(r.roleType)}</Badge>
                    </td>
                    <td>
                      <Badge tone={r.dataScope === 'all' ? 'success' : undefined}>{scopeLabel(r.dataScope)}</Badge>
                    </td>
                    <td className="num right">{r.userCount}</td>
                    <td>
                      <ActiveBadge active={r.isActive} />
                    </td>
                    <td className="col-actions">
                      <div className="row-actions">
                        {perms.edit && (
                          <Link className="btn btn-ghost btn-icon" to={editUrl(r)} title="Edit">
                            <Pencil />
                          </Link>
                        )}
                        <ActionMenu
                          trigger={({ toggle, title }) => (
                            <button type="button" className="dropdown-toggle btn btn-ghost btn-icon" style={{ width: 32, height: 32, border: 0, padding: 0, justifyContent: 'center' }} title={title} onClick={toggle}>
                              <EllipsisVertical />
                            </button>
                          )}
                          items={[{ label: 'Delete', icon: Trash2, danger: true, hidden: !perms.delete || r.isSystem, onClick: () => setToDelete(r) }]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'cards' && items.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <div className="rec-grid">
              {items.map((r, i) => (
                <Link key={r.id} className={`rec-card ${CARD_TONES[i % CARD_TONES.length]}`} to={editUrl(r)}>
                  <div className="rc-top">
                    <Shield />
                    <span>{r.code}</span>
                    <span className="rc-go">
                      <ArrowUpRight />
                    </span>
                  </div>
                  <div className="rc-title">{r.name}</div>
                  <div className="rc-meta">
                    <span><Tag />Level {r.level}</span>
                    <span><Eye />{scopeLabel(r.dataScope)}</span>
                    <span><Users />{r.userCount} users</span>
                  </div>
                  <div className="rc-foot">
                    <Badge tone={r.roleType === 'internal' ? 'success' : 'info'}>{typeLabel(r.roleType)}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {view === 'list' && items.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <div className="list">
              {items.map((r) => (
                <Link key={r.id} className="list-item" to={editUrl(r)} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span className="lead">
                    <Shield />
                  </span>
                  <div className="body">
                    <div className="title">{r.name}</div>
                    <div className="meta">
                      <span><Tag />{r.code}</span>
                      <span><Eye />{scopeLabel(r.dataScope)}</span>
                    </div>
                  </div>
                  <div className="trail">
                    <Badge tone={r.roleType === 'internal' ? 'success' : 'info'}>{typeLabel(r.roleType)}</Badge>
                    <ChevronRight />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!list.isLoading && !items.length && <EmptyState icon={Shield} title="No roles found" />}
        {total > 0 && (
          <TableFoot page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        )}
      </div>

      <ConfirmDeleteModal
        open={toDelete !== null}
        title={deleteIds.length > 1 ? `Delete ${deleteIds.length} roles?` : 'Delete role?'}
        message={
          deleteIds.length
            ? `${deleteIds.length > 1 ? 'These roles and their permissions' : `The role "${toDelete?.name ?? items.find((r) => r.id === deleteIds[0])?.name}" and its permissions`} will be removed.${skipped ? ` ${skipped} selected role(s) are built-in or assigned to users and will be skipped.` : ''}`
            : 'None of the selected roles can be deleted: built-in roles and roles assigned to users are kept.'
        }
        busy={remove.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => (deleteIds.length ? remove.mutate(deleteIds) : setToDelete(null))}
      />
    </>
  );
}
