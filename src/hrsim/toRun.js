// Convierte la salida de un simulador JS (HRSim / HOSim) en el mismo objeto `run` que el visor
// construye desde los CSV de MATLAB, pero con trayectorias EXACTAS (no reconstruidas).
import { workerBase, CARGO } from '../workload/spec.js'
import { ENGINE_VERSION, paramsHash, toJSONSafe } from './common.js'
import { ladderHeights, metabolicRate, rateScale } from '../workload/derive.js'
import { buildHuerto } from './huertos/index.js'

const f32 = (a) => Float32Array.from(a)

export function simToRun(sim, { robot }) {
  const p = sim.p,
    rec = sim.rec,
    dt = sim.dt,
    n = rec.t.length,
    NH = sim.NH
  const meta = {
    robot,
    nw: NH,
    row: p.row,
    act: p.act,
    rp: p.rp,
    duration: (n - 1) * dt,
    placement: p.placement,
    simulated: true,
    engineVersion: ENGINE_VERSION,
    params: JSON.parse(toJSONSafe(p)),
    paramsHash: paramsHash(p),
  }
  const series = {
    t: f32(rec.t),
    cargo: f32(rec.delivered),
    total: f32(rec.delivered),
    robot: robot ? f32(rec.onboard) : new Float32Array(n),
    work: f32(rec.work),
  }
  const all = []
  // el huerto no viaja desde el worker (tiene funciones): se regenera, el generador es determinista
  const huerto = sim.huerto || (p.huerto && p.huerto !== 'matlab-2026' ? buildHuerto(p) : null)
  const workers = sim.W.map((w, k) => {
    const h = k + 1
    const act = sim.type[k] === 1 ? 'ground' : sim.type[k] === 2 ? 'ladder' : 'picker'
    // puesto inicial: mapa del estudio (por fila y disposición) o el del huerto generado
    const pu = huerto?.calles ? huerto.puestos[k] : null
    const base = pu
      ? { x: pu.start[0], y: pu.start[1], tx: pu.tree[0], ty: pu.tree[1], heading: Math.atan2(pu.tree[1] - pu.start[1], pu.tree[0] - pu.start[0]) }
      : workerBase(h, p.row, p.rp)
    const flag = Uint8Array.from(rec.flag[k])
    const prod = f32(rec.prod[k]),
      work = f32(rec.workH[k])
    const state = Uint8Array.from(rec.wst[k])
    const track = new Float32Array(n * 4)
    const th = rec.wth[k]
    const lh = act === 'ladder' ? ladderHeights(flag) : null
    for (let i = 0; i < n; i++) {
      track[i * 4] = rec.wx[k][i]
      track[i * 4 + 1] = rec.wy[k][i]
      track[i * 4 + 2] = lh ? lh[i] : 0
      track[i * 4 + 3] = th[i]
    }
    const rate = metabolicRate(work, dt, all)
    // posición de la caja de este trabajador: la del primer evento de su caja
    const b0 = robot ? sim.ev.boxes.find((b) => b.h === h) : null
    const acopio = huerto?.acopio || CARGO.wp
    return { h, act, base, box: b0 ? [b0.x, b0.y] : [acopio[0], acopio[1]], prod, work, flag, state, rate, track }
  })
  const rateMax = rateScale(all)
  let rob = null
  if (robot) {
    const pos = new Float32Array(n * 3),
      body = new Float32Array(n)
    let hd = 0
    for (let i = 0; i < n; i++) {
      const x = rec.rx[i],
        y = rec.ry[i]
      if (i > 0) {
        const dx = x - rec.rx[i - 1],
          dy = y - rec.ry[i - 1]
        if (Math.hypot(dx, dy) > 1e-4) hd = Math.atan2(dy, dx)
      }
      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = hd
      body[i] = rec.rth[i]
    }
    // el visor dibuja el vehículo según su dirección de avance (como el MATLAB)
    const onboard = f32(rec.onboard)
    rob = {
      pos,
      body,
      status: Uint8Array.from(rec.rst),
      picks: sim.ev.picks.map((e) => ({ ...e })),
      boxes: sim.ev.boxes.map((e) => ({ ...e, picked: Number.isFinite(e.picked) ? e.picked : n + 1, served: Number.isFinite(e.picked) })),
      unloads: sim.ev.unloads.map((e) => ({ ...e })),
      crates: (sim.ev.crates || []).map((e) => ({ ...e })),
      onboard,
      // huertos generados: energía acumulada (Wh) y pose del carro del robot de arrastre
      ...(rec.energy
        ? {
            energy: f32(rec.energy),
            trailer: rec.cx.some((v) => Number.isFinite(v)) ? { x: f32(rec.cx), y: f32(rec.cy), th: f32(rec.cth) } : null,
          }
        : {}),
    }
  }
  return {
    meta,
    n,
    dt,
    series,
    workers,
    robot: rob,
    rateMax,
    name: `SIM-${robot ? 'HR' : 'HO'}-${NH}-${p.row}-${p.act}-${p.rp}`,
    rowAt: (t) => Math.min(n - 1, Math.max(0, Math.floor(t / dt))),
  }
}
