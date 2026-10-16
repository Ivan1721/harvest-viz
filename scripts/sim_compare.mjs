// Compara el simulador JS con una corrida de MATLAB (serie temporal + log del robot).
import fs from 'fs'
import { HRSim } from '../src/hrsim/engine.js'
const fis = fs.readFileSync(new URL('../src/hrsim/goal_seeking.fis', import.meta.url), 'utf8')
const dir = new URL('../public/data/', import.meta.url)
const base = process.argv[2] || 'HUMAN_ROBOT_12_ROW3_harv_mixed_RP0'
const t0 = Date.now()
const extra = process.env.LD ? { costs: { ladderDown: +process.env.LD } } : {}
const sim = new HRSim({ nw: 12, row: 3, act: 'mixed', rp: 0, ...extra }, fis).run()
console.log('JS: %d ticks en %d ms', sim.idx, Date.now() - t0)
const s = sim.summary()
console.log('resumen JS', s)
// --- serie temporal MATLAB (cada 1 s) ---
const lines = fs.readFileSync(new URL(base + '_timeseries.csv', dir), 'utf8').trim().split('\n')
const head = lines[0].split(','), rows = lines.slice(1).map((l) => l.split(',').map(Number))
const col = (n) => head.indexOf(n)
const last = rows[rows.length - 1]
console.log('MATLAB final: entregado=%s  a bordo=%s  trabajo=%s', last[col('Total_product_cargo')], last[col('Total_product_robot')], last[col('Total_workload')].toFixed(1))
console.log('JS     final: entregado=%s  a bordo=%s  trabajo=%s', sim.prodRobotTotal, sim.prodRobot, sim.rec.work.at(-1).toFixed(1))
// error por minuto en entregado
const out = []
for (const m of [5, 10, 15, 20, 30, 40, 45]) {
  const r = rows[m * 60], i = m * 240
  out.push(`${m}min  MATLAB ${r[col('Total_product_cargo')]}  JS ${sim.rec.delivered[i]}`)
}
console.log(out.join('\n'))
// --- eventos del robot ---
const log = fs.readFileSync(new URL(base + '_robot_status_log.txt', dir), 'utf8').split('\n').filter(Boolean)
const mEv = log.map((l) => { const m = l.match(/^idx=(\d+) \| (.*)$/); return m ? { idx: +m[1], msg: m[2] } : null }).filter(Boolean)
const kinds = (e) => /reached ROUTE|reached CARGO|detected BOX|picked BOX/.test(e.msg) ? e.msg.replace(/\s*\|.*$/, '').replace(/ from h\d+/, '') + (/reached ROUTE/.test(e.msg) ? ' ' + (e.msg.match(/k=(\d+)/) || [])[0] : '') : null
const A = mEv.map((e) => ({ idx: e.idx, k: kinds(e), msg: e.msg })).filter((e) => e.k)
const B = sim.events.map((e) => ({ idx: e.idx, k: kinds(e), msg: e.msg })).filter((e) => e.k)
console.log('eventos MATLAB %d  JS %d', A.length, B.length)
const n = +(process.argv[3] || 30)
for (let i = 0; i < n; i++) console.log(String(A[i]?.idx).padStart(5), (A[i]?.k || '').padEnd(32), '|', String(B[i]?.idx).padStart(5), (B[i]?.k || ''))
let firstDiff = -1
for (let i = 0; i < Math.min(A.length, B.length); i++) if (A[i].idx !== B[i].idx || A[i].k !== B[i].k) { firstDiff = i; break }
console.log('primera diferencia:', firstDiff, firstDiff >= 0 ? JSON.stringify([A[firstDiff], B[firstDiff]]) : 'ninguna')
