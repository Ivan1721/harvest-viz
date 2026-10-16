// Web Worker: corre el simulador (HO y/o HR) fuera del hilo de la interfaz.
// Las series se envían como typed arrays transferibles (sin copia).
import fisText from './goal_seeking.fis?raw'
import { HRSim } from './engine.js'
import { HOSim } from './humanonly.js'

const U8 = new Set(['flag', 'wst', 'rst'])
function pack(s, transfer) {
  const rec = {}
  for (const [k, v] of Object.entries(s.rec)) {
    const T = U8.has(k) ? Uint8Array : Float64Array
    const conv = (a) => {
      const t = T.from(a)
      transfer.push(t.buffer)
      return t
    }
    rec[k] = Array.isArray(v[0]) ? v.map(conv) : conv(v)
  }
  return { p: s.p, rec, ev: s.ev, W: s.W.map((w) => ({ h: w.h })), type: Array.from(s.type), NH: s.NH, dt: s.dt, summary: s.summary(), events: s.events || [] }
}

self.onmessage = (e) => {
  const { id, opts, which } = e.data
  try {
    const out = {},
      transfer = []
    const t0 = performance.now()
    if (which.includes('ho')) out.ho = pack(new HOSim(opts).run(), transfer)
    if (which.includes('hr')) out.hr = pack(new HRSim(opts, fisText).run(), transfer)
    out.ms = performance.now() - t0
    self.postMessage({ id, out }, transfer)
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) })
  }
}
