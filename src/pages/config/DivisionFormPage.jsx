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
import { ErrorAlert } from '@/components/ui/Display';
import { Dropdown } from '@/components/ui/Dropdown';
import { Field, Switch } from '@/components/ui/Field';
import { FullPageLoader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useConfirm } from '@/components/ui/confirm-context';
import { useApiFormError } from '@/hooks/useApiForm';
import { useCurrencyOptions } from '@/hooks/useOptions';
import { SCREENS } from '@/lib/constants';
import NotFoundPage from '@/pages/errors/NotFoundPage';

const api = configApi('project-divisions');
const BASE = SCREENS.PROJECT_DIVISIONS;

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter the division name').max(100),
    description: z.string().max(2000),
    isActive: z.boolean(),
    quoteRates: z.array(
      z.object({
        currency: z.string().min(1, 'Select'),
        ratePerHour: z.string().refine((v) => v !== '' && Number(v) > 0, 'Enter the rate'),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    const currencies = new Set();
    v.quoteRates.forEach((q, i) => {
      if (q.currency && currencies.has(q.currency)) ctx.addIssue({ code: 'custom', path: ['quoteRates', i, 'currency'], message: 'Listed twice' });
      currencies.add(q.currency);
    });
  });

/** Project Divisions tab: the division and its quote rates (project types have their own tab). */
export default function DivisionFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const record = useQuery({ queryKey: ['config', 'project-divisions', id], queryFn: () => api.get(id), enabled: isEdit, retry: false });
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { name: '', description: '', isActive: true, quoteRates: [] } });
  const rates = useFieldArray({ control, name: 'quoteRates' });
  const quoteRates = useWatch({ control, name: 'quoteRates' });
  const currencies = useCurrencyOptions();
  const { formError, handleApiError } = useApiFormError(setError);

  useEffect(() => {
    const r = record.data;
    if (!r) return;
    reset({
      name: r.name,
      description: r.description ?? '',
      isActive: r.isActive,
      quoteRates: (r.quoteRates ?? []).map((q) => ({ currency: q.currency, ratePerHour: String(q.ratePerHour) })),
    });
  }, [record.data, reset]);

  const save = useMutation({
    mutationFn: (body) => (isEdit ? api.update(id, body) : api.create(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'project-divisions'] });
      queryClient.invalidateQueries({ queryKey: ['config', 'project-types'] });
      queryClient.invalidateQueries({ queryKey: ['config', 'task-templates'] });
      queryClient.invalidateQueries({ queryKey: ['masters'] });
      toast.success(isEdit ? 'Division saved' : 'Division created');
      navigate(BASE);
    },
    onError: (err) => handleApiError(err),
  });

  if (isEdit && record.isLoading) return <FullPageLoader />;
  if (isEdit && record.isError) {
    return record.error?.response?.status === 404 ? <NotFoundPage what="Division" /> : <ErrorAlert>{errorMessage(record.error)}</ErrorAlert>;
  }

  const onSubmit = (v) =>
    save
      .mutateAsync({
        name: v.name.trim(),
        description: v.description.trim() || null,
        isActive: v.isActive,
        quoteRates: v.quoteRates.map((q) => ({ currency: q.currency, ratePerHour: Number(q.ratePerHour) })),
      })
      .catch(() => {});

  const rateErr = (i, k) => errors.quoteRates?.[i]?.[k]?.message;
  const errText = (msg) => (msg ? <span className="help" style={{ color: 'var(--danger)', display: 'block', marginTop: 4 }}>{msg}</span> : null);
  // one quote rate per currency: a row offers only the currencies no other row uses
  const usedCurrencies = (quoteRates ?? []).map((q) => q.currency).filter(Boolean);
  const freeCurrencies = currencies.filter((c) => !usedCurrencies.includes(c.value));
  const currencyOptions = (own) => currencies.filter((c) => c.value === own || !usedCurrencies.includes(c.value));
  const addRate = () => rates.append({ currency: freeCurrencies[0]?.value ?? '', ratePerHour: '' });

  return (
    <>
      <Topbar title={isEdit ? `Edit division · ${record.data.name}` : 'New division'} breadcrumb={['Administration', 'Business Division']} back={BASE} />
      <form className="form-layout" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-main">
          <ErrorAlert>{formError}</ErrorAlert>

          <section className="card card-lg form-card">
            <div className="fc-head">
              <span className="fc-num">1</span>
              <div>
                <div className="form-section-title">Division</div>
                <div className="form-section-sub">e.g. Web, Software, Solution.</div>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Name" required error={errors.name?.message}>
                <input className="input" maxLength={100} placeholder="e.g. Web" {...register('name')} />
              </Field>
              <Field label="Description" span={2} error={errors.description?.message}>
                <input className="input" maxLength={2000} placeholder="What this division covers" {...register('description')} />
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
                <div className="form-section-title">Quote rate per hour</div>
                <div className="form-section-sub">
                  The rate this division quotes per hour, one per currency. A project&apos;s estimated hours = its total amount ÷ the rate in the project&apos;s currency.
                </div>
              </div>
            </div>
            <div className="editor">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th style={{ width: 200 }}>Currency</th>
                    <th>Quote rate per hour</th>
                    <th className="col-actions" />
                  </tr>
                </thead>
                <tbody>
                  {rates.fields.map((f, i) => (
                    <tr key={f.id}>
                      <td className="muted">{i + 1}</td>
                      <td>
                        <Controller
                          name={`quoteRates.${i}.currency`}
                          control={control}
                          render={({ field }) => <Dropdown placeholder="Select" options={currencyOptions(field.value)} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
                        />
                        {errText(rateErr(i, 'currency'))}
                      </td>
                      <td>
                        <div className="input-group" style={{ maxWidth: 240 }}>
                          <input className="input has-trail" type="number" min="0" step="0.01" placeholder="0.00" {...register(`quoteRates.${i}.ratePerHour`)} />
                          <span className="trail">/ hr</span>
                        </div>
                        {errText(rateErr(i, 'ratePerHour'))}
                      </td>
                      <td className="col-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          title="Remove rate"
                          onClick={async () => {
                            const cur = quoteRates?.[i]?.currency;
                            if (await confirm({ title: 'Remove quote rate?', message: `The ${cur || 'selected'} quote rate is removed when you save the division.`, confirmLabel: 'Remove' })) rates.remove(i);
                          }}
                        >
                          <X />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!rates.fields.length && (
                    <tr>
                      <td colSpan={4} className="muted small" style={{ padding: 16 }}>
                        No quote rates yet – project hours are entered by hand until a rate is set for the project&apos;s currency.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="editor-foot">
                <button type="button" className="btn btn-soft btn-sm" onClick={addRate} disabled={!freeCurrencies.length} title={freeCurrencies.length ? undefined : 'Every currency has a rate'}>
                  <Plus />
                  Add quote rate
                </button>
                <span className="muted small">
                  {rates.fields.length} currenc{rates.fields.length === 1 ? 'y' : 'ies'}
                </span>
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
                {isSubmitting ? 'Saving…' : isEdit ? 'Save division' : 'Create division'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
