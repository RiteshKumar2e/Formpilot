import { Fragment, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowRight, GitCompareArrows } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { usePageMeta } from '../../hooks/usePageMeta'
import { useWorkspace } from '../workspace'
import type { ApplicationField } from '../types'
import { Badge, Card, ConfidenceBar, EmptyState, FieldStatusBadge, PageHeader, SourceChip } from '../ui'

const PIPELINE = [
  { step: 'Understand', body: 'Reads what the form question is really asking, however it is worded.', tag: 'Language understanding' },
  { step: 'Retrieve', body: 'Searches your verified profile and documents for the most relevant details.', tag: 'RAG · Vector search' },
  { step: 'Match', body: 'Compares meaning, not exact words, and picks the best candidate.', tag: 'Embeddings · Semantic mapping' },
  { step: 'Verify', body: 'Scores confidence, cross-checks documents and flags conflicts for you.', tag: 'Confidence scoring' },
]

function MappingRow({ field, appId }: { field: ApplicationField; appId: string }) {
  const reworded = field.profileKey && field.candidates[0] && field.label.toLowerCase() !== field.profileKey.replace(/_/g, ' ')
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] items-center gap-2 py-4 md:grid-cols-[minmax(0,1.1fr)_24px_minmax(0,1.3fr)_24px_minmax(0,1fr)_minmax(0,0.8fr)] md:gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">Application field</p>
        <p className="mt-0.5 text-[15px] font-medium text-ink">“{field.label}”</p>
        {reworded && field.value && <p className="mt-0.5 text-[12px] text-accent">Matched by meaning</p>}
      </div>
      <ArrowRight className="hidden size-4 text-subtle md:block" aria-hidden />
      <ArrowDown className="size-4 text-subtle md:hidden" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">FormPilot match</p>
        {field.value ? (
          <p className="mt-0.5 truncate text-[15px] text-ink" title={field.value}>
            {field.value}
          </p>
        ) : (
          <div className="mt-1">
            <FieldStatusBadge status={field.status} />
          </div>
        )}
      </div>
      <ArrowRight className="hidden size-4 text-subtle md:block" aria-hidden />
      <ArrowDown className="size-4 text-subtle md:hidden" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">Source</p>
        <div className="mt-1">
          {field.status === 'conflict' ? (
            <Badge tone="warning">{field.candidates.length} sources disagree</Badge>
          ) : field.value ? (
            <SourceChip source={field.source} />
          ) : (
            <span className="text-[13px] text-subtle">None</span>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">Confidence</p>
        {field.value ? (
          <ConfidenceBar value={field.confidence} className="mt-1.5" />
        ) : (
          <Link to={`/applications/${appId}`} className="mt-1 inline-block text-[13px] text-accent hover:underline">
            Resolve
          </Link>
        )}
      </div>
    </li>
  )
}

export function FieldMappingPage() {
  usePageMeta({ title: 'Field Mapping', path: '/mapping' })
  const { data } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const apps = data?.applications ?? []
  const app = apps.find((a) => a.id === params.get('app')) ?? apps.find((a) => a.status === 'needs_review') ?? apps[0]

  // Pin the chosen application in the URL so it stays selected as statuses change.
  useEffect(() => {
    if (app && !params.get('app')) setParams({ app: app.id }, { replace: true })
  }, [app, params, setParams])

  if (!data) return null

  if (!app) {
    return (
      <div className="space-y-6">
        <PageHeader title="Field Mapping" description="How every form question is matched to your profile." />
        <EmptyState icon={GitCompareArrows} title="No applications yet." description="Create an application to see its field mapping." action={<Button to="/applications/new">Create Application</Button>} />
      </div>
    )
  }

  const profileFields = app.fields.filter((f) => f.section !== 'Documents')
  const mapped = profileFields.filter((f) => f.value).length
  const avg = mapped ? profileFields.filter((f) => f.value).reduce((s, f) => s + f.confidence, 0) / mapped : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field Mapping"
        description="How FormPilot matched every question on this form to your profile, and where each answer came from."
        actions={
          <>
            <label htmlFor="mapping-app" className="sr-only">
              Application
            </label>
            <select
              id="mapping-app"
              value={app.id}
              onChange={(e) => setParams({ app: e.target.value }, { replace: true })}
              className="h-10 max-w-[260px] rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[14px] text-ink"
            >
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            <Button to={`/applications/${app.id}`} variant="secondary">
              Open workspace
            </Button>
          </>
        }
      />

      <Card className="p-5 sm:p-6">
        <h2 className="text-[16px] font-semibold text-ink">From question to answer</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PIPELINE.map((p, i) => (
            <Fragment key={p.step}>
              <li className="relative rounded-[var(--radius-panel)] border border-line bg-canvas p-4">
                <p className="font-mono text-[12px] text-accent">0{i + 1}</p>
                <p className="mt-1 text-[15px] font-semibold text-ink">{p.step}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{p.body}</p>
                <p className="mt-3 inline-block rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">{p.tag}</p>
              </li>
            </Fragment>
          ))}
        </ol>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-[13px] text-muted">Fields mapped</p>
          <p className="mt-1 text-[22px] font-semibold text-ink">
            {mapped}/{profileFields.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] text-muted">Average confidence</p>
          <p className="mt-1 text-[22px] font-semibold text-ink">{Math.round(avg * 100)}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] text-muted">Need your input</p>
          <p className="mt-1 text-[22px] font-semibold text-warning">{profileFields.length - mapped}</p>
        </Card>
      </div>

      <Card className="px-5 sm:px-6">
        <h2 className="border-b border-line py-4 text-[16px] font-semibold text-ink">
          {app.title}
          {app.organization && <span className="font-normal text-subtle"> · {app.organization}</span>}
        </h2>
        <ul className="divide-y divide-line">
          {profileFields.map((f) => (
            <MappingRow key={f.id} field={f} appId={app.id} />
          ))}
        </ul>
      </Card>

      <p className="text-[13px] leading-relaxed text-subtle">
        Each question is scored against every field in your profile on the FormPilot API, using known phrasings and text similarity. The production design adds embeddings and vector search behind the same interface.
      </p>
    </div>
  )
}
