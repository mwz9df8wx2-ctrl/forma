/**
 * Печатает адрес для телефона и QR-код к нему.
 * Используется скриптом `npm run dev:mobile`.
 */
import { networkInterfaces } from 'node:os'
import qrcode from 'qrcode-terminal'

const protocol = process.env.HTTPS === '1' ? 'https' : 'http'
const port = process.env.PORT ?? '5173'

function localAddress() {
  const interfaces = networkInterfaces()
  const candidates = []
  for (const list of Object.values(interfaces)) {
    for (const entry of list ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) candidates.push(entry.address)
    }
  }
  // Домашние сети обычно 192.168.*, их и показываем первыми.
  candidates.sort((a, b) => Number(b.startsWith('192.168.')) - Number(a.startsWith('192.168.')))
  return candidates[0] ?? 'localhost'
}

const url = `${protocol}://${localAddress()}:${port}`

console.log('')
console.log('  ФОРМА — открыть на телефоне')
console.log('  ' + '─'.repeat(46))
console.log(`  Адрес:  ${url}`)
console.log('  Телефон и компьютер должны быть в одной сети Wi-Fi.')
if (protocol === 'https') {
  console.log('  Сертификат самоподписанный: браузер покажет предупреждение —')
  console.log('  нажмите «Дополнительно» → «Перейти на сайт». Без этого не будет камеры.')
}
console.log('')
qrcode.generate(url, { small: true })
console.log('')
