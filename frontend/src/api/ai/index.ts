export { aiBackend } from './aiBackend'
export { buildAiPrompt } from './prompt'
export { getProvider, type AiProvider } from './providers'
// Модуль Claude тянет за собой SDK, поэтому подключается динамически —
// см. loadClaude(). Здесь только тип, он стирается при сборке.
export type { InteriorAnalysis } from './claude'

/** Ленивая загрузка разбора снимков: SDK не попадает в основной бандл. */
export const loadClaude = () => import('./claude')
export {
  DEFAULT_AI_SETTINGS,
  clearAiSettings,
  isAiReady,
  isClaudeReady,
  loadAiSettings,
  saveAiSettings,
  type AiProviderId,
  type AiSettings,
} from './settings'
