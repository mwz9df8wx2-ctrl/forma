import { createContext } from 'react'
import type {
  Dimensions,
  Generation,
  GenerationResult,
  Project,
  ProjectParams,
  ProjectPhoto,
} from '@/types'

export interface ProjectContextValue {
  project: Project | null
  photo: ProjectPhoto | null
  params: ProjectParams
  title: string
  photoUploading: boolean
  generation: Generation | null
  results: GenerationResult[]
  missing: string[]
  canGenerate: boolean
  setTitle: (title: string) => void
  confirmPhoto: (photo: ProjectPhoto) => Promise<void>
  clearPhoto: () => void
  updateParams: (patch: Partial<ProjectParams>) => void
  setDimension: (key: keyof Dimensions, value: number) => void
  toggleOption: (id: string, value: boolean) => void
  selectPalette: (paletteId: string) => void
  /** newSeed — «Создать ещё»: параметры те же, меняется только зерно. */
  startGeneration: (options?: { newSeed?: boolean }) => Promise<boolean>
  cancelGeneration: () => void
  openProject: (project: Project) => void
  /** Привязка к проекту на сервере: туда уходит спецификация и файлы. */
  serverProject: { id: string; revisionId: string | null } | null
  setServerProject: (value: { id: string; revisionId: string | null } | null) => void
  resetProject: () => void
}

export const ProjectContext = createContext<ProjectContextValue | null>(null)
