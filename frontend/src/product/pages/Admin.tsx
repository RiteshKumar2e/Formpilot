import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Database, FileText, Inbox, Puzzle, RefreshCw, Search, Users, Workflow, type LucideIcon } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { usePageMeta } from '../../hooks/usePageMeta'
import { api, ApiError } from '../../lib/api'
import { cn } from '../../lib/utils'
import type { AdminDocument, AdminMessage, AdminOverview, AdminRun, AdminUser } from '../../types/api'
import { formatDateTime, timeAgo } from '../selectors'
import { Badge, Card, PageHeader, Skeleton } from '../ui'

type Tab = 'users' | 'documents' | 'activity' | 'messages'

interface AdminData {
  overview: AdminOverview
  users: AdminUser[]
  documents: AdminDocument[]
  activity: AdminRun[]
  messages: AdminMessage[]
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'accent' | 'neutral'> = {
  processed: 'success',
  succeeded: 'success',
  prepared: 'success',
  ready: 'accent',
  processing: 'accent',
  running: 'accent',
  needs_review: 'warning',
  failed: 'danger',
}

function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</Badge>
}

function Stat({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <Icon className="size-4 text-accent" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-[26px] font-semibold tracking-[-0.02em] text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[12px] text-subtle">{hint}</p>}
    </Card>
  )
}

function Breakdown({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((n, [, c]) => n + c, 0)
  return (
    <div>
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {total === 0 ? (
        <p className="mt-2 text-[13px] text-subtle">Nothing yet</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {entries.map(([status, count]) => (
            <li key={status} className="flex items-center gap-2 text-[13px]">
              <span className="w-28 shrink-0 truncate capitalize text-ink-2">{status.replace(/_/g, ' ')}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${(count / total) * 100}%` }} />
              </span>
              <span className="w-8 text-right tabular-nums text-muted">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Signups({ days }: { days: AdminOverview['signups'] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  const total = days.reduce((n, d) => n + d.count, 0)
  return (
    <div>
      <p className="text-[13px] font-medium text-ink">
        Sign-ups, last 14 days <span className="font-normal text-subtle">· {total}</span>
      </p>
      <div className="mt-3 flex h-28 items-end gap-1" role="img" aria-label={`${total} sign-ups in the last 14 days`}>
        {days.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end">
            <div
              className={cn('rounded-t-[3px]', d.count ? 'bg-accent' : 'bg-sunken')}
              style={{ height: d.count ? `${Math.max(8, (d.count / max) * 100)}%` : '4px' }}
              title={`${new Date(d.date).toLocaleDateString('en', { day: 'numeric', month: 'short' })}: ${d.count}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-subtle">
        <span>{new Date(days[0]?.date ?? Date.now()).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</span>
        <span>Today</span>
      </div>
    </div>
  )
}

function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-[12px] text-subtle">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-8 text-center text-[14px] text-subtle">Nothing here yet.</p>}
    </div>
  )
}

const td = 'px-4 py-2.5 align-top text-ink-2'

export function AdminPage() {
  usePageMeta({ title: 'Admin', path: '/admin' })
  const { user } = useAuth()
  const [data, setData] = useState<AdminData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('users')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
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
    if (user?.is_admin) void load()
  }, [user?.is_admin, load])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    const has = (...values: (string | null | undefined)[]) => !q || values.some((v) => v?.toLowerCase().includes(q))
    return {
      users: data?.users.filter((u) => has(u.full_name, u.email)) ?? [],
      documents: data?.documents.filter((d) => has(d.filename, d.owner, d.status)) ?? [],
      activity: data?.activity.filter((r) => has(r.workflow, r.user, r.status)) ?? [],
      messages: data?.messages.filter((m) => has(m.name, m.email, m.message)) ?? [],
    }
  }, [data, q])

  if (user && !user.is_admin) return <Navigate to="/dashboard" replace />

  const o = data?.overview
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'users', label: 'Users', count: data?.users.length },
    { id: 'documents', label: 'Documents', count: data?.documents.length },
    { id: 'activity', label: 'Workflow runs', count: data?.activity.length },
    { id: 'messages', label: 'Contact messages', count: data?.messages.length },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Badge tone="accent">Admin</Badge>}
        title="Admin dashboard"
        description="What’s in the FormPilot database. Read-only; personal details (profile values, answers, document text) stay encrypted and aren’t shown."
        actions={
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} aria-hidden />
            Refresh
          </Button>
        }
      />

      {error && (
        <Card className="border-danger-line bg-danger-soft p-4 text-[14px] text-danger" >
          {error}
        </Card>
      )}

      {!o ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[104px]" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat icon={Users} label="Users" value={o.totals.users} hint={`${o.signups.at(-1)?.count ?? 0} joined today`} />
            <Stat icon={FileText} label="Documents" value={o.totals.documents} hint={`${bytes(o.totals.storage_bytes)} stored`} />
            <Stat icon={Workflow} label="Applications" value={o.totals.applications} hint={`${o.totals.templates} templates · ${o.totals.saved_answers} saved answers`} />
            <Stat icon={Puzzle} label="Extensions connected" value={o.totals.extensions_connected} />
            <Stat icon={Database} label="Extracted fields" value={o.totals.extracted_fields} hint={o.database} />
            <Stat
              icon={Database}
              label="Vector points"
              value={o.vector_store.points ?? '—'}
              hint={o.vector_store.error ?? `${o.vector_store.name} · ${o.vector_store.collection}`}
            />
            <Stat icon={Workflow} label="Workflow runs" value={o.totals.workflow_runs} />
            <Stat icon={Inbox} label="Contact messages" value={o.totals.contact_messages} />
          </div>

          <Card className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <Signups days={o.signups} />
            <Breakdown title="Documents" counts={o.documents_by_status} />
            <Breakdown title="Applications" counts={o.applications_by_status} />
            <Breakdown title="Workflow runs" counts={o.workflows_by_status} />
          </Card>
        </>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'shrink-0 rounded-[var(--radius-control)] px-3 py-1.5 text-[13px] transition-colors',
                  tab === t.id ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-sunken hover:text-ink',
                )}
              >
                {t.label}
                {t.count !== undefined && <span className="ml-1.5 tabular-nums text-subtle">{t.count}</span>}
              </button>
            ))}
          </div>
          <label className="relative block sm:w-64">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-9 w-full rounded-[var(--radius-control)] border border-line bg-panel pr-3 pl-9 text-[14px] text-ink outline-none focus:border-accent"
            />
          </label>
        </div>

        {!data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : tab === 'users' ? (
          <Table head={['Name', 'Email', 'Joined', 'Documents', 'Applications', 'Answers', 'Extension', 'Last active']} empty={filtered.users.length === 0}>
            {filtered.users.map((u) => (
              <tr key={u.id}>
                <td className={cn(td, 'font-medium text-ink')}>{u.full_name}</td>
                <td className={td}>{u.email}</td>
                <td className={td} title={formatDateTime(u.created_at)}>{timeAgo(u.created_at)}</td>
                <td className={cn(td, 'tabular-nums')}>{u.documents}</td>
                <td className={cn(td, 'tabular-nums')}>{u.applications}</td>
                <td className={cn(td, 'tabular-nums')}>{u.saved_answers}</td>
                <td className={td}>{u.extension ? <Badge tone="success">Connected</Badge> : <span className="text-subtle">—</span>}</td>
                <td className={td}>{u.last_active ? timeAgo(u.last_active) : <span className="text-subtle">—</span>}</td>
              </tr>
            ))}
          </Table>
        ) : tab === 'documents' ? (
          <Table head={['File', 'Owner', 'Size', 'Pages', 'Status', 'Uploaded']} empty={filtered.documents.length === 0}>
            {filtered.documents.map((d) => (
              <tr key={d.id}>
                <td className={cn(td, 'max-w-[260px] truncate font-medium text-ink')} title={d.filename}>{d.filename}</td>
                <td className={td}>{d.owner}</td>
                <td className={cn(td, 'tabular-nums')}>{bytes(d.size_bytes)}</td>
                <td className={cn(td, 'tabular-nums')}>{d.page_count ?? '—'}</td>
                <td className={td}><StatusBadge status={d.status} /></td>
                <td className={td} title={formatDateTime(d.created_at)}>{timeAgo(d.created_at)}</td>
              </tr>
            ))}
          </Table>
        ) : tab === 'activity' ? (
          <Table head={['Workflow', 'User', 'Status', 'Steps', 'Started', 'Duration']} empty={filtered.activity.length === 0}>
            {filtered.activity.map((r) => (
              <tr key={r.id}>
                <td className={cn(td, 'font-mono text-[12px] text-ink')}>{r.workflow}</td>
                <td className={td}>{r.user}</td>
                <td className={td}><StatusBadge status={r.status} /></td>
                <td className={cn(td, 'tabular-nums')}>{r.steps}</td>
                <td className={td} title={formatDateTime(r.started_at)}>{timeAgo(r.started_at)}</td>
                <td className={cn(td, 'tabular-nums')}>
                  {r.finished_at ? `${((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000).toFixed(1)} s` : '—'}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Table head={['From', 'Email', 'Message', 'Received']} empty={filtered.messages.length === 0}>
            {filtered.messages.map((m) => (
              <tr key={m.id}>
                <td className={cn(td, 'font-medium text-ink')}>{m.name}</td>
                <td className={td}>
                  <a className="text-accent hover:underline" href={`mailto:${m.email}`}>
                    {m.email}
                  </a>
                </td>
                <td className={cn(td, 'max-w-[420px] whitespace-pre-line')}>{m.message}</td>
                <td className={td} title={formatDateTime(m.created_at)}>{timeAgo(m.created_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
