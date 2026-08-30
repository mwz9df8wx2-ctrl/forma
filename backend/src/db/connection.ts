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

/**
 * Добавление колонки к существующей таблице.
 *
 * CREATE TABLE IF NOT EXISTS не трогает уже созданную таблицу, поэтому новые
 * поля не появляются сами. Полноценные миграции пока избыточны, но молча
 * работать со старой схемой нельзя: запрос упадёт на первом же обращении.
 */
export function ensureColumn(table: string, column: string, definition: string): void {
  const columns = db().prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[]
  if (columns.some((item) => item.name === column)) return
  db().exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

/** Применение схемы. Идемпотентно: все таблицы через IF NOT EXISTS. */
export function applySchema(): void {
  const here = dirname(fileURLToPath(import.meta.url))
  const sql = readFileSync(resolve(here, 'schema.sql'), 'utf8')
  db().exec(sql)

  // Базы, созданные до появления цен, дополняются на месте.
  // Цены только целыми копейками: REAL в деньгах теряет копейки округлением.
  ensureColumn('catalog_items', 'price_unit', "TEXT NOT NULL DEFAULT 'piece'")
  ensureColumn('catalog_items', 'purchase_price_kopecks', 'INTEGER')
  ensureColumn('catalog_items', 'sale_price_kopecks', 'INTEGER')
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
