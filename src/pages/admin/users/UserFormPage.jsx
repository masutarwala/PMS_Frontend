import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
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
import { useAssignableRoleOptions, useLookupOptions, useMasterOptions } from '@/hooks/useOptions';
import { TIME_ZONES } from '@/lib/constants';
import { todayIso } from '@/lib/timezone';
import { passwordSchema } from '@/lib/password';
import NotFoundPage from '@/pages/errors/NotFoundPage';

/** Roles whose users have skills (Parameters → SKILL). */
const SKILL_ROLES = ['EMPLOYEE', 'PROJECT_MANAGER'];

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
      skillIds: z.array(z.number()),
      siteId: z.number().nullable(),
      siteShiftId: z.number().nullable(),
      timeZone: z.string().min(1),
      isOnLeave: z.boolean(),
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
  skillIds: [],
  siteId: null,
  siteShiftId: null,
  timeZone: 'Asia/Kolkata',
  isOnLeave: false,
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
  skillIds: (u.skills ?? []).map((x) => x.id),
  siteId: u.siteId,
  siteShiftId: u.siteShiftId ?? null,
  timeZone: u.timeZone,
  isOnLeave: u.isOnLeave,
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
    skillIds: v.skillIds, // the API keeps them only for Employee / Project Manager
    siteId: v.siteId,
    siteShiftId: v.siteId ? v.siteShiftId : null,
    timeZone: v.timeZone,
    isOnLeave: v.isOnLeave,
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
  const skillOptions = useLookupOptions('SKILL').options;
  const sites = useMasterOptions('sites');
  const shiftsQ = useQuery({ queryKey: ['masters', 'site-shifts', 'all'], queryFn: () => mastersApi.list('site-shifts', { includeInactive: true }) });
  const gradesQ = useQuery({ queryKey: ['masters', 'resource-grades'], queryFn: () => mastersApi.list('resource-grades') });
  const grades = gradesQ.data ?? [];

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
  // skills only for users with the Employee or Project Manager role
  const roleIdValue = useWatch({ control, name: 'roleId' });
  const roleCode = roles.roles.find((r) => r.id === roleIdValue)?.code ?? (userQ.data?.roleId === roleIdValue ? userQ.data?.roleCode : undefined);
  const showSkills = SKILL_ROLES.includes(roleCode);
  const siteId = useWatch({ control, name: 'siteId' });
  const siteShiftId = useWatch({ control, name: 'siteShiftId' });
  // shifts of the selected site (active ones, plus the user's current one even if switched off)
  const shiftOptions = useMemo(
    () => (shiftsQ.data ?? []).filter((s) => s.siteId === siteId && (s.isActive !== false || s.id === siteShiftId)).map((s) => ({ value: s.id, label: s.name })),
    [shiftsQ.data, siteId, siteShiftId],
  );

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
                  render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} onBlur={field.onBlur} max={todayIso()} placeholder="Select date of birth" />}
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

          <Section num={3} title="Work" sub="Reporting line, site and the shift the user works.">
            <div className="form-grid">
              <Field label="Reports to" error={err('reportsTo')}>
                {dd('reportsTo', { search: true, clearable: true, placeholder: 'Select reports to', options: peopleOptions })}
              </Field>
              <Field label="Site" error={err('siteId')}>
                <Controller
                  name="siteId"
                  control={control}
                  render={({ field }) => (
                    <Dropdown
                      search
                      clearable
                      placeholder="Select site"
                      options={sites.options}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={(v) => {
                        field.onChange(v);
                        // a new site: pick its shift (the only one, or let the user choose)
                        const own = (shiftsQ.data ?? []).filter((s) => s.siteId === v && s.isActive !== false);
                        setValue('siteShiftId', own.length === 1 ? own[0].id : null, { shouldDirty: true });
                      }}
                    />
                  )}
                />
              </Field>
              <Field label="Shift" error={err('siteShiftId')} help={siteId ? 'working hours for attendance' : 'select the site first'}>
                {dd('siteShiftId', { clearable: true, disabled: !siteId, placeholder: siteId ? 'Select shift' : 'Select the site first', options: shiftOptions })}
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

          <Section
            num={4}
            title={showSkills ? 'Grade & skills' : 'Grade'}
            sub={`The user's cost comes from their grade (Administration → Resource Grade & Cost).${showSkills ? ' Skills show which project tasks they can do.' : ''}`}
          >
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
                      options={grades.map((g) => ({ value: g.id, label: g.name }))}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </Field>
              {showSkills && (
                <Field label="Skills" span={2} help={skillOptions.length ? 'what this person can do (Parameters → SKILL)' : 'Add skills in Parameters → SKILL'}>
                  {dd('skillIds', { multi: true, search: true, placeholder: 'Select skills', options: skillOptions })}
                </Field>
              )}
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
