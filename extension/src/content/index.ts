/**
 * Content script, on every http(s) page.
 *
 * On ordinary websites it watches for forms (including ones that appear later, in single-page apps and
 * multi-step applications), shows the FormPilot control when it finds some, and fills only what the
 * person approves. Nothing is sent anywhere until the person opens FormPilot on that page.
 *
 * On the FormPilot web app itself it does one thing: receive the connection token from the
 * "Connect browser extension" page.
 */

import { detectFields, signature } from '../core/field-detector'
import { DEFAULT_APP_URL, send, type Status, type TabCommand } from '../shared/messages'
import { Overlay } from './ui'

const RESCAN_DELAY_MS = 600

function appOrigin(status: Status | null): string {
  try {
    return new URL(status?.appUrl ?? DEFAULT_APP_URL).origin
  } catch {
    return new URL(DEFAULT_APP_URL).origin
  }
}

/** On the FormPilot app: hand the token from the connect page to the service worker. */
function bridgeToApp(): void {
  document.documentElement.dataset.formpilotExtension = chrome.runtime.getManifest().version
  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== location.origin) return
    const data = event.data as { source?: string; type?: string; token?: unknown } | null
    if (!data || data.source !== 'formpilot-web') return
    if (data.type === 'connect' && typeof data.token === 'string') {
      const reply = await send({ type: 'connect', token: data.token })
      window.postMessage(
        { source: 'formpilot-extension', type: 'connect-result', ok: reply.ok, error: reply.ok ? undefined : reply.error },
        location.origin,
      )
    }
  })
}

async function main(): Promise<void> {
  const reply = await send({ type: 'status', verify: false })
  const status = reply.ok ? reply.data : null
  if (location.origin === appOrigin(status)) return bridgeToApp()
  if (!status) return

  const overlay = new Overlay(status)
  let last = ''
  const scan = () => {
    const fields = detectFields(document)
    const sig = signature(fields)
    if (sig === last) return
    last = sig
    overlay.setFields(fields)
  }
  scan()

  // Forms that appear or change after load: SPAs, "Next step" in multi-page applications.
  let timer = 0
  new MutationObserver(() => {
    window.clearTimeout(timer)
    timer = window.setTimeout(scan, RESCAN_DELAY_MS)
  }).observe(document.body ?? document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'style', 'class', 'disabled', 'aria-hidden'],
  })

  // "Find fields on this page" in the popup.
  chrome.runtime.onMessage.addListener((message: TabCommand, _sender, sendResponse) => {
    if (message?.type !== 'open-panel') return
    last = ''
    scan()
    void overlay.openPanel()
    sendResponse({ ok: true })
  })
}

void main()
