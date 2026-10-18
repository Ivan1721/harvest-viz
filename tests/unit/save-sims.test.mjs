// Guardado local de simulaciones (plugin del servidor de desarrollo): carpeta, índice, duplicados y desactivación en CI.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { writeSimulation, saveEnabled } from '../../scripts/vite-save-sims.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { HRSim } from '../../src/hrsim/engine.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { runFiles } from '../../src/hrsim/export.js'
import { FIS } from '../helpers.mjs'

const cfg = { nw: 2, row: 1, act: 'ground', rp: 0, duration: 60 }
function body() {
  const ho = simToRun(new HOSim(cfg).run(), { robot: false }),
    hr = simToRun(new HRSim(cfg, FIS).run(), { robot: true })
  const m = hr.meta
  return {
    meta: { nw: m.nw, row: m.row, act: m.act, rp: m.rp, engineVersion: m.engineVersion, paramsHash: m.paramsHash, duration: 60 },
    summary: { ho: { TotalRecollectedCrops: 1 }, hr: { TotalRecollectedCrops: 2, handoffs: 0 } },
    files: [...runFiles(ho), ...runFiles(hr)],
  }
}

test('escribe la simulación en motor-<versión>/<config>_SIM-<hash>/ con un índice', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hv-sims-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const b = body()
  const r = writeSimulation(root, b)
  assert.equal(r.existed, false)
  const dir = path.join(root, `motor-${b.meta.engineVersion}`, `2_ROW1_ground_RP0_SIM-${b.meta.paramsHash}`)
  const files = fs.readdirSync(dir).filter((f) => !f.startsWith('.'))
  assert.equal(files.length, 6, 'timeseries, poses y meta de HO y HR')
  const idx = fs.readFileSync(path.join(root, 'indice.csv'), 'utf8').trim().split('\n')
  assert.equal(idx.length, 2)
  assert.match(idx[1], /,2,1,ground,0,60,/)
  // la misma simulación (motor determinista) no se duplica
  assert.equal(writeSimulation(root, b).existed, true)
  assert.equal(fs.readFileSync(path.join(root, 'indice.csv'), 'utf8').trim().split('\n').length, 2)
})

test('nombres de archivo saneados: no se puede escribir fuera de la carpeta', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hv-sims-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const b = body()
  b.meta.paramsHash = '../../fuera'
  b.files = [
    ['../../escape.csv', 'x'],
    ['malo.exe', 'x'],
  ]
  const r = writeSimulation(root, b)
  assert.ok(!fs.existsSync(path.join(root, '..', 'escape.csv')))
  const dir = path.join(root, `motor-${b.meta.engineVersion}`)
  const [sub] = fs.readdirSync(dir)
  assert.deepEqual(
    fs.readdirSync(path.join(dir, sub)).filter((f) => !f.startsWith('.')),
    ['__.._escape.csv'],
  )
  assert.ok(r.dir)
  assert.throws(() => writeSimulation(root, {}), /sin archivos/)
})

test('desactivado en GitHub Actions y con HV_SAVE_SIMS=0', () => {
  assert.equal(saveEnabled({}), true)
  assert.equal(saveEnabled({ CI: 'true' }), false)
  assert.equal(saveEnabled({ GITHUB_ACTIONS: 'true' }), false)
  assert.equal(saveEnabled({ HV_SAVE_SIMS: '0' }), false)
})
