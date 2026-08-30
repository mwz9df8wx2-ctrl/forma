/**
 * Проверки полей форм.
 *
 * Сообщение объясняет, что не так, а не просто гасит кнопку: человек не должен
 * гадать, почему форма не отправляется.
 */

export const MIN_PASSWORD_LENGTH = 8

export function emailError(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) return 'Укажите рабочую почту'
  // Проверка намеренно мягкая: настоящую валидность подтвердит только сервер.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return 'Похоже на опечатку в адресе'
  return null
}

export function passwordError(value: string): string | null {
  if (value.length === 0) return 'Придумайте пароль'
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Не короче ${MIN_PASSWORD_LENGTH} символов — сейчас ${value.length}`
  }
  return null
}

export function requiredError(value: string, label: string, min = 2): string | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) return `Заполните поле «${label}»`
  if (trimmed.length < min) return `Слишком коротко для поля «${label}»`
  return null
}

export function repeatError(password: string, repeat: string): string | null {
  if (repeat.length === 0) return 'Повторите пароль'
  if (password !== repeat) return 'Пароли не совпадают'
  return null
}
