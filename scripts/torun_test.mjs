import fs from 'fs'
import { HRSim } from '../src/hrsim/engine.js'
import { HOSim } from '../src/hrsim/humanonly.js'
import { simToRun } from '../src/hrsim/toRun.js'
import { analyzeHRI } from '../src/workload/hri.js'
const fis = fs.readFileSync(new URL('../src/hrsim/goal_seeking.fis', import.meta.url), 'utf8')
const hr = new HRSim({ nw: 12, row: 3, act: 'mixed', rp: 0 }, fis).run()
const run = simToRun(hr, { robot: true })
console.log(run.n, run.workers.length, run.robot.pos.length, run.name)
const t0 = Date.now()
const h = analyzeHRI(run)
console.log('hri ms', Date.now() - t0, Object.keys(h || {}))
const ho = simToRun(new HOSim({ nw: 12, row: 3, act: 'mixed', rp: 0 }).run(), { robot: false })
console.log(ho.n, ho.series.work.at(-1), run.series.work.at(-1))
