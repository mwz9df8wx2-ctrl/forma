/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Публичный адрес API. Секретов здесь быть не должно — переменные VITE_* попадают в бандл. */
  readonly VITE_API_URL?: string
  /** 'true' — приложение работает на встроенных демо-данных без бэкенда. */
  readonly VITE_USE_MOCK_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
