import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity as ActivityIcon,
  Archive,
  Bell,
  ClipboardList,
  FileText,
  GitCompareArrows,
  Globe,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  User,
  X,
} from 'lucide-react'
import { LogoMark } from '../components/ui/Logo'
import { useAuth } from '../hooks/useAuth'
import { cn } from '../lib/utils'
import { useWorkspace } from './workspace'
import { ErrorPanel, Skeleton } from './ui'
import { HelpPanel } from './HelpPanel'

const NAV = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/vault', label: 'Application Vault', icon: Archive },
  { to: '/profile', label: 'Master Profile', icon: User },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/applications', label: 'Applications', icon: ClipboardList },
  { to: '/mapping', label: 'Field Mapping', icon: GitCompareArrows },
  { to: '/validation', label: 'Validation', icon: ShieldCheck },
  { to: '/anywhere', label: 'Use Anywhere', icon: Globe },
  { to: '/activity', label: 'Activity', icon: ActivityIcon },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function SidebarContent({ onNavigate, onHelp }: { onNavigate?: () => void; onHelp: () => void }) {
  const { data, close } = useWorkspace()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const issues = data?.applications.filter((a) => a.status === 'needs_review').length ?? 0

  return (
    <div className="flex h-full flex-col">
      <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5 px-3 py-1" aria-label="FormPilot overview">
        <LogoMark />
        <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">FormPilot</span>
      </Link>

      <nav aria-label="Product" className="mt-6">
        <ul className="space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-[14px] transition-colors',
                    isActive ? 'bg-panel font-medium text-accent' : 'text-muted hover:bg-panel/60 hover:text-ink',
                  )
                }
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
                {to === '/applications' && issues > 0 && (
                  <span className="ml-auto rounded-full bg-highlight px-1.5 text-[11px] font-semibold text-ink" aria-label={`${issues} need attention`}>
                    {issues}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto space-y-1 pt-6">
        <button
          type="button"
          onClick={onHelp}
          className="flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-[14px] text-muted hover:bg-ink/[0.04] hover:text-ink"
        >
          <HelpCircle className="size-4" aria-hidden />
          Help &amp; Support
        </button>
        {data && (
          <div className="mt-2 flex items-center gap-3 rounded-[var(--radius-control)] border border-line bg-surface p-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent">{initials(data.user.name)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{data.user.name}</p>
              <p className="truncate text-[12px] text-subtle">{data.user.email}</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                // Leave the app first; clearing the user while still inside it would redirect to /login.
                navigate('/', { replace: true })
                await signOut()
                close()
              }}
              className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] text-subtle hover:bg-sunken hover:text-ink"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SearchBox() {
  const { data } = useWorkspace()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    if (!data || q.trim().length < 2) return []
    const term = q.toLowerCase()
    const out: { label: string; hint: string; to: string }[] = []
    for (const a of data.applications)
      if (`${a.title} ${a.organization}`.toLowerCase().includes(term)) out.push({ label: a.title, hint: `Application · ${a.organization}`, to: `/applications/${a.id}` })
    for (const d of data.documents) if (d.name.toLowerCase().includes(term)) out.push({ label: d.name, hint: `Document · ${d.category}`, to: `/documents?doc=${d.id}` })
    for (const f of data.profile)
      if (`${f.label} ${f.value}`.toLowerCase().includes(term)) out.push({ label: f.label, hint: f.value || 'Missing', to: '/profile' })
    return out.slice(0, 8)
  }, [data, q])

  const go = (to: string) => {
    navigate(to)
    setQ('')
    setOpen(false)
  }

  return (
    <div className="relative w-full max-w-[420px]">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) go(results[0].to)
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Search applications, documents, profile"
        aria-label="Search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="search-results"
        className="h-10 w-full rounded-[var(--radius-control)] border border-line bg-canvas pr-3 pl-9 text-[14px] text-ink outline-none placeholder:text-subtle focus:border-accent focus:bg-surface"
      />
      {open && q.trim().length >= 2 && (
        <ul id="search-results" role="listbox" className="absolute top-12 right-0 left-0 z-50 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface py-1 shadow-[var(--shadow-panel)]">
          {results.length === 0 ? (
            <li className="px-4 py-3 text-[14px] text-muted">No results for “{q}”</li>
          ) : (
            results.map((r) => (
              <li key={`${r.to}-${r.label}`} role="option" aria-selected={false}>
                <button type="button" onMouseDown={() => go(r.to)} className="flex w-full flex-col px-4 py-2 text-left hover:bg-canvas">
                  <span className="text-[14px] text-ink">{r.label}</span>
                  <span className="truncate text-[12px] text-subtle">{r.hint}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

function Notifications() {
  const { data } = useWorkspace()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const items = useMemo(() => {
    if (!data) return []
    const list: { title: string; detail: string; to: string }[] = []
    for (const a of data.applications.filter((x) => x.status === 'needs_review'))
      list.push({ title: `${a.title} needs attention`, detail: `${a.fields.filter((f) => f.status === 'conflict' || (f.status === 'missing' && f.required)).length} issues to resolve`, to: `/validation?app=${a.id}` })
    for (const d of data.documents.filter((x) => x.status === 'needs_review')) list.push({ title: `${d.name} needs review`, detail: d.message ?? 'Check the extracted details', to: `/documents?doc=${d.id}` })
    return list
  }, [data])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Notifications${items.length ? `, ${items.length} new` : ''}`}
        className="relative inline-flex size-10 items-center justify-center rounded-[var(--radius-control)] text-ink-2 hover:bg-sunken"
      >
        <Bell className="size-[18px]" aria-hidden />
        {items.length > 0 && <span className="absolute top-2 right-2 size-2 rounded-full bg-danger ring-2 ring-surface" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-[var(--shadow-panel)]"
          >
            <p className="border-b border-line px-4 py-3 text-[14px] font-medium text-ink">Notifications</p>
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-[14px] text-muted">You’re all caught up.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {items.map((n) => (
                  <li key={n.title}>
                    <Link to={n.to} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-canvas">
                      <p className="text-[14px] text-ink">{n.title}</p>
                      <p className="truncate text-[13px] text-subtle">{n.detail}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function AppLayout() {
  const { data, loading, error, open, reload, close } = useWorkspace()
  const { user, loading: authLoading } = useAuth()
  const [mobileNav, setMobileNav] = useState(false)
  const [guide, setGuide] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // Load the signed-in user's workspace.
  useEffect(() => {
    if (user) open(user)
  }, [user, open])

  useEffect(() => setMobileNav(false), [location.pathname])

  useEffect(() => {
    if (!mobileNav) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMobileNav(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [mobileNav])

  if (authLoading) return <AppSkeleton />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />

  let body: ReactNode
  if (error && !data) {
    body = (
      <ErrorPanel
        error={error}
        onRetry={() => void reload()}
        onSignIn={() => {
          close()
          navigate('/login')
        }}
      />
    )
  } else if (loading || !data) {
    body = <PageSkeleton />
  } else {
    body = (
      <>
        {error && (
          <div className="mb-6">
            <ErrorPanel
              error={error}
              onRetry={() => void reload()}
              onSignIn={() => {
                close()
                navigate('/login')
              }}
            />
          </div>
        )}
        <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
          <Outlet />
        </motion.div>
      </>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <a href="#app-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[80] focus:rounded-[var(--radius-control)] focus:bg-surface focus:px-3 focus:py-2 focus:text-sm">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-surface px-3 py-5 lg:block">
        <SidebarContent onHelp={() => setGuide(true)} />
      </aside>

      {/* Mobile navigation */}
      <AnimatePresence>
        {mobileNav && (
          <div className="fixed inset-0 z-[60] lg:hidden">
            <motion.div className="absolute inset-0 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileNav(false)} />
            <motion.aside
              aria-label="Navigation"
              className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-surface px-3 py-5 shadow-[var(--shadow-panel)]"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                type="button"
                onClick={() => setMobileNav(false)}
                className="absolute top-4 right-3 inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] text-subtle hover:bg-sunken"
                aria-label="Close navigation"
              >
                <X className="size-5" aria-hidden />
              </button>
              <SidebarContent onNavigate={() => setMobileNav(false)} onHelp={() => setGuide(true)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur-sm">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileNav(true)}
              className="-ml-1 inline-flex size-10 items-center justify-center rounded-[var(--radius-control)] text-ink hover:bg-sunken lg:hidden"
              aria-label="Open navigation"
              aria-expanded={mobileNav}
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <Link to="/dashboard" className="lg:hidden" aria-label="FormPilot overview">
              <LogoMark className="size-7" />
            </Link>
            <div className="hidden min-w-0 flex-1 sm:block">
              <SearchBox />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Notifications />
              {data && (
                <Link to="/settings" className="flex size-9 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-white" aria-label="Account settings">
                  {initials(data.user.name)}
                </Link>
              )}
            </div>
          </div>
          <div className="px-4 pb-3 sm:hidden">
            <SearchBox />
          </div>
        </header>

        <main id="app-main" className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {body}
        </main>
      </div>

      <HelpPanel open={guide} onClose={() => setGuide(false)} />
    </div>
  )
}

function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-3 h-4 w-80" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="mt-6 h-72" />
    </div>
  )
}

function AppSkeleton() {
  return (
    <div className="min-h-dvh bg-canvas p-8">
      <PageSkeleton />
    </div>
  )
}
