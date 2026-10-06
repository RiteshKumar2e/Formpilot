/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_PLAUSIBLE_DOMAIN?: string
  readonly VITE_PLAUSIBLE_SRC?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
