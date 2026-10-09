import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Database, FileText, Inbox, Mail, Puzzle, Search, Users, Workflow, type LucideIcon } from 'lucide-react'
import { usePageMeta } from '../hooks/usePageMeta'
import { api, ApiError } from '../lib/api'
import { cn } from '../lib/utils'
import type { AdminOverview, AdminUserDetail } from '../types/api'
import { formatDateTime, timeAgo } from '../product/selectors'
import { Badge, Card, Skeleton } from '../product/ui'
import { useAdmin } from './AdminLayout'

// --- Shared pieces ----------------------------------------------------------------------------------

function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

const date = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

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

function Title({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        {description && <p className="mt-1 text-[14px] text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  )
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block sm:w-72">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-[var(--radius-control)] border border-line bg-surface pr-3 pl-9 text-[14px] text-ink outline-none focus:border-accent"
      />
    </label>
  )
}

function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty: boolean }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="bg-sunken/60">
            <tr className="text-[12px] text-subtle">
              {head.map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">{children}</tbody>
        </table>
      </div>
      {empty && <p className="px-4 py-10 text-center text-[14px] text-subtle">Nothing here yet.</p>}
    </Card>
  )
}

const td = 'px-4 py-3 align-middle text-ink-2'

function Loading() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-11" />
      ))}
    </div>
  )
}

function useFilter<T>(items: T[] | undefined, text: (item: T) => (string | null | undefined)[]) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => (items ?? []).filter((item) => !q || text(item).some((v) => v?.toLowerCase().includes(q))), [items, q, text])
  return { query, setQuery, filtered }
}

// --- Overview ---------------------------------------------------------------------------------------

function Stat({ icon: Icon, label, value, hint, to }: { icon: LucideIcon; label: string; value: string | number; hint?: string; to?: string }) {
  const body = (
    <Card className={cn('h-full p-4', to && 'transition-colors hover:border-accent')}>
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <Icon className="size-4 text-accent" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[12px] text-subtle">{hint}</p>}
    </Card>
  )
  return to ? <Link to={to}>{body}</Link> : body
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
              <span className="w-24 shrink-0 truncate capitalize text-ink-2">{status.replace(/_/g, ' ')}</span>
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
        New users, last 14 days <span className="font-normal text-subtle">· {total}</span>
      </p>
      <div className="mt-3 flex h-32 items-end gap-1" role="img" aria-label={`${total} sign-ups in the last 14 days`}>
        {days.map((d) => (
          <div key={d.date} className="flex h-full flex-1 flex-col justify-end">
            <div
              className={cn('rounded-t-[3px]', d.count ? 'bg-accent' : 'bg-sunken')}
              style={{ height: d.count ? `${Math.max(8, (d.count / max) * 100)}%` : '4px' }}
              title={`${date(d.date)}: ${d.count}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-subtle">
        <span>{days[0] && date(days[0].date)}</span>
        <span>Today</span>
      </div>
    </div>
  )
}

export function AdminOverviewPage() {
  usePageMeta({ title: 'Admin', path: '/admin' })
  const { data } = useAdmin()
  const o = data?.overview
  return (
    <>
      <Title title="Overview" description="Everything in the FormPilot database at a glance." />
      {!o || !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[110px]" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat icon={Users} label="Total users" value={o.totals.users} hint={`${o.signups.at(-1)?.count ?? 0} joined today`} to="/admin/users" />
            <Stat icon={FileText} label="Documents" value={o.totals.documents} hint={`${bytes(o.totals.storage_bytes)} stored`} to="/admin/documents" />
            <Stat icon={Workflow} label="Applications" value={o.totals.applications} hint={`${o.totals.templates} templates · ${o.totals.saved_answers} saved answers`} />
            <Stat icon={Puzzle} label="Extensions connected" value={o.totals.extensions_connected} />
            <Stat icon={Database} label="Profile details" value={o.totals.extracted_fields} hint={o.database} />
            <Stat icon={Database} label="Vector points" value={o.vector_store.points ?? '—'} hint={o.vector_store.error ?? o.vector_store.collection} />
            <Stat icon={Workflow} label="Workflow runs" value={o.totals.workflow_runs} to="/admin/activity" />
            <Stat icon={Inbox} label="Contact messages" value={o.totals.contact_messages} to="/admin/messages" />
          </div>

          <Card className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
            <Signups days={o.signups} />
            <Breakdown title="Documents" counts={o.documents_by_status} />
            <Breakdown title="Applications" counts={o.applications_by_status} />
            <Breakdown title="Workflow runs" counts={o.workflows_by_status} />
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-[15px] font-semibold text-ink">Newest users</h2>
              <Link to="/admin/users" className="text-[13px] text-accent hover:underline">
                View all
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {data.users.slice(0, 5).map((u) => (
                <li key={u.id}>
                  <Link to={`/admin/users/${u.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-sunken/50">
                    <Avatar name={u.full_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-ink">{u.full_name}</p>
                      <p className="truncate text-[13px] text-muted">{u.email}</p>
                    </div>
                    <span className="text-[12px] text-subtle">{timeAgo(u.created_at)}</span>
                    <ChevronRight className="size-4 text-subtle" aria-hidden />
                  </Link>
                </li>
              ))}
              {data.users.length === 0 && <li className="px-5 py-8 text-center text-[14px] text-subtle">No users yet.</li>}
            </ul>
          </Card>
        </div>
      )}
    </>
  )
}

// --- Users ------------------------------------------------------------------------------------------

function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent', large ? 'size-14 text-[18px]' : 'size-9 text-[12px]')}>
      {initials || '?'}
    </span>
  )
}

const userText = (u: { full_name: string; email: string }) => [u.full_name, u.email]

export function AdminUsersPage() {
  usePageMeta({ title: 'Users · Admin', path: '/admin/users' })
  const { data } = useAdmin()
  const navigate = useNavigate()
  const { query, setQuery, filtered } = useFilter(data?.users, userText)
  return (
    <>
      <Title
        title="Users"
        description={data ? `${data.users.length} registered accounts. Click a user to see their details.` : undefined}
        actions={<SearchBox value={query} onChange={setQuery} placeholder="Search name or email" />}
      />
      {!data ? (
        <Loading />
      ) : (
        <Table head={['#', 'User', 'Joined', 'Documents', 'Applications', 'Answers', 'Extension', 'Last active']} empty={filtered.length === 0}>
          {filtered.map((u, i) => (
            <tr key={u.id} onClick={() => navigate(`/admin/users/${u.id}`)} className="cursor-pointer hover:bg-sunken/50">
              <td className={cn(td, 'w-10 tabular-nums text-subtle')}>{i + 1}</td>
              <td className={td}>
                <div className="flex items-center gap-3">
                  <Avatar name={u.full_name} />
                  <div className="min-w-0">
                    <Link to={`/admin/users/${u.id}`} className="block truncate font-medium text-ink hover:text-accent" onClick={(e) => e.stopPropagation()}>
                      {u.full_name}
                    </Link>
                    <p className="truncate text-[12px] text-muted">{u.email}</p>
                  </div>
                </div>
              </td>
              <td className={td} title={formatDateTime(u.created_at)}>{date(u.created_at)}</td>
              <td className={cn(td, 'tabular-nums')}>{u.documents}</td>
              <td className={cn(td, 'tabular-nums')}>{u.applications}</td>
              <td className={cn(td, 'tabular-nums')}>{u.saved_answers}</td>
              <td className={td}>{u.extension ? <Badge tone="success">Connected</Badge> : <span className="text-subtle">—</span>}</td>
              <td className={td}>{u.last_active ? timeAgo(u.last_active) : <span className="text-subtle">Never</span>}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  )
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-subtle">{label}</dt>
      <dd className="mt-0.5 text-[14px] break-words text-ink">{value}</dd>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <Card>
      <h2 className="border-b border-line px-5 py-3 text-[15px] font-semibold text-ink">
        {title} <span className="font-normal text-subtle">· {count}</span>
      </h2>
      {count === 0 ? <p className="px-5 py-6 text-[14px] text-subtle">None.</p> : <ul className="divide-y divide-line">{children}</ul>}
    </Card>
  )
}

export function AdminUserDetailPage() {
  const { id = '' } = useParams()
  const [user, setUser] = useState<AdminUserDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  usePageMeta({ title: `${user?.full_name ?? 'User'} · Admin`, path: `/admin/users/${id}` })

  useEffect(() => {
    setUser(null)
    setError(null)
    api.admin.user(id).then(setUser, (err) => setError(err instanceof ApiError ? err.message : 'Couldn’t load this user.'))
  }, [id])

  return (
    <>
      <Link to="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-accent">
        <ArrowLeft className="size-4" aria-hidden />
        All users
      </Link>
      {error ? (
        <p className="text-[14px] text-danger">{error}</p>
      ) : !user ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar name={user.full_name} large />
              <div className="min-w-0 flex-1">
                <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">{user.full_name}</h1>
                <a href={`mailto:${user.email}`} className="inline-flex items-center gap-1.5 text-[14px] text-accent hover:underline">
                  <Mail className="size-4" aria-hidden />
                  {user.email}
                </a>
              </div>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
              <Info label="User ID" value={<span className="font-mono text-[12px]">{user.id}</span>} />
              <Info label="Joined" value={formatDateTime(user.created_at)} />
              <Info label="Sign-in method" value={user.sign_in} />
              <Info label="Password last changed" value={user.password_changed_at ? formatDateTime(user.password_changed_at) : 'Never'} />
              <Info label="Profile details" value={user.profile_details} />
              <Info label="Documents" value={user.documents.length} />
              <Info label="Applications" value={user.applications.length} />
              <Info label="Saved answers · templates" value={`${user.saved_answers} · ${user.templates}`} />
            </dl>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Documents" count={user.documents.length}>
              {user.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <FileText className="size-4 shrink-0 text-accent" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{d.filename}</p>
                    <p className="text-[12px] text-subtle">
                      {bytes(d.size_bytes)}
                      {d.page_count ? ` · ${d.page_count} pages` : ''} · {date(d.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </Section>

            <Section title="Applications" count={user.applications.length}>
              {user.applications.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{a.title || 'Untitled'}</p>
                    <p className="text-[12px] text-subtle">
                      {a.organization ? `${a.organization} · ` : ''}
                      {a.fields} fields · updated {timeAgo(a.updated_at)}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </Section>

            <Section title="Browser extension" count={user.extensions.length}>
              {user.extensions.map((t, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <Puzzle className="size-4 shrink-0 text-accent" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{t.name}</p>
                    <p className="text-[12px] text-subtle">
                      Connected {date(t.created_at)} · {t.last_used_at ? `used ${timeAgo(t.last_used_at)}` : 'not used yet'}
                    </p>
                  </div>
                  {t.active ? <Badge tone="success">Active</Badge> : <Badge>Disconnected</Badge>}
                </li>
              ))}
            </Section>

            <Section title="Recent activity" count={user.runs.length}>
              {user.runs.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">{r.workflow}</span>
                  <span className="text-[12px] text-subtle">{timeAgo(r.started_at)}</span>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </Section>
          </div>
          <p className="text-[12px] text-subtle">Profile values, answers and document text are encrypted and aren’t shown in the admin panel.</p>
        </div>
      )}
    </>
  )
}

// --- Documents, activity, messages -----------------------------------------------------------------

const docText = (d: { filename: string; owner: string; status: string }) => [d.filename, d.owner, d.status]

export function AdminDocumentsPage() {
  usePageMeta({ title: 'Documents · Admin', path: '/admin/documents' })
  const { data } = useAdmin()
  const { query, setQuery, filtered } = useFilter(data?.documents, docText)
  return (
    <>
      <Title title="Documents" description="Every file users uploaded, newest first." actions={<SearchBox value={query} onChange={setQuery} placeholder="Search file, owner or status" />} />
      {!data ? (
        <Loading />
      ) : (
        <Table head={['File', 'Owner', 'Type', 'Size', 'Pages', 'Status', 'Uploaded']} empty={filtered.length === 0}>
          {filtered.map((d) => (
            <tr key={d.id}>
              <td className={cn(td, 'max-w-[260px] truncate font-medium text-ink')} title={d.filename}>{d.filename}</td>
              <td className={td}>{d.owner}</td>
              <td className={cn(td, 'text-[12px] text-subtle')}>{d.content_type.split('/').pop()}</td>
              <td className={cn(td, 'tabular-nums')}>{bytes(d.size_bytes)}</td>
              <td className={cn(td, 'tabular-nums')}>{d.page_count ?? '—'}</td>
              <td className={td}><StatusBadge status={d.status} /></td>
              <td className={td} title={formatDateTime(d.created_at)}>{timeAgo(d.created_at)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  )
}

const runText = (r: { workflow: string; user: string; status: string }) => [r.workflow, r.user, r.status]

export function AdminActivityPage() {
  usePageMeta({ title: 'Activity · Admin', path: '/admin/activity' })
  const { data } = useAdmin()
  const { query, setQuery, filtered } = useFilter(data?.activity, runText)
  return (
    <>
      <Title
        title="Activity"
        description="Workflow runs: document processing, form mapping and extension autofill."
        actions={<SearchBox value={query} onChange={setQuery} placeholder="Search workflow, user or status" />}
      />
      {!data ? (
        <Loading />
      ) : (
        <Table head={['Workflow', 'User', 'Status', 'Steps', 'Started', 'Duration']} empty={filtered.length === 0}>
          {filtered.map((r) => (
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
      )}
    </>
  )
}

const messageText = (m: { name: string; email: string; message: string }) => [m.name, m.email, m.message]

export function AdminMessagesPage() {
  usePageMeta({ title: 'Messages · Admin', path: '/admin/messages' })
  const { data } = useAdmin()
  const { query, setQuery, filtered } = useFilter(data?.messages, messageText)
  return (
    <>
      <Title title="Contact messages" description="Sent from the website’s Contact page." actions={<SearchBox value={query} onChange={setQuery} placeholder="Search messages" />} />
      {!data ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <Card className="px-5 py-10 text-center text-[14px] text-subtle">No messages yet.</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <Card key={m.id} className="p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-[15px] font-semibold text-ink">{m.name}</p>
                <a href={`mailto:${m.email}`} className="text-[13px] text-accent hover:underline">
                  {m.email}
                </a>
                <span className="ml-auto text-[12px] text-subtle" title={formatDateTime(m.created_at)}>
                  {timeAgo(m.created_at)}
                </span>
              </div>
              <p className="mt-2 text-[14px] whitespace-pre-line text-ink-2">{m.message}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
