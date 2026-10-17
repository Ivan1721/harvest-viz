// Exporta un video desde la línea de comandos (útil para lotes o para otros proyectos):
// abre el visor en Chrome sin ventana, configura la grabación y guarda el MP4.
// uso: node scripts/export-video.mjs --url http://localhost:4173/ [--view cmp|hr|ho] [--look real|schem]
//      [--from 0] [--to 45] (min) [--speed 30] [--res 1080] [--fps 60] [--out video.mp4] [--channel chrome] [--sim]
import fs from 'node:fs'
import { chromium } from '@playwright/test'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : d
}
const url = arg('url', 'http://localhost:4173/'),
  view = arg('view', 'cmp'),
  look = arg('look', 'real')
const from = arg('from', '0'),
  to = arg('to', '45'),
  speed = arg('speed', '30'),
  res = arg('res', '1080'),
  fps = arg('fps', '60')
const out = arg('out', `harvest-viz_${view}_${from}-${to}min_x${speed}_${res}p${fps}.mp4`)
const t0 = Date.now()
const browser = await chromium.launch({ channel: arg('channel', undefined), args: ['--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, acceptDownloads: true })).newPage()
await page.goto(`${url}?view=${view}${look === 'schem' ? '&look=schem' : ''}`)
await page.getByText('Fuente', { exact: true }).waitFor()
if (process.argv.includes('--sim')) {
  await page.getByRole('button', { name: 'Simulador', exact: true }).click()
  await page.getByText(/Simulado en \d+ ms/).waitFor({ timeout: 120000 })
}
await page.locator('canvas').first().waitFor({ timeout: 120000 })
const pause = page.getByRole('button', { name: 'Pausar' })
if (await pause.count()) await pause.click()
const v = page.locator('section', { has: page.getByRole('heading', { name: 'Video' }) })
await v.locator('label', { hasText: 'Desde' }).locator('input').fill(from)
await v.locator('label', { hasText: 'Hasta' }).locator('input').fill(to)
await v.getByRole('button', { name: `×${speed}`, exact: true }).click()
await v.getByRole('button', { name: { 720: '720p', 1080: '1080p', 1440: '1440p', 2160: '4K' }[res], exact: true }).click()
await v.getByRole('button', { name: fps, exact: true }).click()
const dl = page.waitForEvent('download', { timeout: 0 })
await v.getByRole('button', { name: 'Exportar video (MP4)' }).click()
const status = setInterval(async () => {
  const t = await page
    .locator('.rec-modal')
    .innerText()
    .catch(() => '')
  if (t) process.stdout.write(`\r${t.replace(/\s+/g, ' ').slice(0, 90)}   `)
}, 2000)
const d = await dl
clearInterval(status)
await d.saveAs(out)
await browser.close()
console.log(`\n${out} · ${(fs.statSync(out).size / 1e6).toFixed(1)} MB · ${((Date.now() - t0) / 1000).toFixed(0)} s`)
