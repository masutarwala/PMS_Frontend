import { Fragment, useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Cloud, Pencil, Plus, Trash2 } from 'lucide-react';
import { configApi, mastersApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { Topbar } from '@/components/layout/Topbar';
import { Dropdown } from '@/components/ui/Dropdown';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { ErrorAlert } from '@/components/ui/Display';
import { Checkbox, Field, Switch } from '@/components/ui/Field';
import { FullPageLoader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useApiFormError } from '@/hooks/useApiForm';
import { useLookupOptions, useMasterOptions } from '@/hooks/useOptions';
import { SCREENS } from '@/lib/constants';
import NotFoundPage from '@/pages/errors/NotFoundPage';

const api = configApi('project-types');
const BASE = SCREENS.PROJECT_TYPES;

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter the name').max(100),
    description: z.string().max(2000),
    isActive: z.boolean(),
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

const EMPTY = { name: '', description: '', isActive: true, templates: [] };
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
            <th>Assigned roles</th>
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
            <Field label="Assigned roles" span={2}>
              <ChipSelect placeholder="Add roles…" options={roles} value={t.roleIds} onChange={(v) => set('roleIds', v)} />
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

export default function ProjectTypeFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const groups = useMasterOptions('task-groups').options;
  const roles = useLookupOptions('TASK_ROLE').options;
  const typesQ = useQuery({ queryKey: ['masters', 'task-types'], queryFn: () => mastersApi.list('task-types') });
  const types = typesQ.data ?? [];

  const record = useQuery({ queryKey: ['config', 'project-types', id], queryFn: () => api.get(id), enabled: isEdit, retry: false });
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const templates = useFieldArray({ control, name: 'templates' });
  const [editing, setEditing] = useState(null); // { index: number | 'new', task }
  const { formError, handleApiError } = useApiFormError(setError);

  useEffect(() => {
    const r = record.data;
    if (!r) return;
    reset({
      name: r.name,
      description: r.description ?? '',
      isActive: r.isActive,
      templates: r.templates.map((t) => ({
        taskGroupId: t.taskGroupId,
        taskTypeId: t.taskTypeId,
        taskTitle: t.taskTitle,
        description: t.description ?? '',
        managerApproval: t.managerApproval,
        clientApproval: t.clientApproval,
        roleIds: t.roles.map((x) => x.id),
      })),
    });
  }, [record.data, reset]);

  const tasks = useWatch({ control, name: 'templates' }) ?? [];

  const save = useMutation({
    mutationFn: (body) => (isEdit ? api.update(id, body) : api.create(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'project-types'] });
      queryClient.invalidateQueries({ queryKey: ['masters', 'project-types'] });
      toast.success(isEdit ? 'Project type saved' : 'Project type created');
      navigate(BASE);
    },
    onError: (err) => handleApiError(err),
  });

  if (isEdit && record.isLoading) return <FullPageLoader />;
  if (isEdit && record.isError) {
    return record.error?.response?.status === 404 ? <NotFoundPage what="Project type" /> : <ErrorAlert>{errorMessage(record.error)}</ErrorAlert>;
  }

  const onSubmit = (v) =>
    save
      .mutateAsync({
        name: v.name,
        description: v.description.trim() || null,
        isActive: v.isActive,
        templates: v.templates.map((t) => ({
          taskGroupId: t.taskGroupId,
          taskTypeId: t.taskTypeId,
          taskTitle: t.taskTitle.trim(),
          description: t.description.trim() || null,
          managerApproval: t.managerApproval,
          clientApproval: t.clientApproval,
          roleIds: t.roleIds,
        })),
        // the effort split is set per project (Estimate tab), not on the project type
        estimates: [],
      })
      .catch(() => {});

  return (
    <>
      <Topbar title={isEdit ? `Edit project type · ${record.data.name}` : 'New project type'} breadcrumb={['Administration', 'Project Types']} back={BASE} />
      <form className="form-layout" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-main">
          <ErrorAlert>{formError}</ErrorAlert>

          <section className="card card-lg form-card">
            <div className="fc-head">
              <span className="fc-num">1</span>
              <div>
                <div className="form-section-title">Project type</div>
                <div className="form-section-sub">e.g. Website Development, SEO &amp; Google Ads.</div>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Name" required error={errors.name?.message}>
                <input className="input" placeholder="Enter name" {...register('name')} />
              </Field>
              <Field span="all" label="Description" error={errors.description?.message}>
                <textarea className="textarea" placeholder="Add description…" {...register('description')} />
              </Field>
              <Field style={{ justifyContent: 'flex-end' }}>
                <Controller name="isActive" control={control} render={({ field }) => <Switch label="Active" checked={field.value} onChange={field.onChange} />} />
              </Field>
            </div>
          </section>

          <section className="card card-lg form-card">
            <div className="fc-head">
              <span className="fc-num">2</span>
              <div>
                <div className="form-section-title">Task template</div>
                <div className="form-section-sub">
                  Tasks created automatically when a project of this type is created.
                </div>
              </div>
            </div>
            <div className="editor tpl-editor">
              <TaskTable
                tasks={tasks}
                groups={groups}
                types={types}
                roles={roles}
                onEdit={(index) => setEditing({ index, task: { ...NEW_TASK, ...tasks[index] } })}
                onRemove={(index) => {
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

          <div className="form-bar">
            <span className="note">
              <Cloud />
              Fields marked * are required
            </span>
            <div className="actions">
              <Link className="btn btn-ghost" to={BASE}>
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                <Check />
                {isSubmitting ? 'Saving…' : isEdit ? 'Save project type' : 'Create project type'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
