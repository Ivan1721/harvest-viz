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
    // H7 fase C: distancia caminada acumulada (m) — trayectorias exactas del simulador
    const dist = new Float32Array(n)
    for (let i = 1; i < n; i++) dist[i] = dist[i - 1] + Math.hypot(rec.wx[k][i] - rec.wx[k][i - 1], rec.wy[k][i] - rec.wy[k][i - 1])
    // posición de la caja de este trabajador: la del primer evento de su caja
    const b0 = robot ? sim.ev.boxes.find((b) => b.h === h) : null
    const acopio = huerto?.acopio || CARGO.wp
    return { h, act, base, box: b0 ? [b0.x, b0.y] : [acopio[0], acopio[1]], prod, work, flag, state, rate, track, dist }
  })
  const rateMax = rateScale(all)
  let rob = null
  if (robot) {
    // el visor dibuja el vehículo según su dirección de avance (como el MATLAB)
    const pos = poseSerie(rec.rx, rec.ry, n)
    const body = f32(rec.rth)
    const onboard = f32(rec.onboard)
    rob = {
      pos,
      body,
      status: Uint8Array.from(rec.rst),
      picks: sim.ev.picks.map((e) => ({ ...e })),
      boxes: sim.ev.boxes.map((e) => ({ ...e, picked: Number.isFinite(e.picked) ? e.picked : n + 1, served: Number.isFinite(e.picked) })),
      unloads: sim.ev.unloads.map((e) => ({ ...e })),
      // H7 fase C: la ruta que sigue a la cuadrilla (cada vez que se recalculó)
      rutas: sim.ev.rutas ? sim.ev.rutas.map((r) => ({ idx: r.idx, puntos: r.puntos.map((q) => [...q]) })) : null,
      calles: huerto?.calles ? callesRecorridas(huerto, rec) : null,
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
    // H8: flota de 2 o 3 robots (opcional); `robot` es el robot 1 y, en la flota, `robots[0]` es el mismo
    flota: robot && rec.fx ? flotaDeRun(sim, rec, rob, n) : null,
    // H7: acopio con acopiador, bins y camión (estado por tick y lo despachado)
    acopio: rec.desp
      ? {
          desp: f32(rec.desp),
          estado: Uint8Array.from(rec.acop),
          bins: Uint8Array.from(rec.bins),
          camion: Int8Array.from(rec.cam),
          cola: Uint8Array.from(rec.cola),
          cfg: { ...p.acopio },
        }
      : null,
    // H7 fase C: estado de cada planta (primer toque y fin, en s) para pintarlas en la escena
    plantas: sim.plantas ?? (sim.cosecha ? sim.cosecha.estadoPlantas() : null),
    // H7 fase B: fruta dejada en los árboles (por tick) y ritmo real de cada cosechero mientras cosecha
    carga: rec.dej
      ? (() => {
          // del motor (pruebas) o del worker (resumen ya calculado)
          const c = (typeof sim.summary === 'function' ? sim.summary() : sim.summary).carga
          return { dej: f32(rec.dej), ritmo: c.ritmo_kgh, fMin: c.fMin, cfg: { ...p.carga } }
        })()
      : null,
    rateMax,
    name: `SIM-${robot ? 'HR' : 'HO'}-${NH}-${p.row}-${p.act}-${p.rp}`,
    rowAt: (t) => Math.min(n - 1, Math.max(0, Math.floor(t / dt))),
  }
}

/** Pose (x, y, rumbo) de un robot por tick; el rumbo sigue el avance y se conserva al detenerse. */
function poseSerie(xs, ys, n) {
  const pos = new Float32Array(n * 3)
  let hd = 0
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const dx = xs[i] - xs[i - 1],
        dy = ys[i] - ys[i - 1]
      if (Math.hypot(dx, dy) > 1e-4) hd = Math.atan2(dy, dx)
    }
    pos[i * 3] = xs[i]
    pos[i * 3 + 1] = ys[i]
    pos[i * 3 + 2] = hd
  }
  return pos
}

/**
 * Flota (H8): lo de cada robot por separado (pose, estado, carga a bordo, energía, carro, rutas y eventos) y el resumen del
 * motor. `cargo` es lo entregado al acopio por ese robot, acumulado por tick (el análisis HRI lo usa para la energía por kg).
 */
function flotaDeRun(sim, rec, rob, n) {
  const resumen = (typeof sim.summary === 'function' ? sim.summary() : sim.summary).flota
  const robots = rec.fx.map((_, k) => {
    const unloads = rob.unloads.filter((u) => u.r === k)
    const cargo = new Float32Array(n)
    let j = 0,
      acum = 0
    for (let i = 0; i < n; i++) {
      while (j < unloads.length && unloads[j].idx <= i) acum += unloads[j++].amount
      cargo[i] = acum
    }
    return {
      id: k,
      pos: poseSerie(rec.fx[k], rec.fy[k], n),
      body: f32(rec.fth[k]),
      status: Uint8Array.from(rec.fst[k]),
      onboard: f32(rec.fon[k]),
      energy: f32(rec.fen[k]),
      trailer: rec.fcx ? { x: f32(rec.fcx[k]), y: f32(rec.fcy[k]), th: f32(rec.fcth[k]) } : null,
      rutas: sim.ev.rutasFlota.filter((q) => q.r === k).map((q) => ({ idx: q.idx, puntos: q.puntos.map((pt) => [...pt]) })),
      boxes: rob.boxes.filter((b) => b.r === k),
      picks: rob.picks.filter((e) => e.r === k),
      unloads,
      cargo,
    }
  })
  return { n: robots.length, estrategia: resumen.estrategia, resumen, robots }
}

/** Calles por las que pasó el robot entre las copas (H7, fase C); en la cabecera no cuenta. */
function callesRecorridas(huerto, rec) {
  const c = huerto.calles,
    H = huerto.limites.h,
    set = new Set()
  for (let i = 0; i < rec.rx.length; i++) {
    const y = rec.ry[i]
    if (y <= c.cabecera || y >= H - c.cabecera) continue
    const x = rec.rx[i]
    for (const e of c.ejes) if (Math.abs(x - e) < c.calle / 4) set.add(e)
  }
  return set.size
}
