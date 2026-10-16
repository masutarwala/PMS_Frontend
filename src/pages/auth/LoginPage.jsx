import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router';
import { ArrowRight, ChartColumnIncreasing, Info, Mail, ShieldCheck, SquareCheckBig, Target, Users } from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import { errorMessage } from '@/api/client';
import { Checkbox, Field, IconInput, PasswordInput } from '@/components/ui/Field';
import { ErrorAlert } from '@/components/ui/Display';
import logo from '@/assets/emqube-logo.svg';
import '@/styles/login.css';

const schema = z.object({
  username: z.string().trim().min(1, 'Enter your email address'),
  password: z.string().min(1, 'Enter your password'),
  rememberMe: z.boolean(),
});

const FEATURES = [
  { icon: SquareCheckBig, title: 'Organize', sub: 'Your work' },
  { icon: Users, title: 'Collaborate', sub: 'With your team' },
  { icon: ChartColumnIncreasing, title: 'Track', sub: 'Progress' },
  { icon: Target, title: 'Achieve', sub: 'Your goals' },
];

/** Decorative leaves + hill in the bottom-left corner. */
function CornerArt() {
  return (
    <svg className="lg-corner" viewBox="0 0 520 360" aria-hidden="true">
      <defs>
        <linearGradient id="lgHill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4CBF7A" />
          <stop offset="1" stopColor="#16A34A" />
        </linearGradient>
        <linearGradient id="lgLeaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5FA77A" />
          <stop offset="1" stopColor="#2F7A4C" />
        </linearGradient>
      </defs>
      <circle cx="210" cy="420" r="300" fill="#CFEFDB" />
      <circle cx="120" cy="470" r="280" fill="url(#lgHill)" opacity=".9" />
      <path d="M400 360C330 250 230 190 60 150" stroke="#9BD7B1" strokeWidth="1.5" fill="none" />
      <g opacity=".85">
        <path d="M30 160C40 110 60 70 40 20C10 60 0 120 30 160z" fill="url(#lgLeaf)" />
        <path d="M40 200C80 170 120 140 130 90C90 100 50 140 40 200z" fill="url(#lgLeaf)" />
        <path d="M20 260C60 250 100 230 120 190C80 190 40 220 20 260z" fill="url(#lgLeaf)" opacity=".8" />
        <path d="M30 160C30 210 25 250 10 300" stroke="#2F7A4C" strokeWidth="3" fill="none" />
      </g>
    </svg>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { username: '', password: '', rememberMe: true } });

  useEffect(() => {
    document.title = 'Sign in · emQube PMS';
  }, []);

  const onSubmit = async (values) => {
    setError(null);
    try {
      await login(values);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="lg-page">
      <span className="lg-blob" aria-hidden="true" />
      <CornerArt />

      <div className="lg-wrap">
        <section className="lg-intro">
          <img className="lg-logo" src={logo} alt="emQube – Powered by Thought" />
          <h1 className="lg-headline">
            Plan. Track. Deliver.
            <br />
            <span>Together.</span>
          </h1>
          <p className="lg-lead">
            Manage your projects, track progress, collaborate with your team and achieve your goals — all in one place.
          </p>
          <div className="lg-features">
            {FEATURES.map((f) => (
              <div key={f.title} className="lg-feature">
                <span className="lg-feature-ico">
                  <f.icon />
                </span>
                <b>{f.title}</b>
                <span>{f.sub}</span>
              </div>
            ))}
          </div>
        </section>

        <form className="lg-card" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="lg-card-head">
            <div>
              <h2>Welcome back</h2>
              <p>Sign in to your account</p>
            </div>
          </div>

          <ErrorAlert>{error}</ErrorAlert>

          <div className="col" style={{ gap: 20 }}>
            <Field label="Email address" htmlFor="username" error={errors.username?.message}>
              <IconInput id="username" icon={Mail} placeholder="you@emqube.com" autoComplete="username" autoFocus {...register('username')} />
            </Field>
            <Field label="Password" htmlFor="password" error={errors.password?.message}>
              <PasswordInput id="password" placeholder="Enter your password" autoComplete="current-password" {...register('password')} />
            </Field>
            <div className="row between">
              <Checkbox label="Remember me" checked={watch('rememberMe')} onChange={(v) => setValue('rememberMe', v)} />
              <button type="button" className="lg-link" onClick={() => setShowReset((s) => !s)} aria-expanded={showReset}>
                Forgot password?
              </button>
            </div>
            {showReset && (
              <div className="alert" role="status">
                <Info style={{ width: 18, height: 18, flexShrink: 0 }} />
                <span>Ask your administrator to reset your password. You will get a new password to sign in with.</span>
              </div>
            )}
            <button type="submit" className="btn btn-primary lg-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
              <ArrowRight />
            </button>
          </div>

          <div className="lg-secure">
            <ShieldCheck />
            Your data is secure with us
          </div>
        </form>
      </div>
    </div>
  );
}
