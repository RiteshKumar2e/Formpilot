import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FileText, Inbox, LayoutDashboard, LogOut, Menu, RefreshCw, Users, Workflow, X } from 'lucide-react'
import { LogoMark } from '../components/ui/Logo'
import { useAuth } from '../hooks/useAuth'
import { api, ApiError } from '../lib/api'
import { cn } from '../lib/utils'
import type { AdminDocument, AdminMessage, AdminOverview, AdminRun, AdminUser } from '../types/api'

export interface AdminData {
  overview: AdminOverview
  users: AdminUser[]
  documents: AdminDocument[]
  activity: AdminRun[]
  messages: AdminMessage[]
}

interface AdminState {
  data: AdminData | null
  error: string | null
  loading: boolean
  reload: () => Promise<void>
}

const AdminContext = createContext<AdminState | null>(null)

export function useAdmin(): AdminState {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used inside <AdminLayout>')
  return ctx
}

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/documents', label: 'Documents', icon: FileText },
  { to: '/admin/activity', label: 'Activity', icon: Workflow },
  { to: '/admin/messages', label: 'Messages', icon: Inbox },
] as const

/** The admin panel: its own shell, separate from the user app. Only ADMIN_EMAILS accounts get in. */
export function AdminLayout() {
  const { user, loading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [data, setData] = useState<AdminData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [overview, users, documents, activity, messages] = await Promise.all([
        api.admin.overview(),
        api.admin.users(),
        api.admin.documents(),
        api.admin.activity(),
        api.admin.messages(),
      ])
      setData({ overview, users, documents, activity, messages })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t load the admin data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.is_admin) void reload()
  }, [user?.is_admin, reload])

  useEffect(() => setMobileNav(false), [location.pathname])

  if (authLoading) return <div className="min-h-dvh bg-canvas" aria-busy="true" />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  if (!user.is_admin) return <Navigate to="/dashboard" replace />

  const logout = async () => {
    navigate('/', { replace: true })
    await signOut()
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/admin" className="flex items-center gap-2.5 px-3 py-1">
        <LogoMark />
        <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">FormPilot</span>
        <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white">ADMIN</span>
      </Link>
      <nav aria-label="Admin" className="mt-6">
        <ul className="space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, ...rest }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={'end' in rest}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-[14px] transition-colors',
                    isActive ? 'bg-panel font-medium text-accent' : 'text-muted hover:bg-panel/60 hover:text-ink',
                  )
                }
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
                {label === 'Users' && data && <span className="ml-auto text-[12px] tabular-nums text-subtle">{data.overview.totals.users}</span>}
                {label === 'Messages' && data && data.messages.length > 0 && (
                  <span className="ml-auto rounded-full bg-highlight px-1.5 text-[11px] font-semibold text-ink">{data.messages.length}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto flex items-center gap-3 rounded-[var(--radius-control)] border border-line bg-surface p-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-white">A</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink">Administrator</p>
          <p className="truncate text-[12px] text-subtle">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] text-subtle hover:bg-sunken hover:text-ink"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )

  return (
    <AdminContext.Provider value={{ data, error, loading, reload }}>
      <div className="min-h-dvh bg-canvas">
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-sunken/40 px-3 py-5 lg:block">{sidebar}</aside>
        {mobileNav && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" className="absolute inset-0 bg-ink/30" aria-label="Close menu" onClick={() => setMobileNav(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 bg-canvas px-3 py-5 shadow-xl">{sidebar}</aside>
          </div>
        )}
        <div className="lg:pl-64">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur sm:px-6">
            <button
              type="button"
              onClick={() => setMobileNav((v) => !v)}
              className="inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-sunken lg:hidden"
              aria-label="Menu"
            >
              {mobileNav ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
            <p className="text-[14px] text-muted">
              Admin panel{data && <span className="text-subtle"> · {data.overview.database} · {data.overview.vector_store.name}</span>}
            </p>
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading}
              className="ml-auto inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[13px] text-ink-2 hover:border-accent hover:text-accent disabled:opacity-50"
            >
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} aria-hidden />
              Refresh
            </button>
          </header>
          <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
            {error && <p role="alert" className="mb-4 rounded-[var(--radius-control)] border border-danger-line bg-danger-soft p-3 text-[14px] text-danger">{error}</p>}
            <Outlet />
          </main>
        </div>
      </div>
    </AdminContext.Provider>
  )
}
