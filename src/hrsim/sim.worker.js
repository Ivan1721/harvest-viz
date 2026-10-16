// Web Worker: corre el simulador (HO y/o HR) fuera del hilo de la interfaz.
import fisText from './goal_seeking.fis?raw'
import { HRSim } from './engine'
import { HOSim } from './humanonly'

const pack = (s) => ({ p: s.p, rec: s.rec, ev: s.ev, W: s.W.map((w) => ({ h: w.h })), type: Array.from(s.type), NH: s.NH, dt: s.dt, summary: s.summary(), events: s.events || [] })

self.onmessage = (e) => {
  const { id, opts, which } = e.data
  try {
    const out = {}
    const t0 = performance.now()
    if (which.includes('ho')) out.ho = pack(new HOSim(opts).run())
    if (which.includes('hr')) out.hr = pack(new HRSim(opts, fisText).run())
    out.ms = performance.now() - t0
    self.postMessage({ id, out })
  } catch (err) { self.postMessage({ id, error: String(err && err.message || err) }) }
}
