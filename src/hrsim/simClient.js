// Cliente del Web Worker: runSimulation(opts) -> { ho, hr, ms } con corridas listas para el visor.
// Una nueva simulación cancela la anterior (se termina el worker y la promesa vieja se rechaza con AbortError).
import { simToRun } from './toRun.js'
import { analyzeHRI } from '../workload/hri.js'

let worker = null, seq = 0, pending = null

function get() {
  if (!worker) {
    worker = new Worker(new URL('./sim.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { id, out, error } = e.data
      if (!pending || pending.id !== id) return
      const p = pending; pending = null
      error ? p.reject(new Error(error)) : p.resolve(out)
    }
    worker.onerror = (e) => { if (pending) { pending.reject(new Error(e.message || 'Error en el simulador')); pending = null } worker = null }
  }
  return worker
}

export function cancelSimulation() {
  if (!pending) return
  worker?.terminate(); worker = null
  const err = new Error('Simulación cancelada'); err.name = 'AbortError'
  pending.reject(err); pending = null
}

const norm = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/_crop_units|_kcal/, ''), v]))

export async function runSimulation(opts, which = ['ho', 'hr']) {
  cancelSimulation()
  const id = ++seq
  const out = await new Promise((resolve, reject) => { pending = { id, resolve, reject }; get().postMessage({ id, opts, which }) })
  const res = { ms: out.ms }
  if (out.ho) { res.ho = simToRun(out.ho, { robot: false }); res.ho.summary = norm(out.ho.summary); res.ho.entryId = `sim-ho-${id}` }
  if (out.hr) { res.hr = simToRun(out.hr, { robot: true }); res.hr.hri = analyzeHRI(res.hr); res.hr.summary = norm(out.hr.summary); res.hr.entryId = `sim-hr-${id}`; res.hr.events = out.hr.events }
  return res
}
