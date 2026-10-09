import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Download, Loader2, MonitorSmartphone, Puzzle, ShieldCheck } from 'lucide-react'
import { Button, buttonClasses } from '../../components/ui/Button'
import { usePageMeta } from '../../hooks/usePageMeta'
import { api, ApiError } from '../../lib/api'
import type { ExtensionConnection } from '../../types/api'
import { timeAgo } from '../selectors'
import { Badge, Card, PageHeader } from '../ui'

/** "Chrome on Windows", so the person can tell connected browsers apart. */
function browserName(): string {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : 'Browser'
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'this device'
  return `${browser} on ${os}`
}

/** The extension's content script marks the FormPilot app's page when it's installed. */
function useExtensionInstalled(): boolean | null {
  const [installed, setInstalled] = useState<boolean | null>(null)
  useEffect(() => {
    let tries = 0
    const timer = window.setInterval(() => {
      const found = Boolean(document.documentElement.dataset.formpilotExtension)
      tries++
      if (found || tries > 10) {
        setInstalled(found)
        window.clearInterval(timer)
      }
    }, 300)
    return () => window.clearInterval(timer)
  }, [])
  return installed
}

/** Hands a new token to the extension on this page, and waits for it to confirm. */
function connectExtension(token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage)
      reject(new Error('The extension didn’t answer. Reload this page and try again.'))
    }, 6000)
    function onMessage(event: MessageEvent) {
      const data = event.data as { source?: string; type?: string; ok?: boolean; error?: string } | null
      if (event.source !== window || data?.source !== 'formpilot-extension' || data.type !== 'connect-result') return
      window.clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
      if (data.ok) resolve()
      else reject(new Error(data.error ?? 'The extension couldn’t connect.'))
    }
    window.addEventListener('message', onMessage)
    window.postMessage({ source: 'formpilot-web', type: 'connect', token }, window.location.origin)
  })
}

const STEPS = [
  {
    title: 'Download and unzip',
    body: (
      <>
        Download <strong>formpilot-extension.zip</strong> with the button above and extract it to a folder you’ll keep (for example{' '}
        <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[13px]">Documents/formpilot-extension</code>).
      </>
    ),
  },
  {
    title: 'Load it in Chrome or Edge',
    body: (
      <>
        Open <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[13px]">chrome://extensions</code> (or{' '}
        <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[13px]">edge://extensions</code>), turn on <strong>Developer mode</strong>, choose{' '}
        <strong>Load unpacked</strong> and select the extracted folder (the one containing <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[13px]">manifest.json</code>).
      </>
    ),
  },
  { title: 'Connect it to your profile', body: <>Reload this page, then click <strong>Connect this browser</strong> below.</> },
]

const SENT = [
  'Each field’s label, name, placeholder, type and dropdown options',
  'The website’s address (origin only, like https://careers.example.com)',
]
const NEVER = ['Anything already typed into the website', 'The rest of the page’s text', 'Your password or any API key']

export function ExtensionPage() {
  usePageMeta({ title: 'Browser extension', path: '/extension' })
  const installed = useExtensionInstalled()
  const [connections, setConnections] = useState<ExtensionConnection[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justConnected, setJustConnected] = useState(false)

  const load = useCallback(() => api.extension.list().then(setConnections, () => setConnections([])), [])
  useEffect(() => {
    void load()
  }, [load])

  const connect = async () => {
    setBusy(true)
    setError(null)
    try {
      const created = await api.extension.connect(browserName())
      if (!created.token) throw new Error('No connection code was created.')
      await connectExtension(created.token)
      setJustConnected(true)
      await load()
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Couldn’t connect the extension.')
      await load() // a token may have been created; it can be disconnected below
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async (id: string) => {
    try {
      await api.extension.disconnect(id)
      setConnections((list) => list?.filter((c) => c.id !== id) ?? null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t disconnect.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="FormPilot browser extension"
        description="Build your profile once. Fill forms anywhere: job portals, admissions, scholarships, government forms, event registrations. FormPilot reads the form, matches it with your profile, and fills only what you approve. You always submit yourself."
        actions={
          <Button to="/anywhere" variant="secondary">
            Try the demo first
          </Button>
        }
      />

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent">
              <Puzzle className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-[16px] font-semibold text-ink">This browser</p>
              <p className="text-[14px] text-muted">
                {installed === null
                  ? 'Looking for the extension…'
                  : installed
                    ? justConnected
                      ? 'Connected. Open any website with a form and look for the FormPilot button.'
                      : 'Extension installed.'
                    : 'Extension not found in this browser. Install it with the steps below, then reload this page.'}
              </p>
            </div>
          </div>
          {justConnected ? (
            <Badge tone="success" icon={CheckCircle2}>
              Connected
            </Badge>
          ) : (
            <Button onClick={() => void connect()} disabled={!installed || busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Connect this browser
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-[14px] text-danger">
            {error}
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold text-ink">
            <Download className="size-4 text-accent" aria-hidden />
            Install in Chrome or Edge
          </h2>
          <a href="/formpilot-extension.zip" download className={`${buttonClasses('primary', 'md')} mt-4`}>
            <Download className="size-4" aria-hidden />
            Download extension (.zip)
          </a>
          <p className="mt-2 text-[13px] text-subtle">Ready to install. No build needed. Works in Chrome and Edge.</p>
          <ol className="mt-4 space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[12px] text-accent">{i + 1}</span>
                <div className="min-w-0 text-[14px] text-ink-2">
                  <p className="font-medium text-ink">{s.title}</p>
                  <p className="mt-0.5 break-words">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold text-ink">
            <ShieldCheck className="size-4 text-accent" aria-hidden />
            What the extension sends
          </h2>
          <p className="mt-3 text-[14px] text-ink-2">Only when you open FormPilot on a page, and only to your FormPilot account:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-ink-2">
            {SENT.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-3 text-[14px] text-ink-2">Never:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-ink-2">
            {NEVER.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-subtle">
            Dates of birth, addresses, ID numbers and file uploads are filled only after you confirm each one. FormPilot never submits a form.
          </p>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold text-ink">
          <MonitorSmartphone className="size-4 text-accent" aria-hidden />
          Connected browsers
        </h2>
        {connections === null ? (
          <p className="mt-3 text-[14px] text-muted">Loading…</p>
        ) : connections.length === 0 ? (
          <p className="mt-3 text-[14px] text-muted">No browsers connected yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {connections.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[15px] font-medium text-ink">{c.name}</p>
                  <p className="text-[13px] text-subtle">
                    Connected {timeAgo(c.created_at)} · {c.last_used_at ? `last used ${timeAgo(c.last_used_at)}` : 'not used yet'} · expires{' '}
                    {new Date(c.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="secondary" size="sm" className="text-danger" onClick={() => void disconnect(c.id)}>
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[13px] text-subtle">Changing your password disconnects every browser.</p>
      </Card>
    </div>
  )
}
