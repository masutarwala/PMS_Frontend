import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Cloud } from 'lucide-react';
import { projectsApi } from '@/api/endpoints';
import { Topbar } from '@/components/layout/Topbar';
import { ErrorAlert } from '@/components/ui/Display';
import { useToast } from '@/components/ui/toast-context';
import { useApiFormError } from '@/hooks/useApiForm';
import { ProjectFields } from './tabs/EditTabs';

/*
 * New project (Screens/projects/project-list/add.html): the basic details only. The project starts
 * in the first stage (Draft); users, estimate and reviews are added from Edit after it is saved.
 */

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
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ['endDate'], message: 'End date cannot be before the start date' });

const EMPTY = {
  customerId: null,
  ownerId: undefined,
  title: '',
  projectDivisionId: undefined,
  projectTypeId: undefined,
  startDate: '',
  endDate: '',
  estimatedAmount: '',
  estimatedAmountCurrency: 'INR',
  sharepointLink: '',
  isRetainerProject: false,
  detail: '',
};

const fromProject = (p) => ({
  customerId: p.customerId,
  ownerId: p.ownerId,
  title: `Copy of ${p.title}`.slice(0, 200),
  projectDivisionId: p.projectDivisionId,
  projectTypeId: p.projectTypeId,
  startDate: p.startDate ?? '',
  endDate: p.endDate ?? '',
  estimatedAmount: p.estimatedAmount != null ? String(p.estimatedAmount) : '',
  estimatedAmountCurrency: p.estimatedAmountCurrency ?? 'INR',
  sharepointLink: p.sharepointLink ?? '',
  isRetainerProject: p.isRetainerProject,
  detail: p.detail ?? '',
});

function toPayload(v) {
  return {
    customerId: v.customerId ?? null,
    ownerId: v.ownerId,
    title: v.title.trim(),
    projectDivisionId: v.projectDivisionId,
    projectTypeId: v.projectTypeId,
    startDate: v.startDate,
    endDate: v.endDate || null,
    estimatedAmount: v.estimatedAmount === '' ? null : Number(v.estimatedAmount),
    estimatedAmountCurrency: v.estimatedAmountCurrency || null,
    sharepointLink: v.sharepointLink || null,
    isRetainerProject: v.isRetainerProject,
    detail: v.detail || null,
  };
}

export default function ProjectFormPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  // "Duplicate" from the list / details pre-fills the new project with a copy of another one.
  const duplicateOf = useLocation().state?.duplicateOf;

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: duplicateOf ? fromProject(duplicateOf) : EMPTY });
  const { formError, handleApiError } = useApiFormError(setError);
  const startDate = useWatch({ control, name: 'startDate' }); // end date can't be before it

  const save = useMutation({
    mutationFn: (body) => projectsApi.create(body),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`Project ${saved.code} created${saved.taskCount ? ` with ${saved.taskCount} tasks` : ''}`);
      navigate(`/projects/${saved.id}`);
    },
    onError: (err) => handleApiError(err),
  });

  const onSubmit = (values) => save.mutateAsync(toPayload(values)).catch(() => {});

  return (
    <>
      <Topbar title={duplicateOf ? `New project · copy of ${duplicateOf.code}` : 'New project'} breadcrumb={['Projects', 'Project List']} back="/projects" />
      <form className="form-layout" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-main">
          <ErrorAlert>{formError}</ErrorAlert>
          <section className="card card-lg form-card" style={{ marginTop: 16 }}>
            <div className="fc-head">
              <div>
                <div className="form-section-title">Project details</div>
                <div className="form-section-sub">Create the project with its basic details. Users, estimate and reviews are added from Edit after it is saved.</div>
              </div>
            </div>
            <ProjectFields control={control} register={register} errors={errors} startDate={startDate} />
          </section>
          <div className="form-bar">
            <span className="note">
              <Cloud />
              Fields marked * are required
            </span>
            <div className="actions">
              <Link className="btn btn-ghost" to="/projects">
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                <Check />
                {isSubmitting ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
