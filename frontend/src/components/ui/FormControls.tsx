import { useId, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { EyeIcon, EyeOffIcon } from './Icons'

const controlClasses =
  'w-full rounded-[var(--radius-control)] border bg-field px-3.5 text-[16px] text-ink placeholder:text-subtle outline-none transition-colors duration-150 focus:border-accent focus:ring-2 focus:ring-accent/15'

interface FieldProps {
  label: string
  error?: string
  hint?: ReactNode
}

function Message({ id, error, hint }: { id: string; error?: string; hint?: ReactNode }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="mt-1.5 text-[14px] text-danger">
        {error}
      </p>
    )
  }
  if (hint) {
    return (
      <p id={`${id}-hint`} className="mt-1.5 text-[14px] text-subtle">
        {hint}
      </p>
    )
  }
  return null
}

const describedBy = (id: string, error?: string, hint?: ReactNode) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined)

export function TextField({ label, error, hint, className, ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-medium text-ink-2">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlClasses, 'h-11', error ? 'border-danger' : 'border-line-strong')}
        {...props}
      />
      <Message id={id} error={error} hint={hint} />
    </div>
  )
}

/** Password input with a show/hide toggle. Used for every password field. */
export function PasswordField({ label, error, hint, className, ...props }: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-medium text-ink-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(controlClasses, 'h-11 pr-12', error ? 'border-danger' : 'border-line-strong')}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[var(--radius-control)] text-subtle hover:text-ink"
        >
          {visible ? <EyeOffIcon className="size-[18px]" /> : <EyeIcon className="size-[18px]" />}
        </button>
      </div>
      <Message id={id} error={error} hint={hint} />
    </div>
  )
}

export function TextArea({ label, error, hint, className, ...props }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-medium text-ink-2">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlClasses, 'min-h-32 py-3', error ? 'border-danger' : 'border-line-strong')}
        {...props}
      />
      <Message id={id} error={error} hint={hint} />
    </div>
  )
}

type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const alertRule: Record<AlertTone, string> = {
  info: 'border-accent bg-accent-soft',
  success: 'border-success bg-success-soft',
  warning: 'border-warning bg-warning-soft',
  danger: 'border-danger bg-danger-soft',
}

/** Message block: tone comes from the left rule and background, the words carry the meaning. */
export function Alert({ tone = 'info', title, children }: { tone?: AlertTone; title: string; children?: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('border-l-2 px-4 py-3 text-[15px]', alertRule[tone])}>
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-0.5 text-ink-2">{children}</div>}
    </div>
  )
}
