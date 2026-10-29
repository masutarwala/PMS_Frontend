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
import { FullPageLoader } from '@/components/ui/Loader';
import { useConfirm } from '@/components/ui/confirm-context';
import { useToast } from '@/components/ui/toast-context';
import { useApiFormError } from '@/hooks/useApiForm';
import { num } from '@/lib/percent';
import NotFoundPage from '@/pages/errors/NotFoundPage';
import { ProjectHero, TabBar, tabFromHash, usableTab } from './tabs/shared';
import { CommercialTab } from './tabs/CommercialTab';
import { EstimateEditor, MembersEditor, memberRow, ProjectFields, UpdateTab } from './tabs/EditTabs';
import { AnalysisView, EstimateView, HistoryView, ProjectView, quotedHours, UsersView } from './tabs/ViewTabs';
import { PlanTab } from './tabs/PlanTab';
import { useAuth, useProjectAccess } from '@/auth/auth-context';
import { PROJECT_FIELDS } from '@/lib/projectAccess';

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
    isBillable: z.boolean(),
    detail: z.string().max(10000),
    estimatedHours: optionalNumber,
    members: z.array(z.any()),
    estimates: z.array(z.object({ taskGroupId: z.number(), taskGroupName: z.string(), effortPercentage: z.string(), locked: z.boolean().optional(), lockReason: z.string().nullable().optional() })),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date cannot be before the start date' });
    if (v.members.some((m) => !m.userId)) ctx.addIssue({ code: 'custom', path: ['members'], message: 'Select a person for every new member row, or remove the empty row.' });
    const total = Math.round(v.estimates.reduce((s, e) => s + num(e.effortPercentage), 0) * 100) / 100;
    if (total !== 0 && total !== 100) ctx.addIssue({ code: 'custom', path: ['estimates'], message: `The effort split must total 100% (now ${total}%)` });
    // a task group where work has started keeps its share
    const stuck = v.estimates.filter((e) => e.locked && num(e.effortPercentage) <= 0);
    if (stuck.length) ctx.addIssue({ code: 'custom', path: ['estimates'], message: `Work has started in ${stuck.map((e) => e.taskGroupName).join(', ')} – ${stuck.length === 1 ? 'its' : 'their'} effort cannot be 0%` });
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
    isRetainerProject: !!p.isRetainerProject,
    isBillable: p.isBillable ?? true,
    detail: p.detail ?? '',
    estimatedHours: p.estimatedHours != null ? String(p.estimatedHours) : '',
    members: p.members.map((m) => memberRow({ ...m, userId: m.id })),
    estimates: [...p.estimates.map((e) => ({ taskGroupId: e.taskGroupId, taskGroupName: e.taskGroupName, effortPercentage: String(e.effortPercentage), locked: e.locked, lockReason: e.lockReason })), ...rest],
  };
}

/** Only the parts the role may change (Roles & Permissions → Project access); the API refuses the rest. */
function toPayload(v, access) {
  const n = (s) => (s === '' ? null : Number(s));
  const all = {
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
    isBillable: v.isBillable,
    detail: v.detail || null,
    estimatedHours: n(v.estimatedHours),
    // access only – the cost per hour is set on the Commercial tab
    members: v.members.map((m) => ({ userId: m.userId })),
    estimates: v.estimates.map((e) => ({ taskGroupId: e.taskGroupId, effortPercentage: num(e.effortPercentage) })),
  };
  const body = {};
  if (access.tab('project') === 'edit') {
    for (const f of PROJECT_FIELDS) if (access.field(f.key) === 'edit') body[f.key] = all[f.key];
  }
  if (access.tab('users') === 'edit') body.members = all.members;
  if (access.tab('estimate') === 'edit') {
    body.estimates = all.estimates;
    body.estimatedHours = all.estimatedHours;
  }
  return body;
}

export default function ProjectEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [tabAsked, setTab] = useState(() => tabFromHash('update'));
  const access = useProjectAccess();
  const { user } = useAuth(); // the Plan tab is the owner's

  const project = useQuery({ queryKey: ['projects', id], queryFn: () => projectsApi.get(id), retry: false });
  const groups = useQuery({ queryKey: ['masters', 'project-task-groups'], queryFn: () => mastersApi.list('project-task-groups'), staleTime: 5 * 60 * 1000 });
  const users = useQuery({ queryKey: ['masters', 'users'], queryFn: () => mastersApi.list('users'), staleTime: 5 * 60 * 1000 });
  const p = project.data;
  const initial = useMemo(() => (p && groups.data ? toForm(p, groups.data) : null), [p, groups.data]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });
  const { formError, handleApiError } = useApiFormError(setError);
  const startDate = useWatch({ control, name: 'startDate' });
  const estimatedHours = useWatch({ control, name: 'estimatedHours' });
  const currency = useWatch({ control, name: 'estimatedAmountCurrency' });
  const estimatedAmount = useWatch({ control, name: 'estimatedAmount' });
  const divisionId = useWatch({ control, name: 'projectDivisionId' });
  // the division's quote rate in the project's currency: estimated hours = amount ÷ rate
  const quoteRates = useQuery({ queryKey: ['masters', 'quote-rates'], queryFn: () => mastersApi.list('quote-rates') });
  const quoteRate = quoteRates.data?.find((q) => q.divisionId === divisionId && q.currency === currency)?.ratePerHour ?? null;
  const quoted = quotedHours(estimatedAmount, quoteRate);
  useEffect(() => {
    // the quote is only the default: it fills the hours while they are empty
    if (quoted != null && !getValues('estimatedHours')) setValue('estimatedHours', String(quoted));
  }, [quoted, getValues, setValue]);

  useEffect(() => {
    if (initial) reset(initial);
  }, [initial, reset]);

  const selectTab = (key) => {
    setTab(key);
    window.history.replaceState(null, '', `#${key}`);
  };

  const save = useMutation({
    mutationFn: async (body) => {
      try {
        return await projectsApi.update(id, body);
      } catch (err) {
        // the removed group's tasks made from the plan are all completed: confirm, then remove anyway
        if (err.response?.data?.code === 'CONFIRM_REQUIRED') {
          const ok = await confirm({ title: 'Remove the task group?', message: err.response.data.message, confirmLabel: 'Remove anyway' });
          if (!ok) throw Object.assign(new Error('cancelled'), { cancelled: true });
          return projectsApi.update(id, { ...body, confirmRemove: true });
        }
        throw err;
      }
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      // project people / status feed the task and timesheet forms (who can be assigned, what can be logged)
      queryClient.invalidateQueries({ queryKey: ['tasks', 'options'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['masters'] });
      toast.success('Project saved');
      navigate(`/projects/${saved.id}#${tab === 'update' ? 'project' : tab}`);
    },
    onError: (err) => {
      if (err.cancelled) return;
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

  const tab = usableTab(tabAsked, p, access.tab, user.id);
  const canEditTab = (t) => access.tab(t) === 'edit';
  const onSubmit = (values) => {
    const body = toPayload(values, access);
    if (!Object.keys(body).length) return undefined; // nothing this role may change
    return save.mutateAsync(body).catch(() => {});
  };
  const onInvalid = (errs) => {
    const first = Object.keys(errs)[0];
    selectTab(FIELD_TAB[first] ?? 'project');
  };
  // the Project, Users and Estimate tabs are forms – when the role may edit them
  const formTab = ['project', 'users', 'estimate'].includes(tab) && canEditTab(tab);

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
          <TabBar tab={tab} onSelect={selectTab} p={p} />
          {formTab && <ErrorAlert>{formError}</ErrorAlert>}

          {tab === 'update' && <UpdateTab p={p} canEdit={canEditTab('update')} onShowLogs={() => selectTab('history')} />}
          {tab === 'project' && !canEditTab('project') && <ProjectView p={p} />}
          {tab === 'users' && !canEditTab('users') && <UsersView p={p} />}
          {tab === 'estimate' && !canEditTab('estimate') && <EstimateView p={p} />}

          <div hidden={tab !== 'project' || !canEditTab('project')}>
            <section className="card card-lg form-card" style={{ marginTop: 16 }}>
              <div className="fc-head">
                <div>
                  <div className="form-section-title">Project details</div>
                </div>
              </div>
              <ProjectFields control={control} register={register} errors={errors} isEdit startDate={startDate} getValues={getValues} setValue={setValue} access={access.field} />
            </section>
          </div>

          <div hidden={tab !== 'users' || !canEditTab('users')}>
            <Controller
              name="members"
              control={control}
              render={({ field }) => (
                <MembersEditor projectId={p.id} value={field.value ?? []} onChange={field.onChange} users={users.data ?? []} error={errors.members?.message} />
              )}
            />
          </div>

          <div hidden={tab !== 'estimate' || !canEditTab('estimate')}>
            <Controller
              name="estimates"
              control={control}
              render={({ field }) => (
                <EstimateEditor
                  value={field.value ?? []}
                  onChange={field.onChange}
                  totalHours={estimatedHours}
                  quote={{ amount: estimatedAmount, currency, rate: quoteRate }}
                  onUseQuote={(h) => setValue('estimatedHours', String(h), { shouldDirty: true })}
                  hoursField={{ props: register('estimatedHours'), error: errors.estimatedHours?.message }}
                  error={errors.estimates?.message}
                />
              )}
            />
          </div>

          {tab === 'plan' && <PlanTab p={p} />}
          {tab === 'commercial' && p.canSeeCommercial && <CommercialTab key={p.updatedAt} p={p} canEdit={canEditTab('commercial')} />}
          {tab === 'analysis' && <AnalysisView p={p} />}
          {tab === 'history' && <HistoryView id={p.id} />}

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
