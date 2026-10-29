import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { emailSchema, keepPhoneChars, phoneSchema } from '@/lib/validation';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Cloud, Mail, Phone } from 'lucide-react';
import { configApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { Topbar } from '@/components/layout/Topbar';
import { Dropdown } from '@/components/ui/Dropdown';
import { TimePicker } from '@/components/ui/TimePicker';
import { ErrorAlert } from '@/components/ui/Display';
import { Field, IconInput, Switch } from '@/components/ui/Field';
import { FullPageLoader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useApiFormError } from '@/hooks/useApiForm';
import { useOptionsFrom } from '@/hooks/useOptions';
import NotFoundPage from '@/pages/errors/NotFoundPage';

const fieldsOf = (def) => def.sections.flatMap((s) => s.fields);

/** Zod schema built from the field definitions. Numbers are edited as strings and converted on save. */
function buildSchema(def) {
  const shape = {};
  for (const f of fieldsOf(def)) {
    const need = (s) => (f.required ? s.min(1, `Enter ${f.label.toLowerCase()}`) : s);
    switch (f.type) {
      case 'switch':
        shape[f.name] = z.boolean();
        break;
      case 'multiselect':
        shape[f.name] = z.array(z.number());
        break;
      case 'select':
        shape[f.name] = f.required
          ? z.union([z.number(), z.string().min(1)], { error: `Select ${f.label.toLowerCase()}` })
          : z.union([z.number(), z.string()]).nullable();
        break;
      case 'email':
        shape[f.name] = emailSchema.refine((v) => !f.required || v !== '', `Enter ${f.label.toLowerCase()}`);
        break;
      case 'phone':
        shape[f.name] = phoneSchema.refine((v) => !f.required || v !== '', `Enter ${f.label.toLowerCase()}`);
        break;
      case 'number':
        shape[f.name] = z
          .string()
          .trim()
          .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 9999), 'Enter a whole number')
          .refine((v) => !f.required || v !== '', `Enter ${f.label.toLowerCase()}`);
        break;
      case 'time':
        shape[f.name] = need(z.string()).refine((v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Enter a time (HH:MM)');
        break;
      case 'decimal':
        // required-ness is checked below (it may depend on other fields via showIf)
        shape[f.name] = z
          .string()
          .trim()
          .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) > 0), 'Enter a number above 0');
        break;
      default:
        shape[f.name] = need(z.string().trim()).max(f.max ?? (f.type === 'textarea' ? 10000 : 100), `At most ${f.max ?? 100} characters`);
    }
  }
  // fields shown only for some values (showIf) are required only while they are shown
  return z.object(shape).superRefine((v, ctx) => {
    for (const f of fieldsOf(def)) {
      if (f.type === 'decimal' && f.required && (!f.showIf || f.showIf(v)) && !String(v[f.name] ?? '').trim()) {
        ctx.addIssue({ code: 'custom', path: [f.name], message: `Enter ${f.label.toLowerCase()}` });
      }
    }
  });
}

const emptyValues = (def) =>
  Object.fromEntries(fieldsOf(def).map((f) => [f.name, f.default ?? (f.type === 'switch' ? false : f.type === 'select' ? null : f.type === 'multiselect' ? [] : '')]));

const fromRecord = (def, r) =>
  Object.fromEntries(
    fieldsOf(def).map((f) => {
      const v = r[f.name];
      if (f.type === 'switch') return [f.name, !!v];
      if (f.type === 'select') return [f.name, v ?? null];
      if (f.type === 'multiselect') return [f.name, v ?? []];
      return [f.name, v === null || v === undefined ? '' : String(v)];
    }),
  );

const toPayload = (def, values) =>
  Object.fromEntries(
    fieldsOf(def).map((f) => {
      const v = values[f.name];
      if (f.type === 'number') return [f.name, v === '' ? (f.default !== undefined ? Number(f.default) : null) : Number(v)];
      if (f.type === 'decimal') return [f.name, (f.showIf && !f.showIf(values)) || v === '' ? null : Number(v)];
      if (f.type === 'switch' || f.type === 'select' || f.type === 'multiselect') return [f.name, v];
      if (f.type === 'upper') return [f.name, v.trim().toUpperCase()];
      return [f.name, typeof v === 'string' && v.trim() === '' && !f.required ? null : v];
    }),
  );

function SelectField({ field, control }) {
  const options = useOptionsFrom(field.optionsFrom, field.options);
  return (
    <Controller
      name={field.name}
      control={control}
      render={({ field: f }) => (
        <Dropdown
          search={options.length > 6}
          multi={field.type === 'multiselect'}
          clearable={!field.required}
          placeholder={`Select ${field.label.toLowerCase()}`}
          options={options}
          value={f.value}
          onChange={f.onChange}
          onBlur={f.onBlur}
        />
      )}
    />
  );
}

function FormField({ field, control, register, error }) {
  const common = { placeholder: field.placeholder, ...register(field.name) };
  if (field.type === 'switch') {
    return (
      <Field style={{ justifyContent: 'flex-end' }} help={field.help}>
        <Controller name={field.name} control={control} render={({ field: f }) => <Switch label={field.label} checked={f.value} onChange={f.onChange} />} />
      </Field>
    );
  }
  let control_;
  switch (field.type) {
    case 'select':
    case 'multiselect':
      control_ = <SelectField field={field} control={control} />;
      break;
    case 'textarea':
      control_ = <textarea className="textarea" placeholder={`Add ${field.label.toLowerCase()}…`} {...register(field.name)} />;
      break;
    case 'email':
      control_ = <IconInput icon={Mail} type="email" maxLength={150} placeholder="name@company.com" {...register(field.name)} />;
      break;
    case 'phone':
      control_ = <IconInput icon={Phone} type="tel" inputMode="tel" maxLength={15} placeholder="Enter phone number" onInput={keepPhoneChars} {...register(field.name)} />;
      break;
    case 'time':
      control_ = (
        <Controller
          name={field.name}
          control={control}
          render={({ field: f }) => <TimePicker value={f.value} onChange={f.onChange} onBlur={f.onBlur} placeholder={`Select ${field.label.toLowerCase()}`} />}
        />
      );
      break;
    case 'number':
      control_ = <input className="input" type="number" min="0" step="1" placeholder="0" {...common} />;
      break;
    case 'decimal':
      control_ = <input className="input" type="number" min="0" step="any" placeholder={field.placeholder ?? '0.00'} {...register(field.name)} />;
      break;
    case 'upper':
      control_ = <input className="input" style={{ textTransform: 'uppercase' }} placeholder={`Enter ${field.label.toLowerCase()}`} {...register(field.name)} />;
      break;
    default:
      control_ = <input className="input" placeholder={`Enter ${field.label.toLowerCase()}`} {...register(field.name)} />;
  }
  return (
    <Field label={field.label} required={field.required} help={field.help} error={error} span={field.span}>
      {control_}
    </Field>
  );
}

/** Add / edit form for a configuration master: numbered form sections, then the sticky form bar. */
export default function ConfigFormPage({ def }) {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const api = useMemo(() => configApi(def.key), [def.key]);
  const schema = useMemo(() => buildSchema(def), [def]);

  const record = useQuery({ queryKey: ['config', def.key, id], queryFn: () => api.get(id), enabled: isEdit, retry: false });
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: emptyValues(def) });
  const { formError, handleApiError } = useApiFormError(setError);
  const values = useWatch({ control }); // for fields shown only for some values (showIf)

  useEffect(() => {
    if (record.data) reset(fromRecord(def, record.data));
  }, [record.data, reset, def]);

  const save = useMutation({
    mutationFn: (body) => (isEdit ? api.update(id, body) : api.create(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', def.key] });
      queryClient.invalidateQueries({ queryKey: ['masters'] });
      queryClient.invalidateQueries({ queryKey: ['lookups'] });
      toast.success(`${def.singular[0].toUpperCase()}${def.singular.slice(1)} ${isEdit ? 'saved' : 'created'}`);
      navigate(def.back ?? def.screen);
    },
    onError: (err) => handleApiError(err),
  });

  if (isEdit && record.isLoading) return <FullPageLoader />;
  if (isEdit && record.isError) {
    return record.error?.response?.status === 404 ? <NotFoundPage what={def.singular} /> : <ErrorAlert>{errorMessage(record.error)}</ErrorAlert>;
  }

  const name = record.data?.name;
  return (
    <>
      <Topbar
        title={isEdit ? `Edit ${def.singular}${name ? ` · ${name}` : ''}` : `New ${def.singular}`}
        breadcrumb={[def.breadcrumb ?? 'Administration', def.title]}
        back={def.back ?? def.screen}
      />
      <form className="form-layout" onSubmit={handleSubmit((v) => save.mutateAsync(toPayload(def, v)).catch(() => {}))} noValidate>
        <div className="form-main">
          <ErrorAlert>{formError}</ErrorAlert>
          {def.sections.map((s, i) => (
            <section key={s.title} className="card card-lg form-card">
              <div className="fc-head">
                {def.sections.length > 1 && <span className="fc-num">{i + 1}</span>}
                <div>
                  <div className="form-section-title">{s.title}</div>
                  <div className="form-section-sub">{s.sub}</div>
                </div>
              </div>
              <div className="form-grid">
                {s.fields
                  .filter((f) => !f.showIf || f.showIf(values))
                  .map((f) => (
                    <FormField key={f.name} field={f} control={control} register={register} error={errors[f.name]?.message} />
                  ))}
              </div>
            </section>
          ))}
          <div className="form-bar">
            <span className="note">
              <Cloud />
              Fields marked * are required
            </span>
            <div className="actions">
              <Link className="btn btn-ghost" to={def.back ?? def.screen}>
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                <Check />
                {isSubmitting ? 'Saving…' : isEdit ? `Save ${def.singular}` : `Create ${def.singular}`}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
