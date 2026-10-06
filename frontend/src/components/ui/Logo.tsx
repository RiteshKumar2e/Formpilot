import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

/** Form lines being completed: three fields, the last one confirmed. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-7 shrink-0', className)}>
      <rect width="32" height="32" rx="7" fill="#2b45b8" />
      <path d="M9 11h14M9 16h10M9 21h6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="21.5" cy="21" r="2.6" fill="#a9d9bb" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('inline-flex items-center gap-2.5', className)} aria-label="FormPilot home">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">FormPilot</span>
    </Link>
  )
}
