import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Cloud, Copy } from 'lucide-react';
import { rolesApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { Dropdown } from '@/components/ui/Dropdown';
import { Checkbox, ChoiceGroup, Field, Switch } from '@/components/ui/Field';
import { ErrorAlert } from '@/components/ui/Display';
import { FullPageLoader, Spinner } from '@/components/ui/Loader';
import { useConfirm } from '@/components/ui/confirm-context';
import { useToast } from '@/components/ui/toast-context';
import { useApiFormError } from '@/hooks/useApiForm';
import { DATA_SCOPES, PERMISSION_ACTIONS } from '@/lib/constants';
import NotFoundPage from '@/pages/errors/NotFoundPage';
import { ACCESS_LEVELS, PROJECT_FIELDS, PROJECT_TABS } from '@/lib/projectAccess';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the role name').max(100),
  code: z.string().trim().max(50),
  level: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ error: 'Enter a level' }).int('Whole number').min(0, '0 or more').max(99, '99 or less'),
  ),
  roleType: z.enum(['internal', 'external']),
  dataScope: z.enum(['all', 'team', 'own', 'customer', 'vendor']),
  isActive: z.boolean(),
});

const EMPTY = { name: '', code: '', level: '', roleType: 'internal', dataScope: 'own', isActive: true };
const NO_FLAGS = Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a.key, false]));

/** Matrix state: { [menuId]: { view, create, … } } */
function PermissionMatrix({ menus, value, onChange, can, readOnly }) {
  const screens = menus.flatMap((m) => m.children);
  const set = (menuId, action, checked) => {
    const row = { ...NO_FLAGS, ...value[menuId], [action]: checked };
    if (action !== 'view' && checked) row.view = true; // any action needs view
    if (action === 'view' && !checked) Object.assign(row, NO_FLAGS); // no view → nothing
    onChange({ ...value, [menuId]: row });
  };
  const fill = (fn) => onChange(Object.fromEntries(screens.map((s) => [s.id, fn(s)])));
  // Only actions the screen supports (menus.actions) are offered, and an admin can only grant
  // what they have themselves (both enforced by the API too).
  const supports = (screen, action) => (screen.actions ?? []).includes(action);
  const allowed = (screen, action) => supports(screen, action) && can(screen.url, action);
  // columns: only actions at least one screen supports (Approve appears once a screen has an approval step)
  const columns = PERMISSION_ACTIONS.filter((a) => screens.some((sc) => supports(sc, a.key)));

  return (
    <>
      {!readOnly && (
        <div className="row" style={{ padding: '0 0 12px', gap: 8 }}>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => fill((s) => Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a.key, allowed(s, a.key)])))}>
            Select all
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => fill((s) => ({ ...NO_FLAGS, view: allowed(s, 'view') }))}>
            View only
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => fill(() => ({ ...NO_FLAGS }))}>
            Clear
          </button>
        </div>
      )}
      <div className="editor perm-matrix">
        <div className="table-wrap" style={{ border: 0, maxHeight: 520 }}>
          <table className="data-table is-compact">
            <thead>
              <tr>
                <th>Screen</th>
                {columns.map((a) => (
                  <th key={a.key} className="center">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {menus.map((m) => (
                <FragmentRows key={m.id} module={m} colSpan={columns.length + 1}>
                  {m.children.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      {columns.map((a) => (
                        <td key={a.key} className="center">
                          {supports(s, a.key) ? (
                            <Checkbox
                              checked={readOnly || value[s.id]?.[a.key]}
                              disabled={readOnly || !allowed(s, a.key)}
                              title={!readOnly && !allowed(s, a.key) ? 'You do not have this permission yourself' : undefined}
                              onChange={(c) => set(s.id, a.key, c)}
                            />
                          ) : (
                            <span className="muted" title={`${s.name} has no ${a.label.toLowerCase()} action`} aria-label="Not applicable">
                              –
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </FragmentRows>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/** Rows (tabs or fields) with a Hidden / View / Edit choice each; missing = Edit. */
function AccessTable({ title, rows, value, onChange, readOnly }) {
  const levelOf = (r) => value[r.key] ?? (r.editable === false ? 'view' : 'edit');
  const allowed = (r, level) => !(level === 'edit' && r.editable === false) && !(level === 'hidden' && r.required);
  return (
    <div className="editor perm-matrix">
      <table className="data-table is-compact">
        <thead>
          <tr>
            <th>{title}</th>
            {ACCESS_LEVELS.map((l) => (
              <th key={l.value} className="center" style={{ width: 90 }}>
                {l.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>
                {r.label}
                {r.required && <span className="muted small"> · required</span>}
                {r.note && <div className="muted small">{r.note}</div>}
              </td>
              {ACCESS_LEVELS.map((l) => (
                <td key={l.value} className="center">
                  {allowed(r, l.value) ? (
                    <input
                      type="radio"
                      className="access-radio"
                      name={`${title}-${r.key}`}
                      checked={levelOf(r) === l.value}
                      disabled={readOnly}
                      onChange={() => onChange({ ...value, [r.key]: l.value })}
                      aria-label={`${r.label}: ${l.label}`}
                    />
                  ) : (
                    <span className="muted" title={r.required ? 'Every project needs this field' : 'This tab has nothing to edit'}>
                      –
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRows({ module, colSpan, children }) {
  return (
    <>
      <tr className="module-row">
        <td colSpan={colSpan}>{module.name}</td>
      </tr>
      {children}
    </>
  );
}

export default function RoleFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user: me, can, reloadSession } = useAuth();
  const [matrix, setMatrix] = useState({});
  const [access, setAccess] = useState({ tabs: {}, fields: {} }); // project tabs / fields: hidden · view · edit

  const menus = useQuery({ queryKey: ['menus'], queryFn: rolesApi.menus, staleTime: 5 * 60 * 1000 });
  const roleQ = useQuery({ queryKey: ['roles', id], queryFn: () => rolesApi.get(id), enabled: isEdit, retry: false });
  const role = roleQ.data;
  // "Clone from": every other role that has permissions (Super Admin needs none)
  const allRoles = useQuery({ queryKey: ['roles', 'clone-list'], queryFn: () => rolesApi.list({ pageSize: 100, sortBy: 'level' }), staleTime: 60 * 1000 });
  const cloneOptions = (allRoles.data?.items ?? [])
    .filter((r) => r.level > 0 && String(r.id) !== String(id))
    .map((r) => ({ value: r.id, label: `${r.name} (level ${r.level})` }));
  const [cloneFrom, setCloneFrom] = useState(null);
  const [cloning, setCloning] = useState(false);
  const confirm = useConfirm();

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { formError, handleApiError } = useApiFormError(setError);

  useEffect(() => {
    if (!role) return;
    reset({
      name: role.name,
      code: role.code,
      level: role.level,
      roleType: role.roleType,
      dataScope: role.dataScope,
      isActive: role.isActive,
    });
    setMatrix(Object.fromEntries(role.permissions.map(({ menuId, ...flags }) => [menuId, flags])));
    setAccess({ tabs: role.accessRules?.tabs ?? {}, fields: role.accessRules?.fields ?? {} });
  }, [role, reset]);

  const isSuperAdminRole = role?.level === 0;
  // an empty Level field is not level 0
  const levelValue = watch('level');
  const levelIsZero = levelValue !== '' && levelValue !== undefined && levelValue !== null && Number(levelValue) === 0;
  const isSystem = role?.isSystem;
  const levelHelp = useMemo(
    () => (me.isSuperAdmin ? '0 = highest authority (Super Admin)' : `Must be higher than your level (${me.role.level})`),
    [me],
  );

  const save = useMutation({
    mutationFn: (body) => (isEdit ? rolesApi.update(id, body) : rolesApi.create(body)),
    onSuccess: async (saved) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      if (saved.id === me.role.id) await reloadSession();
      toast.success(isEdit ? 'Role saved' : 'Role created');
      navigate('/administration/roles');
    },
    onError: (err) => handleApiError(err),
  });

  if ((isEdit && roleQ.isLoading) || menus.isLoading) return <FullPageLoader />;
  if (isEdit && roleQ.isError) {
    return roleQ.error?.response?.status === 404 ? <NotFoundPage what="Role" /> : <ErrorAlert>{errorMessage(roleQ.error)}</ErrorAlert>;
  }

  const onSubmit = (v) => {
    const permissions = Object.entries(matrix)
      .map(([menuId, flags]) => ({ menuId: Number(menuId), ...NO_FLAGS, ...flags }))
      .filter((p) => PERMISSION_ACTIONS.some((a) => p[a.key]));
    return save.mutateAsync({ ...v, code: v.code || undefined, permissions, accessRules: access }).catch(() => {});
  };
  const err = (n) => errors[n]?.message;

  /** Copies another role's permissions and project access into this form (name, level, scope stay). */
  const cloneRole = async (sourceId) => {
    if (!sourceId) return;
    const source = cloneOptions.find((o) => o.value === sourceId)?.label ?? 'the role';
    const hasTicks = Object.values(matrix).some((flags) => PERMISSION_ACTIONS.some((a) => flags?.[a.key]));
    if (
      hasTicks &&
      !(await confirm({
        title: 'Replace permissions?',
        message: `The permissions ticked here are replaced with the ones of ${source}.`,
        confirmLabel: 'Replace',
        tone: 'primary',
      }))
    ) {
      return;
    }
    setCloning(true);
    try {
      const src = await queryClient.fetchQuery({ queryKey: ['roles', String(sourceId)], queryFn: () => rolesApi.get(sourceId) });
      // only what each screen supports and what the signed-in user may grant
      const screens = (menus.data ?? []).flatMap((m) => m.children);
      const next = {};
      for (const { menuId, ...flags } of src.permissions) {
        const screen = screens.find((sc) => sc.id === menuId);
        if (!screen) continue;
        next[menuId] = Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a.key, !!flags[a.key] && (screen.actions ?? []).includes(a.key) && can(screen.url, a.key)]));
      }
      setMatrix(next);
      setAccess({ tabs: src.accessRules?.tabs ?? {}, fields: src.accessRules?.fields ?? {} });
      setCloneFrom(sourceId);
      toast.success(`Permissions copied from ${src.name} – change any of them before saving`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCloning(false);
    }
  };

  return (
    <>
      <Topbar
        title={isEdit ? `Edit role · ${role.name}` : 'New role'}
        breadcrumb={['Administration', 'Roles & Permissions']}
        back="/administration/roles"
      />
      <form className="form-layout" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-main">
          <ErrorAlert>{formError}</ErrorAlert>
          <section className="card card-lg form-card">
            <div className="fc-head">
              <span className="fc-num">1</span>
              <div>
                <div className="form-section-title">Role</div>
                <div className="form-section-sub">Lower level = more authority. Level 0 is Super Admin.</div>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Name" required error={err('name')}>
                <input className="input" placeholder="Enter name" {...register('name')} />
              </Field>
              <Field label="Code" error={err('code')} help={isSystem ? 'Built-in role – code is fixed' : 'stable key used in code, e.g. SUPER_ADMIN'}>
                <input className="input" placeholder="Auto-generated if left blank" readOnly={isSystem} {...register('code')} />
              </Field>
              <Field label="Level" required error={err('level')} help={levelHelp}>
                <input className="input" type="number" min="0" max="99" placeholder="0" readOnly={isSystem} {...register('level')} />
              </Field>
              <Field label="Role type" help="external = customer / vendor logins">
                <Controller
                  name="roleType"
                  control={control}
                  render={({ field }) => (
                    <ChoiceGroup
                      name="roleType"
                      value={field.value}
                      onChange={field.onChange}
                      options={[{ value: 'internal', label: 'Internal' }, { value: 'external', label: 'External' }]}
                    />
                  )}
                />
              </Field>
              <Field label="Data scope" help="which records the role can see">
                <Controller
                  name="dataScope"
                  control={control}
                  render={({ field }) => <Dropdown placeholder="Select data scope" options={DATA_SCOPES} value={field.value} onChange={field.onChange} />}
                />
              </Field>
              <Field style={{ justifyContent: 'flex-end' }}>
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => <Switch label="Active" checked={field.value} onChange={field.onChange} disabled={isSystem} />}
                />
              </Field>
            </div>
          </section>

          <section className="card card-lg form-card">
            <div className="fc-head">
              <span className="fc-num">2</span>
              <div style={{ flex: 1 }}>
                <div className="form-section-title">Permissions</div>
                <div className="form-section-sub">
                  {isSuperAdminRole || levelIsZero
                    ? 'Level 0 (Super Admin) can do everything – no permissions to set.'
                    : 'Tick the actions this role can perform on each screen, or clone them from another role.'}
                </div>
              </div>
              {!(isSuperAdminRole || levelIsZero) && (
                <div className="role-clone">
                  <span className="role-clone-label">
                    <Copy />
                    Clone from
                  </span>
                  <Dropdown
                    search
                    clearable
                    placeholder={allRoles.isLoading ? 'Loading roles…' : 'Select a role'}
                    disabled={cloning || !cloneOptions.length}
                    options={cloneOptions}
                    value={cloneFrom}
                    onChange={(v) => (v ? cloneRole(v) : setCloneFrom(null))}
                  />
                </div>
              )}
            </div>
            {menus.isError ? (
              <ErrorAlert>{errorMessage(menus.error)}</ErrorAlert>
            ) : !menus.data ? (
              <Spinner />
            ) : (
              <PermissionMatrix
                menus={menus.data}
                value={matrix}
                onChange={setMatrix}
                can={can}
                readOnly={isSuperAdminRole || levelIsZero}
              />
            )}
          </section>

          {!(isSuperAdminRole || levelIsZero) && (
            <section className="card card-lg form-card">
              <div className="fc-head">
                <span className="fc-num">3</span>
                <div>
                  <div className="form-section-title">Project access</div>
                  <div className="form-section-sub">
                    Which project tabs and Project-tab fields this role sees (View) or changes (Edit). Edit still needs Edit on Project List above. Hidden fields are also blank in the
                    project list.
                  </div>
                </div>
              </div>
              <div className="access-grid">
                <AccessTable title="Project tab" rows={PROJECT_TABS} value={access.tabs} onChange={(tabs) => setAccess((a) => ({ ...a, tabs }))} />
                <AccessTable title="Project tab field" rows={PROJECT_FIELDS} value={access.fields} onChange={(fields) => setAccess((a) => ({ ...a, fields }))} />
              </div>
            </section>
          )}

          <div className="form-bar">
            <span className="note">
              <Cloud />
              Fields marked * are required
            </span>
            <div className="actions">
              <Link className="btn btn-ghost" to="/administration/roles">
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                <Check />
                {isSubmitting ? 'Saving…' : isEdit ? 'Save role' : 'Create role'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
