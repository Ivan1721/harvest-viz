// Cliente del Web Worker: runSimulation(opts) -> { ho, hr, ms } con corridas listas para el visor.
import { simToRun } from './toRun'
import { analyzeHRI } from '../workload/hri'

let worker = null, seq = 0
const pending = new Map()
function get() {
  if (!worker) {
    worker = new Worker(new URL('./sim.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { id, out, error } = e.data
      const p = pending.get(id); pending.delete(id)
      if (!p) return
      error ? p.reject(new Error(error)) : p.resolve(out)
    }
  }
  return worker
}

const norm = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/_crop_units|_kcal/, ''), v]))

export async function runSimulation(opts, which = ['ho', 'hr']) {
  const id = ++seq
  const out = await new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); get().postMessage({ id, opts, which }) })
  const res = { ms: out.ms }
  if (out.ho) { res.ho = simToRun(out.ho, { robot: false }); res.ho.summary = norm(out.ho.summary); res.ho.entryId = `sim-ho-${id}` }
  if (out.hr) { res.hr = simToRun(out.hr, { robot: true }); res.hr.hri = analyzeHRI(res.hr); res.hr.summary = norm(out.hr.summary); res.hr.entryId = `sim-hr-${id}`; res.hr.events = out.hr.events }
  return res
}
