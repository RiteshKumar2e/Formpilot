// A deliberately small icon set. Icons appear only where they clarify an action.

type IconProps = { className?: string }

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} {...stroke}>
      <path d="M3 6h14M3 14h14" />
    </svg>
  )
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} {...stroke}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  )
}

export function UploadIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} {...stroke}>
      <path d="M10 13V3.5M6 7l4-3.5L14 7M3.5 13v2.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V13" />
    </svg>
  )
}

export function FileIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} {...stroke}>
      <path d="M11.5 2.5H5.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-10l-4-4Z" />
      <path d="M11.5 2.5v4h4" />
    </svg>
  )
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} {...stroke}>
      <path d="M3.5 5.5h13M8 5.5V4h4v1.5M5.5 5.5l.7 10.6a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.7-10.6" />
    </svg>
  )
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} {...stroke}>
      <path d="M6 8l4 4 4-4" />
    </svg>
  )
}

export function GitHubIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

export function LinkedInIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  )
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} {...stroke}>
      <path d="M1.8 10S4.8 4.5 10 4.5 18.2 10 18.2 10 15.2 15.5 10 15.5 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.6" />
    </svg>
  )
}

export function EyeOffIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} {...stroke}>
      <path d="M8.2 4.7A8.6 8.6 0 0 1 10 4.5c5.2 0 8.2 5.5 8.2 5.5a14.6 14.6 0 0 1-2.4 3M5.4 6.1C3 7.7 1.8 10 1.8 10S4.8 15.5 10 15.5a8.3 8.3 0 0 0 4.1-1.1" />
      <path d="M8.2 8.2a2.6 2.6 0 0 0 3.6 3.6M3 3l14 14" />
    </svg>
  )
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className} {...stroke}>
      <path d="M16 10H4M9 5l-5 5 5 5" />
    </svg>
  )
}
