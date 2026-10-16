import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight, Building2, ChevronRight, Download, EllipsisVertical, IdCard, LockOpen, MapPin, Pencil, Plane, Plus,
  Search, Shield, SlidersHorizontal, Trash2, UserCheck, UserRound, Users,
} from 'lucide-react';
import { usersApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAuth, usePermissions } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { ActionMenu, Dropdown } from '@/components/ui/Dropdown';
import { ActiveBadge, Avatar, Badge, EmptyState, ErrorAlert, UserCell } from '@/components/ui/Display';
import { Field, Switch } from '@/components/ui/Field';
import {
  ActiveFilters, BulkBar, CARD_TONES, Drawer, SelectAllCell, SelectRowCell, ViewSwitch, useSelection, useViewMode,
} from '@/components/ui/ListKit';
import { AreaCard, DonutCard, KpiSection, RowsCard, StackCard } from '@/components/ui/MetricCards';
import { ConfirmDeleteModal } from '@/components/ui/Modal';
import { TableFoot } from '@/components/ui/Pager';
import { TableLoading } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useDebounce } from '@/hooks/useDebounce';
import { useAssignableRoleOptions, useLookupOptions, useMasterOptions } from '@/hooks/useOptions';
import { SCREENS } from '@/lib/constants';
import { downloadCsv } from '@/lib/csv';

const EMPTY_FILTERS = { roleId: [], siteId: [], shiftId: [], active: null, reportsTo: [], userTypeId: [], onLeave: false };

function UserSummary({ s }) {
  const activePct = s?.total ? (s.active / s.total) * 100 : 0;
  return (
    <KpiSection storageKey="users">
      <AreaCard
        title="Total users"
        icon={Users}
        value={s?.total}
        trend={s?.createdThisMonth ? { value: s.createdThisMonth, label: 'this month' } : null}
        subs={s && [[s.internal, 'Employees'], [s.external, 'External']]}
        series={s?.totalByMonth}
      />
      <DonutCard
        title="Active users"
        icon={UserCheck}
        percent={activePct}
        value={s?.active}
        pill={s ? `${Math.round(activePct)}%` : undefined}
        legend={[
          ['Active', activePct, '#16A34A'],
          ['Inactive', 100 - activePct, 'var(--surface-3)'],
        ]}
      />
      <StackCard title="On leave today" icon={Plane} value={s?.onLeave.total} people={s?.onLeave.people} emptyText="Nobody is on leave" />
      <RowsCard
        title="Customer / vendor logins"
        icon={Building2}
        value={s ? s.externalLogins.customer + s.externalLogins.vendor : undefined}
        rows={s ? [['Customer', s.externalLogins.customer], ['Vendor', s.externalLogins.vendor]] : []}
      />
    </KpiSection>
  );
}

function MoreFilters({ open, onClose, filters, onApply, people, userTypes }) {
  const [draft, setDraft] = useState(filters);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="More filters"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => setDraft({ ...draft, reportsTo: [], userTypeId: [], onLeave: false })}>
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
          <Field label="Reports to">
            <Dropdown multi search placeholder="Select people" options={people} value={draft.reportsTo} onChange={(v) => setDraft({ ...draft, reportsTo: v })} />
          </Field>
          <Field label="User type">
            <Dropdown multi placeholder="Select user type" options={userTypes} value={draft.userTypeId} onChange={(v) => setDraft({ ...draft, userTypeId: v })} />
          </Field>
          <Switch label="On leave only" checked={draft.onLeave} onChange={(v) => setDraft({ ...draft, onLeave: v })} />
        </div>
      </div>
    </Drawer>
  );
}

export default function UserListPage() {
  const perms = usePermissions(SCREENS.USERS);
  const { user: me } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [view, setView] = useViewMode('users');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [toDelete, setToDelete] = useState(null); // user or 'bulk'
  const [moreOpen, setMoreOpen] = useState(false);
  const debouncedSearch = useDebounce(search);

  const roles = useAssignableRoleOptions();
  const sites = useMasterOptions('sites');
  const shifts = useMasterOptions('shifts');
  const people = useMasterOptions('users');
  const userTypes = useLookupOptions('USER_TYPE');

  const params = {
    search: debouncedSearch,
    roleId: filters.roleId,
    siteId: filters.siteId,
    shiftId: filters.shiftId,
    reportsTo: filters.reportsTo,
    userTypeId: filters.userTypeId,
    isActive: filters.active === null ? undefined : filters.active === 'active',
    isOnLeave: filters.onLeave || undefined,
    page,
    pageSize,
  };
  const list = useQuery({ queryKey: ['users', 'list', params], queryFn: () => usersApi.list(params), placeholderData: keepPreviousData });
  const summary = useQuery({ queryKey: ['users', 'summary'], queryFn: usersApi.summary });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const total = list.data?.total ?? 0;
  const selection = useSelection(items);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['masters', 'users'] });
  };
  const remove = useMutation({
    mutationFn: async (ids) => {
      const results = await Promise.allSettled(ids.map((id) => usersApi.remove(id)));
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) throw Object.assign(failed[0].reason, { failedCount: failed.length, total: ids.length });
      return ids.length;
    },
    onSuccess: (n) => toast.success(n > 1 ? `${n} users deleted` : 'User deleted'),
    onError: (err) => toast.error(err.total > 1 ? `${err.failedCount} of ${err.total} could not be deleted: ${errorMessage(err)}` : errorMessage(err)),
    onSettled: () => {
      setToDelete(null);
      invalidate();
    },
  });
  const unlock = useMutation({
    mutationFn: (id) => usersApi.unlock(id),
    onSuccess: () => {
      toast.success('Account unlocked');
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const chips = useMemo(() => {
    const out = [];
    const names = (key, opts) => {
      const n = filters[key].map((v) => opts.find((o) => o.value === v)?.label ?? v);
      return n.length > 2 ? `${n.length} selected` : n.join(', ');
    };
    for (const [key, label, opts] of [
      // role / site / shift show as chips in the filter bar; these two live in the More filters drawer
      ['reportsTo', 'Reports to', people.options],
      ['userTypeId', 'User type', userTypes.options],
    ]) {
      if (filters[key].length) out.push({ key, label, value: names(key, opts), onRemove: () => setFilter(key, []) });
    }
    if (filters.active) out.push({ key: 'active', label: 'Active', value: filters.active === 'active' ? 'Active' : 'Inactive', onRemove: () => setFilter('active', null) });
    if (filters.onLeave) out.push({ key: 'leave', label: 'On leave', value: 'Yes', onRemove: () => setFilter('onLeave', false) });
    return out;
  }, [filters, people.options, userTypes.options]);

  const exportRows = (rows) =>
    downloadCsv(
      'users.csv',
      ['Employee code', 'Name', 'Username', 'Email', 'Role', 'Reports to', 'Site', 'Shift', 'Active'],
      rows.map((u) => [u.empCode, u.name, u.username, u.email, u.roleName, u.reportsToName, u.siteName, u.shiftName, u.isActive ? 'Yes' : 'No']),
    );

  const deleteIds = toDelete === 'bulk' ? selection.ids.filter((id) => id !== me.id) : toDelete ? [toDelete.id] : [];
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const isFiltered = debouncedSearch || hasFilters;

  return (
    <>
      <Topbar
        title="Users"
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
              <Link className="btn btn-primary" to="/administration/users/new">
                <Plus />
                New user
              </Link>
            )}
          </>
        }
      />

      <UserSummary s={summary.data} />

      <div className="card card-flush">
        <div className="filter-bar">
          <div className="input-group search">
            <Search />
            <input
              className="input"
              placeholder="Search by name, email or employee code…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Dropdown pill multi search placeholder="Role" options={roles.options} value={filters.roleId} onChange={(v) => setFilter('roleId', v)} />
          <Dropdown pill multi search placeholder="Site" options={sites.options} value={filters.siteId} onChange={(v) => setFilter('siteId', v)} />
          <Dropdown pill multi search placeholder="Shift" options={shifts.options} value={filters.shiftId} onChange={(v) => setFilter('shiftId', v)} />
          <Dropdown
            pill
            clearable
            placeholder="Active"
            options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
            value={filters.active}
            onChange={(v) => setFilter('active', v)}
          />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMoreOpen(true)}>
            <SlidersHorizontal />
            More filters
          </button>
          <span className="spacer" />
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

        <BulkBar count={selection.count}>
          {perms.export && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => exportRows(items.filter((u) => selection.isSelected(u.id)))}>
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
                  <th>User</th>
                  <th>Employee code</th>
                  <th>Role</th>
                  <th>Reports to</th>
                  <th>Site</th>
                  <th>Shift</th>
                  <th>Active</th>
                  <th className="col-actions" />
                </tr>
              </thead>
              <tbody>
                {list.isLoading && <TableLoading colSpan={9} />}
                {items.map((u) => (
                  <tr key={u.id} className={selection.isSelected(u.id) ? 'is-selected' : ''}>
                    <SelectRowCell selection={selection} id={u.id} />
                    <td>
                      <UserCell name={u.name} sub={u.email || u.username} to={perms.edit ? `/administration/users/${u.id}/edit` : undefined} LinkComponent={Link} />
                    </td>
                    <td className="nowrap">{u.empCode ?? '—'}</td>
                    <td className="nowrap">{u.roleName}</td>
                    <td>
                      <UserCell name={u.reportsToName} />
                    </td>
                    <td className="nowrap">{u.siteName ?? '—'}</td>
                    <td className="nowrap">{u.shiftName ?? '—'}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <ActiveBadge active={u.isActive} />
                        {u.isLocked && <Badge tone="danger">Locked</Badge>}
                      </div>
                    </td>
                    <td className="col-actions">
                      <div className="row-actions">
                        {perms.edit && (
                          <Link className="btn btn-ghost btn-icon" to={`/administration/users/${u.id}/edit`} title="Edit">
                            <Pencil />
                          </Link>
                        )}
                        <ActionMenu
                          trigger={({ toggle, title }) => (
                            <button type="button" className="dropdown-toggle btn btn-ghost btn-icon" style={{ width: 32, height: 32, border: 0, padding: 0, justifyContent: 'center' }} title={title} onClick={toggle}>
                              <EllipsisVertical />
                            </button>
                          )}
                          items={[
                            { label: 'Unlock account', icon: LockOpen, hidden: !perms.edit || !u.isLocked, onClick: () => unlock.mutate(u.id) },
                            { label: 'Delete', icon: Trash2, danger: true, hidden: !perms.delete || u.id === me.id, onClick: () => setToDelete(u) },
                          ]}
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
              {items.map((u, i) => (
                <Link key={u.id} className={`rec-card ${CARD_TONES[i % CARD_TONES.length]}`} to={perms.edit ? `/administration/users/${u.id}/edit` : '#'}>
                  <div className="rc-top">
                    <UserRound />
                    <span>{u.email || u.username}</span>
                    <span className="rc-go">
                      <ArrowUpRight />
                    </span>
                  </div>
                  <div className="rc-title">{u.name}</div>
                  <div className="rc-meta">
                    <span><IdCard />{u.empCode ?? '—'}</span>
                    <span><Shield />{u.roleName}</span>
                    <span><MapPin />{u.siteName ?? '—'}</span>
                  </div>
                  <div className="rc-foot">
                    <Avatar name={u.name} />
                    <span className="small" style={{ fontWeight: 600 }}>{u.name}</span>
                    <ActiveBadge active={u.isActive} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {view === 'list' && items.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <div className="list">
              {items.map((u) => (
                <Link key={u.id} className="list-item" to={perms.edit ? `/administration/users/${u.id}/edit` : '#'} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <Avatar name={u.name} size="md" />
                  <div className="body">
                    <div className="title">{u.name}</div>
                    <div className="meta">
                      <span><IdCard />{u.empCode ?? '—'}</span>
                      <span><Shield />{u.roleName}</span>
                      <span><MapPin />{u.siteName ?? '—'}</span>
                    </div>
                  </div>
                  <div className="trail">
                    <ActiveBadge active={u.isActive} />
                    <ChevronRight />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!list.isLoading && !items.length && <EmptyState icon={Users} title={isFiltered ? 'No users match your filters' : 'No users yet'} />}
        {total > 0 && (
          <TableFoot page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        )}
      </div>

      <MoreFilters
        key={moreOpen ? 'open' : 'closed'}
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        filters={filters}
        people={people.options}
        userTypes={userTypes.options}
        onApply={(f) => {
          setFilters(f);
          setPage(1);
          setMoreOpen(false);
        }}
      />

      <ConfirmDeleteModal
        open={deleteIds.length > 0}
        title={deleteIds.length > 1 ? `Delete ${deleteIds.length} users?` : 'Delete user?'}
        message={`${deleteIds.length > 1 ? 'These users' : toDelete?.name ?? 'This user'} will be removed. Users linked to projects or other records cannot be deleted – deactivate them instead.${toDelete === 'bulk' && selection.isSelected(me.id) ? ' Your own account is skipped.' : ''}`}
        busy={remove.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => remove.mutate(deleteIds)}
      />
    </>
  );
}
