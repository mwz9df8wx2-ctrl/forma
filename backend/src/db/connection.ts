import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../env.ts'

/**
 * Подключение к базе.
 *
 * SQLite выбран сознательно: нулевая инфраструктура, встроен в Node,
 * настоящие транзакции — они нужны для резервирования кредитов.
 * SQL написан переносимо, переезд на MySQL или PostgreSQL механический.
 */

let database: DatabaseSync | null = null

export function db(): DatabaseSync {
  if (database) return database

  mkdirSync(dirname(resolve(env.databaseFile)), { recursive: true })
  database = new DatabaseSync(resolve(env.databaseFile))
  database.exec('PRAGMA journal_mode = WAL')
  database.exec('PRAGMA foreign_keys = ON')
  return database
}

/** Применение схемы. Идемпотентно: все таблицы через IF NOT EXISTS. */
export function applySchema(): void {
  const here = dirname(fileURLToPath(import.meta.url))
  const sql = readFileSync(resolve(here, 'schema.sql'), 'utf8')
  db().exec(sql)
}

/**
 * Транзакция. Всё внутри либо применяется целиком, либо откатывается.
 * Резервирование кредитов и создание задания обязаны быть атомарными.
 */
export function transaction<T>(work: () => T): T {
  const connection = db()
  connection.exec('BEGIN IMMEDIATE')
  try {
    const result = work()
    connection.exec('COMMIT')
    return result
  } catch (error) {
    connection.exec('ROLLBACK')
    throw error
  }
}

export function closeDb(): void {
  database?.close()
  database = null
}
