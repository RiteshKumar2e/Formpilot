import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, CircleDashed, FileText, Loader2, X, XCircle, type LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/Button'
import type { ApplicationStatus, DocumentStatus, FieldStatus } from './types'
import { STATUS_LABEL } from './selectors'
import type { WorkspaceError } from './workspace'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-[var(--radius-panel)] border border-line bg-surface shadow-[var(--shadow-card)]', className)}>{children}</div>
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  eyebrow?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-[13px] text-subtle">{eyebrow}</div>}
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const TONE: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink-2 border-line',
  accent: 'bg-accent-soft text-accent border-accent-line',
  success: 'bg-success-soft text-success border-success-line',
  warning: 'bg-warning-soft text-warning border-warning-line',
  danger: 'bg-danger-soft text-danger border-danger-line',
}

export function Badge({ tone = 'neutral', icon: Icon, children, className }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium whitespace-nowrap', TONE[tone], className)}>
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  )
}

const APP_TONE: Record<ApplicationStatus, Tone> = {
  draft: 'neutral',
  processing: 'accent',
  needs_review: 'warning',
  ready: 'accent',
  prepared: 'success',
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge tone={APP_TONE[status]}>{STATUS_LABEL[status]}</Badge>
}

export function FieldStatusBadge({ status }: { status: FieldStatus }) {
  switch (status) {
    case 'mapped':
      return <Badge tone="success" icon={CheckCircle2}>Mapped</Badge>
    case 'confirmed':
      return <Badge tone="success" icon={CheckCircle2}>Confirmed</Badge>
    case 'needs_review':
      return <Badge tone="warning" icon={AlertTriangle}>Needs review</Badge>
    case 'conflict':
      return <Badge tone="warning" icon={AlertTriangle}>Conflict</Badge>
    case 'missing':
      return <Badge tone="danger" icon={CircleDashed}>Missing</Badge>
  }
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  switch (status) {
    case 'processed':
      return <Badge tone="success" icon={CheckCircle2}>Processed</Badge>
    case 'needs_review':
      return <Badge tone="warning" icon={AlertTriangle}>Needs review</Badge>
    case 'failed':
      return <Badge tone="danger" icon={XCircle}>Failed</Badge>
    case 'processing':
      return <Badge tone="accent" icon={Loader2}>Processing</Badge>
  }
}

export function ConfidenceBar({ value, className, showLabel = true }: { value: number; className?: string; showLabel?: boolean }) {
  const pct = Math.round(value * 100)
  const tone = pct >= 90 ? 'bg-success' : pct >= 75 ? 'bg-accent' : 'bg-warning'
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-1.5 w-full min-w-12 overflow-hidden rounded-full bg-ink/[0.07]"
        role="meter"
        aria-label="Confidence"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div className={cn('h-full rounded-full', tone)} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      {showLabel && <span className="w-10 shrink-0 text-right font-mono text-[12px] text-ink-2">{pct}%</span>}
    </div>
  )
}

export function ProgressRing({ value, size = 44 }: { value: number; size?: number }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value}% complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-ink/[0.08]" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        className={value === 100 ? 'stroke-success' : 'stroke-accent'}
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - value / 100) }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-ink font-mono text-[11px]">
        {value}%
      </text>
    </svg>
  )
}

export function SourceChip({ source, onClick }: { source: string | null; onClick?: () => void }) {
  const content = (
    <>
      <FileText className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{source ?? 'Entered by you'}</span>
    </>
  )
  const cls = 'inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-canvas px-2 py-0.5 font-mono text-[12px] text-ink-2'
  if (onClick && source) {
    return (
      <button type="button" onClick={onClick} className={cn(cls, 'hover:border-accent-line hover:text-accent')} aria-label={`View source ${source}`}>
        {content}
      </button>
    )
  }
  return <span className={cls}>{content}</span>
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-panel)] border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-sunken text-ink-2">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-4 text-[16px] font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-[14px] text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Error with a message, the reason, and a recovery action. */
export function ErrorPanel({ error, onRetry, onSignIn, onChooseFile }: { error: WorkspaceError; onRetry?: () => void; onSignIn?: () => void; onChooseFile?: () => void }) {
  const action =
    error.action === 'signin' && onSignIn ? (
      <Button size="sm" onClick={onSignIn}>
        Sign in again
      </Button>
    ) : error.action === 'choose_file' && onChooseFile ? (
      <Button size="sm" variant="secondary" onClick={onChooseFile}>
        Choose another file
      </Button>
    ) : onRetry ? (
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    ) : null
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-danger-line bg-danger-soft p-4 sm:flex-row sm:items-center">
      <XCircle className="size-5 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-ink">{error.message}</p>
        <p className="text-[14px] text-ink-2">{error.reason}</p>
      </div>
      {action}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />
}

/** Slide-over panel with Escape to close and focus moved inside. */
export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.div className="absolute inset-0 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col bg-surface shadow-[var(--shadow-panel)] outline-none"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
              <h2 className="truncate text-[17px] font-semibold text-ink">{title}</h2>
              <button type="button" onClick={onClose} className="inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] text-subtle hover:bg-sunken hover:text-ink" aria-label="Close">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
            {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
