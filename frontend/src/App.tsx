import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { CatalogProvider } from '@/state/CatalogProvider'
import { ProjectProvider } from '@/state/ProjectProvider'
import { ToastProvider } from '@/state/ToastProvider'
import { DrawingsPage } from '@/pages/DrawingsPage'
import { GenerationPage } from '@/pages/GenerationPage'
import { HomePage } from '@/pages/HomePage'
import { ProfilePage } from '@/pages/ProfilePage'
import { ProjectPage } from '@/pages/ProjectPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { ResultsPage } from '@/pages/ResultsPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <p className="eyebrow">Страница не найдена</p>
      <h1 className="mt-3 text-[1.5rem] font-semibold tracking-[-0.02em] text-ink">
        Такой страницы нет
      </h1>
      <p className="mt-2 max-w-xs text-[0.9375rem] text-muted">
        Вернитесь на главный экран и создайте новую визуализацию.
      </p>
      <Button variant="primary" size="lg" className="mt-7" onClick={() => navigate('/')}>
        На главную
      </Button>
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <CatalogProvider>
          <ProjectProvider>
            <ScrollToTop />
            <AppShell>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/setup" element={<ProjectPage />} />
                <Route path="/generation" element={<GenerationPage />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/drawings" element={<DrawingsPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AppShell>
          </ProjectProvider>
        </CatalogProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
