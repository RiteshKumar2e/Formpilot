import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, FileImage, FileText, FileUp, Loader2, Plus, Trash2, UploadCloud } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { usePageMeta } from '../../hooks/usePageMeta'
import { cn } from '../../lib/utils'
import { UPLOAD_STAGES, useWorkspace, WorkspaceError, type UploadStage } from '../workspace'
import { formatDateTime, timeAgo } from '../selectors'
import type { DocumentCategory, DocumentItem } from '../types'
import { Badge, Card, ConfidenceBar, DocumentStatusBadge, Drawer, EmptyState, ErrorPanel, PageHeader } from '../ui'

const CATEGORIES: DocumentCategory[] = ['Resume', 'Education', 'Experience', 'Identity', 'Certificates', 'Other']

function DocIcon({ doc }: { doc: Pick<DocumentItem, 'fileType'> }) {
  const Icon = doc.fileType === 'PDF' ? FileText : FileImage
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-sunken text-ink-2">
      <Icon className="size-5" aria-hidden />
    </span>
  )
}

function UploadFlow({ onDone }: { onDone: (doc: DocumentItem) => void }) {
  const { uploadDocument } = useWorkspace()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<UploadStage | null>(null)
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState<WorkspaceError | null>(null)
  const [result, setResult] = useState<DocumentItem | null>(null)

  const stages = UPLOAD_STAGES
  const currentIndex = stage ? stages.findIndex((s) => s.id === stage) : -1

  const start = async (f: File) => {
    setFile(f)
    setError(null)
    setResult(null)
    setPercent(0)
    try {
      const doc = await uploadDocument(f, (s, p) => {
        setStage(s)
        if (p !== undefined) setPercent(p)
      })
      setResult(doc)
    } catch (err) {
      setStage(null)
      setError(err instanceof WorkspaceError ? err : new WorkspaceError('We couldn’t process this document.', 'Try uploading a clearer file.', 'retry'))
    }
  }

  const pick = (files: FileList | null) => {
    const f = files?.[0]
    if (f) void start(f)
  }

  const reset = () => {
    setFile(null)
    setStage(null)
    setError(null)
    setResult(null)
  }

  if (result) {
    const failed = result.status === 'failed'
    return (
      <div className="text-center">
        <motion.span
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn('mx-auto flex size-12 items-center justify-center rounded-full', failed ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success')}
        >
          <CheckCircle2 className="size-6" aria-hidden />
        </motion.span>
        <p className="mt-4 text-[17px] font-semibold text-ink" role="status">
          {failed ? 'We couldn’t process this document.' : result.status === 'needs_review' ? 'Some information needs your attention.' : 'Document processed successfully.'}
        </p>
        <p className="mt-1 text-[14px] text-muted">{result.message ?? `${result.extracted.length} details extracted from ${result.name}.`}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="secondary" onClick={reset}>
            Upload another
          </Button>
          <Button onClick={() => onDone(result)}>View document</Button>
        </div>
      </div>
    )
  }

  if (file && stage) {
    return (
      <div>
        <div className="flex items-center gap-3">
          <DocIcon doc={{ fileType: file.type === 'application/pdf' ? 'PDF' : 'JPG' }} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-ink">{file.name}</p>
            <p className="text-[13px] text-subtle" role="status">
              Processing document…
            </p>
          </div>
        </div>
        <ol className="mt-6 space-y-3">
          {stages.map((s, i) => {
            const done = i < currentIndex || stage === 'ready'
            const active = i === currentIndex && stage !== 'ready'
            return (
              <li key={s.id} className="flex items-center gap-3">
                <span className={cn('flex size-6 items-center justify-center rounded-full', done ? 'bg-success text-white' : active ? 'bg-accent-soft text-accent' : 'bg-sunken text-subtle')}>
                  {done ? <CheckCircle2 className="size-4" aria-hidden /> : active ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <span className="size-1.5 rounded-full bg-current" />}
                </span>
                <span className={cn('text-[14px]', done || active ? 'text-ink' : 'text-subtle')}>
                  {s.label}
                  {s.id === 'uploading' && active && ` · ${percent}%`}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-4">
          <ErrorPanel error={error} onRetry={() => file && void start(file)} onChooseFile={() => inputRef.current?.click()} />
        </div>
      )}
      <div
        onDragOver={(e: DragEvent) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault()
          setDragging(false)
          pick(e.dataTransfer.files)
        }}
        className={cn(
          'flex flex-col items-center rounded-[var(--radius-panel)] border-2 border-dashed px-6 py-12 text-center transition-colors',
          dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-canvas',
        )}
      >
        <UploadCloud className={cn('size-9', dragging ? 'text-accent' : 'text-subtle')} aria-hidden />
        <p className="mt-3 text-[16px] font-medium text-ink">Drop your document here</p>
        <p className="mt-1 text-[14px] text-muted">Supported: PDF, JPG, PNG · up to 10 MB</p>
        <p className="my-3 text-[13px] text-subtle">or</p>
        <Button onClick={() => inputRef.current?.click()}>Browse Files</Button>
        <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" tabIndex={-1} aria-label="Choose a document" onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
      </div>
    </div>
  )
}

function DocumentDetail({ doc }: { doc: DocumentItem }) {
  const usedIn = useWorkspace().data?.applications.filter((a) => a.fields.some((f) => f.source === doc.name)) ?? []
  const avg = doc.extracted.length ? doc.extracted.reduce((s, e) => s + e.confidence, 0) / doc.extracted.length : null
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DocIcon doc={doc} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-ink">{doc.name}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <DocumentStatusBadge status={doc.status} />
            {doc.verified && <Badge tone="success">Verified</Badge>}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-[14px]">
        <div>
          <dt className="text-subtle">Type</dt>
          <dd className="text-ink">{doc.category} · {doc.fileType}</dd>
        </div>
        <div>
          <dt className="text-subtle">Uploaded</dt>
          <dd className="text-ink">{formatDateTime(doc.uploadedAt)}</dd>
        </div>
        <div>
          <dt className="text-subtle">Size</dt>
          <dd className="text-ink">{doc.sizeKb} KB{doc.pages ? ` · ${doc.pages} ${doc.pages === 1 ? 'page' : 'pages'}` : ''}</dd>
        </div>
        <div>
          <dt className="text-subtle">Source confidence</dt>
          <dd>{avg !== null ? <ConfidenceBar value={avg} /> : <span className="text-ink">Not applicable</span>}</dd>
        </div>
      </dl>

      {doc.message && (
        <p className={cn('rounded-[var(--radius-control)] border px-3 py-2.5 text-[14px]', doc.status === 'failed' ? 'border-danger-line bg-danger-soft text-ink-2' : 'border-warning-line bg-warning-soft text-ink-2')}>
          {doc.message}
        </p>
      )}

      <div>
        <h3 className="text-[15px] font-semibold text-ink">Extracted information</h3>
        {doc.extracted.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">No details were extracted from this document.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-[var(--radius-panel)] border border-line">
            {doc.extracted.map((e) => (
              <li key={`${e.label}-${e.value}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[110px_minmax(0,1fr)_110px] sm:items-center sm:gap-3">
                <span className="text-[13px] text-subtle">{e.label}</span>
                <span className="break-words text-[14px] text-ink">{e.value}</span>
                <ConfidenceBar value={e.confidence} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {usedIn.length > 0 && (
        <div>
          <h3 className="text-[15px] font-semibold text-ink">Used in</h3>
          <ul className="mt-2 space-y-1 text-[14px] text-ink-2">
            {usedIn.map((a) => (
              <li key={a.id}>{a.title} · {a.organization}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function DocumentsPage() {
  usePageMeta({ title: 'Documents', path: '/documents' })
  const { data, deleteDocument } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const [category, setCategory] = useState<DocumentCategory | 'All'>('All')
  const [deleteError, setDeleteError] = useState<WorkspaceError | null>(null)
  const selectedId = params.get('doc')
  const uploading = params.get('upload') === '1'

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params)
      if (value) next.set(key, value)
      else next.delete(key)
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const docs = useMemo(() => data?.documents ?? [], [data])
  const filtered = category === 'All' ? docs : docs.filter((d) => d.category === category)
  const selected = docs.find((d) => d.id === selectedId) ?? null
  if (!data) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Upload your documents once. Reuse them across applications."
        actions={
          <Button onClick={() => setParam('upload', '1')}>
            <Plus className="size-4" aria-hidden />
            Upload Document
          </Button>
        }
      />

      {deleteError && <ErrorPanel error={deleteError} onRetry={() => setDeleteError(null)} />}

      <div role="tablist" aria-label="Document categories" className="-mx-1 flex flex-wrap gap-1.5">
        {(['All', ...CATEGORIES] as const).map((c) => {
          const count = c === 'All' ? docs.length : docs.filter((d) => d.category === c).length
          return (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[13px] transition-colors',
                category === c ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-2 hover:border-line-strong',
              )}
            >
              {c} <span className={category === c ? 'text-white/70' : 'text-subtle'}>{count}</span>
            </button>
          )
        })}
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon={FileUp}
          title="No documents yet."
          description="Upload your first document to build your reusable profile."
          action={<Button onClick={() => setParam('upload', '1')}>Upload Document</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title={`No ${category.toLowerCase()} documents.`} description="Upload one, or choose another category." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((doc) => (
            <li key={doc.id}>
              <Card className="group flex h-full flex-col p-4 transition-shadow hover:shadow-[var(--shadow-raised)]">
                <button type="button" onClick={() => setParam('doc', doc.id)} className="flex flex-1 items-start gap-3 text-left" aria-label={`Open ${doc.name}`}>
                  <DocIcon doc={doc} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-ink group-hover:text-accent">{doc.name}</p>
                    <p className="text-[13px] text-subtle">
                      {doc.fileType} · {doc.category} · {timeAgo(doc.uploadedAt)}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <DocumentStatusBadge status={doc.status} />
                      {doc.verified && <Badge tone="success">Verified</Badge>}
                    </div>
                  </div>
                </button>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[13px]">
                  <span className="text-subtle">{doc.extracted.length} details extracted</span>
                  <button
                    type="button"
                    onClick={async () => {
                      setDeleteError(null)
                      try {
                        await deleteDocument(doc.id)
                      } catch (err) {
                        setDeleteError(err as WorkspaceError)
                      }
                    }}
                    className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] text-subtle hover:bg-danger-soft hover:text-danger"
                    aria-label={`Delete ${doc.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Drawer open={Boolean(selected)} onClose={() => setParam('doc', null)} title={selected?.name ?? 'Document'}>
        {selected && <DocumentDetail doc={selected} />}
      </Drawer>

      <Drawer open={uploading} onClose={() => setParam('upload', null)} title="Upload document">
        <UploadFlow
          onDone={(doc) => {
            const next = new URLSearchParams(params)
            next.delete('upload')
            next.set('doc', doc.id)
            setParams(next, { replace: true })
          }}
        />
      </Drawer>
    </div>
  )
}
