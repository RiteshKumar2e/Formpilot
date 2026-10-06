import { useId, useRef, useState, type DragEvent } from 'react'
import { api, ApiError } from '../../lib/api'
import { cn, formatBytes } from '../../lib/utils'
import type { DocumentRecord } from '../../types/api'
import { Button } from '../ui/Button'
import { ChevronIcon, CloseIcon, FileIcon, TrashIcon, UploadIcon } from '../ui/Icons'
import { Status, type Tone } from '../ui/primitives'

const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
const ACCEPT_ATTR = '.pdf,.png,.jpg,.jpeg'
const MAX_BYTES = 10 * 1024 * 1024

interface PendingUpload {
  localId: string
  file: File
  progress: number
  error: string | null
  retryable: boolean
}

function clientValidate(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'This file type isn’t supported. Upload a PDF, JPG or PNG.'
  if (file.size > MAX_BYTES) return 'This file is larger than 10 MB. Try a compressed or single-page version.'
  if (file.size === 0) return 'This file is empty.'
  return null
}

const STATUS: Record<DocumentRecord['status'], { tone: Tone; label: string; fallback: string | null }> = {
  processed: { tone: 'success', label: 'Processed', fallback: null },
  needs_review: { tone: 'warning', label: 'Needs your attention', fallback: 'Some information needs your attention.' },
  failed: { tone: 'danger', label: 'Couldn’t process', fallback: 'Try uploading a clearer file.' },
  processing: { tone: 'accent', label: 'Analyzing document…', fallback: null },
}

function DocumentRow({ doc, onRemove }: { doc: DocumentRecord; onRemove: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const status = STATUS[doc.status]
  const message = doc.message ?? status.fallback

  return (
    <li className="border-b border-line">
      <div className="flex items-start gap-3 py-4">
        <FileIcon className="mt-0.5 size-5 shrink-0 text-subtle" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-ink">{doc.filename}</p>
          <p className="font-mono text-[12px] text-subtle">
            {formatBytes(doc.size_bytes)}
            {doc.page_count ? ` · ${doc.page_count} ${doc.page_count === 1 ? 'page' : 'pages'}` : ''}
          </p>
          <Status tone={status.tone} className="mt-2">
            {status.label}
          </Status>
          {message && <p className="mt-1 text-[14px] text-ink-2">{message}</p>}
        </div>
        <button
          type="button"
          onClick={() => onRemove(doc.id)}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-subtle hover:bg-ink/[0.05] hover:text-danger"
          aria-label={`Delete ${doc.filename}`}
        >
          <TrashIcon className="size-4" />
        </button>
      </div>

      {doc.extracted.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={detailsId}
            className="-mt-1 mb-3 ml-8 inline-flex items-center gap-1 text-[14px] text-accent"
          >
            {open ? 'Hide' : 'Show'} {doc.extracted.length} extracted {doc.extracted.length === 1 ? 'detail' : 'details'}
            <ChevronIcon className={cn('size-4 transition-transform', open && 'rotate-180')} />
          </button>
          {open && (
            <dl id={detailsId} className="mb-4 ml-8 divide-y divide-line border-y border-line text-[14px]">
              {doc.extracted.map((f) => (
                <div key={`${f.key}-${f.value}`} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_auto] gap-3 py-2">
                  <dt className="truncate text-subtle">{f.label}</dt>
                  <dd className="break-words text-ink">{f.value}</dd>
                  <dd className="font-mono text-[12px] text-subtle">{Math.round(f.confidence * 100)}%</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}
    </li>
  )
}

function PendingRow({ upload, onRetry, onDismiss }: { upload: PendingUpload; onRetry: () => void; onDismiss: () => void }) {
  const analyzing = upload.progress >= 100 && !upload.error
  return (
    <li className="border-b border-line py-4">
      <div className="flex items-start gap-3">
        <FileIcon className="mt-0.5 size-5 shrink-0 text-subtle" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-ink">{upload.file.name}</p>
          <p className="font-mono text-[12px] text-subtle">{formatBytes(upload.file.size)}</p>

          {upload.error ? (
            <div role="alert" className="mt-2">
              <Status tone="danger">We couldn’t process this document.</Status>
              <p className="mt-1 text-[14px] text-ink-2">{upload.error}</p>
              {upload.retryable && (
                <Button variant="quiet" className="mt-2" onClick={onRetry}>
                  Try again
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-2.5" role="status">
              <p className="text-[14px] text-accent">
                {analyzing ? 'Analyzing document…' : `Uploading… ${upload.progress}%`}
              </p>
              {analyzing ? (
                <div className="skeleton mt-2 h-1.5 w-full" aria-hidden />
              ) : (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
                  <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${upload.progress}%` }} />
                </div>
              )}
            </div>
          )}
        </div>
        {upload.error && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-subtle hover:bg-ink/[0.05] hover:text-ink"
            aria-label={`Dismiss ${upload.file.name}`}
          >
            <CloseIcon className="size-4" />
          </button>
        )}
      </div>
    </li>
  )
}

export function DocumentUploader({
  documents,
  loading = false,
  onUploaded,
  onRemoved,
}: {
  documents: DocumentRecord[]
  loading?: boolean
  onUploaded: (doc: DocumentRecord) => void
  onRemoved: (id: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [removeError, setRemoveError] = useState<string | null>(null)

  const update = (localId: string, patch: Partial<PendingUpload>) =>
    setPending((list) => list.map((u) => (u.localId === localId ? { ...u, ...patch } : u)))

  const start = async (upload: PendingUpload) => {
    const invalid = clientValidate(upload.file)
    if (invalid) {
      update(upload.localId, { error: invalid, retryable: false })
      return
    }
    update(upload.localId, { error: null, progress: 0, retryable: false })
    try {
      const doc = await api.documents.upload(upload.file, (p) => update(upload.localId, { progress: p }))
      setPending((list) => list.filter((u) => u.localId !== upload.localId))
      onUploaded(doc)
    } catch (err) {
      // Network and server errors can be retried; validation errors (4xx) need a different file.
      const retryable = !(err instanceof ApiError) || err.status === 0 || err.status >= 500
      update(upload.localId, { error: err instanceof ApiError ? err.message : 'Try uploading a clearer file.', retryable })
    }
  }

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return
    const uploads = Array.from(files).map((file) => ({
      localId: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
      progress: 0,
      error: null,
      retryable: false,
    }))
    setPending((list) => [...uploads, ...list])
    uploads.forEach((u) => void start(u))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const remove = async (id: string) => {
    setRemoveError(null)
    try {
      await api.documents.remove(id)
      onRemoved(id)
    } catch (err) {
      setRemoveError(err instanceof ApiError ? err.message : 'Couldn’t delete this document.')
    }
  }

  const empty = !loading && documents.length === 0 && pending.length === 0

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center rounded-[var(--radius-panel)] border border-dashed px-6 py-9 text-center transition-colors duration-150',
          dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-canvas',
        )}
      >
        {empty ? (
          <>
            <p className="text-[17px] font-medium text-ink">No documents yet.</p>
            <p className="mt-1 max-w-xs text-[15px] text-muted">Upload your first document to build your profile.</p>
          </>
        ) : (
          <p className="text-[15px] text-muted">Drop more documents here, or</p>
        )}
        <Button className="mt-4" size="sm" onClick={() => inputRef.current?.click()}>
          <UploadIcon className="size-4" />
          Choose files
        </Button>
        <p className="mt-3 text-[13px] text-subtle">PDF, JPG or PNG, up to 10 MB each</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label="Upload documents"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {removeError && (
        <p role="alert" className="mt-3 text-[14px] text-danger">
          {removeError}
        </p>
      )}

      {loading && (
        <ul className="mt-4 border-t border-line" aria-label="Loading documents">
          {[0, 1].map((i) => (
            <li key={i} className="flex gap-3 border-b border-line py-4" aria-hidden>
              <div className="skeleton size-5" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-1/2" />
                <div className="skeleton h-3 w-1/4" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !empty && (
        <ul className="mt-4 border-t border-line" aria-label="Your documents">
          {pending.map((u) => (
            <PendingRow
              key={u.localId}
              upload={u}
              onRetry={() => void start(u)}
              onDismiss={() => setPending((list) => list.filter((x) => x.localId !== u.localId))}
            />
          ))}
          {documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} onRemove={(id) => void remove(id)} />
          ))}
        </ul>
      )}
    </div>
  )
}
