// Contratos de formato: los archivos de MATLAB que el visor lee y escribe.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import fc from 'fast-check'
import { buildRun, FormatError, REQUIRED_COLUMNS } from '../../src/workload/run.js'
import { analyzeHRI } from '../../src/workload/hri.js'

const D = new URL('../../public/data/', import.meta.url)
const read = (f) => fs.readFileSync(new URL(f, D), 'utf8')
const manifest = JSON.parse(read('manifest.json'))

test('manifest.json: cada entrada apunta a archivos existentes y con nombre válido', () => {
  assert.ok(manifest.runs.length > 0)
  for (const e of manifest.runs) {
    assert.ok(fs.existsSync(new URL(e.csv, D)), e.csv)
    if (e.log) assert.ok(fs.existsSync(new URL(e.log, D)), e.log)
    for (const k of ['id', 'nw', 'row', 'act', 'rp']) assert.ok(e[k] !== undefined, `${e.csv}: falta ${k}`)
  }
})

for (const e of manifest.runs)
  test(`contrato del CSV de ejemplo ${e.csv}`, () => {
    const csv = read(e.csv)
    const head = csv.slice(0, csv.indexOf('\n')).split(',')
    for (const c of REQUIRED_COLUMNS) assert.ok(head.includes(c), `falta ${c}`)
    for (let h = 1; h <= e.nw; h++) for (const c of ['Production', 'Workload', 'ActivityFlag']) assert.ok(head.includes(`${c}_H${h}`), `falta ${c}_H${h}`)
    const run = buildRun({ csvText: csv, logText: e.log ? read(e.log) : null, name: e.csv })
    assert.equal(run.workers.length, e.nw)
    assert.equal(run.dt, 1, 'el estudio exporta cada 1 s')
    assert.ok(run.series.t[run.n - 1] >= 2700)
    if (e.log) {
      assert.ok(run.robot && run.robot.picks.length > 0, 'el log trae recogidas')
      assert.ok(run.robot.unloads.length > 0, 'el log trae descargas')
      const h = analyzeHRI(run)
      assert.ok(h.dist.every((v) => Number.isFinite(v)))
    }
  })

test('entradas malformadas dan un FormatError claro (no un error interno)', () => {
  const cases = {
    vacío: '',
    'solo cabecera': 'Time_s,Total_product_cargo,Total_product,Total_workload\n',
    'sin columnas requeridas': 'hola,mundo\n1,2\n3,4',
    'sin trabajadores': 'Time_s,Total_product_cargo,Total_product,Total_workload\n0,0,0,0\n1,0,0,0',
    'valor no numérico': 'Time_s,Total_product_cargo,Total_product,Total_workload,Production_H1,Workload_H1,ActivityFlag_H1\n0,0,0,0,0,0,1\n1,0,0,x,0,0,1',
    'fila corta': 'Time_s,Total_product_cargo,Total_product,Total_workload,Production_H1,Workload_H1,ActivityFlag_H1\n0,0,0,0,0,0,1\n1,0',
    'tiempo no creciente': 'Time_s,Total_product_cargo,Total_product,Total_workload,Production_H1,Workload_H1,ActivityFlag_H1\n0,0,0,0,0,0,1\n0,0,0,0,0,0,1',
  }
  for (const [name, csv] of Object.entries(cases))
    assert.throws(() => buildRun({ csvText: csv, logText: null, name: 'HUMAN_ONLY_1_ROW1_harv_ground_RP0' }), FormatError, name)
})

test('tolera BOM, fin de línea CRLF y espacios en la cabecera', () => {
  const csv = '﻿Time_s, Total_product_cargo,Total_product,Total_workload,Production_H1,Workload_H1,ActivityFlag_H1\r\n0,0,0,0,0,0,1\r\n1,0,0,0.1,1,0.1,1\r\n'
  const r = buildRun({ csvText: csv, logText: null, name: 'HUMAN_ONLY_1_ROW1_harv_ground_RP0' })
  assert.equal(r.n, 2)
  assert.equal(r.workers.length, 1)
})

test('fuzzing: con cualquier texto, buildRun devuelve una corrida o lanza FormatError', () => {
  const sample = read(manifest.runs[0].csv).split('\n').slice(0, 30).join('\n')
  const mutated = fc
    .tuple(fc.nat(sample.length), fc.nat(40), fc.string({ maxLength: 20 }))
    .map(([i, del, ins]) => sample.slice(0, i) + ins + sample.slice(i + del))
  const anyText = fc.oneof(fc.string({ maxLength: 300 }), mutated)
  const logs = fc.option(fc.oneof(fc.string({ maxLength: 200 }), fc.constant('idx=10 | Robot picked BOX from h1 box_product=15 robot=[1 2]\nidx=x | ???')), {
    nil: null,
  })
  fc.assert(
    fc.property(anyText, logs, (csv, log) => {
      try {
        const r = buildRun({ csvText: csv, logText: log, name: 'HUMAN_ROBOT_12_ROW3_harv_mixed_RP0' })
        assert.ok(r.n >= 2 && r.workers.length >= 1)
      } catch (e) {
        if (!(e instanceof FormatError)) throw e
      }
    }),
    { numRuns: Number(process.env.FUZZ_RUNS || 300), seed: 20261016 },
  )
})
