import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, FilePlus2, FileText, FileUp, UserRoundCheck } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { usePageMeta } from '../../hooks/usePageMeta'
import { useWorkspace } from '../workspace'
import { needsReviewCount, profileCompleteness, progress, summary, timeAgo } from '../selectors'
import { ActivityIcon } from './Activity'
import { ApplicationStatusBadge, Card, EmptyState, PageHeader } from '../ui'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function Stat({ label, value, note, tone, to }: { label: string; value: string; note: string; tone?: 'warning'; to: string }) {
  return (
    <Link to={to} className="group block">
      <Card className="h-full p-5 transition-shadow group-hover:shadow-[var(--shadow-raised)]">
        <p className="text-[13px] text-muted">{label}</p>
        <p className={`mt-2 text-[30px] font-semibold tracking-[-0.03em] ${tone === 'warning' ? 'text-warning' : 'text-ink'}`}>{value}</p>
        <p className="mt-1 text-[13px] text-subtle">{note}</p>
      </Card>
    </Link>
  )
}

export function DashboardPage() {
  usePageMeta({ title: 'Overview', path: '/dashboard' })
  const { data } = useWorkspace()
  if (!data) return null

  const completion = profileCompleteness(data.profile)
  const review = needsReviewCount(data)
  const processedDocs = data.documents.filter((d) => d.status === 'processed').length
  const prepared = data.applications.filter((a) => a.status === 'prepared').length
  const recent = [...data.applications].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)
  const firstName = data.user.name.split(' ')[0]
  const missingProfile = data.profile.filter((f) => !f.value)

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description="Here’s what’s happening with your applications."
        actions={
          <Button to="/applications/new">
            <FilePlus2 className="size-4" aria-hidden />
            New Application
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Profile Completion" value={`${completion}%`} note={missingProfile.length ? `${missingProfile.length} ${missingProfile.length === 1 ? 'detail' : 'details'} to add` : 'Complete'} to="/profile" />
        <Stat label="Documents" value={String(data.documents.length)} note={`${processedDocs} processed`} to="/documents" />
        <Stat label="Applications" value={String(data.applications.length)} note={`${prepared} ready for submission`} to="/applications" />
        <Stat label="Needs Review" value={String(review)} note={review ? 'Resolve before approving' : 'Nothing waiting'} tone={review ? 'warning' : undefined} to="/validation" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[16px] font-semibold text-ink">Recent applications</h2>
            <Link to="/applications" className="text-[14px] text-accent hover:underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={ClipboardList} title="No applications yet." description="Create your first application." action={<Button to="/applications/new" size="sm">Create Application</Button>} />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((app) => {
                const s = summary(app)
                return (
                  <li key={app.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/applications/${app.id}`} className="text-[15px] font-medium text-ink hover:text-accent">
                          {app.title}
                        </Link>
                        <ApplicationStatusBadge status={app.status} />
                      </div>
                      <p className="mt-0.5 text-[13px] text-subtle">
                        {app.organization} · Updated {timeAgo(app.updatedAt)}
                        {s.issues.length > 0 && app.status !== 'prepared' && ` · ${s.issues.length} ${s.issues.length === 1 ? 'issue' : 'issues'}`}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
                          <motion.div
                            className={`h-full rounded-full ${progress(app) === 100 ? 'bg-success' : 'bg-accent'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress(app)}%` }}
                            transition={{ duration: 0.6 }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-[12px] text-ink-2">{progress(app)}%</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2 md:w-[172px] md:justify-end">
                      <Button to={`/applications/${app.id}`} variant="secondary" size="sm">
                        Open
                      </Button>
                      {app.status === 'needs_review' || app.status === 'draft' ? (
                        <Button to={`/validation?app=${app.id}`} size="sm">
                          Continue
                        </Button>
                      ) : (
                        <Button to={`/applications/${app.id}/review`} size="sm">
                          Review
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-[16px] font-semibold text-ink">Quick actions</h2>
            <div className="mt-4 grid gap-2">
              {[
                { to: '/documents?upload=1', icon: FileUp, label: 'Upload Document', note: 'PDF, JPG or PNG' },
                { to: '/applications/new', icon: FilePlus2, label: 'Create Application', note: 'Map a form to your profile' },
                { to: '/profile', icon: UserRoundCheck, label: 'Complete Profile', note: missingProfile.length ? `${missingProfile.length} ${missingProfile.length === 1 ? 'detail' : 'details'} missing` : 'All details added' },
              ].map(({ to, icon: Icon, label, note }) => (
                <Link key={label} to={to} className="group flex items-center gap-3 rounded-[var(--radius-control)] border border-line px-3 py-2.5 hover:border-accent-line hover:bg-accent-soft/40">
                  <span className="flex size-9 items-center justify-center rounded-[var(--radius-control)] bg-sunken text-ink-2 group-hover:bg-accent-soft group-hover:text-accent">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-ink">{label}</span>
                    <span className="block text-[12px] text-subtle">{note}</span>
                  </span>
                  <ArrowRight className="size-4 text-subtle group-hover:text-accent" aria-hidden />
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-[16px] font-semibold text-ink">Activity</h2>
              <Link to="/activity" className="text-[14px] text-accent hover:underline">
                View all
              </Link>
            </div>
            {data.activity.length === 0 ? (
              <p className="px-5 py-8 text-center text-[14px] text-muted">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.activity.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex gap-3 px-5 py-3.5">
                    <ActivityIcon kind={a.kind} />
                    <div className="min-w-0">
                      <p className="text-[14px] text-ink">{a.title}</p>
                      <p className="truncate text-[13px] text-subtle">{a.detail}</p>
                      <p className="mt-0.5 text-[12px] text-subtle">{timeAgo(a.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {data.documents.length === 0 && (
        <EmptyState
          icon={FileText}
          title="Start by uploading a document."
          description="Upload your resume or a certificate to build your reusable profile."
          action={<Button to="/documents?upload=1" size="sm">Upload Document</Button>}
        />
      )}

      {review === 0 && data.applications.length > 0 && (
        <p className="flex items-center gap-2 text-[14px] text-success">
          <CheckCircle2 className="size-4" aria-hidden />
          No applications need your attention.
        </p>
      )}
      {review > 0 && (
        <p className="flex items-center gap-2 text-[14px] text-warning">
          <AlertTriangle className="size-4" aria-hidden />
          {review} {review === 1 ? 'application needs' : 'applications need'} your attention before approval.{' '}
          <Link to="/validation" className="underline underline-offset-2">
            Open Validation
          </Link>
        </p>
      )}
    </div>
  )
}
