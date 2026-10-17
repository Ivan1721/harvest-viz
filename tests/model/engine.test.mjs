import test from 'node:test'
import assert from 'node:assert/strict'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { FIS } from '../helpers.mjs'

const cfg = { nw: 6, row: 2, act: 'mixed', rp: 1, duration: 600 }

test('el simulador es determinista', () => {
  const a = new HRSim(cfg, FIS).run().summary(),
    b = new HRSim(cfg, FIS).run().summary()
  assert.deepEqual(a, b)
})

test('simToRun produce series coherentes con el resumen', () => {
  const sim = new HRSim(cfg, FIS).run()
  const run = simToRun(sim, { robot: true })
  assert.equal(run.n, 600 / 0.25 + 1)
  assert.equal(run.workers.length, 6)
  assert.equal(run.robot.pos.length, run.n * 3)
  assert.ok(Math.abs(run.series.work[run.n - 1] - sim.summary().TotalHumanWorkload_kcal) < 1e-2)
  assert.equal(run.meta.params.nw, 6)
  assert.ok(run.meta.engineVersion)
})

test('sin robot no hay entregas del robot', () => {
  const run = simToRun(new HOSim(cfg).run(), { robot: false })
  assert.equal(run.robot, null)
  assert.ok(run.series.cargo[run.n - 1] > 0)
})

test('cambiar un parámetro cambia el resultado (los parámetros se aplican)', () => {
  const base = new HOSim(cfg).run().summary().TotalHumanWorkload_kcal
  const slow = new HOSim({ ...cfg, metabolicMultiplier: 1.5 }).run().summary().TotalHumanWorkload_kcal
  assert.ok(Math.abs(slow / base - 1.5) < 1e-6)
})

test('la exportación tiene el formato de MATLAB y se puede volver a leer', async () => {
  const { timeseriesCSV, runStem } = await import('../../src/hrsim/export.js')
  const { buildRun, parseName } = await import('../../src/workload/run.js')
  const run = simToRun(new HRSim(cfg, FIS).run(), { robot: true })
  const csv = timeseriesCSV(run)
  assert.ok(csv.startsWith('Time_s,Total_product_cargo,Total_product,Total_product_robot,Total_workload,Production_H1'))
  assert.equal(csv.trim().split('\n').length, 600 + 2)
  assert.deepEqual(parseName(runStem(run)), { robot: true, nw: 6, row: 2, act: 'mixed', rp: 1 })
  const back = buildRun({ csvText: csv, logText: null, name: runStem(run) })
  assert.ok(Math.abs(back.series.work[back.n - 1] - run.series.work[run.n - 1]) < 1e-3)
})

test('runFiles entrega timeseries, poses y meta coherentes', async () => {
  const { runFiles } = await import('../../src/hrsim/export.js')
  const run = simToRun(new HRSim(cfg, FIS).run(), { robot: true })
  const files = runFiles(run)
  assert.deepEqual(
    files.map(([n]) => n.replace(/^.*_SIM-[0-9a-f]{8}/, '')),
    ['_timeseries.csv', '_poses.csv', '_meta.json'],
  )
  const poses = files[1][1].trim().split('\n')
  assert.equal(poses.length, run.n + 1)
  assert.ok(poses[0].startsWith('Time_s,Robot_x,Robot_y,Robot_theta_rad,Robot_status,X_H1'))
  const meta = JSON.parse(files[2][1])
  assert.equal(meta.paramsHash, run.meta.paramsHash)
})
