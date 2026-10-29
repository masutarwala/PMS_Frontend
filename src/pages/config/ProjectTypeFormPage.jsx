import { Fragment, useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Cloud, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { configApi, mastersApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { Topbar } from '@/components/layout/Topbar';
import { Dropdown } from '@/components/ui/Dropdown';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { ErrorAlert } from '@/components/ui/Display';
import { Checkbox, Field, Switch } from '@/components/ui/Field';
import { FullPageLoader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useConfirm } from '@/components/ui/confirm-context';
import { useApiFormError } from '@/hooks/useApiForm';
import { useLookupOptions, useMasterOptions } from '@/hooks/useOptions';
import { SCREENS } from '@/lib/constants';
import { num } from '@/lib/percent';
import { PercentBox } from '@/pages/projects/tabs/EditTabs';
import { ColorDot } from '@/pages/projects/tabs/shared';
import NotFoundPage from '@/pages/errors/NotFoundPage';

const api = configApi('project-types');

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter the name').max(100),
    projectDivisionId: z.number({ error: 'Select the division' }),
    description: z.string().max(2000),
    isActive: z.boolean(),
    // default effort split: % per task group (Project Types tab)
    split: z.array(z.object({ taskGroupId: z.number(), name: z.string(), pct: z.string() })),
    templates: z.array(
      z.object({
        taskGroupId: z.number({ error: 'Select a task group' }),
        taskTypeId: z.number({ error: 'Select a task type' }),
        taskTitle: z.string().trim().min(1, 'Enter the task title').max(300),
        description: z.string().max(5000),
        managerApproval: z.boolean(),
        clientApproval: z.boolean(),
        roleIds: z.array(z.number()),
      }),
    ),
  });

const EMPTY = { name: '', projectDivisionId: undefined, description: '', isActive: true, split: [], templates: [] };
const round2 = (n) => Math.round(n * 100) / 100;

/** API template task → form row. */
const toFormTask = (t) => ({
  taskGroupId: t.taskGroupId,
  taskTypeId: t.taskTypeId,
  taskTitle: t.taskTitle,
  description: t.description ?? '',
  managerApproval: t.managerApproval,
  clientApproval: t.clientApproval,
  roleIds: t.roles.map((x) => x.id),
});

/** Project types for the template pickers, with how many template tasks each has. */
function useProjectTypeList() {
  return useQuery({ queryKey: ['config', 'project-types', 'all'], queryFn: () => api.list({ pageSize: 100, sortBy: 'name' }), staleTime: 60 * 1000 });
}
const typeLabel = (t) => `${t.name}${t.divisionName ? ` · ${t.divisionName}` : ''} (${t.taskCount} task${t.taskCount === 1 ? '' : 's'})`;

/**
 * "New task template": the same page as the template editor, with the project type chosen at the
 * top (a template belongs to a project type). Picking the type opens its template right here.
 */
function NewTaskTemplate() {
  const navigate = useNavigate();
  const list = useProjectTypeList();
  const all = list.data?.items ?? [];
  // types without a template first
  const typeOptions = [...all]
    .sort((a, b) => (a.taskCount > 0) - (b.taskCount > 0) || a.name.localeCompare(b.name))
    .map((t) => ({ value: t.id, label: typeLabel(t) }));
  if (list.isLoading) return <FullPageLoader />;
  return (
    <>
      <Topbar title="New task template" breadcrumb={['Administration', 'Business Division', 'Task Templates']} back={SCREENS.TASK_TEMPLATES} />
      <div className="form-layout">
        <div className="form-main">
          <ErrorAlert>{list.isError ? errorMessage(list.error) : null}</ErrorAlert>
          <div className="card tpl-type-head">
            <span className="muted small">Project type</span>
            <div style={{ width: 360, maxWidth: '100%' }}>
              <Dropdown
                search
                placeholder="Select project type"
                options={typeOptions}
                value={null}
                // the template editor of that type – same page, now with its tasks
                onChange={(v) => v && navigate(`${SCREENS.TASK_TEMPLATES}/${v}/edit`, { replace: true })}
              />
            </div>
            <span className="muted small">a template belongs to one project type – add new types on the Project Types tab</span>
          </div>

          <section className="card card-lg form-card">
            <div className="fc-head">
              <div style={{ flex: 1 }}>
                <div className="form-section-title">Task template</div>
                <div className="form-section-sub">
                  Tasks created automatically when a project of this type is created. Add them one by one, or clone another type&apos;s template.
                </div>
              </div>
              <div className="role-clone">
                <span className="role-clone-label">
                  <Copy />
                  Clone from
                </span>
                <Dropdown disabled placeholder="Select the project type first" options={[]} value={null} onChange={() => {}} />
              </div>
            </div>
            <div className="editor tpl-editor">
              <div className="muted small" style={{ padding: 18 }}>
                Select the project type above to add its template tasks.
              </div>
              <div className="editor-foot">
                <button type="button" className="btn btn-soft btn-sm" disabled>
                  <Plus />
                  Add task
                </button>
              </div>
            </div>
          </section>

          <div className="form-bar">
            <span className="note">
              <Cloud />
              Fields marked * are required
            </span>
            <div className="actions">
              <Link className="btn btn-ghost" to={SCREENS.TASK_TEMPLATES}>
                Cancel
              </Link>
              <button type="button" className="btn btn-primary" disabled>
                <Check />
                Save task template
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
const NEW_TASK = { taskGroupId: undefined, taskTypeId: undefined, taskTitle: '', description: '', managerApproval: false, clientApproval: false, roleIds: [] };

/** Template tasks as a clean read-only table; ✎ opens the task in the drawer. */
function TaskTable({ tasks, groups, types, roles, onEdit, onRemove, editing, editor }) {
  const groupName = (id) => groups.find((g) => g.value === id)?.label ?? '—';
  const typeName = (id) => types.find((t) => t.id === id)?.name ?? '—';
  const roleName = (id) => roles.find((r) => r.value === id)?.label;
  if (!tasks.length && !editing) {
    return <div className="muted small" style={{ padding: 18 }}>No template tasks yet – projects of this type start without tasks.</div>;
  }
  return (
    <div className="table-wrap" style={{ border: 0 }}>
      <table className="data-table tpl-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Task title</th>
            <th>Group / type</th>
            <th>Skills needed</th>
            <th>Approvals</th>
            <th className="col-actions" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => {
            const roleNames = (t.roleIds ?? []).map(roleName).filter(Boolean);
            const isEditing = editing?.index === i;
            return (
              <Fragment key={i}>
              <tr className={isEditing ? 'is-selected' : ''}>
                <td className="muted">{i + 1}</td>
                <td className="tpl-task">
                  <button type="button" className="cell-title tpl-title-link" onClick={() => onEdit(i)}>
                    {t.taskTitle || <span className="muted">Untitled task</span>}
                  </button>
                  {t.description && <div className="cell-sub tpl-desc-line">{t.description}</div>}
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{groupName(t.taskGroupId)}</div>
                  <div className="cell-sub">{typeName(t.taskTypeId)}</div>
                </td>
                <td>
                  <div className="tpl-role-chips" title={roleNames.join(', ')}>
                    {roleNames.slice(0, 2).map((n) => (
                      <span key={n} className="chip">
                        {n}
                      </span>
                    ))}
                    {roleNames.length > 2 && <span className="chip chip-more">+{roleNames.length - 2}</span>}
                    {!roleNames.length && <span className="muted">—</span>}
                  </div>
                </td>
                <td>
                  <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                    {t.managerApproval && <span className="badge badge-info">Manager</span>}
                    {t.clientApproval && <span className="badge badge-warning">Client</span>}
                    {!t.managerApproval && !t.clientApproval && <span className="muted">—</span>}
                  </div>
                </td>
                <td className="col-actions">
                  <div className="row-actions">
                    <button type="button" className="btn btn-ghost btn-icon" title="Edit task" onClick={() => onEdit(i)}>
                      <Pencil />
                    </button>
                    <button type="button" className="btn btn-ghost btn-icon" title="Remove task" onClick={() => onRemove(i)}>
                      <Trash2 />
                    </button>
                  </div>
                </td>
              </tr>
              {isEditing && editor}
              </Fragment>
            );
          })}
          {editing?.index === 'new' && editor}
        </tbody>
      </table>
    </div>
  );
}

/** Inline editor for one template task, shown as a full-width row inside the task table. */
function TaskEditor({ editing, onCancel, onSave, groups, types, roles }) {
  const [t, setT] = useState(editing.task);
  const [errs, setErrs] = useState({});
  const set = (k, v) => setT((x) => ({ ...x, [k]: v }));
  const typeOptions = types.filter((x) => x.groupId === t.taskGroupId).map((x) => ({ value: x.id, label: x.name }));
  const isNew = editing.index === 'new';

  const save = () => {
    const e = {};
    if (!t.taskGroupId) e.taskGroupId = 'Select a task group';
    if (!t.taskTypeId) e.taskTypeId = 'Select a task type';
    if (!t.taskTitle.trim()) e.taskTitle = 'Enter the task title';
    setErrs(e);
    if (Object.keys(e).length) return;
    onSave({ ...t, taskTitle: t.taskTitle.trim() });
  };

  return (
    <tr className="tpl-edit-row">
      <td colSpan={6}>
        <div className="tpl-edit">
          <div className="tpl-edit-title">{isNew ? 'New task' : `Edit task ${editing.index + 1}`}</div>
          <div className="form-grid tpl-edit-grid">
            <Field label="Task group" required error={errs.taskGroupId}>
              <Dropdown
                search
                placeholder="Select task group"
                options={groups}
                value={t.taskGroupId}
                onChange={(v) => setT((x) => ({ ...x, taskGroupId: v, taskTypeId: undefined }))}
              />
            </Field>
            <Field label="Task type" required error={errs.taskTypeId}>
              <Dropdown
                search
                disabled={!t.taskGroupId}
                placeholder={!t.taskGroupId ? 'Select task group first' : typeOptions.length ? 'Select task type' : 'No task types in this group'}
                options={typeOptions}
                value={t.taskTypeId}
                onChange={(v) => set('taskTypeId', v)}
              />
            </Field>
            <Field label="Task title" required error={errs.taskTitle}>
              <input className="input" maxLength={300} placeholder="e.g. Create a site architecture" value={t.taskTitle} onChange={(e) => set('taskTitle', e.target.value)} />
            </Field>
            <Field label="Description" span="all">
              <textarea className="textarea" rows={2} maxLength={5000} placeholder="What this task covers" value={t.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
            <Field label="Skills needed" span={2} help="who can do this task (Parameters → SKILL)">
              <ChipSelect placeholder="Add skills…" options={roles} value={t.roleIds} onChange={(v) => set('roleIds', v)} />
            </Field>
            <Field label="Approvals">
              <div className="row" style={{ gap: 18, minHeight: 'var(--control-h)' }}>
                <Checkbox label="Manager" checked={t.managerApproval} onChange={(v) => set('managerApproval', v)} />
                <Checkbox label="Client" checked={t.clientApproval} onChange={(v) => set('clientApproval', v)} />
              </div>
            </Field>
          </div>
          <div className="tpl-edit-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save}>
              <Check />
              {isNew ? 'Add task' : 'Save task'}
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

/** Project Types tab: name, division, description, active. */
export default function ProjectTypeFormPage() {
  return <ProjectTypeEditor mode="type" />;
}

/** Task Templates tab: the tasks created for new projects of a type. */
export function TaskTemplateFormPage() {
  const { id } = useParams();
  return id ? <ProjectTypeEditor mode="template" /> : <NewTaskTemplate />;
}

function ProjectTypeEditor({ mode }) {
  const isTemplate = mode === 'template';
  const backTo = isTemplate ? SCREENS.TASK_TEMPLATES : SCREENS.PROJECT_TYPES;
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const groups = useMasterOptions('project-task-groups').options;
  const divisions = useMasterOptions('project-divisions').options;
  // "New project type" from a division row can pass ?divisionId=
  const presetDivision = Number(new URLSearchParams(useLocation().search).get('divisionId')) || undefined;
  const roles = useLookupOptions('SKILL').options;
  const typesQ = useQuery({ queryKey: ['masters', 'task-types'], queryFn: () => mastersApi.list('task-types') });
  const types = typesQ.data ?? [];

  const record = useQuery({ queryKey: ['config', 'project-types', id], queryFn: () => api.get(id), enabled: isEdit, retry: false });
  // "Clone from": other project types that have a template
  const typeList = useProjectTypeList();
  const cloneOptions = (typeList.data?.items ?? []).filter((t) => t.taskCount > 0 && String(t.id) !== String(id)).map((t) => ({ value: t.id, label: typeLabel(t) }));
  const [cloneFrom, setCloneFrom] = useState(null);
  const [cloning, setCloning] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { ...EMPTY, projectDivisionId: presetDivision } });
  const templates = useFieldArray({ control, name: 'templates' });
  const [editing, setEditing] = useState(null); // { index: number | 'new', task }
  const { formError, handleApiError } = useApiFormError(setError);

  const splitReady = useRef(false);
  useEffect(() => {
    const r = record.data;
    if (!r) return;
    reset({
      name: r.name,
      projectDivisionId: r.projectDivisionId ?? undefined,
      description: r.description ?? '',
      isActive: r.isActive,
      templates: r.templates.map(toFormTask),
    });
    splitReady.current = false; // the split is filled again once the task groups are here
  }, [record.data, reset]);

  // default effort split: every task group a project can use, with the saved % (once the groups are loaded)
  useEffect(() => {
    if (isTemplate || splitReady.current || !groups.length || (isEdit && !record.data)) return;
    const saved = new Map((record.data?.estimates ?? []).map((e) => [e.taskGroupId, e.effortPercentage]));
    setValue(
      'split',
      groups.map((g) => ({ taskGroupId: g.value, name: g.label, pct: saved.has(g.value) ? String(saved.get(g.value)) : '' })),
    );
    splitReady.current = true;
  }, [groups, record.data, isEdit, isTemplate, setValue]);

  const tasks = useWatch({ control, name: 'templates' }) ?? [];
  const split = useWatch({ control, name: 'split' }) ?? [];
  const splitTotal = round2(split.reduce((s, x) => s + num(x.pct), 0));
  const splitOk = splitTotal === 0 || splitTotal === 100;
  const setPct = (gid, v) => {
    setValue('split', split.map((x) => (x.taskGroupId === gid ? { ...x, pct: v } : x)));
    clearErrors('split');
  };

  /** Copies another project type's template tasks into this template (saved with "Save task template"). */
  const cloneTemplate = async (sourceId) => {
    if (!sourceId) return;
    const current = templates.fields.length;
    const label = cloneOptions.find((o) => o.value === sourceId)?.label ?? 'the selected project type';
    if (current && !(await confirm({ title: 'Replace template tasks?', message: `The ${current} task${current === 1 ? '' : 's'} here are replaced with the tasks of ${label}.`, confirmLabel: 'Replace', tone: 'primary' }))) return;
    setCloning(true);
    try {
      const src = await queryClient.fetchQuery({ queryKey: ['config', 'project-types', String(sourceId)], queryFn: () => api.get(sourceId) });
      setEditing(null);
      templates.replace(src.templates.map(toFormTask));
      setCloneFrom(sourceId);
      toast.success(`${src.templates.length} task${src.templates.length === 1 ? '' : 's'} copied from ${src.name} – save the template to keep them`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCloning(false);
    }
  };

  const save = useMutation({
    mutationFn: (body) => (isEdit ? api.update(id, body) : api.create(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'project-types'] });
      queryClient.invalidateQueries({ queryKey: ['config', 'task-templates'] }); // the Task Templates tab lists project types too
      queryClient.invalidateQueries({ queryKey: ['masters', 'project-types'] });
      queryClient.invalidateQueries({ queryKey: ['config', 'project-divisions'] });
      toast.success(isTemplate ? 'Task template saved' : isEdit ? 'Project type saved' : 'Project type created');
      navigate(backTo);
    },
    onError: (err) => handleApiError(err),
  });

  if (isTemplate && !isEdit) return <NotFoundPage what="Task template" />; // templates belong to a project type
  if (isEdit && record.isLoading) return <FullPageLoader />;
  if (isEdit && record.isError) {
    return record.error?.response?.status === 404 ? <NotFoundPage what="Project type" /> : <ErrorAlert>{errorMessage(record.error)}</ErrorAlert>;
  }

  const onSubmit = (v) => {
    if (!isTemplate && !(splitTotal === 0 || splitTotal === 100)) {
      setError('split', { type: 'validate', message: `The default split must total 100% (now ${splitTotal}%)` });
      return undefined;
    }
    return save
      .mutateAsync({
        name: v.name,
        projectDivisionId: v.projectDivisionId,
        description: v.description.trim() || null,
        isActive: v.isActive,
        // the template is saved from the Task Templates tab only; the Project Types tab leaves it alone
        ...(isTemplate
          ? {
              templates: v.templates.map((t) => ({
                taskGroupId: t.taskGroupId,
                taskTypeId: t.taskTypeId,
                taskTitle: t.taskTitle.trim(),
                description: t.description.trim() || null,
                managerApproval: t.managerApproval,
                clientApproval: t.clientApproval,
                roleIds: t.roleIds,
              })),
            }
          : {
              // the default effort split new projects of this type start with (0 or 100 %)
              estimates: v.split.filter((s) => num(s.pct) > 0).map((s) => ({ taskGroupId: s.taskGroupId, effortPercentage: num(s.pct) })),
            }),
      })
      .catch(() => {});
  };

  return (
    <>
      <Topbar
        title={isTemplate ? `Task template · ${record.data.name}` : isEdit ? `Edit project type · ${record.data.name}` : 'New project type'}
        breadcrumb={['Administration', 'Business Division', isTemplate ? 'Task Templates' : 'Project Types']}
        back={backTo}
      />
      <form className="form-layout" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-main">
          <ErrorAlert>{formError}</ErrorAlert>

          {isTemplate ? (
            <div className="card tpl-type-head">
              <span className="muted small">Project type</span>
              <b>{record.data.name}</b>
              {record.data.divisionName && <span className="badge">{record.data.divisionName}</span>}
            </div>
          ) : (
          <section className="card card-lg form-card">
            <div className="fc-head">
              <div>
                <div className="form-section-title">Project type</div>
                <div className="form-section-sub">e.g. Website Development, SEO &amp; Google Ads.</div>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Name" required error={errors.name?.message}>
                <input className="input" placeholder="Enter name" {...register('name')} />
              </Field>
              <Field label="Division" required error={errors.projectDivisionId?.message} help="projects of this type use this division">
                <Controller
                  name="projectDivisionId"
                  control={control}
                  render={({ field }) => <Dropdown search placeholder="Select division" options={divisions} value={field.value} onChange={field.onChange} />}
                />
              </Field>
              <Field span="all" label="Description" error={errors.description?.message}>
                <textarea className="textarea" placeholder="Add description…" {...register('description')} />
              </Field>
              <Field style={{ justifyContent: 'flex-end' }}>
                <Controller name="isActive" control={control} render={({ field }) => <Switch label="Active" checked={field.value} onChange={field.onChange} />} />
              </Field>
            </div>
          </section>
          )}

          {!isTemplate && (
            <section className="card card-lg form-card">
              <div className="fc-head">
                <div>
                  <div className="form-section-title">Default effort split</div>
                  <div className="form-section-sub">
                    The % of effort for each task group. New projects of this type start with this split on their Estimate tab; it can still be changed per project. Leave all empty for no default.
                  </div>
                </div>
              </div>
              <div className="alloc-bar" style={{ marginBottom: 16 }}>
                {split.filter((s) => num(s.pct) > 0).map((s, i) => (
                  <span key={s.taskGroupId} className={`c${(i % 8) + 1}`} style={{ width: `${Math.min(100, num(s.pct))}%` }} />
                ))}
              </div>
              <div className="editor">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Task group</th>
                      <th style={{ width: 170 }}>% of effort</th>
                    </tr>
                  </thead>
                  <tbody>
                    {split.map((s, i) => (
                      <tr key={s.taskGroupId}>
                        <td>
                          <span className="row" style={{ gap: 10 }}>
                            <ColorDot i={i} />
                            <b>{s.name}</b>
                          </span>
                        </td>
                        <td>
                          <PercentBox value={s.pct} onChange={(v) => setPct(s.taskGroupId, v)} inputStyle={{ textAlign: 'right', paddingRight: 40 }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="editor-foot">
                  <span className={`small${splitOk ? ' muted' : ''}`} style={splitOk ? undefined : { color: 'var(--danger)', fontWeight: 600 }}>
                    {errors.split?.message ?? (splitTotal === 100 ? 'Total is 100%' : splitTotal === 0 ? 'No default split' : splitTotal > 100 ? `${round2(splitTotal - 100)}% over – reduce a value` : `${round2(100 - splitTotal)}% left to allocate`)}
                  </span>
                  <div className="editor-total">
                    <span className={`badge ${splitTotal === 100 ? 'badge-success' : splitTotal === 0 ? '' : 'badge-danger'}`}>{splitTotal}%</span>
                    <span className="muted">Total</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {isTemplate && (
          <section className="card card-lg form-card">
            <div className="fc-head">
              <div style={{ flex: 1 }}>
                <div className="form-section-title">Task template</div>
                <div className="form-section-sub">
                  Tasks created automatically when a project of this type is created. Add them one by one, or clone another type&apos;s template.
                </div>
              </div>
              <div className="role-clone">
                <span className="role-clone-label">
                  <Copy />
                  Clone from
                </span>
                <Dropdown
                  search
                  clearable
                  placeholder={typeList.isLoading ? 'Loading…' : cloneOptions.length ? 'Select a project type' : 'No other templates'}
                  disabled={cloning || !cloneOptions.length}
                  options={cloneOptions}
                  value={cloneFrom}
                  onChange={(v) => (v ? cloneTemplate(v) : setCloneFrom(null))}
                />
              </div>
            </div>
            <div className="editor tpl-editor">
              <TaskTable
                tasks={tasks}
                groups={groups}
                types={types}
                roles={roles}
                onEdit={(index) => setEditing({ index, task: { ...NEW_TASK, ...tasks[index] } })}
                onRemove={async (index) => {
                  const title = tasks[index]?.taskTitle;
                  if (!(await confirm({ title: 'Remove task?', message: `"${title || 'This task'}" is removed from the template when you save.`, confirmLabel: 'Remove' }))) return;
                  setEditing(null);
                  templates.remove(index);
                }}
                editing={editing}
                editor={
                  editing && (
                    <TaskEditor
                      key={`${editing.index}`}
                      editing={editing}
                      onCancel={() => setEditing(null)}
                      groups={groups}
                      types={types}
                      roles={roles}
                      onSave={(task) => {
                        if (editing.index === 'new') templates.append(task);
                        else templates.update(editing.index, task);
                        setEditing(null);
                      }}
                    />
                  )
                }
              />
              <div className="editor-foot">
                <button type="button" className="btn btn-soft btn-sm" onClick={() => setEditing({ index: 'new', task: { ...NEW_TASK } })}>
                  <Plus />
                  Add task
                </button>
              </div>
            </div>
          </section>
          )}

          <div className="form-bar">
            <span className="note">
              <Cloud />
              Fields marked * are required
            </span>
            <div className="actions">
              <Link className="btn btn-ghost" to={backTo}>
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                <Check />
                {isSubmitting ? 'Saving…' : isTemplate ? 'Save task template' : isEdit ? 'Save project type' : 'Create project type'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
