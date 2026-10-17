// Benchmark del simulador: mediana de 5 corridas por caso, comparada con bench/baseline.json.
// uso: npm run bench            → informa y avisa si algo es >20 % más lento
//      npm run bench -- --strict → además termina con código 1 si algo es >20 % más lento
//      npm run bench -- --save  → guarda las medidas actuales como nueva línea base
import fs from 'node:fs'
import os from 'node:os'
import { HRSim } from '../src/hrsim/engine.js'
import { HOSim } from '../src/hrsim/humanonly.js'
const FIS = fs.readFileSync(new URL('../src/hrsim/goal_seeking.fis', import.meta.url), 'utf8')
const CASES = [
  ['HO-12', () => new HOSim({ nw: 12, row: 3, act: 'mixed', rp: 0 }).run()],
  ['HO-24', () => new HOSim({ nw: 24, row: 1, act: 'picker', rp: 0 }).run()],
  ['HR-1', () => new HRSim({ nw: 1, row: 1, act: 'ground', rp: 0 }, FIS).run()],
  ['HR-12', () => new HRSim({ nw: 12, row: 3, act: 'mixed', rp: 0 }, FIS).run()],
  ['HR-24', () => new HRSim({ nw: 24, row: 1, act: 'picker', rp: 1 }, FIS).run()],
]
const file = new URL('../bench/baseline.json', import.meta.url)
const base = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
const out = { node: process.version, cpu: os.cpus()[0]?.model, date: new Date().toISOString(), ms: {} }
let slow = 0
for (const [name, f] of CASES) {
  f()
  const t = []
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now()
    f()
    t.push(performance.now() - t0)
  }
  const ms = t.sort((a, b) => a - b)[2]
  out.ms[name] = Math.round(ms)
  const ref = base?.ms?.[name]
  const d = ref ? (ms / ref - 1) * 100 : null
  if (d != null && d > 20) slow++
  console.log(
    `${name.padEnd(6)} ${ms.toFixed(0).padStart(5)} ms${ref ? `   base ${ref} ms   ${d >= 0 ? '+' : ''}${d.toFixed(0)} %${d > 20 ? '  ← más lento' : ''}` : ''}`,
  )
}
console.log(`memoria: ${(process.memoryUsage().rss / 1048576).toFixed(0)} MB RSS`)
if (process.argv.includes('--save')) {
  fs.mkdirSync(new URL('../bench/', import.meta.url), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
  console.log('línea base guardada en bench/baseline.json')
} else if (slow) {
  console.log(`\n${slow} caso(s) >20 % más lentos que la línea base (medida en otra máquina: compara con cuidado).`)
  if (process.argv.includes('--strict')) process.exitCode = 1
}
