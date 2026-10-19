// Reloj de reproducción, biblioteca de corridas, exportación y cliente del worker (sin navegador).
import test from 'node:test'
import assert from 'node:assert/strict'
import { play, anim, setPlay, advance, subscribe } from '../../src/workload/playback.js'
import { loadManifest, realize, entriesFromFiles, cfgKey } from '../../src/workload/library.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { HRSim } from '../../src/hrsim/engine.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { timeseriesCSV, posesCSV, metaJSON, runFiles, runStem } from '../../src/hrsim/export.js'
import { FIS } from '../helpers.mjs'

const RUN = { name: 'r1' }

test('reproducción: solo avanza el reloj de la corrida que lo conduce', () => {
  setPlay({ t: 0, tEnd: 100, playing: true, speed: 10, driver: 'r1' })
  assert.equal(advance({ name: 'otra' }, 0.02), false)
  assert.equal(advance(null, 0.02), false)
  assert.equal(play.t, 0)
  assert.equal(advance(RUN, 0.02), true)
  assert.ok(Math.abs(play.t - 0.2) < 1e-12, 't avanza dt × velocidad')
})

test('reproducción: el paso real se acota a 50 ms y se detiene al final', () => {
  setPlay({ t: 0, tEnd: 1, playing: true, speed: 10, driver: 'r1' })
  const a0 = anim.t
  advance(RUN, 5)
  assert.ok(Math.abs(anim.t - a0 - 0.05) < 1e-12)
  assert.equal(play.t, 0.5)
  advance(RUN, 0.05)
  assert.equal(play.t, 1)
  assert.equal(play.playing, false, 'se pausa al llegar al final')
  assert.equal(advance(RUN, 0.05), false)
})

test('reproducción: setPlay avisa de inmediato; los avances, a lo sumo cada 200 ms', () => {
  const seen = []
  const off = subscribe((s) => seen.push(s))
  setPlay({ t: 3, playing: true, tEnd: 1e9, driver: 'r1', speed: 1 })
  assert.equal(seen.at(-1).t, 3)
  const n = seen.length
  for (let i = 0; i < 10; i++) advance(RUN, 0.001) // mismo instante: a lo sumo un aviso
  assert.ok(seen.length - n <= 1)
  off()
  setPlay({ t: 4 })
  assert.notEqual(seen.at(-1).t, 4, 'tras desuscribirse no recibe avisos')
  setPlay({ playing: false })
})

test('biblioteca: manifiesto ausente o inválido da lista vacía', async (t) => {
  const orig = globalThis.fetch
  t.after(() => (globalThis.fetch = orig))
  globalThis.fetch = async () => ({ ok: false })
  assert.deepEqual(await loadManifest('/'), [])
  globalThis.fetch = async () => {
    throw new Error('sin red')
  }
  assert.deepEqual(await loadManifest('/'), [])
  globalThis.fetch = async (u) => ({ ok: true, json: async () => ({ runs: [{ id: 'a', csv: 'x.csv', url: u }] }) })
  const m = await loadManifest('/base/')
  assert.equal(m[0].source, 'manifest')
  assert.equal(m[0].url, '/base/data/manifest.json')
})

// CSV en formato MATLAB generado por el propio simulador (export.js)
const ho = simToRun(new HOSim({ nw: 2, row: 1, act: 'ground', rp: 0, duration: 120 }).run(), { robot: false })
const csv = timeseriesCSV(ho)
const stem = runStem(ho)

test('exportación: CSV con las columnas de MATLAB, poses por tick y metadatos', () => {
  const head = csv.split('\n')[0].split(',')
  assert.deepEqual(head.slice(0, 5), ['Time_s', 'Total_product_cargo', 'Total_product', 'Total_product_robot', 'Total_workload'])
  assert.equal(head.length, 5 + 3 * 2)
  assert.equal(csv.trim().split('\n').length, 1 + 121, 'una fila por segundo')
  assert.equal(posesCSV(ho).trim().split('\n').length, 1 + ho.n)
  const meta = JSON.parse(metaJSON(ho))
  assert.equal(meta.paramsHash, ho.meta.paramsHash)
  assert.deepEqual(
    runFiles(ho).map(([n]) => n.replace(stem, '')),
    ['_timeseries.csv', '_poses.csv', '_meta.json'],
  )
  const hr = simToRun(new HRSim({ nw: 2, row: 1, act: 'ground', rp: 0, duration: 60 }, FIS).run(), { robot: true })
  assert.ok(posesCSV(hr).split('\n')[0].includes('Robot_status'))
  assert.match(runStem(hr), /^HUMAN_ROBOT_2_ROW1_harv_ground_RP0_SIM-/)
})

test('biblioteca: archivos del usuario → entradas → corrida (con caché)', async () => {
  const files = [new File([csv], `${stem}_timeseries.csv`)]
  const [e] = await entriesFromFiles(files)
  assert.equal(cfgKey(e), '2|1|ground|0')
  assert.equal(e.source, 'archivo')
  const run = await realize(e, '/')
  assert.equal(run.workers.length, 2)
  assert.equal(run.entryId, e.id)
  assert.equal(await realize(e, '/'), run, 'segunda vez sale de la caché')
})

test('biblioteca: nombres y tamaños inválidos dan mensajes claros', async () => {
  await assert.rejects(entriesFromFiles([new File(['x'], 'notas.txt')]), /al menos un/)
  await assert.rejects(entriesFromFiles([new File([csv], 'cualquier_cosa_timeseries.csv')]), /No reconozco el nombre/)
  const big = { name: `${stem}_timeseries.csv`, size: 60 * 1048576, text: async () => csv }
  await assert.rejects(entriesFromFiles([big]), /pesa 60 MB/)
})

test('biblioteca: un CSV del manifiesto que no es de MATLAB da error', async (t) => {
  const orig = globalThis.fetch
  t.after(() => (globalThis.fetch = orig))
  globalThis.fetch = async () => ({ ok: true, text: async () => '<html>404</html>' })
  await assert.rejects(realize({ id: 'm-bad', csv: `${stem}_timeseries.csv` }, '/'), /No se pudo leer/)
})

// Worker falso: responde, falla o se queda colgado según lo que pida la prueba
class FakeWorker {
  static mode = 'ok'
  static terminated = 0
  constructor() {
    FakeWorker.last = this
  }
  postMessage({ id, opts, which }) {
    if (FakeWorker.mode === 'hang') return
    setTimeout(() => {
      if (FakeWorker.mode === 'error') return this.onmessage({ data: { id, error: 'boom' } })
      if (FakeWorker.mode === 'crash') return this.onerror({ message: 'sin memoria' })
      // mismo formato que pack() en sim.worker.js
      const pack = (s) => ({
        p: s.p,
        rec: s.rec,
        ev: s.ev,
        W: s.W.map((w) => ({ h: w.h })),
        type: Array.from(s.type),
        NH: s.NH,
        dt: s.dt,
        summary: s.summary(),
        events: s.events || [],
      })
      const out = { ms: 1 }
      if (which.includes('ho')) out.ho = pack(new HOSim(opts).run())
      if (which.includes('hr')) out.hr = pack(new HRSim(opts, FIS).run())
      this.onmessage({ data: { id, out } })
    }, 1)
  }
  terminate() {
    FakeWorker.terminated++
  }
}

test('cliente del simulador: resultado, error, caída, cancelación y tiempo máximo', async (t) => {
  const origW = globalThis.Worker
  t.after(() => (globalThis.Worker = origW))
  globalThis.Worker = FakeWorker
  const { runSimulation, cancelSimulation } = await import('../../src/hrsim/simClient.js')

  FakeWorker.mode = 'ok'
  const res = await runSimulation({ nw: 2, row: 1, act: 'ground', rp: 0, duration: 60 })
  assert.ok(res.ho && res.hr)
  assert.equal(res.ho.robot, null)
  assert.ok(res.hr.hri, 'la corrida HR trae el análisis de interacción')
  assert.ok('TotalRecollectedCrops' in res.hr.summary, 'métricas con nombres normalizados')
  assert.match(res.hr.entryId, /^sim-hr-/)

  FakeWorker.mode = 'error'
  await assert.rejects(runSimulation({ nw: 1, duration: 10 }, ['ho']), /boom/)

  FakeWorker.mode = 'crash'
  await assert.rejects(runSimulation({ nw: 1, duration: 10 }, ['ho']), /sin memoria/)

  FakeWorker.mode = 'hang'
  const p = runSimulation({ nw: 1, duration: 10 }, ['ho'])
  cancelSimulation()
  await assert.rejects(p, { name: 'AbortError' })

  const q = runSimulation({ nw: 1, duration: 10 }, ['ho'], { timeoutMs: 20 })
  await assert.rejects(q, { name: 'TimeoutError' })
  assert.ok(FakeWorker.terminated >= 2)

  // una simulación nueva cancela la anterior
  const a = runSimulation({ nw: 1, duration: 10 }, ['ho'])
  const b = runSimulation({ nw: 1, duration: 10 }, ['ho'], { timeoutMs: 20 })
  await assert.rejects(a, { name: 'AbortError' })
  await assert.rejects(b, { name: 'TimeoutError' })
  cancelSimulation() // sin simulación pendiente: no hace nada
})

test('mapa a mundo 3D y franja de proximidad de la línea de tiempo', async () => {
  const { toW, MAP } = await import('../../src/workload/spec.js')
  assert.deepEqual(toW(MAP.w / 2, MAP.h / 2), [0, 0, -0])
  const { heatGradient } = await import('../../src/workload/hri.js')
  const g = heatGradient({ minD: Float32Array.from({ length: 240 }, (_, i) => (i < 120 ? 0.3 : 9)) }, 4)
  assert.match(g, /linear-gradient/)
})
