/** Messages between the content script, the popup and the service worker. */

import type { FieldMeta } from '../core/field-detector'
import type { SmartAnswer, SuggestResponse } from '../core/types'

export type Request =
  | { type: 'status'; verify?: boolean }
  | { type: 'suggest'; fields: FieldMeta[]; pageOrigin: string; pageTitle: string; organization?: string }
  | { type: 'answer'; question: string; organization?: string }
  | { type: 'download'; documentId: string }
  | { type: 'save-profile'; key: string; value: string }
  | { type: 'save-answer'; question: string; answer: string }
  | { type: 'open-connect' }
  | { type: 'connect'; token: string }
  | { type: 'disconnect' }

export interface Status {
  connected: boolean
  appUrl: string
  email?: string
  name?: string
  showButton: boolean
  hiddenSites: string[]
}

export interface DownloadedFile {
  name: string
  mime: string
  base64: string
}

/** Every reply has this shape, so failures reach the UI as a message instead of an exception. */
export type Reply<T> = { ok: true; data: T } | { ok: false; error: string; status?: number }

export type ReplyFor<R extends Request> = R extends { type: 'status' }
  ? Status
  : R extends { type: 'suggest' }
    ? SuggestResponse
    : R extends { type: 'answer' }
      ? SmartAnswer
      : R extends { type: 'download' }
        ? DownloadedFile
        : void

/** Sends a request to the service worker. */
export async function send<R extends Request>(request: R): Promise<Reply<ReplyFor<R>>> {
  try {
    return await chrome.runtime.sendMessage<Reply<ReplyFor<R>>>(request)
  } catch {
    return { ok: false, error: 'FormPilot was updated or restarted. Reload this page to use it again.' }
  }
}

/** Opened from the popup: the active tab's content script shows the panel. */
export interface TabCommand {
  type: 'open-panel'
}

// Settings kept in chrome.storage.local
// The deployed FormPilot app. For local development, set http://localhost:5173 in the popup's settings.
export const DEFAULT_APP_URL = 'https://formpilot-six.vercel.app'
export const STORAGE = { token: 'fpToken', appUrl: 'fpAppUrl', showButton: 'fpShowButton', hiddenSites: 'fpHiddenSites' } as const
