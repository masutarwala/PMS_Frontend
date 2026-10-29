import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Cloud, Info, Plus } from 'lucide-react';
import { task135Api, tasksApi, timesheetsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAuth, usePermissions } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { DatePicker } from '@/components/ui/DatePicker';
import { ErrorAlert } from '@/components/ui/Display';
import { Dropdown } from '@/components/ui/Dropdown';
import { Field } from '@/components/ui/Field';
import { FullPageLoader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useApiFormError } from '@/hooks/useApiForm';
import { blockNonNumericKeys } from '@/lib/percent';
import { SCREENS } from '@/lib/constants';
import { todayIso } from '@/lib/timezone';
import NotFoundPage from '@/pages/errors/NotFoundPage';

// project / group / type are checked on submit: only a project category needs them
const schema = z.object({
  categoryId: z.number().nullable(),
  workDate: z.string().min(1, 'Select the date'),
  projectId: z.number().nullable().optional(),
  taskGroupId: z.number().nullable().optional(),
  taskTypeId: z.number().nullable().optional(),
  taskId: z.number().nullable(),
  minutes: z
    .string()
    .trim()
    .min(1, 'Enter the time spent')
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 1440, 'Enter whole minutes, 1 to 1440'),
  comment: z.string().trim().min(1, 'Describe the work you did').max(2000),
});

const EMPTY = {
  categoryId: null,
  workDate: todayIso(),
  projectId: null,
  taskGroupId: null,
  taskTypeId: null,
  taskId: null,
  minutes: '',
  comment: '',
};

/**
 * Log time / edit a time entry. The task category decides the rest:
 *   Project  – pick one of your open project tasks / subtasks; it fills the project, task group and type;
 *   Personal, Activity … – no task, project or billing: only the time and the work done.
 */
export default function TimesheetFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const options = useQuery({
    queryKey: ['timesheets', 'options'],
    queryFn: timesheetsApi.options,
  });
  const meta = useQuery({
    queryKey: ['timesheets', 'meta'],
    queryFn: timesheetsApi.meta,
  });
  const entry = useQuery({
    queryKey: ['timesheets', 'entry', id],
    queryFn: () => timesheetsApi.get(id),
    enabled: isEdit,
    retry: false,
  });
  // "My task": open tasks and subtasks assigned to me
  const canTasks = usePermissions(SCREENS.TASKS).view;
  const can135 = usePermissions(SCREENS.TASK_135).view;
  const myTasks = useQuery({
    queryKey: ['timesheets', 'my-tasks', user.id],
    queryFn: () =>
      tasksApi.list({
        scope: 'mine',
        assignedTo: [user.id],
        status: ['to_do', 'in_progress', 'hold'],
        pageSize: 100,
        sortBy: 'priority',
      }),
    enabled: canTasks,
  });
  const mySubtasks = useQuery({
    queryKey: ['timesheets', 'my-subtasks', user.id],
    queryFn: () => task135Api.subtasks(),
    enabled: can135,
  });
  const [picked, setPicked] = useState(null);
  const [needsType, setNeedsType] = useState(false); // the picked task has a group but no task type: pick one

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { formError, handleApiError } = useApiFormError(setError);
  const addAnother = useRef(false); // "Log & add another" stays on the form
  const [categoryId, projectId, taskGroupId, taskTypeId, taskId] = useWatch({
    control,
    name: ['categoryId', 'projectId', 'taskGroupId', 'taskTypeId', 'taskId'],
  });

  useEffect(() => {
    const e = entry.data;
    if (e) {
      reset({
        categoryId: e.categoryId,
        workDate: e.workDate,
        projectId: e.projectId,
        taskGroupId: e.taskGroupId,
        taskTypeId: e.taskTypeId,
        taskId: e.taskId,
        minutes: String(e.minutes),
        comment: e.comment ?? '',
      });
    }
  }, [entry.data, reset]);

  const categories = useMemo(() => meta.data?.categories ?? [], [meta.data]);
  const projectCat = categories.find((c) => c.isProject);
  // no category picked yet = the project category (as before)
  const catId = categoryId ?? projectCat?.id ?? null;
  const category = categories.find((c) => c.id === catId);
  const isProject = category ? category.isProject : true;

  const projects = useMemo(() => options.data ?? [], [options.data]);

  // open tasks / subtasks assigned to me, on the projects I am assigned to
  const myWork = useMemo(() => {
    const where = new Map(projects.flatMap((p) => p.tasks.map((t) => [t.id, p])));
    return [
      ...(myTasks.data?.items ?? [])
        .filter((t) => where.has(t.id))
        .map((t) => ({ value: `t${t.id}`, label: t.name, taskId: t.id, projectId: where.get(t.id).id, title: t.name })),
      ...(mySubtasks.data ?? [])
        .filter((s) => where.has(s.taskId))
        .map((s) => ({
          value: `s${s.id}`,
          label: `Subtask: ${s.title} — of ${s.taskName}`,
          taskId: s.taskId,
          projectId: where.get(s.taskId).id,
          title: s.title,
        })),
    ];
  }, [projects, myTasks.data, mySubtasks.data]);

  const project = projects.find((p) => p.id === projectId);
  // an edited entry's task may no longer be open: keep it selectable
  const taskOptions = useMemo(() => {
    const t = taskId && !myWork.some((w) => w.taskId === taskId) ? project?.tasks.find((x) => x.id === taskId) : null;
    return t ? [{ value: `t${t.id}`, label: t.name, taskId: t.id, projectId: project.id, title: t.name }, ...myWork] : myWork;
  }, [myWork, taskId, project]);
  // the tasks of the selected project
  const projectTasks = taskOptions.filter((w) => w.projectId === projectId);
  const taskValue = taskId ? ((taskOptions.find((w) => w.value === picked && w.taskId === taskId) ?? taskOptions.find((w) => w.taskId === taskId))?.value ?? null) : null;

  const clearTask = () => {
    setNeedsType(false);
    setValue('projectId', null);
    setValue('taskGroupId', null);
    setValue('taskTypeId', null);
    setValue('taskId', null);
  };

  const pickWork = (key) => {
    setPicked(key ?? null);
    const w = taskOptions.find((x) => x.value === key);
    if (!w) {
      // task cleared: the project stays
      setNeedsType(false);
      setValue('taskGroupId', null);
      setValue('taskTypeId', null);
      setValue('taskId', null);
      return;
    }
    const p = projects.find((x) => x.id === w.projectId);
    const t = p.tasks.find((x) => x.id === w.taskId);
    // the task's group / type count only when the group is in the project estimate
    const g = p.taskGroups.find((x) => x.id === t.taskGroupId);
    setValue('projectId', p.id);
    setValue('taskGroupId', g?.id ?? null);
    const typeOk = g?.taskTypes.some((x) => x.id === t.taskTypeId);
    setValue('taskTypeId', typeOk ? t.taskTypeId : null);
    setNeedsType(Boolean(g) && !typeOk);
    setValue('taskId', w.taskId);
    clearErrors('taskId');
    if (!getValues('comment')?.trim()) setValue('comment', w.title);
  };

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const group = project?.taskGroups.find((g) => g.id === taskGroupId);
  const taskType = group?.taskTypes.find((x) => x.id === taskTypeId);
  // Personal / Activity: the groups set up for the category (none set = any group)
  const otherGroups = (meta.data?.taskGroups ?? []).filter((g) => !category?.taskGroupIds?.length || category.taskGroupIds.includes(g.id));
  const otherGroup = otherGroups.find((g) => g.id === taskGroupId);
  const taskHelp = 'your open tasks and subtasks of the project';

  const save = useMutation({
    mutationFn: (body) => (isEdit ? timesheetsApi.update(id, body) : timesheetsApi.create(body)),
    onSuccess: (saved, body) => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'efforts'] });
      toast.success(isEdit ? 'Time entry updated' : `${saved.minutes} mins logged on ${saved.projectTitle ?? saved.categoryName}`);
      if (addAnother.current) {
        // next entry: same day, category and project, the rest cleared
        reset({
          ...EMPTY,
          workDate: body.workDate,
          categoryId: body.categoryId,
        });
        setPicked(null);
        return;
      }
      navigate('/timesheet');
    },
    onError: (err) => handleApiError(err),
  });

  if (options.isLoading || meta.isLoading || (isEdit && entry.isLoading)) return <FullPageLoader />;
  if (isEdit && entry.isError) {
    return entry.error?.response?.status === 404 ? <NotFoundPage what="Time entry" /> : <ErrorAlert>{errorMessage(entry.error)}</ErrorAlert>;
  }

  const err = (n) => errors[n]?.message;
  const onSubmit = (v) => {
    // Personal / Activity: the task group and type are required
    if (!isProject && (!v.taskGroupId || !v.taskTypeId)) {
      if (!v.taskGroupId) setError('taskGroupId', { message: 'Select the task group' });
      if (!v.taskTypeId) setError('taskTypeId', { message: 'Select the task type' });
      return undefined;
    }
    // project time needs a task whose project, task group and type are known
    if (isProject) {
      const hasKept = isEdit && v.projectId && v.taskGroupId && v.taskTypeId; // an older entry without a task
      let message = null;
      if (!v.projectId) {
        setError('projectId', { message: 'Select the project' });
        return undefined;
      }
      if (!v.taskId && !hasKept) message = 'Select the task';
      else if (!v.projectId || !v.taskGroupId) message = 'This task’s task group is not in the project estimate – set it on the project Estimate tab';
      else if (!v.taskTypeId) {
        setError('taskTypeId', { message: 'Select the task type' });
        return undefined;
      }
      if (message) {
        setError('taskId', { message });
        return undefined;
      }
    }
    return save
      .mutateAsync({
        categoryId: catId,
        workDate: v.workDate,
        projectId: isProject ? v.projectId : null,
        taskGroupId: v.taskGroupId ?? null,
        taskTypeId: v.taskTypeId ?? null,
        taskId: isProject ? (v.taskId ?? null) : null,
        minutes: Number(v.minutes),
        comment: v.comment.trim(),
      })
      .catch(() => {});
  };

  const noProjects = !projects.length;

  return (
    <>
      <Topbar title={isEdit ? 'Edit time entry' : 'Log time'} breadcrumb={['Timesheet', 'Timesheet']} back="/timesheet" />
      <form className="form-layout" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-main">
          <ErrorAlert>{formError}</ErrorAlert>
          {isProject && noProjects && (
            <div className="alert alert-warning" style={{ marginBottom: 16 }}>
              <Info />
              <div>You are not assigned to any project yet. Ask the project owner to add you on the project&apos;s Users tab – or log Personal / Activity time.</div>
            </div>
          )}
          <section className="card card-lg form-card">
            <div className="fc-head">
              <span className="fc-num">1</span>
              <div>
                <div className="form-section-title">Time entry</div>
                <div className="form-section-sub">
                  {isProject
                    ? 'Pick one of your open project tasks, so the time counts in the project analysis.'
                    : `${category?.name ?? 'This'} time is not on a project – the task group and type are required.`}
                </div>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Category" required error={err('categoryId')}>
                <Controller
                  name="categoryId"
                  control={control}
                  render={({ field }) => (
                    <Dropdown
                      options={categoryOptions}
                      value={catId}
                      onChange={(v) => {
                        if (v === catId) return;
                        field.onChange(v);
                        // another category: start the task again
                        setPicked(null);
                        clearTask();
                                      }}
                    />
                  )}
                />
              </Field>
              <Field label="Date" required error={err('workDate')}>
                <Controller
                  name="workDate"
                  control={control}
                  render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} onBlur={field.onBlur} clearable={false} max={todayIso()} placeholder="Select date" />}
                />
              </Field>
              {/* fixed layout: every field stays in place; Project and Task are switched off for Personal / Activity, Task group and type are view only for project time */}
              <Field label="Project" required={isProject} span={2} error={err('projectId')} help={isProject ? 'projects you are assigned to' : 'only for project time'}>
                <Controller
                  name="projectId"
                  control={control}
                  render={({ field }) => (
                    <Dropdown
                      search
                      placeholder={!isProject ? `Not needed for ${category?.name ?? 'this category'}` : noProjects ? 'No assigned projects' : 'Select project'}
                      disabled={!isProject || noProjects}
                      options={projects.map((p) => ({ value: p.id, label: p.title }))}
                      value={isProject ? field.value : null}
                      onChange={(v) => {
                        if (v === field.value) return;
                        field.onChange(v);
                        // another project: pick its task again
                        setPicked(null);
                        setNeedsType(false);
                        setValue('taskGroupId', null);
                        setValue('taskTypeId', null);
                        setValue('taskId', null);
                        clearErrors(['projectId', 'taskId']);
                      }}
                    />
                  )}
                />
              </Field>
              <Field label="Task" required={isProject} span={2} error={err('taskId')} help={isProject ? taskHelp : 'only for project time'}>
                <Dropdown
                  search
                  clearable
                  disabled={!isProject || !projectId || !projectTasks.length}
                  placeholder={
                    !isProject
                      ? `Not needed for ${category?.name ?? 'this category'}`
                      : !projectId
                        ? 'Select project first'
                        : myTasks.isLoading || mySubtasks.isLoading
                          ? 'Loading…'
                          : projectTasks.length
                            ? 'Select a task or subtask'
                            : 'No open tasks assigned to you on this project'
                  }
                  options={isProject ? projectTasks : []}
                  value={isProject ? taskValue : null}
                  onChange={pickWork}
                />
              </Field>
              <Field label="Task group" required error={err('taskGroupId')} help={isProject ? 'from the task' : undefined}>
                <Controller
                  name="taskGroupId"
                  control={control}
                  render={({ field }) => (
                    <Dropdown
                      search
                      disabled={isProject}
                      placeholder={isProject ? 'Filled from the task' : 'Select task group'}
                      options={isProject ? (group ? [{ value: group.id, label: group.name }] : []) : otherGroups.map((g) => ({ value: g.id, label: g.name }))}
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v);
                        setValue('taskTypeId', null);
                        clearErrors(['taskGroupId', 'taskTypeId']);
                      }}
                    />
                  )}
                />
              </Field>
              <Field label="Task type" required error={err('taskTypeId')} help={isProject ? (needsType ? 'this task has no type – pick one' : 'from the task') : undefined}>
                <Controller
                  name="taskTypeId"
                  control={control}
                  render={({ field }) => (
                    <Dropdown
                      search
                      disabled={isProject ? !needsType : !otherGroup}
                      placeholder={isProject ? (needsType ? 'Select task type' : 'Filled from the task') : !otherGroup ? 'Select task group first' : otherGroup.taskTypes.length ? 'Select task type' : 'No task types in this group'}
                      options={isProject ? (needsType ? (group?.taskTypes ?? []).map((t) => ({ value: t.id, label: t.name })) : taskType ? [{ value: taskType.id, label: taskType.name }] : []) : (otherGroup?.taskTypes ?? []).map((t) => ({ value: t.id, label: t.name }))}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </Field>
              <Field label="Time spent" required error={err('minutes')} help="in minutes, e.g. 90 = 1 h 30 min">
                <div className="input-group">
                  <input
                    className="input has-trail"
                    type="number"
                    min="1"
                    max="1440"
                    step="1"
                    inputMode="numeric"
                    placeholder="0"
                    onKeyDown={(e) => {
                      blockNonNumericKeys(e);
                      if (e.key === '.' || e.key === ',') e.preventDefault(); // whole minutes only
                    }}
                    {...register('minutes')}
                  />
                  <span className="trail">mins</span>
                </div>
              </Field>
              <Field label="Work done" required span="all" error={err('comment')}>
                <textarea className="textarea" rows={3} maxLength={2000} placeholder="Explain the work you did…" {...register('comment')} />
              </Field>
            </div>
          </section>
          <div className="form-bar">
            <span className="note">
              <Cloud />
              Fields marked * are required
            </span>
            <div className="actions">
              <Link className="btn btn-ghost" to="/timesheet">
                Cancel
              </Link>
              {!isEdit && (
                <button type="submit" className="btn btn-secondary" disabled={isSubmitting || (isProject && noProjects)} onClick={() => (addAnother.current = true)}>
                  <Plus />
                  Log &amp; add another
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={isSubmitting || (isProject && noProjects)} onClick={() => (addAnother.current = false)}>
                <Check />
                {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Log time'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
