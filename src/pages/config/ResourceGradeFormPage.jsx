import { useEffect } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Cloud, Plus, X } from 'lucide-react';
import { configApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { Topbar } from '@/components/layout/Topbar';
import { Dropdown } from '@/components/ui/Dropdown';
import { ErrorAlert } from '@/components/ui/Display';
import { Field } from '@/components/ui/Field';
import { DatePicker } from '@/components/ui/DatePicker';
import { FullPageLoader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useApiFormError } from '@/hooks/useApiForm';
import { useCurrencyOptions, useLookupOptions, useMasterOptions } from '@/hooks/useOptions';
import { SCREENS } from '@/lib/constants';
import NotFoundPage from '@/pages/errors/NotFoundPage';

const api = configApi('resource-grades');
const BASE = SCREENS.RESOURCE_GRADES;

const schema = z.object({
  gradeId: z.number({ error: 'Select a grade' }),
  teamId: z.number().nullable(),
  costs: z.array(
    z
      .object({
        costPerHour: z.string().refine((v) => v !== '' && Number(v) >= 0, 'Enter the cost'),
        currency: z.string().min(1, 'Select'),
        fromDate: z.string().min(1, 'Select the start date'),
        toDate: z.string(),
      })
      .refine((c) => !c.toDate || c.toDate >= c.fromDate, { path: ['toDate'], message: 'Before the start date' }),
  ),
});

const today = () => new Date().toISOString().slice(0, 10);
const Err = ({ e }) => (e ? <span className="help" style={{ color: 'var(--danger)', display: 'block', marginTop: 4 }}>{e.message}</span> : null);

/** Resource grade = grade (Parameters → GRADE) for a team, with its cost-per-hour history. */
export default function ResourceGradeFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const grades = useLookupOptions('GRADE').options;
  const teams = useMasterOptions('teams').options;
  const currencies = useCurrencyOptions();

  const record = useQuery({ queryKey: ['config', 'resource-grades', id], queryFn: () => api.get(id), enabled: isEdit, retry: false });
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { gradeId: undefined, teamId: null, costs: [] } });
  const costs = useFieldArray({ control, name: 'costs' });
  const costValues = useWatch({ control, name: 'costs' }); // "To" can't be before "From"
  const { formError, handleApiError } = useApiFormError(setError);

  useEffect(() => {
    const r = record.data;
    if (!r) return;
    reset({
      gradeId: r.gradeId,
      teamId: r.teamId,
      costs: r.costs.map((c) => ({ costPerHour: String(c.costPerHour), currency: c.currency, fromDate: c.fromDate, toDate: c.toDate ?? '' })),
    });
  }, [record.data, reset]);

  const save = useMutation({
    mutationFn: (body) => (isEdit ? api.update(id, body) : api.create(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'resource-grades'] });
      queryClient.invalidateQueries({ queryKey: ['masters', 'resource-grades'] });
      toast.success(isEdit ? 'Resource grade saved' : 'Resource grade created');
      navigate(BASE);
    },
    onError: (err) => handleApiError(err),
  });

  if (isEdit && record.isLoading) return <FullPageLoader />;
  if (isEdit && record.isError) {
    return record.error?.response?.status === 404 ? <NotFoundPage what="Resource grade" /> : <ErrorAlert>{errorMessage(record.error)}</ErrorAlert>;
  }

  const onSubmit = (v) =>
    save
      .mutateAsync({
        gradeId: v.gradeId,
        teamId: v.teamId ?? null,
        costs: v.costs.map((c) => ({ costPerHour: Number(c.costPerHour), currency: c.currency, fromDate: c.fromDate, toDate: c.toDate || null })),
      })
      .catch(() => {});

  return (
    <>
      <Topbar
        title={isEdit ? `Edit resource grade · ${record.data.gradeName}` : 'New resource grade'}
        breadcrumb={['Administration', 'Resource Grade & Cost']}
        back={BASE}
      />
      <form className="form-layout" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-main">
          <ErrorAlert>{formError}</ErrorAlert>

          <section className="card card-lg form-card">
            <div className="fc-head">
              <span className="fc-num">1</span>
              <div>
                <div className="form-section-title">Assignment</div>
                <div className="form-section-sub">The grade and, optionally, the team it applies to. Grade names are managed in Parameters (type GRADE).</div>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Grade" required error={errors.gradeId?.message}>
                <Controller
                  name="gradeId"
                  control={control}
                  render={({ field }) => <Dropdown search placeholder="Select grade" options={grades} value={field.value} onChange={field.onChange} />}
                />
              </Field>
              <Field label="Team" help={teams.length ? 'leave empty for all teams' : 'no teams set up yet – applies to all teams'}>
                <Controller
                  name="teamId"
                  control={control}
                  render={({ field }) => (
                    <Dropdown search clearable disabled={!teams.length} placeholder="All teams" options={teams} value={field.value} onChange={field.onChange} />
                  )}
                />
              </Field>
            </div>
          </section>

          <section className="card card-lg form-card">
            <div className="fc-head">
              <span className="fc-num">2</span>
              <div>
                <div className="form-section-title">Cost per hour</div>
                <div className="form-section-sub">
                  Cost history used for project cost reports. The period that covers today is the current cost; it pre-fills the hourly rate of users on this grade.
                </div>
              </div>
            </div>
            <div className="editor">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cost per hour</th>
                    <th>Currency</th>
                    <th>From date</th>
                    <th>To date</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {costs.fields.map((f, i) => {
                    const e = errors.costs?.[i];
                    return (
                      <tr key={f.id}>
                        <td style={{ width: 170 }}>
                          <input className="input" type="number" min="0" step="0.01" placeholder="0.00" {...register(`costs.${i}.costPerHour`)} />
                          <Err e={e?.costPerHour} />
                        </td>
                        <td style={{ width: 130 }}>
                          <Controller
                            name={`costs.${i}.currency`}
                            control={control}
                            render={({ field }) => <Dropdown placeholder="Select" options={currencies} value={field.value} onChange={field.onChange} />}
                          />
                          <Err e={e?.currency} />
                        </td>
                        <td>
                          <Controller
                            name={`costs.${i}.fromDate`}
                            control={control}
                            render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} clearable={false} placeholder="From date" />}
                          />
                          <Err e={e?.fromDate} />
                        </td>
                        <td>
                          <Controller
                            name={`costs.${i}.toDate`}
                            control={control}
                            render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} min={costValues?.[i]?.fromDate || undefined} placeholder="Still running" />}
                          />
                          <Err e={e?.toDate} />
                        </td>
                        <td className="col-actions">
                          <button type="button" className="btn btn-ghost btn-icon btn-sm" title="Remove" onClick={() => costs.remove(i)}>
                            <X />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!costs.fields.length && (
                    <tr>
                      <td colSpan={5} className="muted small" style={{ padding: 16 }}>
                        No cost yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="editor-foot">
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={() => costs.append({ costPerHour: '', currency: currencies[0]?.value ?? 'INR', fromDate: today(), toDate: '' })}
                >
                  <Plus />
                  Add cost
                </button>
                <span className="muted small">Leave “To date” empty for the period that is still running.</span>
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
                {isSubmitting ? 'Saving…' : isEdit ? 'Save resource grade' : 'Create resource grade'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
