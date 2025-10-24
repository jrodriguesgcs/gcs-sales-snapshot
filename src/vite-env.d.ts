/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AC_API_URL: string
  readonly VITE_AC_API_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}