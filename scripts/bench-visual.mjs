// Mide la fluidez del visor en el navegador: FPS, ms por cuadro (p95), draw calls y triángulos
// para cada combinación de estilo y vista. Requiere el sitio servido (npm run build && npx vite preview).
// uso: node scripts/bench-visual.mjs [--url http://localhost:4173/] [--channel chrome|msedge] [--headed] [--label antes] [--secs 15]
import fs from 'node:fs'
import os from 'node:os'
import { chromium } from '@playwright/test'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : d
}
const url = arg('url', 'http://localhost:4173/')
const channel = arg('channel', undefined)
const headed = process.argv.includes('--headed')
const label = arg('label', 'actual')
const secs = Number(arg('secs', 15))
const SCEN = [
  ['Realista', 'cmp'],
  ['Realista', 'hr'],
  ['Esquemático', 'cmp'],
  ['Esquemático', 'hr'],
]

const browser = await chromium.launch({ channel, headless: !headed, args: ['--ignore-gpu-blocklist', '--disable-frame-rate-limit=false'] })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const page = await ctx.newPage()
const gpu = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2')
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info')
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'desconocida'
})
const rows = []
for (const [look, view] of SCEN) {
  await page.goto(`${url}?perf=1&view=${view}&speed=10${look === 'Esquemático' ? '&look=schem' : ''}`)
  await page.locator('canvas').first().waitFor({ timeout: 120000 })
  await page.waitForTimeout(6000) // calentamiento: carga de texturas y compilación de shaders
  const samples = []
  for (let s = 0; s < secs; s++) {
    await page.waitForTimeout(1000)
    samples.push(await page.evaluate(() => JSON.parse(JSON.stringify(window.__hvPerf || {}))))
  }
  const scenes = Object.keys(samples.at(-1))
  const avg = (k) => samples.reduce((a, s) => a + Math.min(...scenes.map((n) => (k === 'fps' ? s[n]?.fps : -s[n]?.[k]) ?? 0)), 0) / samples.length
  const sum = (k) => scenes.reduce((a, n) => a + (samples.at(-1)[n]?.[k] || 0), 0)
  const r = {
    look,
    view: view === 'cmp' ? 'Comparar' : 'Humano-robot',
    fps: avg('fps'),
    p95Ms: -avg('p95Ms'),
    calls: sum('calls'),
    triangles: sum('triangles'),
  }
  rows.push(r)
  console.log(
    `${r.look.padEnd(12)} ${r.view.padEnd(13)} ${r.fps.toFixed(1).padStart(5)} FPS   p95 ${r.p95Ms.toFixed(1).padStart(5)} ms   ${String(r.calls).padStart(5)} draw calls   ${r.triangles.toLocaleString('es-CL').padStart(10)} triángulos`,
  )
}
await browser.close()
const out = { label, date: new Date().toISOString(), host: os.hostname(), cpu: os.cpus()[0]?.model, gpu, browser: channel || 'chromium', url, rows }
fs.mkdirSync(new URL('../bench/', import.meta.url), { recursive: true })
const file = new URL(`../bench/visual-${label}.json`, import.meta.url)
fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
console.log(`GPU: ${gpu}\nguardado en bench/visual-${label}.json`)
