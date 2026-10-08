/** The few chrome.* extension APIs FormPilot uses (Chrome and Edge, Manifest V3). */
declare namespace chrome {
  interface MessageSender {
    id?: string
    url?: string
    origin?: string
    tab?: { id?: number; url?: string }
  }

  namespace runtime {
    const id: string
    const lastError: { message?: string } | undefined
    function sendMessage<T = unknown>(message: unknown): Promise<T>
    function getURL(path: string): string
    function getManifest(): { version: string }
    function openOptionsPage(): Promise<void>
    const onMessage: {
      addListener(
        callback: (message: any, sender: MessageSender, sendResponse: (response?: unknown) => void) => boolean | void,
      ): void
    }
    const onInstalled: { addListener(callback: (details: { reason: string }) => void): void }
  }

  namespace storage {
    const local: {
      get(keys: string | string[] | null): Promise<Record<string, any>>
      set(items: Record<string, unknown>): Promise<void>
      remove(keys: string | string[]): Promise<void>
    }
    const onChanged: { addListener(callback: (changes: Record<string, { newValue?: unknown }>, area: string) => void): void }
  }

  namespace tabs {
    interface Tab {
      id?: number
      url?: string
    }
    function create(options: { url: string }): Promise<Tab>
    function query(query: { active?: boolean; currentWindow?: boolean }): Promise<Tab[]>
    function sendMessage<T = unknown>(tabId: number, message: unknown): Promise<T>
  }

  namespace permissions {
    function request(permissions: { origins?: string[] }): Promise<boolean>
    function contains(permissions: { origins?: string[] }): Promise<boolean>
  }
}
