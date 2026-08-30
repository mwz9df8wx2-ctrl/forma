import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Конфигурация сервера.
 * Секреты читаются только здесь и никогда не покидают процесс.
 */

function loadDotEnv(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index < 0) continue
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim()
      if (!(key in process.env)) process.env[key] = value
    }
  } catch {
    /* .env необязателен: в продакшене переменные задаёт окружение */
  }
}

loadDotEnv()

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (value === undefined || value === '') {
    throw new Error(`Не задана переменная окружения ${name}`)
  }
  return value
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  databaseFile: required('DATABASE_FILE', './data/forma.db'),
  storageDir: required('STORAGE_DIR', './data/files'),
  sessionSecret: required('SESSION_SECRET', 'dev-secret-not-for-production'),
  openAiKey: process.env.OPENAI_API_KEY ?? '',
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? '',
  aiEnabled: (process.env.AI_GENERATION_ENABLED ?? 'true') !== 'false',
  isProduction: process.env.NODE_ENV === 'production',
}

/** Проверка конфигурации при старте: лучше упасть сразу, чем на первом запросе. */
export function validateEnv(): string[] {
  const warnings: string[] = []
  if (env.isProduction && env.sessionSecret.startsWith('dev-')) {
    throw new Error('SESSION_SECRET не задан в продакшене')
  }
  if (!env.openAiKey) warnings.push('OPENAI_API_KEY не задан — генерация изображений недоступна')
  if (!env.anthropicKey) warnings.push('ANTHROPIC_API_KEY не задан — разбор фотографии недоступен')
  if (!env.aiEnabled) warnings.push('генерация выключена глобально (AI_GENERATION_ENABLED=false)')
  return warnings
}
