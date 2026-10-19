// Huerto `matlab-2026`: la geometría fija del modelo MATLAB (scene_spec.json de HumanRobot_Sim/HumanOnly_Sim).
// Es el escenario de validación: con él, el simulador reproduce a MATLAB (ver docs/simulador.md).
// Los números de este archivo no se deben cambiar; los huertos nuevos se generan en otros módulos.

export const LIMITES = { w: 29.7414, h: 25.7759 }
export const R3 = { 3: 19.5, 2: 12.5, 1: 5.7 }
export const TREE_X = [4.5, 11.5, 18.3, 25.2]
export const TREES_ALL = [
  [4.5, 5.7],
  [11.5, 5.7],
  [18.3, 5.7],
  [25.2, 5.7],
  [4.5, 12.5],
  [11.5, 12.5],
  [18.3, 12.5],
  [25.2, 12.5],
  [4.5, 19.5],
  [11.5, 19.5],
  [18.5, 19.5],
  [25.2, 19.5],
]
// puestos de los cosecheros alrededor de su árbol (disposición 0 y su reflejo, disposición 1)
export const OFFS_RP0 = [
  [-1.15, -1.1],
  [1.15, -1.1],
  [-1.15, 1.1],
  [1.15, 1.1],
  [0, -1.45],
  [0, 1.45],
  [-1.45, 0],
  [1.45, 0],
  [-0.85, -1.35],
  [0.85, -1.35],
  [-0.85, 1.35],
  [0.85, 1.35],
]
export const OFFS_RP1 = [
  [1.15, 1.1],
  [-1.15, 1.1],
  [1.15, -1.1],
  [-1.15, -1.1],
  [0, 1.45],
  [0, -1.45],
  [1.45, 0],
  [-1.45, 0],
  [0.85, 1.35],
  [-0.85, 1.35],
  [0.85, -1.35],
  [-0.85, -1.35],
]
const ACOPIO = [15, 2]
export const GOAL_Y = { 3: 24, 2: 16.2, 1: 9 }

/**
 * Construye el huerto para una fila (1–3) y disposición (0–1) del estudio.
 * @returns {import('./index.js').Huerto}
 */
export function huertoMatlab2026({ row, rp, nw }) {
  const rowY = R3[row]
  const refTrees = TREE_X.map((x) => [x, rowY])
  if (row === 3) refTrees[2][0] = 18.5
  const offs = rp === 0 ? OFFS_RP0 : OFFS_RP1
  const puestos = []
  for (let h = 0; h < nw; h++) {
    const tree = refTrees[h % 4],
      off = offs[Math.floor(h / 4) % offs.length]
    puestos.push({ tree, start: [tree[0] + off[0], tree[1] + off[1]] })
  }
  // vuelta base del robot: 9 waypoints escritos a mano en el MATLAB, según la fila cosechada
  const gy = GOAL_Y[row]
  const init = [...ACOPIO],
    cargo = [...ACOPIO]
  const goal1 = [8, gy],
    goal2 = [15, gy],
    goal3 = [22, gy],
    ini1 = [8, 2],
    ini2 = [22, 2]
  return {
    sistema: 'matlab-2026',
    version: 1,
    params: { row, rp },
    limites: { ...LIMITES },
    arboles: TREES_ALL.map(([x, y]) => ({ x, y, z: 0, carga: Infinity })),
    puestos,
    acopio: [...ACOPIO],
    inicioRobot: [ACOPIO[0], ACOPIO[1], 0],
    vueltaRobot: [init, ini2, goal3, goal2, cargo, ini1, goal1, goal2, cargo],
    calles: null, // sin grafo: se camina en línea recta, como en MATLAB
    terreno: { pendiente: 0 },
  }
}
