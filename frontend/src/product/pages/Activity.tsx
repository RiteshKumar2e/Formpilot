import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ClipboardList, FileText, FileUp, GitCompareArrows, History, ScanText, UserRoundPen, XCircle } from 'lucide-react'
import { usePageMeta } from '../../hooks/usePageMeta'
import { useWorkspace } from '../workspace'
import { formatDateTime, timeAgo } from '../selectors'
import type { ActivityKind } from '../types'
import { Card, EmptyState, PageHeader } from '../ui'
import { cn } from '../../lib/utils'

const ICONS: Record<ActivityKind, { icon: typeof FileText; tone: string }> = {
  document_uploaded: { icon: FileUp, tone: 'bg-accent-soft text-accent' },
  information_extracted: { icon: ScanText, tone: 'bg-accent-soft text-accent' },
  profile_updated: { icon: UserRoundPen, tone: 'bg-sunken text-ink-2' },
  application_created: { icon: ClipboardList, tone: 'bg-sunken text-ink-2' },
  fields_mapped: { icon: GitCompareArrows, tone: 'bg-accent-soft text-accent' },
  conflict_detected: { icon: AlertTriangle, tone: 'bg-warning-soft text-warning' },
  issue_resolved: { icon: CheckCircle2, tone: 'bg-success-soft text-success' },
  application_approved: { icon: CheckCircle2, tone: 'bg-success-soft text-success' },
  document_failed: { icon: XCircle, tone: 'bg-danger-soft text-danger' },
}

export function ActivityIcon({ kind }: { kind: ActivityKind }) {
  const { icon: Icon, tone } = ICONS[kind]
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', tone)}>
      <Icon className="size-4" aria-hidden />
    </span>
  )
}

export function ActivityPage() {
  usePageMeta({ title: 'Activity', path: '/activity' })
  const { data } = useWorkspace()
  if (!data) return null
  const items = [...data.activity].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <div className="space-y-6">
      <PageHeader title="Activity" description="Everything FormPilot did with your documents and applications, and every decision you made." />
      {items.length === 0 ? (
        <EmptyState icon={History} title="No activity yet." description="Uploads, mappings and approvals will appear here." />
      ) : (
        <Card className="p-5 sm:p-6">
          <ol className="relative">
            {items.map((a, i) => (
              <li key={a.id} className="relative flex gap-4 pb-6 last:pb-0">
                {i < items.length - 1 && <span aria-hidden className="absolute top-9 bottom-1 left-4 w-px bg-line" />}
                <ActivityIcon kind={a.kind} />
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <p className="text-[15px] font-medium text-ink">{a.title}</p>
                    <time dateTime={a.at} title={formatDateTime(a.at)} className="shrink-0 text-[13px] text-subtle">
                      {timeAgo(a.at)}
                    </time>
                  </div>
                  <p className="mt-0.5 text-[14px] text-muted">{a.detail}</p>
                  {a.applicationId && data.applications.some((x) => x.id === a.applicationId) && (
                    <Link to={`/applications/${a.applicationId}`} className="mt-1 inline-block text-[13px] text-accent hover:underline">
                      Open application
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  )
}
