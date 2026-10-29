// Cliente del Web Worker: runSimulation(opts) -> { ho, hr, ms } con corridas listas para el visor.
// Una nueva simulación cancela la anterior (se termina el worker y la promesa vieja se rechaza con AbortError).
import { simToRun } from './toRun.js'
import { analyzeHRI } from '../workload/hri.js'
import { analizarFlota } from '../workload/flota.js'

let worker = null,
  seq = 0,
  pending = null

function get() {
  if (!worker) {
    worker = new Worker(new URL('./sim.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { id, out, error } = e.data
      if (!pending || pending.id !== id) return
      const p = pending
      pending = null
      clearTimeout(p.timer)
      error ? p.reject(new Error(error)) : p.resolve(out)
    }
    worker.onerror = (e) => {
      if (pending) {
        pending.reject(new Error(e.message || 'Error en el simulador'))
        clearTimeout(pending.timer)
        pending = null
      }
      worker?.terminate()
      worker = null
    }
  }
  return worker
}

/** Termina la simulación en curso (si hay) y rechaza su promesa con AbortError. */
export function cancelSimulation(reason = 'Simulación cancelada', name = 'AbortError') {
  if (!pending) return
  worker?.terminate()
  worker = null
  const err = new Error(reason)
  err.name = name
  clearTimeout(pending.timer)
  pending.reject(err)
  pending = null
}

/** Tiempo máximo de una simulación: si el worker no responde (p. ej. sin memoria), se termina. */
export const SIM_TIMEOUT_MS = 120_000

const norm = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/_crop_units|_kcal/, ''), v]))

export async function runSimulation(opts, which = ['ho', 'hr'], { timeoutMs = SIM_TIMEOUT_MS } = {}) {
  cancelSimulation()
  const id = ++seq
  const out = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        cancelSimulation(`La simulación superó ${Math.round(timeoutMs / 1000)} s y se detuvo. Reduce la duración o el número de trabajadores.`, 'TimeoutError'),
      timeoutMs,
    )
    pending = { id, resolve, reject, timer }
    get().postMessage({ id, opts, which })
  })
  const res = { ms: out.ms }
  if (out.ho) {
    res.ho = simToRun(out.ho, { robot: false })
    res.ho.summary = norm(out.ho.summary)
    res.ho.entryId = `sim-ho-${id}`
  }
  if (out.hr) {
    res.hr = simToRun(out.hr, { robot: true })
    res.hr.hri = res.hr.flota ? analizarFlota(res.hr) : analyzeHRI(res.hr)
    res.hr.summary = norm(out.hr.summary)
    res.hr.entryId = `sim-hr-${id}`
    res.hr.events = out.hr.events
  }
  return res
}
