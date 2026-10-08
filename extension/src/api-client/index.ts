/**
 * API client used by the service worker. It holds the extension's token (created in the FormPilot web
 * app, revocable there) and talks to the FormPilot API at the configured app URL. No API secret is
 * ever shipped in the extension.
 */

import { DEFAULT_APP_URL, STORAGE } from '../shared/messages'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function settings(): Promise<{ appUrl: string; token: string | null }> {
  const stored = await chrome.storage.local.get([STORAGE.appUrl, STORAGE.token])
  return { appUrl: (stored[STORAGE.appUrl] as string) || DEFAULT_APP_URL, token: (stored[STORAGE.token] as string) || null }
}

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  const { appUrl, token } = await settings()
  if (!token) throw new ApiError('Connect FormPilot to your account first.', 401)
  let res: Response
  try {
    res = await fetch(`${appUrl.replace(/\/$/, '')}/api${path}`, {
      ...init,
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(`Couldn’t reach FormPilot at ${appUrl}. Is it running?`, 0)
  }
  if (res.status === 401) {
    // Revoked, expired, or the password changed: forget the token so the UI asks to reconnect.
    await chrome.storage.local.remove(STORAGE.token)
    throw new ApiError('Your FormPilot connection ended. Connect again from the FormPilot app.', 401)
  }
  if (!res.ok) {
    let message = 'Something went wrong. Please try again.'
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') message = body.detail
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(message, res.status)
  }
  return res
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await raw(path, init)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function apiBlob(path: string): Promise<Blob> {
  return (await raw(path)).blob()
}
