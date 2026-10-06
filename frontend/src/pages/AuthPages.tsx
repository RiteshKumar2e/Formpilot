import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { cn, validateEmail, validatePassword, validateRequired } from '../lib/utils'
import { useAuth } from '../hooks/useAuth'
import { usePageMeta } from '../hooks/usePageMeta'
import { Alert, PasswordField, TextField } from '../components/ui/FormControls'
import { Button } from '../components/ui/Button'
import { Honeypot } from '../components/ui/Honeypot'
import { Container } from '../components/ui/primitives'

function AuthShell({ title, subtitle, children, aside }: { title: string; subtitle: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <Container
      className={cn(
        'grid grid-cols-[minmax(0,1fr)] gap-12 py-12 sm:py-16 lg:py-24',
        Boolean(aside) && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-20',
      )}
    >
      {/* With a side panel the form sits left of center; on its own it is centered. */}
      <div className={cn('mx-auto w-full max-w-[440px]', Boolean(aside) && 'lg:mx-0 lg:ml-auto')}>
        <h1 className="heading text-[32px] text-ink sm:text-[38px]">{title}</h1>
        <p className="mt-2 text-[15px] text-muted">{subtitle}</p>
        <div className="mt-8 rounded-[var(--radius-panel)] border border-line bg-surface p-6 sm:p-8">{children}</div>
      </div>
      {aside && <aside className="hidden lg:block">{aside}</aside>}
    </Container>
  )
}

const ONBOARDING = [
  { title: 'Create your account', body: 'Your profile is private to you.' },
  { title: 'Upload your documents', body: 'Resume, certificates, transcripts, IDs.' },
  { title: 'Review your profile', body: 'Confirm what FormPilot extracted and resolve conflicts.' },
]

export function GetStartedPage() {
  usePageMeta({ title: 'Get Started', path: '/get-started', description: 'Create your FormPilot account and build a reusable profile from your documents.' })
  const { user, loading, setUser } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState({ full_name: '', email: '', password: '' })
  const [agreed, setAgreed] = useState(false)
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (!loading && user) return <Navigate to="/app" replace />

  const validate = () => {
    const next = {
      full_name: validateRequired(values.full_name, 'Full name'),
      email: validateEmail(values.email),
      password: validatePassword(values.password),
      agreed: agreed ? undefined : 'Please accept the terms to continue.',
    }
    setErrors(next)
    return !Object.values(next).some(Boolean)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      const created = await api.auth.signUp({ ...values, email: values.email.trim(), full_name: values.full_name.trim(), website })
      setUser(created)
      navigate('/app')
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        <>
          Already have one?{' '}
          <Link to="/signin" className="font-medium text-accent underline underline-offset-2">
            Sign in
          </Link>
        </>
      }
      aside={
        <div className="pt-2">
          <p className="eyebrow">What happens next</p>
          <ol className="mt-5 border-t border-line">
            {ONBOARDING.map((step, i) => (
              <li key={step.title} className={cn('grid grid-cols-[2.5rem_1fr] border-b border-line py-5', i === 0 && 'text-ink')}>
                <span className="pt-0.5 font-mono text-[13px] text-subtle">0{i + 1}</span>
                <div>
                  <p className="text-[16px] font-medium text-ink">{step.title}</p>
                  <p className="mt-0.5 text-[15px] text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[15px] text-ink-2">FormPilot prepares answers. It never submits a form for you.</p>
        </div>
      }
    >
      <form noValidate onSubmit={onSubmit} className="relative space-y-5">
        <Honeypot value={website} onChange={setWebsite} />
        {formError && <Alert tone="danger" title="We couldn’t create your account">{formError}</Alert>}
        <TextField
          label="Full name"
          name="full_name"
          autoComplete="name"
          value={values.full_name}
          error={errors.full_name}
          onChange={(e) => setValues({ ...values, full_name: e.target.value })}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={values.email}
          error={errors.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          value={values.password}
          error={errors.password}
          hint="At least 6 characters, with a letter and a number."
          onChange={(e) => setValues({ ...values, password: e.target.value })}
        />
        <div>
          <label className="flex items-start gap-3 text-[14px] text-ink-2">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              aria-invalid={errors.agreed ? true : undefined}
              aria-describedby={errors.agreed ? 'agree-error' : undefined}
              className="mt-0.5 size-4 shrink-0 rounded accent-accent"
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" className="text-accent underline underline-offset-2">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-accent underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {errors.agreed && (
            <p id="agree-error" className="mt-1.5 text-[13px] text-danger">
              {errors.agreed}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  )
}

export function SignInPage() {
  usePageMeta({ title: 'Sign In', path: '/signin', description: 'Sign in to your FormPilot workspace.' })
  const { user, loading, setUser } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/app'
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (!loading && user) return <Navigate to={next} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const nextErrors = {
      email: validateEmail(values.email),
      password: values.password ? undefined : 'Enter your password.',
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return
    setSubmitting(true)
    try {
      setUser(await api.auth.signIn({ email: values.email.trim(), password: values.password }))
      navigate(next)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        <>
          New to FormPilot?{' '}
          <Link to="/get-started" className="font-medium text-accent underline underline-offset-2">
            Create an account
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        {formError && <Alert tone="danger" title="Sign in failed">{formError}</Alert>}
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={values.email}
          error={errors.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          value={values.password}
          error={errors.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
        />
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
    </AuthShell>
  )
}
