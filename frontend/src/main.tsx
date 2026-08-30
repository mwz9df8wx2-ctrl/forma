import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Не найден корневой элемент приложения')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Сервис-воркер нужен только в собранном приложении: он даёт установку
// на домашний экран и открытие без сети. В режиме разработки он мешает.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* без сервис-воркера приложение работает как обычный сайт */
    })
  })
}
