// Geometría de la escena de una corrida: el mapa del estudio (matlab-2026, por fila) o un huerto generado (H2),
// reconstruido desde los parámetros guardados en la corrida (el generador es determinista).
import { buildHuerto } from '../hrsim/huertos/index.js'
import { ROWS, CANOPY_R, CARGO, routeLoop } from './spec.js'
import { LIMITES } from '../hrsim/huertos/matlab2026.js'

const cache = new Map()

/**
 * @returns {{ generated: boolean, limites: {w:number,h:number}, trees: {x:number,y:number,seed:number}[], R: number,
 *   strips: {x0:number,y0:number,x1:number,y1:number}[], cargo: {x:number[],y:number[]}, route: number[][], label: string }}
 */
export function sceneGeometry(meta) {
  const p = meta?.params
  if (!p?.huerto || p.huerto === 'matlab-2026') {
    const row = meta?.row ?? p?.row ?? 3
    const key = `matlab-${row}`
    if (!cache.has(key))
      cache.set(key, {
        generated: false,
        limites: { ...LIMITES },
        trees: Object.entries(ROWS).flatMap(([r, R]) => R.x.map((x, i) => ({ x, y: R.y, seed: +r * 7 + i }))),
        R: CANOPY_R,
        // hileras horizontales a lo ancho de todo el mapa
        strips: Object.values(ROWS).map((R) => ({ x0: -8, x1: LIMITES.w + 8, y0: R.y - 2.5, y1: R.y + 2.5 })),
        cargo: CARGO,
        route: routeLoop(row),
        label: 'MATLAB 2026',
      })
    return cache.get(key)
  }
  const key = JSON.stringify([p.huerto, p.huertoParams, p.nw])
  if (!cache.has(key)) {
    const h = buildHuerto(p)
    const R = h.arboles[0]?.radio ?? 2.5
    const rowsX = [...new Set(h.arboles.map((a) => a.x))]
    const y0 = Math.min(...h.arboles.map((a) => a.y)) - R,
      y1 = Math.max(...h.arboles.map((a) => a.y)) + R
    const [ax, ay] = h.acopio
    cache.set(key, {
      generated: true,
      limites: { ...h.limites },
      trees: h.arboles.map((a, i) => ({ x: a.x, y: a.y, seed: i + 1 })),
      R,
      H: h.arboles[0]?.altura,
      // hileras verticales (paralelas al eje y)
      strips: rowsX.map((x) => ({ x0: x - R, x1: x + R, y0, y1 })),
      cargo: { wp: [ax, ay], x: [ax - 2.5, ax + 2.5], y: [0, Math.max(0.6, ay - 1.8)] },
      route: h.vueltaRobot.map((w) => [...w]),
      label: h.sistema,
    })
  }
  return cache.get(key)
}
