import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'node:path'

/**
 * HTTPS включается переменной HTTPS=1 (скрипт `npm run dev:mobile`).
 * Это нужно, чтобы камера работала при открытии с телефона по адресу в
 * локальной сети: браузеры дают доступ к камере только в защищённом контексте.
 */
const useHttps = process.env.HTTPS === '1'

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(useHttps ? [basicSsl()] : [])],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // Общий домен: одна и та же спецификация у фронтенда и сервера.
      '@shared': path.resolve(import.meta.dirname, '../shared/src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    fs: {
      // Разрешаем читать общий пакет за пределами каталога фронтенда.
      allow: [path.resolve(import.meta.dirname, '..')],
    },
  },
})
