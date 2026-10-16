import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Cloud, Eye } from 'lucide-react';
import { mastersApi, projectsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { Topbar } from '@/components/layout/Topbar';
import { ErrorAlert } from '@/components/ui/Display';
import { FullPageLoader, Spinner } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useApiFormError } from '@/hooks/useApiForm';
import { useStageOptions } from '@/hooks/useOptions';
import { num } from '@/lib/percent';
import NotFoundPage from '@/pages/errors/NotFoundPage';
import { ProjectHero, TabBar, tabFromHash } from './tabs/shared';
import { EstimateEditor, MembersEditor, memberRow, ProjectFields, ReviewForm } from './tabs/EditTabs';
import { AnalysisView, HistoryView } from './tabs/ViewTabs';

const optionalNumber = z
  .string()
  .trim()
  .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Enter a positive number');

const schema = z
  .object({
    customerId: z.number().nullable(),
    ownerId: z.number({ error: 'Select the project owner' }),
    title: z.string().trim().min(1, 'Enter the project title').max(200),
    projectDivisionId: z.number({ error: 'Select the project division' }),
    projectTypeId: z.number({ error: 'Select the project type' }),
    startDate: z.string().min(1, 'Select the start date'),
    endDate: z.string(),
    estimatedAmount: optionalNumber,
    estimatedAmountCurrency: z.string(),
    sharepointLink: z.union([z.literal(''), z.url('Enter a valid URL (https://…)')]),
    isRetainerProject: z.boolean(),
    detail: z.string().max(10000),
    estimatedHours: optionalNumber,
    members: z.array(z.any()),
    estimates: z.array(z.object({ taskGroupId: z.number(), taskGroupName: z.string(), effortPercentage: z.string() })),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date cannot be before the start date' });
    if (v.members.some((m) => !m.userId)) ctx.addIssue({ code: 'custom', path: ['members'], message: 'Select a person for every new member row, or remove the empty row.' });
    const total = Math.round(v.estimates.reduce((s, e) => s + num(e.effortPercentage), 0) * 100) / 100;
    if (total !== 0 && total !== 100) ctx.addIssue({ code: 'custom', path: ['estimates'], message: `The effort split must total 100% (now ${total}%)` });
  });

// which tab shows a field, so a failed save opens the tab with the problem
const FIELD_TAB = { members: 'users', estimates: 'estimate', estimatedHours: 'estimate' };

function toForm(p, groups) {
  const byGroup = new Map(p.estimates.map((e) => [e.taskGroupId, e]));
  // the project's split first (largest share first), then the other task groups at 0%
  const rest = groups.filter((g) => !byGroup.has(g.id)).map((g) => ({ taskGroupId: g.id, taskGroupName: g.name, effortPercentage: '' }));
  return {
    customerId: p.customerId,
    ownerId: p.ownerId,
    title: p.title,
    projectDivisionId: p.projectDivisionId,
    projectTypeId: p.projectTypeId,
    startDate: p.startDate ?? '',
    endDate: p.endDate ?? '',
    estimatedAmount: p.estimatedAmount != null ? String(p.estimatedAmount) : '',
    estimatedAmountCurrency: p.estimatedAmountCurrency ?? 'INR',
    sharepointLink: p.sharepointLink ?? '',
    isRetainerProject: p.isRetainerProject,
    detail: p.detail ?? '',
    estimatedHours: p.estimatedHours != null ? String(p.estimatedHours) : '',
    members: p.members.map((m) => memberRow({ ...m, userId: m.id })),
    estimates: [...p.estimates.map((e) => ({ taskGroupId: e.taskGroupId, taskGroupName: e.taskGroupName, effortPercentage: String(e.effortPercentage) })), ...rest],
  };
}

function toPayload(v) {
  const n = (s) => (s === '' ? null : Number(s));
  return {
    customerId: v.customerId ?? null,
    ownerId: v.ownerId,
    title: v.title.trim(),
    projectDivisionId: v.projectDivisionId,
    projectTypeId: v.projectTypeId,
    startDate: v.startDate,
    endDate: v.endDate || null,
    estimatedAmount: n(v.estimatedAmount),
    estimatedAmountCurrency: v.estimatedAmountCurrency || null,
    sharepointLink: v.sharepointLink || null,
    isRetainerProject: v.isRetainerProject,
    detail: v.detail || null,
    estimatedHours: n(v.estimatedHours),
    members: v.members.map((m) => ({ userId: m.userId, accessLevel: m.accessLevel, costPerHour: n(m.costPerHour) })),
    estimates: v.estimates.map((e) => ({ taskGroupId: e.taskGroupId, effortPercentage: num(e.effortPercentage) })),
  };
}

function UpdateTab({ p }) {
  const stages = useStageOptions();
  const reviews = useQuery({ queryKey: ['projects', p.id, 'reviews'], queryFn: () => projectsApi.reviews(p.id) });
  if (reviews.isLoading) return <Spinner />;
  const list = reviews.data ?? [];
  return <ReviewForm key={`${list.length}-${p.stageId}`} p={p} reviews={list} stages={stages.options} />;
}

export default function ProjectEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(() => tabFromHash('update'));

  const project = useQuery({ queryKey: ['projects', id], queryFn: () => projectsApi.get(id), retry: false });
  const groups = useQuery({ queryKey: ['masters', 'task-groups'], queryFn: () => mastersApi.list('task-groups'), staleTime: 5 * 60 * 1000 });
  const users = useQuery({ queryKey: ['masters', 'users'], queryFn: () => mastersApi.list('users'), staleTime: 5 * 60 * 1000 });
  const p = project.data;
  const initial = useMemo(() => (p && groups.data ? toForm(p, groups.data) : null), [p, groups.data]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });
  const { formError, handleApiError } = useApiFormError(setError);
  const startDate = useWatch({ control, name: 'startDate' });
  const estimatedHours = useWatch({ control, name: 'estimatedHours' });
  const currency = useWatch({ control, name: 'estimatedAmountCurrency' });

  useEffect(() => {
    if (initial) reset(initial);
  }, [initial, reset]);

  const selectTab = (key) => {
    setTab(key);
    window.history.replaceState(null, '', `#${key}`);
  };

  const save = useMutation({
    mutationFn: (body) => projectsApi.update(id, body),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['masters'] });
      toast.success('Project saved');
      navigate(`/projects/${saved.id}#${tab === 'update' ? 'project' : tab}`);
    },
    onError: (err) => {
      handleApiError(err);
      const field = err.response?.data?.details?.[0]?.field;
      if (FIELD_TAB[field]) {
        // members / estimate problems are shown in full on their own tab
        if (field !== 'estimatedHours') setError(field, { type: 'server', message: errorMessage(err) });
        selectTab(FIELD_TAB[field]);
      }
    },
  });

  if (project.isLoading || (p && !initial)) return <FullPageLoader />;
  if (project.isError) {
    return project.error?.response?.status === 404 ? <NotFoundPage what="Project" /> : <ErrorAlert>{errorMessage(project.error)}</ErrorAlert>;
  }

  const onSubmit = (values) => save.mutateAsync(toPayload(values)).catch(() => {});
  const onInvalid = (errs) => {
    const first = Object.keys(errs)[0];
    selectTab(FIELD_TAB[first] ?? 'project');
  };
  const formTab = tab === 'project' || tab === 'users' || tab === 'estimate';

  return (
    <>
      <Topbar title="Edit project" breadcrumb={['Projects', 'Project List']} back={`/projects/${id}`} />
      <form className="form-layout" onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
        <div className="form-main">
          <ProjectHero
            p={p}
            edit
            actions={
              <Link className="btn btn-light" to={`/projects/${id}#${tab}`}>
                <Eye />
                View project
              </Link>
            }
          />
          <TabBar tab={tab} onSelect={selectTab} />
          {formTab && <ErrorAlert>{formError}</ErrorAlert>}

          {tab === 'update' && <UpdateTab p={p} />}

          <div hidden={tab !== 'project'}>
            <section className="card card-lg form-card" style={{ marginTop: 16 }}>
              <div className="fc-head">
                <div>
                  <div className="form-section-title">Project details</div>
                </div>
              </div>
              <ProjectFields control={control} register={register} errors={errors} isEdit startDate={startDate} />
            </section>
          </div>

          <div hidden={tab !== 'users'}>
            <Controller
              name="members"
              control={control}
              render={({ field }) => (
                <MembersEditor value={field.value ?? []} onChange={field.onChange} users={users.data ?? []} currency={currency} error={errors.members?.message} />
              )}
            />
          </div>

          <div hidden={tab !== 'estimate'}>
            <Controller
              name="estimates"
              control={control}
              render={({ field }) => (
                <EstimateEditor
                  value={field.value ?? []}
                  onChange={field.onChange}
                  totalHours={estimatedHours}
                  hoursField={{ props: register('estimatedHours'), error: errors.estimatedHours?.message }}
                  error={errors.estimates?.message}
                />
              )}
            />
          </div>

          {tab === 'analysis' && <AnalysisView p={p} canEdit={false} />}
          {tab === 'history' && <HistoryView id={p.id} canEdit={false} />}

          {/* only the Project, Users and Estimate tabs have changes to save */}
          {formTab && (
            <div className="form-bar">
              <span className="note">
                <Cloud />
                Changes on each tab are saved together
              </span>
              <div className="actions">
                <Link className="btn btn-ghost" to={`/projects/${id}`}>
                  Back
                </Link>
                <button type="button" className="btn btn-secondary" onClick={() => reset(initial)} disabled={isSubmitting}>
                  Reset
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  <Check />
                  {isSubmitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </>
  );
}
