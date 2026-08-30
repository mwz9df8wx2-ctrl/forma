import type { CSSProperties } from 'react'
import { darken, lighten, withAlpha } from '@/lib/color'
import type { GrainKind, SurfacePreview } from '@/types'

/** Превью поверхности целиком на CSS — никаких внешних изображений. */
export function surfaceStyle(preview: SurfacePreview): CSSProperties {
  const { base, highlight, shade, grain } = preview

  switch (grain) {
    case 'wood':
      return {
        backgroundColor: base,
        backgroundImage: [
          `repeating-linear-gradient(92deg, ${withAlpha(shade, 0.24)} 0 1px, transparent 1px 7px)`,
          `repeating-linear-gradient(88deg, ${withAlpha(highlight, 0.3)} 0 1px, transparent 1px 13px)`,
          `linear-gradient(168deg, ${withAlpha(highlight, 0.5)}, transparent 45%, ${withAlpha(shade, 0.42)})`,
        ].join(','),
      }
    case 'veneer':
      return {
        backgroundColor: base,
        backgroundImage: [
          `repeating-linear-gradient(90deg, ${withAlpha(shade, 0.16)} 0 2px, transparent 2px 11px)`,
          `radial-gradient(120% 60% at 30% 20%, ${withAlpha(highlight, 0.45)}, transparent 70%)`,
          `linear-gradient(170deg, ${withAlpha(highlight, 0.35)}, transparent 50%, ${withAlpha(shade, 0.4)})`,
        ].join(','),
      }
    case 'gloss':
      return {
        backgroundColor: base,
        backgroundImage: [
          `linear-gradient(118deg, ${withAlpha('#ffffff', 0.72)} 0 14%, transparent 30% 52%, ${withAlpha('#ffffff', 0.4)} 60% 66%, transparent 80%)`,
          `linear-gradient(180deg, ${withAlpha(highlight, 0.5)}, ${withAlpha(shade, 0.5)})`,
        ].join(','),
      }
    case 'marble':
      return {
        backgroundColor: base,
        backgroundImage: [
          `linear-gradient(112deg, transparent 32%, ${withAlpha(shade, 0.5)} 33%, transparent 35%)`,
          `linear-gradient(102deg, transparent 54%, ${withAlpha(shade, 0.32)} 55%, transparent 57%)`,
          `linear-gradient(126deg, transparent 68%, ${withAlpha(shade, 0.22)} 69%, transparent 71%)`,
          `radial-gradient(90% 70% at 20% 15%, ${withAlpha(highlight, 0.65)}, transparent 65%)`,
          `linear-gradient(165deg, ${withAlpha(highlight, 0.35)}, transparent 60%, ${withAlpha(shade, 0.25)})`,
        ].join(','),
      }
    case 'stone':
      return {
        backgroundColor: base,
        backgroundImage: [
          `radial-gradient(28% 34% at 22% 30%, ${withAlpha(shade, 0.22)}, transparent 70%)`,
          `radial-gradient(34% 30% at 74% 62%, ${withAlpha(highlight, 0.45)}, transparent 70%)`,
          `radial-gradient(22% 26% at 52% 84%, ${withAlpha(shade, 0.18)}, transparent 70%)`,
          `linear-gradient(160deg, ${withAlpha(highlight, 0.3)}, transparent 55%, ${withAlpha(shade, 0.3)})`,
        ].join(','),
      }
    case 'speck':
      return {
        backgroundColor: base,
        backgroundImage: [
          `radial-gradient(circle at 1px 1px, ${withAlpha(shade, 0.35)} 1px, transparent 0)`,
          `radial-gradient(circle at 4px 6px, ${withAlpha(highlight, 0.55)} 1px, transparent 0)`,
          `linear-gradient(165deg, ${withAlpha(highlight, 0.4)}, transparent 55%, ${withAlpha(shade, 0.28)})`,
        ].join(','),
        backgroundSize: '9px 9px, 13px 13px, 100% 100%',
      }
    case 'linear':
      return {
        backgroundColor: base,
        backgroundImage: [
          `repeating-linear-gradient(180deg, ${withAlpha(shade, 0.16)} 0 1px, transparent 1px 5px)`,
          `linear-gradient(165deg, ${withAlpha(highlight, 0.4)}, transparent 55%, ${withAlpha(shade, 0.3)})`,
        ].join(','),
      }
    default:
      return {
        backgroundColor: base,
        backgroundImage: `linear-gradient(160deg, ${withAlpha(highlight, 0.55)}, transparent 45%, ${withAlpha(shade, 0.38)})`,
      }
  }
}

/** Строит превью поверхности из одного цвета каталога. */
export function previewFromHex(hex: string, grain: GrainKind): SurfacePreview {
  return {
    base: hex,
    highlight: lighten(hex, 0.22),
    shade: darken(hex, 0.22),
    grain,
  }
}
