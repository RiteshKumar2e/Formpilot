/** Joins class names, skipping falsy values. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(value.trim())) return 'Enter a valid email address, like name@example.com.'
  return undefined
}

export function validateRequired(value: string, label: string): string | undefined {
  return value.trim() ? undefined : `Enter your ${label.toLowerCase()}.`
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'Enter a password.'
  if (value.length < 6) return 'Use at least 6 characters.'
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return 'Include at least one letter and one number.'
  return undefined
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
