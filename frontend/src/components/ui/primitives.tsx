import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1180px] px-4 sm:px-6 lg:px-8', className)}>{children}</div>
}

export function Section({
  id,
  className,
  children,
  labelledBy,
}: {
  id?: string
  className?: string
  children: ReactNode
  labelledBy?: string
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn('py-24 sm:py-28 lg:py-36', className)}>
      {children}
    </section>
  )
}

export function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  align = 'left',
  className,
}: {
  id: string
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <div className={cn('max-w-[640px]', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 id={id} className="heading text-[32px] text-ink sm:text-[40px] lg:text-[46px]">
        {title}
      </h2>
      {description && <p className="mt-5 text-[18px] leading-relaxed text-muted text-pretty">{description}</p>}
    </div>
  )
}

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const toneText: Record<Tone, string> = {
  neutral: 'text-muted',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

const toneDot: Record<Tone, string> = {
  neutral: 'bg-subtle',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

/** Status shown as a colored dot plus text. */
export function Status({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium whitespace-nowrap', toneText[tone], className)}>
      <span aria-hidden className={cn('size-1.5 rounded-full', toneDot[tone])} />
      {children}
    </span>
  )
}

export function ProgressBar({
  value,
  tone = 'accent',
  label,
  className,
}: {
  value: number
  tone?: 'accent' | 'success' | 'warning'
  label: string
  className?: string
}) {
  const fill = { accent: 'bg-accent', success: 'bg-success', warning: 'bg-warning' }[tone]
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1 w-full overflow-hidden rounded-full bg-ink/[0.08]', className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', fill)} style={{ width: `${value}%` }} />
    </div>
  )
}
