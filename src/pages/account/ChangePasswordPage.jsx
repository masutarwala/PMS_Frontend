import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router';
import { Check, KeyRound } from 'lucide-react';
import { authApi } from '@/api/endpoints';
import { Topbar } from '@/components/layout/Topbar';
import { Field, PasswordInput } from '@/components/ui/Field';
import { ErrorAlert } from '@/components/ui/Display';
import { useToast } from '@/components/ui/toast-context';
import { useApiFormError } from '@/hooks/useApiForm';
import { passwordSchema } from '@/lib/password';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export default function ChangePasswordPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });
  const { formError, handleApiError } = useApiFormError(setError);


  const onSubmit = async ({ currentPassword, newPassword }) => {
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      toast.success('Password changed');
      navigate('/');
    } catch (err) {
      handleApiError(err);
    }
  };

  return (
    <>
      <Topbar title="Change password" breadcrumb={['Account']} />
      <div style={{ maxWidth: 640 }}>
        <form className="card card-lg" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-section">
            <div className="form-section-title">Change password</div>
            <div className="form-section-sub">Enter your current password, then the new one twice.</div>
            <ErrorAlert>{formError}</ErrorAlert>
            <div className="form-grid" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
              <Field label="Current password" required error={errors.currentPassword?.message}>
                <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
              </Field>
              <Field label="New password" required error={errors.newPassword?.message}>
                <PasswordInput icon={KeyRound} autoComplete="new-password" {...register('newPassword')} />
              </Field>
              <Field label="Confirm new password" required error={errors.confirmPassword?.message}>
                <PasswordInput icon={KeyRound} autoComplete="new-password" {...register('confirmPassword')} />
              </Field>
            </div>
          </div>
          <div className="form-actions">
            <Link className="btn btn-ghost" to="/">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <Check />
              {isSubmitting ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
