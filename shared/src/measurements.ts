import type { Appliance, ProjectSpec, Utility, ValueStatus } from './spec.ts'

/**
 * Лист замеров.
 *
 * Главное правило этапа: размеры нельзя определять по фотографии. Ошибка
 * в 30–50 мм делает столешницу непригодной — её уже отпилили. Поэтому у
 * каждого значения есть статус, и в производство уходят только подтверждённые
 * замеры, а не то, что удалось предположить по снимку.
 */

export type MeasurementGroup = 'room' | 'appliance' | 'utility'

export interface MeasurementItem {
  /** Устойчивый идентификатор: `roomWidth`, `appliance:hob`, `utility:drain`. */
  id: string
  group: MeasurementGroup
  label: string
  /** Зачем этот размер нужен. Показывается замерщику, а не прячется в коде. */
  reason: string
  value: number | null
  status: ValueStatus
  /** Без него нельзя выпускать техпакет. */
  required: boolean
  /** Допустимый диапазон: защита от опечатки на порядок. */
  min: number
  max: number
}

const APPLIANCE_LABELS: Record<Appliance['slot'], string> = {
  hob: 'Ширина варочной панели',
  oven: 'Ширина духового шкафа',
  dishwasher: 'Ширина посудомоечной машины',
  fridge: 'Ширина холодильника',
  microwave: 'Ширина микроволновой печи',
  hood: 'Ширина вытяжки',
  sink: 'Ширина мойки',
}

const APPLIANCE_REASONS: Record<Appliance['slot'], string> = {
  hob: 'По ней размечается вырез в столешнице.',
  oven: 'Определяет ширину ниши и раскрой корпуса.',
  dishwasher: 'Определяет ширину ниши и место подключения.',
  fridge: 'Съедает длину фронта — без неё модули не разложить.',
  microwave: 'Определяет размер ниши.',
  hood: 'Привязывает верхние шкафы к воздуховоду.',
  sink: 'По ней размечается вырез и подбирается тумба.',
}

const UTILITY_LABELS: Record<Utility['kind'], string> = {
  cold_water: 'Холодная вода: расстояние от угла',
  hot_water: 'Горячая вода: расстояние от угла',
  drain: 'Канализация: расстояние от угла',
  socket: 'Розетка: расстояние от угла',
  switch: 'Выключатель: расстояние от угла',
  ventilation: 'Вентиляция: расстояние от угла',
  gas: 'Газ: расстояние от угла',
}

/** Техника, без которой раскладку модулей делать нельзя. */
const REQUIRED_APPLIANCES: Appliance['slot'][] = ['fridge', 'hob', 'sink']

/** Точки подключения, определяющие положение мойки и посудомоечной машины. */
const REQUIRED_UTILITIES: Utility['kind'][] = ['cold_water', 'drain']

function roomItems(spec: ProjectSpec): MeasurementItem[] {
  const d = spec.dimensions
  const status = (key: string): ValueStatus => spec.dimensionStatus[key] ?? 'missing'

  const items: MeasurementItem[] = [
    {
      id: 'roomWidth',
      group: 'room',
      label: 'Длина стены с кухней',
      reason: 'Задаёт длину фронта. От неё считаются все модули.',
      value: d.roomWidth || null,
      status: d.roomWidth > 0 ? status('roomWidth') : 'missing',
      required: true,
      min: 800,
      max: 12000,
    },
    {
      id: 'roomHeight',
      group: 'room',
      label: 'Высота помещения',
      reason: 'Определяет высоту верхних шкафов и антресолей.',
      value: d.roomHeight || null,
      status: d.roomHeight > 0 ? status('roomHeight') : 'missing',
      required: true,
      min: 2000,
      max: 4500,
    },
    {
      id: 'counterHeight',
      group: 'room',
      label: 'Высота столешницы от пола',
      reason: 'Обычно 900 мм, но под рост заказчика меняется.',
      value: d.counterHeight || null,
      status: d.counterHeight > 0 ? status('counterHeight') : 'missing',
      required: true,
      min: 700,
      max: 1100,
    },
    {
      id: 'counterDepth',
      group: 'room',
      label: 'Глубина столешницы',
      reason: 'Стандарт 600 мм. Меняется, если проход становится узким.',
      value: d.counterDepth || null,
      status: d.counterDepth > 0 ? status('counterDepth') : 'missing',
      required: true,
      min: 400,
      max: 1200,
    },
    {
      id: 'roomDepth',
      group: 'room',
      label: 'Глубина помещения',
      reason: 'Нужна, чтобы проверить ширину прохода перед кухней.',
      value: d.roomDepth || null,
      status: d.roomDepth > 0 ? status('roomDepth') : 'missing',
      required: false,
      min: 1000,
      max: 12000,
    },
  ]

  if (spec.layoutKind === 'corner') {
    items.splice(1, 0, {
      id: 'sideRun',
      group: 'room',
      label: 'Длина боковой стены',
      reason: 'Вторая сторона угла. Без неё угловой модуль не рассчитать.',
      value: d.sideRun || null,
      status: d.sideRun > 0 ? status('sideRun') : 'missing',
      required: true,
      min: 600,
      max: 12000,
    })
  }

  return items
}

export function measurementChecklist(spec: ProjectSpec): MeasurementItem[] {
  const items = roomItems(spec)

  for (const slot of REQUIRED_APPLIANCES) {
    const found = spec.appliances.find((item) => item.slot === slot)
    items.push({
      id: `appliance:${slot}`,
      group: 'appliance',
      label: APPLIANCE_LABELS[slot],
      reason: APPLIANCE_REASONS[slot],
      value: found?.widthMm ?? null,
      status: found && found.widthMm > 0 ? found.status : 'missing',
      required: true,
      min: 150,
      max: 1400,
    })
  }

  // Остальная техника попадает в лист, только если её уже указали.
  for (const appliance of spec.appliances) {
    if (REQUIRED_APPLIANCES.includes(appliance.slot)) continue
    items.push({
      id: `appliance:${appliance.slot}`,
      group: 'appliance',
      label: APPLIANCE_LABELS[appliance.slot],
      reason: APPLIANCE_REASONS[appliance.slot],
      value: appliance.widthMm || null,
      status: appliance.widthMm > 0 ? appliance.status : 'missing',
      required: false,
      min: 150,
      max: 1400,
    })
  }

  for (const kind of REQUIRED_UTILITIES) {
    const found = spec.utilities.find((item) => item.kind === kind)
    items.push({
      id: `utility:${kind}`,
      group: 'utility',
      label: UTILITY_LABELS[kind],
      reason: 'Определяет, где встанет мойка. Перенос стояка — отдельная работа.',
      value: found?.offsetMm ?? null,
      status: found && found.offsetMm > 0 ? found.status : 'missing',
      required: true,
      min: 0,
      max: 12000,
    })
  }

  for (const utility of spec.utilities) {
    if (REQUIRED_UTILITIES.includes(utility.kind)) continue
    items.push({
      id: `utility:${utility.kind}`,
      group: 'utility',
      label: UTILITY_LABELS[utility.kind],
      reason: 'Влияет на расположение техники и розеточных групп.',
      value: utility.offsetMm || null,
      status: utility.offsetMm > 0 ? utility.status : 'missing',
      required: false,
      min: 0,
      max: 12000,
    })
  }

  return items
}

export interface MeasurementSummary {
  /** Подтверждённых обязательных значений. */
  confirmed: number
  /** Всего обязательных значений. */
  required: number
  /** Чего не хватает совсем. */
  missing: string[]
  /** Что есть, но взято из предположения, а не из замера. */
  unconfirmed: string[]
  /** Можно ли выпускать техпакет: только по подтверждённым замерам. */
  readyForProduction: boolean
}

export function measurementSummary(spec: ProjectSpec): MeasurementSummary {
  const items = measurementChecklist(spec).filter((item) => item.required)
  const missing = items.filter((item) => item.status === 'missing').map((item) => item.label)
  const unconfirmed = items
    .filter((item) => item.status === 'estimated')
    .map((item) => item.label)
  const confirmed = items.filter(
    (item) => item.status === 'confirmed' || item.status === 'derived',
  ).length

  return {
    confirmed,
    required: items.length,
    missing,
    unconfirmed,
    // Предположение в производство не уходит: ошибка в 30–50 мм уже брак.
    readyForProduction: missing.length === 0 && unconfirmed.length === 0,
  }
}

export const VALUE_STATUS_LABELS: Record<ValueStatus, string> = {
  confirmed: 'Замер',
  derived: 'Расчёт',
  estimated: 'Предположение',
  missing: 'Нет данных',
}
