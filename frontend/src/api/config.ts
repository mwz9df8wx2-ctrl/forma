/**
 * Публичная конфигурация фронтенда.
 *
 * Важно: переменные VITE_* попадают в клиентский бандл, поэтому здесь
 * допустим только публичный адрес API. Ключи и секреты живут на бэкенде.
 */
const rawApiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8787/api/v1'

export const API_URL = rawApiUrl.replace(/\/+$/, '')

/** По умолчанию демо-режим включён — приложение работает без FastAPI. */
export const USE_MOCK_API = (import.meta.env.VITE_USE_MOCK_API ?? 'true').toLowerCase() !== 'false'

/** Таймаут сетевого запроса, мс. */
export const REQUEST_TIMEOUT = 20000
