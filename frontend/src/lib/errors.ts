export type AppErrorCode =
  | 'network'
  | 'server'
  | 'unavailable'
  | 'photo_too_large'
  | 'photo_unsupported'
  | 'camera_denied'
  | 'camera_unavailable'
  | 'not_found'
  | 'cancelled'
  | 'unknown'

/** Ошибка приложения с человеческим текстом. Stack trace пользователю не показываем. */
export class AppError extends Error {
  readonly code: AppErrorCode
  readonly status?: number

  constructor(code: AppErrorCode, message?: string, status?: number) {
    super(message ?? ERROR_MESSAGES[code])
    this.name = 'AppError'
    this.code = code
    this.status = status
  }
}

export const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  network: 'Нет соединения с сервером.',
  server: 'Сервер временно недоступен. Попробуйте ещё раз.',
  unavailable: 'Не удалось создать визуализацию. Попробуйте ещё раз.',
  photo_too_large: 'Фотография слишком большая. Выберите изображение до 15 МБ.',
  photo_unsupported: 'Этот файл не является фотографией. Выберите изображение.',
  camera_denied: 'Нет доступа к камере. Разрешите съёмку в настройках браузера.',
  camera_unavailable: 'Камера недоступна на этом устройстве.',
  not_found: 'Проект не найден.',
  cancelled: 'Создание визуализации отменено.',
  unknown: 'Что-то пошло не так. Попробуйте ещё раз.',
}

/** Приводит любую пойманную ошибку к безопасному для показа тексту. */
export function toAppError(error: unknown, fallback: AppErrorCode = 'unknown'): AppError {
  if (error instanceof AppError) return error
  if (error instanceof TypeError) return new AppError('network')
  return new AppError(fallback)
}
