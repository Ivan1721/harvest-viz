// Compara los eventos del robot (log de estado de MATLAB) con los del simulador JS: primera divergencia.
// uso: node scripts/sim_events_compare.mjs <log.txt> nw row act rp [duración]
import fs from 'fs'
import { HRSim } from '../src/hrsim/engine.js'
const fis = fs.readFileSync(new URL('../src/hrsim/goal_seeking.fis', import.meta.url), 'utf8')
const [file, nw, row, act, rp, dur = '2700'] = process.argv.slice(2)
const sim = new HRSim({ nw: +nw, row: +row, act, rp: +rp, duration: +dur }, fis).run()
const parse = (lines) => lines.map((l) => { const m = l.match(/^idx=(\d+) \| (.*)$/); return m ? { idx: +m[1], msg: m[2] } : null }).filter(Boolean)
const norm = (m) => m.replace(/Prod_ROBOT_total before=[\d.]+/, '').replace(/total waypoints=\d+/, '').trim()
const A = parse(fs.readFileSync(file, 'utf8').split(/\r?\n/)).filter((e) => !/^Box waypoint removed|^Robot box reset|^Next waypoint/.test(e.msg))
const B = sim.events.filter((e) => !/^Box waypoint removed|^Robot box reset|^Next waypoint/.test(e.msg))
let i = 0
while (i < Math.min(A.length, B.length) && A[i].idx === B[i].idx && norm(A[i].msg).split('|')[0] === norm(B[i].msg).split('|')[0]) i++
console.log(`eventos MATLAB ${A.length} JS ${B.length}; coinciden los primeros ${i}`)
if (i < Math.min(A.length, B.length)) for (let k = Math.max(0, i - 3); k < i + 4; k++) console.log(k === i ? '>>' : '  ', JSON.stringify(A[k]), '\n    ', JSON.stringify(B[k]))
