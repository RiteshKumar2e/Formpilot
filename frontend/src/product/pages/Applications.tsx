import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ClipboardList, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { usePageMeta } from '../../hooks/usePageMeta'
import { cn } from '../../lib/utils'
import { useWorkspace } from '../workspace'
import { STATUS_LABEL, summary, timeAgo } from '../selectors'
import type { ApplicationStatus } from '../types'
import { ApplicationStatusBadge, Card, EmptyState, PageHeader, ProgressRing } from '../ui'

const FILTERS: { id: ApplicationStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'processing', label: 'Processing' },
  { id: 'needs_review', label: 'Needs Review' },
  { id: 'ready', label: 'Ready' },
  { id: 'prepared', label: 'Completed' },
]

export function ApplicationsPage() {
  usePageMeta({ title: 'Applications', path: '/applications' })
  const { data, mode } = useWorkspace()
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all')
  if (!data) return null
  const apps = [...data.applications].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const shown = filter === 'all' ? apps : apps.filter((a) => a.status === filter)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description="Every application is prepared from your profile and waits for your approval."
        actions={
          <Button to="/applications/new">
            <Plus className="size-4" aria-hidden />
            New Application
          </Button>
        }
      />

      <div role="tablist" aria-label="Filter applications" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const count = f.id === 'all' ? apps.length : apps.filter((a) => a.status === f.id).length
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[13px] transition-colors',
                filter === f.id ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-2 hover:border-line-strong',
              )}
            >
              {f.label} <span className={filter === f.id ? 'text-white/70' : 'text-subtle'}>{count}</span>
            </button>
          )
        })}
      </div>

      {apps.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No applications yet." description="Create your first application." action={<Button to="/applications/new">Create Application</Button>} />
      ) : shown.length === 0 ? (
        <EmptyState icon={ClipboardList} title={`No ${STATUS_LABEL[filter as ApplicationStatus]?.toLowerCase() ?? ''} applications.`} description="Try another filter." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((app) => {
            const s = summary(app)
            const mapped = app.fields.filter((f) => f.value).length
            return (
              <li key={app.id}>
                <Card className="flex h-full flex-col p-5 transition-shadow hover:shadow-[var(--shadow-raised)]">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <Link to={`/applications/${app.id}`} className="text-[16px] font-semibold text-ink hover:text-accent">
                        {app.title}
                      </Link>
                      <p className="truncate text-[13px] text-subtle">{app.organization}</p>
                      <div className="mt-2">
                        <ApplicationStatusBadge status={app.status} />
                      </div>
                    </div>
                    <ProgressRing value={s.progress} size={52} />
                  </div>
                  <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-[13px]">
                    <div>
                      <dt className="text-subtle">Fields mapped</dt>
                      <dd className="font-medium text-ink">
                        {mapped}/{s.total}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Issues</dt>
                      <dd className={cn('flex items-center gap-1 font-medium', s.issues.length && app.status !== 'prepared' ? 'text-warning' : 'text-ink')}>
                        {s.issues.length > 0 && app.status !== 'prepared' && <AlertTriangle className="size-3.5" aria-hidden />}
                        {app.status === 'prepared' ? 0 : s.issues.length}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Updated</dt>
                      <dd className="font-medium text-ink">{timeAgo(app.updatedAt)}</dd>
                    </div>
                  </dl>
                  <div className="mt-5 flex gap-2">
                    <Button to={`/applications/${app.id}`} variant="secondary" size="sm" className="flex-1">
                      Open
                    </Button>
                    {app.status === 'prepared' ? (
                      <Button to={`/applications/${app.id}/review`} size="sm" className="flex-1">
                        View
                      </Button>
                    ) : app.status === 'ready' ? (
                      <Button to={`/applications/${app.id}/review`} size="sm" className="flex-1">
                        Review
                      </Button>
                    ) : (
                      <Button to={`/validation?app=${app.id}`} size="sm" className="flex-1">
                        Continue
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
      {mode === 'account' && <p className="text-[13px] text-subtle">Applications are saved in this browser until the applications API is available.</p>}
    </div>
  )
}
