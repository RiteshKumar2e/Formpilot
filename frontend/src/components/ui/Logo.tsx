import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

/** Form lines being completed: three fields, the last one confirmed. */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  // Inverted: white tile with navy lines, for use on navy backgrounds.
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-7 shrink-0', className)}>
      <rect width="32" height="32" rx="7" fill={inverted ? '#ffffff' : '#0e0e62'} />
      <path d="M9 11h14M9 16h10M9 21h6" stroke={inverted ? '#0e0e62' : '#fff'} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="21.5" cy="21" r="2.6" fill="#ffc72c" />
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
