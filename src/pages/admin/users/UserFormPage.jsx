import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { emailSchema } from '@/lib/validation';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Cloud, Mail } from 'lucide-react';
import { mastersApi, usersApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { Topbar } from '@/components/layout/Topbar';
import { Dropdown } from '@/components/ui/Dropdown';
import { Field, IconInput, PasswordInput, Switch } from '@/components/ui/Field';
import { DatePicker } from '@/components/ui/DatePicker';
import { ErrorAlert } from '@/components/ui/Display';
import { FullPageLoader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/toast-context';
import { useApiFormError } from '@/hooks/useApiForm';
import { useAssignableRoleOptions, useCurrencyOptions, useLookupOptions, useMasterOptions } from '@/hooks/useOptions';
import { TIME_ZONES } from '@/lib/constants';
import { passwordSchema } from '@/lib/password';
import NotFoundPage from '@/pages/errors/NotFoundPage';

const optionalNumber = z
  .string()
  .trim()
  .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Enter a positive number');

const makeSchema = (isEdit) =>
  z
    .object({
      name: z.string().trim().min(1, 'Enter the name').max(150),
      empCode: z.string().trim().max(30),
      email: emailSchema,
      dob: z.string(),
      username: z
        .string()
        .trim()
        .min(3, 'At least 3 characters')
        .max(100)
        .regex(/^[A-Za-z0-9._@-]+$/, 'Letters, numbers and . _ @ - only'),
      roleId: z.number({ error: 'Select a role' }),
      userTypeId: z.number().nullable(),
      isActive: z.boolean(),
      password: isEdit ? z.union([z.literal(''), passwordSchema]) : passwordSchema,
      confirmPassword: z.string(),
      reportsTo: z.number().nullable(),
      resourceGradeId: z.number().nullable(),
      siteId: z.number().nullable(),
      shiftId: z.number().nullable(),
      timeZone: z.string().min(1),
      isOnLeave: z.boolean(),
      hourlyRate: optionalNumber,
      hourlyRateCurrency: z.string().nullable(),
    })
    .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

const EMPTY = {
  name: '',
  empCode: '',
  email: '',
  dob: '',
  username: '',
  roleId: undefined,
  userTypeId: null,
  isActive: true,
  password: '',
  confirmPassword: '',
  reportsTo: null,
  resourceGradeId: null,
  siteId: null,
  shiftId: null,
  timeZone: 'Asia/Kolkata',
  isOnLeave: false,
  hourlyRate: '',
  hourlyRateCurrency: null,
};

const fromUser = (u) => ({
  ...EMPTY,
  name: u.name,
  empCode: u.empCode ?? '',
  email: u.email ?? '',
  dob: u.dob ?? '',
  username: u.username,
  roleId: u.roleId,
  userTypeId: u.userTypeId,
  isActive: u.isActive,
  reportsTo: u.reportsTo,
  resourceGradeId: u.resourceGradeId,
  siteId: u.siteId,
  shiftId: u.shiftId,
  timeZone: u.timeZone,
  isOnLeave: u.isOnLeave,
  hourlyRate: u.hourlyRate != null ? String(u.hourlyRate) : '',
  hourlyRateCurrency: u.hourlyRateCurrency,
});

function toPayload(v) {
  const body = {
    name: v.name,
    empCode: v.empCode || null,
    email: v.email || null,
    dob: v.dob || null,
    username: v.username,
    roleId: v.roleId,
    userTypeId: v.userTypeId,
    isActive: v.isActive,
    reportsTo: v.reportsTo,
    resourceGradeId: v.resourceGradeId,
    siteId: v.siteId,
    shiftId: v.shiftId,
    timeZone: v.timeZone,
    isOnLeave: v.isOnLeave,
    hourlyRate: v.hourlyRate === '' ? null : Number(v.hourlyRate),
    hourlyRateCurrency: v.hourlyRateCurrency,
  };
  if (v.password) body.password = v.password;
  return body;
}

function Section({ num, title, sub, children }) {
  return (
    <section className="card card-lg form-card">
      <div className="fc-head">
        <span className="fc-num">{num}</span>
        <div>
          <div className="form-section-title">{title}</div>
          <div className="form-section-sub">{sub}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function UserFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user: me, reloadSession } = useAuth();
  const isSelf = isEdit && Number(id) === me.id;

  const roles = useAssignableRoleOptions();
  const userTypes = useLookupOptions('USER_TYPE');
  const people = useMasterOptions('users');
  const sites = useMasterOptions('sites');
  const shifts = useMasterOptions('shifts');
  const gradesQ = useQuery({ queryKey: ['masters', 'resource-grades'], queryFn: () => mastersApi.list('resource-grades') });
  const grades = gradesQ.data ?? [];
  const currencies = useCurrencyOptions();

  const userQ = useQuery({ queryKey: ['users', id], queryFn: () => usersApi.get(id), enabled: isEdit, retry: false });
  const schema = useMemo(() => makeSchema(isEdit), [isEdit]);
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

  useEffect(() => {
    if (userQ.data) reset(fromUser(userQ.data));
  }, [userQ.data, reset]);

  // The user's current role may be above what the editor may assign; still show it.
  const roleOptions = useMemo(() => {
    const u = userQ.data;
    if (u && !roles.options.some((o) => o.value === u.roleId)) return [{ value: u.roleId, label: u.roleName }, ...roles.options];
    return roles.options;
  }, [roles.options, userQ.data]);
  const peopleOptions = useMemo(() => people.options.filter((o) => String(o.value) !== String(id)), [people.options, id]);

  const save = useMutation({
    mutationFn: (body) => (isEdit ? usersApi.update(id, body) : usersApi.create(body)),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['masters', 'users'] });
      if (isSelf) await reloadSession();
      toast.success(isEdit ? 'User saved' : 'User created');
      navigate('/administration/users');
    },
    onError: (err) => handleApiError(err),
  });

  if (isEdit && userQ.isLoading) return <FullPageLoader />;
  if (isEdit && userQ.isError) {
    return userQ.error?.response?.status === 404 ? <NotFoundPage what="User" /> : <ErrorAlert>{errorMessage(userQ.error)}</ErrorAlert>;
  }

  const err = (n) => errors[n]?.message;
  const dd = (name, props) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => <Dropdown value={field.value} onChange={field.onChange} onBlur={field.onBlur} {...props} />}
    />
  );

  return (
    <>
      <Topbar title={isEdit ? `Edit user · ${userQ.data.name}` : 'New user'} breadcrumb={['Administration', 'Users']} back="/administration/users" />
      <form className="form-layout" onSubmit={handleSubmit((v) => save.mutateAsync(toPayload(v)).catch(() => {}))} noValidate>
        <div className="form-main">
          <ErrorAlert>{formError}</ErrorAlert>

          <Section num={1} title="Personal details" sub="Name and contact of the user.">
            <div className="form-grid">
              <Field label="Name" required error={err('name')}>
                <input className="input" placeholder="Enter name" {...register('name')} />
              </Field>
              <Field label="Employee code" error={err('empCode')}>
                <input className="input" placeholder="Auto-generated if left blank" {...register('empCode')} />
              </Field>
              <Field label="Email" error={err('email')}>
                <IconInput icon={Mail} type="email" maxLength={150} placeholder="name@company.com" {...register('email')} />
              </Field>
              <Field label="Date of birth" error={err('dob')}>
                <Controller
                  name="dob"
                  control={control}
                  render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} onBlur={field.onBlur} max={new Date().toISOString().slice(0, 10)} placeholder="Select date of birth" />}
                />
              </Field>
            </div>
          </Section>

          <Section num={2} title="Login & access" sub="The role decides the menus and actions the user can use.">
            <div className="form-grid">
              <Field label="Username" required error={err('username')}>
                <input className="input" placeholder="Enter username" autoComplete="off" {...register('username')} />
              </Field>
              <Field label="Role" required error={err('roleId')} help={isSelf ? 'You cannot change your own role' : 'Only roles below your level are listed'}>
                {dd('roleId', { search: true, placeholder: 'Select role', options: roleOptions, disabled: isSelf })}
              </Field>
              <Field label="User type" error={err('userTypeId')}>
                {dd('userTypeId', { search: true, clearable: true, placeholder: 'Select user type', options: userTypes.options })}
              </Field>
              <Field style={{ justifyContent: 'flex-end' }}>
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => <Switch label="Active" checked={field.value} onChange={field.onChange} disabled={isSelf} />}
                />
              </Field>
            </div>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <Field
                label={isEdit ? 'Reset password' : 'Password'}
                required={!isEdit}
                error={err('password')}
                help={isEdit ? 'Leave blank to keep the current password. Resetting unlocks the account and signs the user out.' : undefined}
              >
                <PasswordInput placeholder="Enter password" autoComplete="new-password" {...register('password')} />
              </Field>
              <Field label="Confirm password" required={!isEdit} error={err('confirmPassword')}>
                <PasswordInput autoComplete="new-password" {...register('confirmPassword')} />
              </Field>
            </div>
          </Section>

          <Section num={3} title="Work" sub="Reporting line, location and shift.">
            <div className="form-grid">
              <Field label="Reports to" error={err('reportsTo')}>
                {dd('reportsTo', { search: true, clearable: true, placeholder: 'Select reports to', options: peopleOptions })}
              </Field>
              <Field label="Site" error={err('siteId')}>
                {dd('siteId', { search: true, clearable: true, placeholder: 'Select site', options: sites.options })}
              </Field>
              <Field label="Shift" error={err('shiftId')}>
                {dd('shiftId', { search: true, clearable: true, placeholder: 'Select shift', options: shifts.options })}
              </Field>
              <Field label="Time zone" error={err('timeZone')}>
                {dd('timeZone', { placeholder: 'Select time zone', options: TIME_ZONES.map((t) => ({ value: t, label: t })) })}
              </Field>
              <Field style={{ justifyContent: 'flex-end' }}>
                <Controller
                  name="isOnLeave"
                  control={control}
                  render={({ field }) => <Switch label="On leave" checked={field.value} onChange={field.onChange} />}
                />
              </Field>
            </div>
          </Section>

          <Section num={4} title="Grade & cost" sub="The grade's current cost pre-fills the hourly rate; change it for this user if needed. Used for project cost reports.">
            <div className="form-grid">
              <Field label="Grade" error={err('resourceGradeId')} help={grades.length ? undefined : 'Set up grades in Administration → Resource Grade & Cost'}>
                <Controller
                  name="resourceGradeId"
                  control={control}
                  render={({ field }) => (
                    <Dropdown
                      search
                      clearable
                      placeholder="Select grade"
                      options={grades.map((g) => ({ value: g.id, label: g.costPerHour != null ? `${g.name} (${g.currency} ${g.costPerHour}/h)` : g.name }))}
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v);
                        // pre-fill the rate from the grade's current cost
                        const g = grades.find((x) => x.id === v);
                        if (g?.costPerHour != null) {
                          setValue('hourlyRate', String(g.costPerHour), { shouldDirty: true });
                          setValue('hourlyRateCurrency', g.currency, { shouldDirty: true });
                        }
                      }}
                    />
                  )}
                />
              </Field>
              <Field label="Hourly rate" error={err('hourlyRate')}>
                <input className="input" type="number" min="0" step="0.01" placeholder="0.00" {...register('hourlyRate')} />
              </Field>
              <Field label="Rate currency" help="ISO code">
                {dd('hourlyRateCurrency', { clearable: true, placeholder: 'Select rate currency', options: currencies })}
              </Field>
            </div>
          </Section>


          <div className="form-bar">
            <span className="note">
              <Cloud />
              Fields marked * are required
            </span>
            <div className="actions">
              <Link className="btn btn-ghost" to="/administration/users">
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                <Check />
                {isSubmitting ? 'Saving…' : isEdit ? 'Save user' : 'Create user'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
