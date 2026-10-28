// H8: la flota de robots en el visor. Cada robot se analiza por separado (sus estados, su energía, su campo de protección)
// y la flota se resume en conjunto; la geometría con las personas (distancias, zonas, encuentros) va hacia el robot más
// cercano a cada trabajador (ver analyzeHRI). Sin flota nada de esto se usa.
import { analyzeHRI } from './hri.js'

/** Color de cada robot: azul (el de «Humano-robot»), ámbar y malva; distinguibles también con daltonismo (Okabe-Ito). */
export const COLORES_ROBOT = ['#2a78d6', '#e69f00', '#cc79a7']
export const colorRobot = (k) => COLORES_ROBOT[k % COLORES_ROBOT.length]
export const etiquetaRobot = (k) => `RB-0${k + 1}`

/** La corrida vista desde el robot k: solo sus estados, cajas, energía y entregas, para analizarlo por separado. */
export function vistaRobot(run, k) {
  const f = run.flota.robots[k]
  return {
    ...run,
    flota: null,
    series: { ...run.series, cargo: f.cargo },
    robot: {
      ...run.robot,
      pos: f.pos,
      body: f.body,
      status: f.status,
      onboard: f.onboard,
      energy: f.energy,
      boxes: f.boxes,
      picks: f.picks,
      unloads: f.unloads,
    },
  }
}

/**
 * Análisis HRI de una corrida con flota: la geometría humano–robot es hacia el robot más cercano; lo propio de cada robot se
 * suma o promedia en `fluency`; el análisis de cada uno queda en `porRobot`.
 */
export function analizarFlota(run) {
  const por = run.flota.robots.map((_, k) => analyzeHRI(vistaRobot(run, k)))
  const g = analyzeHRI(run)
  return { ...g, fluency: fluidezFlota(run, g.fluency, por), porRobot: por }
}

const sumaDe = (xs) => xs.reduce((a, b) => a + b, 0)
const porTiempo = (a, b) => a.t0 - b.t0

function fluidezFlota(run, f0, por) {
  const T = por.map((a) => a.fluency)
  const nR = T.length
  const media = (f) => sumaDe(T.map(f)) / nR
  const robotTime = Object.fromEntries(Object.keys(f0.robotTime).map((k) => [k, k === 'exact' ? f0.robotTime.exact : media((x) => x.robotTime[k])]))
  const robotWait = T[0].robotWait
    ? (() => {
        const total = sumaDe(T.map((x) => x.robotWait.total)),
          n = sumaDe(T.map((x) => x.robotWait.n))
        const events = por.flatMap((a, r) => a.fluency.robotWait.events.map((e) => ({ ...e, r }))).sort(porTiempo)
        return { total, n, mean: n ? total / n : 0, max: Math.max(...T.map((x) => x.robotWait.max)), events }
      })()
    : null
  // energía: la de toda la flota; la batería restante es la del robot que más gastó (como en el resumen del motor)
  const E = T.map((x) => x.energia)
  const energia = E[0]
    ? (() => {
        const wh = sumaDe(E.map((e) => e.wh)),
          kg = run.series.cargo[run.n - 1]
        const bat = E.map((e) => e.bateriaPct).filter((v) => v != null)
        return {
          wh,
          whPorKg: kg > 0 ? wh / kg : null,
          bateriaPct: bat.length ? Math.min(...bat) : null,
          descargas: sumaDe(E.map((e) => e.descargas)),
          traccion_s: sumaDe(E.map((e) => e.traccion_s)),
          robot: E[0].robot,
        }
      })()
    : null
  const spEvents = por.flatMap((a, r) => a.fluency.protection.events.map((e) => ({ ...e, r }))).sort(porTiempo)
  const p5 = T.map((x) => x.p5Moving).filter((v) => v != null)
  return {
    ...f0,
    robotTime,
    robotWait,
    energia,
    safetyStops: por.flatMap((a, r) => a.fluency.safetyStops.map((e) => ({ ...e, r }))).sort(porTiempo),
    protection: { s: sumaDe(T.map((x) => x.protection.s)), n: spEvents.length, frac: media((x) => x.protection.frac), events: spEvents },
    p5Moving: p5.length ? Math.min(...p5) : null,
  }
}
