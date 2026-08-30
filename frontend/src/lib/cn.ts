type ClassValue = string | number | false | null | undefined

/** Простое объединение классов без внешних зависимостей. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ')
}
