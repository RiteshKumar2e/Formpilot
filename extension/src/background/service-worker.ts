/**
 * Service worker: the only part of the extension that talks to the FormPilot API. Content scripts run
 * inside other websites, so they ask through messages instead of holding the token themselves.
 * Personal data is never logged.
 */

import { api, apiBlob, ApiError, settings } from '../api-client'
import type { SmartAnswer, SuggestResponse } from '../core/types'
import { STORAGE, type DownloadedFile, type Reply, type Request, type Status } from '../shared/messages'

/** Settings and connection state. `verify` also checks the token with the API (the popup does). */
async function status(verify = true): Promise<Status> {
  const stored = await chrome.storage.local.get([STORAGE.showButton, STORAGE.hiddenSites])
  const { appUrl, token } = await settings()
  const base: Status = {
    connected: false,
    appUrl,
    showButton: stored[STORAGE.showButton] !== false,
    hiddenSites: (stored[STORAGE.hiddenSites] as string[]) ?? [],
  }
  if (!token) return base
  if (!verify) return { ...base, connected: true }
  try {
    const me = await api<{ email: string; full_name: string }>('/auth/me')
    return { ...base, connected: true, email: me.email, name: me.full_name }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return base
    return { ...base, connected: true } // offline: keep the token, show the error when used
  }
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

/** Only the configured FormPilot app may hand the extension a token. */
async function fromApp(sender: chrome.MessageSender): Promise<boolean> {
  const { appUrl } = await settings()
  const url = sender.tab?.url ?? sender.url
  if (!url) return false
  try {
    return new URL(url).origin === new URL(appUrl).origin
  } catch {
    return false
  }
}

async function handle(message: Request, sender: chrome.MessageSender): Promise<unknown> {
  switch (message.type) {
    case 'status':
      return status(message.verify !== false)
    case 'suggest':
      return api<SuggestResponse>('/autofill/suggest', {
        method: 'POST',
        body: JSON.stringify({
          fields: message.fields,
          page_url: message.pageOrigin, // origin only, never the full URL
          page_title: message.pageTitle.slice(0, 300),
          organization: message.organization,
        }),
      })
    case 'answer':
      return api<SmartAnswer>('/answers/suggest', {
        method: 'POST',
        body: JSON.stringify({ question: message.question, organization: message.organization }),
      })
    case 'download': {
      const docs = await api<{ id: string; filename: string; content_type: string }[]>('/documents')
      const doc = docs.find((d) => d.id === message.documentId)
      if (!doc) throw new ApiError('That document is no longer in your vault.', 404)
      const blob = await apiBlob(`/documents/${encodeURIComponent(doc.id)}/file`)
      const file: DownloadedFile = { name: doc.filename, mime: doc.content_type, base64: toBase64(await blob.arrayBuffer()) }
      return file
    }
    case 'save-profile':
      await api('/profile/conflicts/resolve', { method: 'POST', body: JSON.stringify({ key: message.key, value: message.value }) })
      return undefined
    case 'save-answer':
      await api('/answers', { method: 'POST', body: JSON.stringify({ question: message.question, answer: message.answer }) })
      return undefined
    case 'open-connect': {
      const { appUrl } = await settings()
      await chrome.tabs.create({ url: `${appUrl.replace(/\/$/, '')}/extension` })
      return undefined
    }
    case 'connect':
      if (!(await fromApp(sender))) throw new ApiError('Only the FormPilot app can connect this extension.', 403)
      if (!/^fpx_[\w-]{20,}$/.test(message.token)) throw new ApiError('That connection code isn’t valid.', 400)
      await chrome.storage.local.set({ [STORAGE.token]: message.token })
      return status()
    case 'disconnect':
      await chrome.storage.local.remove(STORAGE.token)
      return undefined
  }
}

chrome.runtime.onMessage.addListener((message: Request, sender, sendResponse) => {
  handle(message, sender).then(
    (data) => sendResponse({ ok: true, data } satisfies Reply<unknown>),
    (err) =>
      sendResponse({
        ok: false,
        error: err instanceof ApiError ? err.message : 'Something went wrong in FormPilot.',
        status: err instanceof ApiError ? err.status : undefined,
      } satisfies Reply<unknown>),
  )
  return true // the reply is sent asynchronously
})

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') void handle({ type: 'open-connect' }, {})
})
