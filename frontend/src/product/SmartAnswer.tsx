import { useCallback, useEffect, useState } from 'react'
import { BookmarkPlus, FileText, Loader2, MessageSquareText, Pencil, RefreshCw, Sparkles, UserRound } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { api, ApiError } from '../lib/api'
import { cn } from '../lib/utils'
import type { SmartAnswer, SmartAnswerSource } from '../types/api'

const METHOD_LABEL: Record<SmartAnswer['method'], string> = {
  llm_rag: 'Written by AI from your profile and documents',
  saved_answer: 'From your saved answers',
  profile_draft: 'Drafted from your Master Profile',
  none: 'No suggestion',
}

const SOURCE_ICON: Record<SmartAnswerSource['type'], typeof FileText> = {
  profile: UserRound,
  document: FileText,
  saved_answer: MessageSquareText,
}

export function SourceContext({ sources }: { sources: SmartAnswerSource[] }) {
  if (!sources.length) return null
  return (
    <div>
      <p className="text-[12px] font-medium text-subtle">Source context</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {sources.map((s, i) => {
          const Icon = SOURCE_ICON[s.type]
          return (
            <li
              key={`${s.type}-${s.label}-${i}`}
              title={s.detail ?? undefined}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-canvas px-2 py-0.5 text-[12px] text-ink-2"
            >
              <Icon className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{s.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * A suggested answer to an open question. It is never used until the person clicks "Use answer",
 * and they can edit or regenerate it first.
 */
export function SmartAnswerCard({
  question,
  organization,
  role,
  initial,
  onUse,
  compact = false,
}: {
  question: string
  organization?: string
  role?: string
  initial?: SmartAnswer
  onUse: (answer: string) => void
  compact?: boolean
}) {
  const [suggestion, setSuggestion] = useState<SmartAnswer | null>(initial ?? null)
  const [text, setText] = useState(initial?.answer ?? '')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(!initial)
  const [error, setError] = useState<string | null>(null)
  const [saveForLater, setSaveForLater] = useState(false)

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await api.answers.suggest(question, { organization, role })
      setSuggestion(next)
      setText(next.answer)
      setEditing(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t suggest an answer.')
    } finally {
      setLoading(false)
    }
  }, [question, organization, role])

  useEffect(() => {
    if (!initial) void generate()
  }, [initial, generate])

  const use = async () => {
    const answer = text.trim()
    if (!answer) return
    if (saveForLater) {
      try {
        await api.answers.create(question, answer)
      } catch {
        /* Using the answer matters more than saving it; the Vault can save it later. */
      }
    }
    onUse(answer)
  }

  return (
    <div className={cn('rounded-[var(--radius-panel)] border border-accent-line bg-panel', compact ? 'p-3' : 'p-4')}>
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-accent">
          <Sparkles className="size-4" aria-hidden />
          Suggested answer
        </p>
        <span className="rounded-full border border-warning-line bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
          Review before using
        </span>
      </div>

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-[14px] text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Retrieving your experience, projects and saved answers…
        </p>
      ) : error ? (
        <p role="alert" className="mt-3 text-[14px] text-danger">
          {error}
        </p>
      ) : suggestion?.method === 'none' ? (
        <p className="mt-3 text-[14px] text-muted">
          Your profile doesn’t have enough to draft this yet. Add experience or projects to your Master Profile, or write it yourself.
        </p>
      ) : (
        <>
          {editing ? (
            <>
              <label className="sr-only" htmlFor={`answer-${question}`}>
                Edit answer
              </label>
              <textarea
                id={`answer-${question}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={compact ? 5 : 6}
                autoFocus
                className="mt-3 w-full rounded-[var(--radius-control)] border border-line-strong bg-field px-3 py-2 text-[14px] leading-relaxed text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </>
          ) : (
            <p className="mt-3 text-[14px] leading-relaxed whitespace-pre-line text-ink">“{text}”</p>
          )}
          <p className="mt-2 text-[12px] text-subtle">{suggestion && METHOD_LABEL[suggestion.method]}</p>
          {suggestion && (
            <div className="mt-3">
              <SourceContext sources={suggestion.sources} />
            </div>
          )}
          <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" checked={saveForLater} onChange={(e) => setSaveForLater(e.target.checked)} />
            <BookmarkPlus className="size-3.5" aria-hidden />
            Save to Common Answers
          </label>
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void use()} disabled={loading || !text.trim()}>
          Use answer
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setEditing((v) => !v)} disabled={loading || !suggestion}>
          <Pencil className="size-3.5" aria-hidden />
          {editing ? 'Done editing' : 'Edit'}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void generate()} disabled={loading}>
          <RefreshCw className="size-3.5" aria-hidden />
          Regenerate
        </Button>
      </div>
    </div>
  )
}
