import { useEffect } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Cloud, Lock, Plus, Trash2 } from 'lucide-react';
import { configApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { Topbar } from '@/components/layout/Topbar';
import { ErrorAlert } from '@/components/ui/Display';
import { Field, Switch } from '@/components/ui/Field';
import { FullPageLoader } from '@/components/ui/Loader';
import { TimePicker } from '@/components/ui/TimePicker';
import { useToast } from '@/components/ui/toast-context';
import { useConfirm } from '@/components/ui/confirm-context';
import { useApiFormError } from '@/hooks/useApiForm';
import { SCREENS } from '@/lib/constants';
import NotFoundPage from '@/pages/errors/NotFoundPage';

const api = configApi('sites');
const BASE = SCREENS.SITES;

const optMinutes = z
  .string()
  .trim()
  .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 1440), '0 – 1440');

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter the site name').max(100),
    isActive: z.boolean(),
    shifts: z
      .array(
        z
          .object({
            dbId: z.number().nullable(), // the shift's id ("id" is taken by useFieldArray's row key)
            name: z.string().trim().min(1, 'Enter the shift title').max(100),
            startTime: z.string().min(1, 'Select the start time'),
            endTime: z.string().min(1, 'Select the end time'),
            lateAfterMinutes: optMinutes,
            halfDayMinutes: optMinutes,
            isActive: z.boolean(),
            inUse: z.boolean(),
            userCount: z.number(),
          })
          .passthrough(),
      )
      .min(1, 'Add at least one shift'),
  })
  .superRefine((v, ctx) => {
    const seen = new Set();
    v.shifts.forEach((s, i) => {
      const key = s.name.trim().toLowerCase();
      if (key && seen.has(key)) ctx.addIssue({ code: 'custom', path: ['shifts', i, 'name'], message: 'Listed twice' });
      seen.add(key);
      if (s.startTime && s.startTime === s.endTime) ctx.addIssue({ code: 'custom', path: ['shifts', i, 'endTime'], message: 'Same as start' });
    });
  });

const NEW_SHIFT = { dbId: null, name: '', startTime: '', endTime: '', lateAfterMinutes: '15', halfDayMinutes: '240', isActive: true, inUse: false, userCount: 0 };
const num = (v) => (v === '' ? null : Number(v));

/** Site Master: the site and its shifts (Morning Shift 09:00–18:00 …) on one form. */
export default function SiteFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const record = useQuery({ queryKey: ['config', 'sites', id], queryFn: () => api.get(id), enabled: isEdit, retry: false });
  const {
    control,
    register,
    handleSubmit,
    reset,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { name: '', isActive: true, shifts: [{ ...NEW_SHIFT, name: 'General Shift', startTime: '09:00', endTime: '18:00' }] } });
  const shifts = useFieldArray({ control, name: 'shifts' });
  const { formError, handleApiError } = useApiFormError(setError);

  useEffect(() => {
    const r = record.data;
    if (!r) return;
    reset({
      name: r.name,
      isActive: r.isActive,
      shifts: r.shifts.map((s) => ({
        dbId: s.id,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        lateAfterMinutes: s.lateAfterMinutes == null ? '' : String(s.lateAfterMinutes),
        halfDayMinutes: s.halfDayMinutes == null ? '' : String(s.halfDayMinutes),
        isActive: s.isActive,
        inUse: s.inUse,
        userCount: s.userCount,
      })),
    });
  }, [record.data, reset]);

  const save = useMutation({
    mutationFn: (body) => (isEdit ? api.update(id, body) : api.create(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'sites'] });
      queryClient.invalidateQueries({ queryKey: ['masters'] });
      toast.success(isEdit ? 'Site saved' : 'Site created');
      navigate(BASE);
    },
    onError: (err) => handleApiError(err),
  });

  if (isEdit && record.isLoading) return <FullPageLoader />;
  if (isEdit && record.isError) {
    return record.error?.response?.status === 404 ? <NotFoundPage what="Site" /> : <ErrorAlert>{errorMessage(record.error)}</ErrorAlert>;
  }

  const onSubmit = (v) =>
    save
      .mutateAsync({
        name: v.name.trim(),
        isActive: v.isActive,
        shifts: v.shifts.map((s) => ({
          id: s.dbId ?? null,
          name: s.name.trim(),
          startTime: s.startTime,
          endTime: s.endTime,
          lateAfterMinutes: num(s.lateAfterMinutes),
          halfDayMinutes: num(s.halfDayMinutes),
          isActive: s.isActive,
        })),
      })
      .catch(() => {});

  const err = (i, k) => errors.shifts?.[i]?.[k]?.message;
  const errNode = (i, k) => (err(i, k) ? <span className="help" style={{ color: 'var(--danger)', display: 'block', marginTop: 4 }}>{err(i, k)}</span> : null);

  return (
    <>
      <Topbar title={isEdit ? `Edit site · ${record.data.name}` : 'New site'} breadcrumb={['Administration', 'Site Master']} back={BASE} />
      <form className="form-layout" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-main">
          <ErrorAlert>{formError}</ErrorAlert>

          <section className="card card-lg form-card">
            <div className="fc-head">
              <span className="fc-num">1</span>
              <div>
                <div className="form-section-title">Site</div>
                <div className="form-section-sub">Office site used on user records and holidays. Inactive sites are hidden from dropdowns.</div>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Name" required span={2} error={errors.name?.message}>
                <input className="input" maxLength={100} placeholder="e.g. Emqube DXB" {...register('name')} />
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
                <div className="form-section-title">Shifts</div>
                <div className="form-section-sub">
                  Working hours at this site, e.g. Morning Shift, Night Shift. Each user works one of these shifts for attendance (late marks and half days). A shift assigned to users can&apos;t be
                  removed – switch it off instead.
                </div>
              </div>
            </div>
            <div className="editor">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Shift title</th>
                    <th>Start time</th>
                    <th>End time</th>
                    <th title="minutes after the start time before a check-in is late">Late after (min)</th>
                    <th title="minutes worked below which the day is a half day">Half day (min)</th>
                    <th style={{ width: 80 }}>Active</th>
                    <th className="col-actions" />
                  </tr>
                </thead>
                <tbody>
                  {shifts.fields.map((f, i) => (
                    <tr key={f.id}>
                      <td className="muted">{i + 1}</td>
                      <td style={{ minWidth: 170 }}>
                        <input className="input" maxLength={100} placeholder="e.g. Morning Shift" {...register(`shifts.${i}.name`)} />
                        {errNode(i, 'name')}
                      </td>
                      <td style={{ width: 150 }}>
                        <Controller name={`shifts.${i}.startTime`} control={control} render={({ field }) => <TimePicker value={field.value} onChange={field.onChange} onBlur={field.onBlur} />} />
                        {errNode(i, 'startTime')}
                      </td>
                      <td style={{ width: 150 }}>
                        <Controller name={`shifts.${i}.endTime`} control={control} render={({ field }) => <TimePicker value={field.value} onChange={field.onChange} onBlur={field.onBlur} />} />
                        {errNode(i, 'endTime')}
                      </td>
                      <td style={{ width: 96 }}>
                        <input className="input num" inputMode="numeric" placeholder="—" {...register(`shifts.${i}.lateAfterMinutes`)} />
                        {errNode(i, 'lateAfterMinutes')}
                      </td>
                      <td style={{ width: 96 }}>
                        <input className="input num" inputMode="numeric" placeholder="—" {...register(`shifts.${i}.halfDayMinutes`)} />
                        {errNode(i, 'halfDayMinutes')}
                      </td>
                      <td>
                        <Controller name={`shifts.${i}.isActive`} control={control} render={({ field }) => <Switch checked={field.value} onChange={field.onChange} />} />
                      </td>
                      <td className="col-actions">
                        {f.inUse ? (
                          <span className="rg-lock" title={f.userCount ? `Assigned to ${f.userCount} user${f.userCount === 1 ? '' : 's'} – switch it off instead` : 'Used in rosters / attendance – switch it off instead'}>
                            <Lock />
                          </span>
                        ) : (
                          <button type="button" className="btn btn-ghost btn-icon" title="Remove shift" disabled={shifts.fields.length === 1}
                            onClick={async () => {
                              const name = getValues(`shifts.${i}.name`);
                              if (await confirm({ title: 'Remove shift?', message: `"${name || 'This shift'}" is removed when you save the site.`, confirmLabel: 'Remove' })) shifts.remove(i);
                            }}
                          >
                            <Trash2 />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {errors.shifts?.root?.message || errors.shifts?.message ? (
                <span className="help" style={{ color: 'var(--danger)', display: 'block', padding: '8px 12px' }}>
                  {errors.shifts?.root?.message ?? errors.shifts?.message}
                </span>
              ) : null}
              <div className="editor-foot">
                <button type="button" className="btn btn-soft btn-sm" onClick={() => shifts.append({ ...NEW_SHIFT })}>
                  <Plus />
                  Add shift
                </button>
                <span className="muted small">
                  {shifts.fields.length} shift{shifts.fields.length === 1 ? '' : 's'}
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
                {isSubmitting ? 'Saving…' : isEdit ? 'Save site' : 'Create site'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
