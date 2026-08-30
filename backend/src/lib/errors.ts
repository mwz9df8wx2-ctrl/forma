/** Ошибка с кодом состояния и текстом, который не стыдно показать пользователю. */
export class HttpError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

export const badRequest = (message: string) => new HttpError(400, 'bad_request', message)
export const unauthorized = (message = 'Требуется вход') => new HttpError(401, 'unauthorized', message)
export const forbidden = (message = 'Нет доступа') => new HttpError(403, 'forbidden', message)
export const notFound = (message = 'Не найдено') => new HttpError(404, 'not_found', message)
export const conflict = (message: string) => new HttpError(409, 'conflict', message)
export const tooLarge = (message: string) => new HttpError(413, 'too_large', message)
export const unavailable = (message: string) => new HttpError(503, 'unavailable', message)
/** Кредиты закончились: 402 отличает нехватку оплаты от конфликта состояния. */
export const paymentRequired = (message: string) => new HttpError(402, 'no_credits', message)
/** Превышен лимит: частота запусков, одновременные задания или бюджет. */
export const tooManyRequests = (message: string) => new HttpError(429, 'rate_limited', message)
