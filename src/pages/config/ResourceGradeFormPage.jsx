import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Cloud, Lock, Plus, X } from 'lucide-react';
import { configApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { Topbar } from '@/components/layout/Topbar';
import { Dropdown } from '@/components/ui/Dropdown';
import { ErrorAlert } from '@/components/ui/Display';
import { Field } from '@/components/ui/Field';
import { DatePicker } from '@/components/ui/DatePicker';
import { FullPageLoader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useConfirm } from '@/components/ui/confirm-context';
import { useApiFormError } from '@/hooks/useApiForm';
import { useCurrencyOptions, useLookupOptions } from '@/hooks/useOptions';
import { SCREENS } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import NotFoundPage from '@/pages/errors/NotFoundPage';
import { todayIso } from '@/lib/timezone';

const api = configApi('resource-grades');
const BASE = SCREENS.RESOURCE_GRADES;

const schema = z.object({
  gradeId: z.number({ error: 'Select a grade' }),
  costs: z.array(
    z
      .object({
        costPerHour: z.string().refine((v) => v !== '' && Number(v) >= 0, 'Enter the cost'),
        currency: z.string().min(1, 'Select'),
        fromDate: z.string().min(1, 'Select the start date'),
        toDate: z.string(),
      })
      .passthrough()
      .refine((c) => !c.toDate || c.toDate >= c.fromDate, { path: ['fromDate'], message: 'Must be after the previous period starts' }),
  ),
});

/* ------------------------------------------------------------------ cost periods
 * Per currency the periods form a chain without gaps: next "from" = previous "to" + 1 day.
 *   - older periods of a currency are locked (read-only)
 *   - the latest period is always still running, so there is always a current price
 *   - a new period starts today by default; the previous one ends the day before it starts
 */
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

let rowSeq = 0;
const newKey = () => `c${(rowSeq += 1)}`;

/** Rows of each currency in chain order: saved rows by start date, then new rows in the order added. */
function chains(rows) {
  const out = new Map();
  for (const r of rows) out.set(r.currency, [...(out.get(r.currency) ?? []), r]);
  for (const [cur, list] of out) {
    const saved = list.filter((r) => !r.isNew).sort((a, b) => a.fromDate.localeCompare(b.fromDate));
    out.set(cur, [...saved, ...list.filter((r) => r.isNew)]);
  }
  return out;
}

/**
 * Re-links every currency chain after an edit:
 *   - the latest period is always "still running" (there is always a current price)
 *   - a new period starts on its chosen date (at least the day after the previous one starts);
 *     the previous period then ends the day before
 *   - saved periods keep following each other without gaps
 */
function normalize(input) {
  const rows = input.map((r) => ({ ...r }));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const [, list] of chains(rows)) {
    for (let k = 1; k < list.length; k += 1) {
      const prev = byKey.get(list[k - 1].key);
      const cur = byKey.get(list[k].key);
      if (cur.isNew || !prev.toDate) {
        const earliest = addDays(prev.fromDate, 1);
        if (!cur.fromDate || cur.fromDate < earliest) cur.fromDate = earliest;
        prev.toDate = addDays(cur.fromDate, -1);
      } else {
        cur.fromDate = addDays(prev.toDate, 1);
      }
    }
    byKey.get(list[list.length - 1].key).toDate = ''; // the latest price never ends
  }
  return rows;
}

function CostEditor({ value, onChange, currencies, errors }) {
  const rows = value ?? [];
  const byChain = chains(rows);
  const update = (key, patch) => onChange(normalize(rows.map((r) => (r.key === key ? { ...r, ...patch } : r))));
  const confirm = useConfirm();
  const remove = async (key) => {
    const r = rows.find((x) => x.key === key);
    const what = r?.costPerHour ? `The ${r.currency} ${r.costPerHour} / hour cost` : 'This cost';
    if (!(await confirm({ title: 'Remove cost?', message: `${what} is removed when you save the grade.`, confirmLabel: 'Remove' }))) return;
    onChange(normalize(rows.filter((x) => x.key !== key)));
  };
  const add = () => {
    const last = rows[rows.length - 1];
    const currency = last?.currency ?? currencies[0]?.value ?? 'INR';
    onChange(normalize([...rows, { key: newKey(), isNew: true, costPerHour: '', currency, fromDate: todayIso(), toDate: '' }]));
  };
  // display: currency by currency, oldest first
  const ordered = [...byChain.values()].flat();
  const errOf = (key, field) => errors?.[rows.findIndex((r) => r.key === key)]?.[field]?.message;
  const Err = ({ msg }) => (msg ? <span className="help" style={{ color: 'var(--danger)', display: 'block', marginTop: 4 }}>{msg}</span> : null);

  return (
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
          {ordered.map((r) => {
            const chain = byChain.get(r.currency);
            const k = chain.findIndex((x) => x.key === r.key);
            const latest = k === chain.length - 1;
            const locked = !latest; // an older period of this currency
            return (
              <tr key={r.key} className={locked ? 'rg-locked' : undefined}>
                <td style={{ width: 170 }}>
                  {locked ? (
                    <span className="num">
                      <b>{r.costPerHour}</b>
                    </span>
                  ) : (
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={r.costPerHour}
                      onChange={(e) => update(r.key, { costPerHour: e.target.value })}
                    />
                  )}
                  <Err msg={errOf(r.key, 'costPerHour')} />
                </td>
                <td style={{ width: 130 }}>
                  {r.isNew && latest ? (
                    <Dropdown placeholder="Select" options={currencies} value={r.currency} onChange={(v) => update(r.key, { currency: v })} />
                  ) : (
                    <b>{r.currency}</b>
                  )}
                </td>
                <td>
                  {latest && (k === 0 || r.isNew) ? (
                    <DatePicker
                      value={r.fromDate}
                      onChange={(v) => update(r.key, { fromDate: v })}
                      min={k > 0 ? addDays(chain[k - 1].fromDate, 1) : undefined}
                      clearable={false}
                      placeholder="From date"
                    />
                  ) : (
                    <span className="rg-date" title={k > 0 ? 'Starts the day after the previous period ends' : undefined}>
                      {formatDate(r.fromDate)}
                      {k > 0 && latest && <Lock />}
                    </span>
                  )}
                  <Err msg={errOf(r.key, 'fromDate')} />
                </td>
                <td>
                  {locked ? (
                    <span className="rg-date">{formatDate(r.toDate)}</span>
                  ) : (
                    <span className="rg-date rg-running" title="The latest price stays in force until a newer period is added">
                      Still running
                    </span>
                  )}
                </td>
                <td className="col-actions">
                  {locked ? (
                    <span className="rg-lock" title="An older period – locked once a newer period exists">
                      <Lock />
                    </span>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" title="Remove" onClick={() => remove(r.key)}>
                      <X />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td colSpan={5} className="muted small" style={{ padding: 16 }}>
                No cost yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="editor-foot">
        <button type="button" className="btn btn-soft btn-sm" onClick={add}>
          <Plus />
          Add cost
        </button>
        <span className="muted small">The latest price of each currency is always running. Adding a new period ends the previous one the day before it starts.</span>
      </div>
    </div>
  );
}

/** Resource grade = grade (Parameters → GRADE) with its cost-per-hour history. */
export default function ResourceGradeFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const grades = useLookupOptions('GRADE').options;
  const currencies = useCurrencyOptions();

  const record = useQuery({ queryKey: ['config', 'resource-grades', id], queryFn: () => api.get(id), enabled: isEdit, retry: false });
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { gradeId: undefined, costs: [] } });
  const { formError, handleApiError } = useApiFormError(setError);

  useEffect(() => {
    const r = record.data;
    if (!r) return;
    reset({
      gradeId: r.gradeId,
      costs: normalize(
        r.costs.map((c) => ({
          key: newKey(),
          costPerHour: String(c.costPerHour),
          currency: c.currency,
          fromDate: c.fromDate,
          toDate: c.toDate ?? '',
        })),
      ),
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
                <div className="form-section-title">Grade</div>
                <div className="form-section-sub">Grade names are managed in Parameters (type GRADE).</div>
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
            <Controller
              name="costs"
              control={control}
              render={({ field }) => <CostEditor value={field.value} onChange={field.onChange} currencies={currencies} errors={errors.costs} />}
            />
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
