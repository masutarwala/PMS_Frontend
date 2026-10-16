import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Cloud, Info } from 'lucide-react';
import { timesheetsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { Topbar } from '@/components/layout/Topbar';
import { DatePicker } from '@/components/ui/DatePicker';
import { ErrorAlert } from '@/components/ui/Display';
import { Dropdown } from '@/components/ui/Dropdown';
import { Checkbox, Field } from '@/components/ui/Field';
import { FullPageLoader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useApiFormError } from '@/hooks/useApiForm';
import { blockNonNumericKeys } from '@/lib/percent';
import NotFoundPage from '@/pages/errors/NotFoundPage';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const schema = z.object({
  workDate: z.string().min(1, 'Select the date'),
  projectId: z.number({ error: 'Select the project' }),
  taskGroupId: z.number({ error: 'Select the task group' }),
  taskTypeId: z.number({ error: 'Select the task type' }),
  taskId: z.number().nullable(),
  minutes: z
    .string()
    .trim()
    .min(1, 'Enter the time spent')
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 1440, 'Enter whole minutes, 1 to 1440'),
  isBillable: z.boolean(),
  comment: z.string().trim().min(1, 'Describe the work you did').max(2000),
});

const EMPTY = { workDate: todayIso(), projectId: undefined, taskGroupId: undefined, taskTypeId: undefined, taskId: null, minutes: '', isBillable: true, comment: '' };

export default function TimesheetFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const options = useQuery({ queryKey: ['timesheets', 'options'], queryFn: timesheetsApi.options });
  const entry = useQuery({ queryKey: ['timesheets', 'entry', id], queryFn: () => timesheetsApi.get(id), enabled: isEdit, retry: false });

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { formError, handleApiError } = useApiFormError(setError);
  const [projectId, taskGroupId, taskId] = useWatch({ control, name: ['projectId', 'taskGroupId', 'taskId'] });

  useEffect(() => {
    const e = entry.data;
    if (e) {
      reset({
        workDate: e.workDate,
        projectId: e.projectId,
        taskGroupId: e.taskGroupId,
        taskTypeId: e.taskTypeId,
        taskId: e.taskId,
        minutes: String(e.minutes),
        isBillable: e.isBillable,
        comment: e.comment ?? '',
      });
    }
  }, [entry.data, reset]);

  const projects = useMemo(() => options.data ?? [], [options.data]);
  const project = projects.find((p) => p.id === projectId);
  const group = project?.taskGroups.find((g) => g.id === taskGroupId);
  const projectOptions = projects.map((p) => ({ value: p.id, label: p.title }));
  const groupOptions = (project?.taskGroups ?? []).map((g) => ({ value: g.id, label: g.name }));
  const typeOptions = (group?.taskTypes ?? []).map((t) => ({ value: t.id, label: t.name }));
  // tasks of the project in groups the estimate tracks
  const taskOptions = (project?.tasks ?? [])
    .filter((t) => project.taskGroups.some((g) => g.id === t.taskGroupId) && (!taskGroupId || t.taskGroupId === taskGroupId))
    .map((t) => ({ value: t.id, label: t.name }));

  const save = useMutation({
    mutationFn: (body) => (isEdit ? timesheetsApi.update(id, body) : timesheetsApi.create(body)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(isEdit ? 'Time entry updated' : `${saved.minutes} mins logged on ${saved.projectTitle}`);
      navigate('/timesheet');
    },
    onError: (err) => handleApiError(err),
  });

  if (options.isLoading || (isEdit && entry.isLoading)) return <FullPageLoader />;
  if (isEdit && entry.isError) {
    return entry.error?.response?.status === 404 ? <NotFoundPage what="Time entry" /> : <ErrorAlert>{errorMessage(entry.error)}</ErrorAlert>;
  }

  const err = (n) => errors[n]?.message;
  const onSubmit = (v) =>
    save
      .mutateAsync({
        workDate: v.workDate,
        projectId: v.projectId,
        taskGroupId: v.taskGroupId,
        taskTypeId: v.taskTypeId,
        taskId: v.taskId ?? null,
        minutes: Number(v.minutes),
        isBillable: v.isBillable,
        comment: v.comment.trim(),
      })
      .catch(() => {});

  const noProjects = !projects.length;
  const noGroups = project && !project.taskGroups.length;

  return (
    <>
      <Topbar title={isEdit ? 'Edit time entry' : 'Log time'} breadcrumb={['Timesheet', 'Timesheet']} back="/timesheet" />
      <form className="form-layout" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-main">
          <ErrorAlert>{formError}</ErrorAlert>
          {noProjects && (
            <div className="alert alert-warning" style={{ marginBottom: 16 }}>
              <Info />
              <div>You are not assigned to any project yet. Ask the project owner to add you on the project&apos;s Users tab.</div>
            </div>
          )}
          <section className="card card-lg form-card">
            <div className="fc-head">
              <span className="fc-num">1</span>
              <div>
                <div className="form-section-title">Time entry</div>
                <div className="form-section-sub">Only your assigned projects, and only the task groups in the project&apos;s estimate, so the time counts in the project analysis.</div>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Date" required error={err('workDate')}>
                <Controller
                  name="workDate"
                  control={control}
                  render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} onBlur={field.onBlur} clearable={false} max={todayIso()} placeholder="Select date" />}
                />
              </Field>
              <Field label="Project" required error={err('projectId')} help="projects you are assigned to">
                <Controller
                  name="projectId"
                  control={control}
                  render={({ field }) => (
                    <Dropdown
                      search
                      placeholder={noProjects ? 'No assigned projects' : 'Select project'}
                      disabled={noProjects}
                      options={projectOptions}
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v);
                        setValue('taskGroupId', undefined);
                        setValue('taskTypeId', undefined);
                        setValue('taskId', null);
                      }}
                    />
                  )}
                />
              </Field>
              <Field
                label="Task group"
                required
                error={err('taskGroupId') ?? (noGroups ? 'This project has no effort split yet – set it on the project Estimate tab' : undefined)}
                help="groups in the project estimate"
              >
                <Controller
                  name="taskGroupId"
                  control={control}
                  render={({ field }) => (
                    <Dropdown
                      search
                      disabled={!project || noGroups}
                      placeholder={!project ? 'Select project first' : 'Select task group'}
                      options={groupOptions}
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v);
                        setValue('taskTypeId', undefined);
                        if (taskId && project.tasks.find((t) => t.id === taskId)?.taskGroupId !== v) setValue('taskId', null);
                      }}
                    />
                  )}
                />
              </Field>
              <Field label="Task type" required error={err('taskTypeId')}>
                <Controller
                  name="taskTypeId"
                  control={control}
                  render={({ field }) => (
                    <Dropdown
                      search
                      disabled={!group}
                      placeholder={!group ? 'Select task group first' : typeOptions.length ? 'Select task type' : 'No task types in this group'}
                      options={typeOptions}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </Field>
              <Field label="Task" error={err('taskId')} help="optional – a task of the project">
                <Controller
                  name="taskId"
                  control={control}
                  render={({ field }) => (
                    <Dropdown
                      search
                      clearable
                      disabled={!project || !taskOptions.length}
                      placeholder={!project ? 'Select project first' : taskOptions.length ? 'Select task' : 'No tasks'}
                      options={taskOptions}
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v ?? null);
                        // a task fills its group and type
                        const t = project?.tasks.find((x) => x.id === v);
                        if (t?.taskGroupId) {
                          setValue('taskGroupId', t.taskGroupId);
                          setValue('taskTypeId', t.taskTypeId ?? undefined);
                        }
                      }}
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
              <Field style={{ justifyContent: 'flex-end' }}>
                <Controller name="isBillable" control={control} render={({ field }) => <Checkbox label="Billable" checked={field.value} onChange={field.onChange} />} />
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
              <button type="submit" className="btn btn-primary" disabled={isSubmitting || noProjects}>
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
