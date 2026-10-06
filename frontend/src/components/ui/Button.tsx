import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-field text-ink hover:border-ink/40',
  quiet: 'text-accent hover:text-accent-hover hover:underline underline-offset-4',
  danger: 'bg-danger text-white hover:bg-danger/90',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[14px]',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-12 px-6 text-[16px]',
}

interface CommonProps {
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined; href?: undefined }
type LinkProps = CommonProps & { to: string; href?: undefined; onClick?: () => void }
type AnchorProps = CommonProps & { href: string; to?: undefined; onClick?: () => void }

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  // Quiet buttons are text links: no fixed height or padding.
  return cn(base, variants[variant], variant === 'quiet' ? 'text-[15px]' : sizes[size], className)
}

export function Button(props: ButtonProps | LinkProps | AnchorProps) {
  const { variant = 'primary', size = 'md', className, children } = props
  const classes = buttonClasses(variant, size, className)

  if (props.to !== undefined) {
    return (
      <Link to={props.to} className={classes} onClick={props.onClick}>
        {children}
      </Link>
    )
  }
  if (props.href !== undefined) {
    return (
      <a href={props.href} className={classes} onClick={props.onClick}>
        {children}
      </a>
    )
  }
  const { variant: _v, size: _s, className: _c, children: _ch, type = 'button', ...rest } = props as ButtonProps
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
