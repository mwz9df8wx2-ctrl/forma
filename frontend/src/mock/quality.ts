import { readStorage, writeStorage } from '@/lib/storage'

/** Уровень качества визуализации. */
export type QualityTier = 'fast' | 'balanced' | 'quality'

export interface QualityProfile {
  tier: QualityTier
  width: number
  aoSamples: number
  sceneQuality: 'preview' | 'high'
  label: string
  description: string
}

const STORAGE_KEY = 'forma.quality.v1'

const PROFILES: Record<QualityTier, Omit<QualityProfile, 'tier' | 'width'> & { width: number }> = {
  fast: {
    width: 640,
    aoSamples: 2,
    sceneQuality: 'preview',
    label: 'Быстро',
    description: 'Черновой просчёт за считаные секунды — чтобы быстро перебрать варианты.',
  },
  balanced: {
    width: 800,
    aoSamples: 3,
    sceneQuality: 'preview',
    label: 'Сбалансированно',
    description: 'Разумный компромисс скорости и детализации. Подходит для показа клиенту.',
  },
  quality: {
    width: 1040,
    aoSamples: 4,
    sceneQuality: 'high',
    label: 'Качество',
    description: 'Максимальная детализация и мягкость света. Считается заметно дольше.',
  },
}

export function loadQualityTier(): QualityTier {
  const stored = readStorage<QualityTier | null>(STORAGE_KEY, null)
  return stored === 'fast' || stored === 'balanced' || stored === 'quality' ? stored : 'balanced'
}

export function saveQualityTier(tier: QualityTier): void {
  writeStorage(STORAGE_KEY, tier)
}

export const QUALITY_TIERS: QualityTier[] = ['fast', 'balanced', 'quality']

export function qualityProfile(tier: QualityTier = loadQualityTier()): QualityProfile {
  const base = PROFILES[tier]
  // Слабое устройство не должно уходить в долгий просчёт.
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4
  const cap = cores >= 8 ? 1040 : cores >= 4 ? 880 : 660
  return {
    tier,
    ...base,
    width: Math.min(base.width, cap),
    aoSamples: cores >= 4 ? base.aoSamples : Math.max(2, base.aoSamples - 1),
  }
}

export function qualityLabel(tier: QualityTier): string {
  return PROFILES[tier].label
}

export function qualityDescription(tier: QualityTier): string {
  return PROFILES[tier].description
}
