import { useContext } from 'react'
import { ProjectContext } from '@/state/project'

export function useProject() {
  const context = useContext(ProjectContext)
  if (!context) throw new Error('useProject используется вне ProjectProvider')
  return context
}
