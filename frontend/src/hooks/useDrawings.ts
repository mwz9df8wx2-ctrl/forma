import { useMemo } from 'react'
import { buildSchedule, summarize } from '@/drawings/schedule'
import { hardwareTotals, moduleHardware } from '@/drawings/hardware'
import { buildWorktopPlan, renderWorktopSheet } from '@/drawings/worktop'
import { renderElevation } from '@/drawings/elevation'
import { renderPlan } from '@/drawings/plan'
import { buildSceneFromParams } from '@/render'
import { buildObjectLayout, isObjectCategory } from '@/drawings/object'
import { useCatalog } from './useCatalog'
import { useProject } from './useProject'

/**
 * Чертежи и ведомости проекта.
 *
 * Один расчёт на все экраны: лист чертежа, техпакет и смета обязаны показывать
 * одни и те же количества. Разойдись они — цех закупит не то, что нарисовано.
 */
export function useDrawings() {
  const { catalog } = useCatalog()
  const { params, title } = useProject()

  const layout = useMemo(() => {
    if (!catalog || !params.materialId || !params.colorId) return null

    // Корпусная мебель строится той же раскладкой, что и её визуализация:
    // число секций на чертеже и на картинке обязано совпадать.
    if (isObjectCategory(params.category)) {
      return buildObjectLayout({
        category: params.category,
        room: {
          width: params.dimensions.roomWidth / 1000,
          height: params.dimensions.roomHeight / 1000,
          depth: params.dimensions.roomDepth / 1000,
        },
        depth: params.dimensions.counterDepth / 1000,
        facadeLabel: catalog.colors.find((item) => item.id === params.colorId)?.name ?? 'Фасад',
      })
    }

    return buildSceneFromParams(catalog, params, 0).layout ?? null
  }, [catalog, params])

  const drawings = useMemo(() => {
    if (!layout || !catalog) return null
    const style = catalog.styles.find((item) => item.id === params.styleId)
    const handles = style ? style.traits.handles !== 'hidden' : true
    const worktop = buildWorktopPlan(layout)
    return {
      elevation: renderElevation(layout, title, 'main'),
      // Вторая развёртка появляется только у угловой кухни: рисовать обе
      // стены на одном листе нельзя, модули отложены по разным осям.
      elevationSide: layout.sideRun ? renderElevation(layout, title, 'side') : null,
      plan: renderPlan(layout, title),
      // Лист столешницы выпускается только там, где столешница есть.
      worktop: layout.hasWorktop ? renderWorktopSheet(worktop, layout, title) : null,
      worktopPlan: worktop,
      schedule: buildSchedule(layout).map((row) => {
        const module = layout.modules.find((item) => item.id === row.id)
        const hardware = module ? moduleHardware(module, { handles }) : null
        return { ...row, hardware }
      }),
      hardware: hardwareTotals(layout, { handles, worktopJoints: worktop.joints }),
      stats: summarize(layout),
    }
  }, [layout, title, catalog, params.styleId])

  return { layout, drawings, catalog, params, title }
}
