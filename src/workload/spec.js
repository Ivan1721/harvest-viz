// Geometría del escenario, extraída de scene_spec.json (HumanRobot_Sim.m / HumanOnly_Sim.m).
// Unidades: metros; origen en la esquina inferior izquierda del mapa; +X derecha, +Y arriba.
export const MAP = { w: 29.7414, h: 25.7759 }
export const CANOPY_R = 3.25
export const ROWS = {
  1: { y: 5.7, x: [4.5, 11.5, 18.3, 25.2], goalY: 9 },
  2: { y: 12.5, x: [4.5, 11.5, 18.3, 25.2], goalY: 16.2 },
  3: { y: 19.5, x: [4.5, 11.5, 18.5, 25.2], goalY: 24 },
}
export const CARGO = { wp: [15, 2], x: [12.5, 17.5], y: [0, 1.5] }

// Desplazamientos de los trabajadores respecto del árbol (layout 0 y su reflejo, layout 1)
export const OFFSETS = [
  [[-1.15, -1.1], [1.15, -1.1], [-1.15, 1.1], [1.15, 1.1], [0, -1.45], [0, 1.45], [-1.45, 0], [1.45, 0], [-0.85, -1.35], [0.85, -1.35], [-0.85, 1.35], [0.85, 1.35]],
  [[1.15, 1.1], [-1.15, 1.1], [1.15, -1.1], [-1.15, -1.1], [0, 1.45], [0, -1.45], [1.45, 0], [-1.45, 0], [0.85, 1.35], [-0.85, 1.35], [0.85, -1.35], [-0.85, -1.35]],
]

export const MIX = ['ground', 'ground', 'ladder', 'ladder', 'picker', 'picker']
export const ACT_LABEL = { ground: 'Suelo', ladder: 'Escalera', picker: 'Gancho', mixed: 'Mixta' }

// Ruta del robot en una vuelta (HumanRobot_Sim.m:1039-1118)
export function routeLoop(row) {
  const Y = ROWS[row].goalY
  return [[15, 2], [22, 2], [22, Y], [15, Y], [15, 2], [8, 2], [8, Y], [15, Y], [15, 2]]
}

export function workerBase(h, row, rp) {
  const R = ROWS[row]
  const ti = (h - 1) % 4
  const oi = Math.floor((h - 1) / 4) % 12
  const tx = R.x[ti], ty = R.y
  const o = OFFSETS[rp ? 1 : 0][oi]
  const x = tx + o[0], y = ty + o[1]
  return { x, y, tx, ty, heading: Math.atan2(ty - y, tx - x) }
}

function nearestOnPolyline(p, pts) {
  let best = null
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1]
    const dx = bx - ax, dy = by - ay
    const L2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L2))
    const q = [ax + t * dx, ay + t * dy]
    const d = Math.hypot(p[0] - q[0], p[1] - q[1])
    if (!best || d < best.d) best = { q, d }
  }
  return best
}

// Posición de la caja del trabajador: punto más cercano de la ruta + desfase lateral (BOX_ROUTE_OFFSET)
export function boxXY(base, row) {
  const { q, d } = nearestOnPolyline([base.x, base.y], routeLoop(row))
  const off = Math.min(1.2, Math.max(0.35, 0.6 * d))
  const ux = d > 1e-9 ? (base.x - q[0]) / d : 0
  const uy = d > 1e-9 ? (base.y - q[1]) / d : 0
  return [q[0] + off * ux, q[1] + off * uy]
}

// Mapa → mundo 3D (X derecha, Z hacia el observador, Y arriba)
export const toW = (x, y) => [x - MAP.w / 2, 0, -(y - MAP.h / 2)]
