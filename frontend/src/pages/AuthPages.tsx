import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { cn, validateEmail, validatePassword, validateRequired } from '../lib/utils'
import { useAuth } from '../hooks/useAuth'
import { usePageMeta } from '../hooks/usePageMeta'
import { Alert, PasswordField, TextField } from '../components/ui/FormControls'
import { Button } from '../components/ui/Button'
import { Honeypot } from '../components/ui/Honeypot'
import { useWorkspace } from '../product/workspace'

function AuthShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="w-full max-w-[420px]">
      <h1 className="text-[30px] font-semibold tracking-[-0.025em] text-ink sm:text-[34px]">{title}</h1>
      <p className="mt-2 text-[15px] text-muted">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </div>
  )
}

/** 0 to 3: long enough, has a letter and a number, and is long or has a symbol. */
function passwordScore(value: string): number {
  if (!value) return 0
  let score = 0
  if (value.length >= 6) score++
  if (/[A-Za-z]/.test(value) && /\d/.test(value)) score++
  if (value.length >= 10 || /[^A-Za-z0-9]/.test(value)) score++
  return score
}

function PasswordStrength({ value }: { value: string }) {
  if (!value) return null
  const score = passwordScore(value)
  const label = ['Too weak', 'Weak', 'Good', 'Strong'][score]
  const color = ['bg-danger', 'bg-danger', 'bg-highlight', 'bg-success'][score]
  return (
    <div className="-mt-2" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i <= score ? color : 'bg-ink/[0.08]')} />
        ))}
      </div>
      <p className="mt-1.5 text-[13px] text-subtle">Password strength: {label}</p>
    </div>
  )
}

export function GetStartedPage() {
  usePageMeta({ title: 'Create your account', path: '/signup', description: 'Create your FormPilot account and build a reusable profile from your documents.' })
  const { user, loading, setUser } = useAuth()
  const { open } = useWorkspace()
  const navigate = useNavigate()
  const [values, setValues] = useState({ full_name: '', email: '', password: '' })
  const [agreed, setAgreed] = useState(false)
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (!loading && user) return <Navigate to="/dashboard" replace />

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
      open(created)
      navigate('/dashboard')
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
          <Link to="/login" className="font-medium text-accent underline underline-offset-2">
            Sign in
          </Link>
        </>
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
        <PasswordStrength value={values.password} />
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
  usePageMeta({ title: 'Sign In', path: '/login', description: 'Sign in to your FormPilot workspace.' })
  const { user, loading, setUser } = useAuth()
  const { open } = useWorkspace()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/dashboard'
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
      const signedIn = await api.auth.signIn({ email: values.email.trim(), password: values.password })
      setUser(signedIn)
      open(signedIn)
      navigate(next)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Sign in to FormPilot"
      subtitle={
        <>
          New to FormPilot?{' '}
          <Link to="/signup" className="font-medium text-accent underline underline-offset-2">
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
        <p className="text-center text-[14px] text-muted">
          Forgot your password?{' '}
          <Link to="/contact" className="font-medium text-accent underline underline-offset-2">
            Contact support
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
