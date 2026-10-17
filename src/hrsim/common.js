// Constantes, geometría y utilidades compartidas por los simuladores Humano-Robot y Solo humano.

/** Versión del motor JS. Súbela cuando un cambio altere resultados (la regresión vs MATLAB debe seguir pasando). */
export const ENGINE_VERSION = '0.3.0'

/**
 * Parámetros de una simulación (todos con valor por defecto en DEFAULTS).
 * @typedef {Object} SimParams
 * @property {number} nw  número de trabajadores
 * @property {1|2|3} row  fila de cultivo
 * @property {'ground'|'ladder'|'picker'|'mixed'} act  actividad principal
 * @property {0|1} rp  disposición de los trabajadores
 * @property {number} duration  duración [s]
 * @property {number} dt  paso de integración [s] (MATLAB: 0,25)
 * @property {number} walkSpeed  [m/s]
 * @property {number} ladderTime  [s]
 * @property {number} maxProd  unidades por caja
 * @property {Record<string, number>} costs  costos metabólicos [kcal/s]
 * @property {number} metabolicMultiplier
 * @property {number} capacityBoxes  capacidad del robot [cajas]
 * @property {number} loadTimePerBox  [s]
 * @property {number} unloadTimePerBox  [s]
 * @property {number} waypointTimeout  [s]
 * @property {number} maxBoxStopsPerLap
 * @property {number} detectorRange  [m]
 * @property {number} detectorFov  [rad]
 * @property {number} boxRouteOffset  [m]
 * @property {{1:number, 2:number, 3:number}} prodPeriod  s por unidad (suelo, escalera, gancho).
 *   Se convierte a ticks con `dt`; MATLAB fija 16/24/20 ticks, así que con dt ≠ 0,25 s ambos modelos divergen a propósito.
 * @property {boolean} fixRecallLoop  corrige el bucle de re-llamada cuando el robot se llena (por defecto replica MATLAB)
 * @property {number} costProduction  ritmo base de cosecha [u/s] (nombre heredado de MATLAB; no es un costo)
 * @property {number} mapW  @property {number} mapH  tamaño del mapa [m]
 * @property {'tree_point'} placement  dónde deja el trabajador la caja
 * @property {number} frontLen  @property {number} rearLen  geometría de dirección del robot [m]
 * @property {number} lapRepeats  vueltas de la ruta base del robot
 *
 * Supuestos que difieren de MATLAB (documentados en docs/simulador.md):
 * - Sin lidar ni FIS de seguimiento: con la ruta del estudio el robot nunca pasa a < 1,5 m de un tronco.
 * - movePose decide la llegada con `dist <= v·dt`; MATLAB usa norm() de MKL y en empates exactos
 *   (múltiplos de 0,1875 m al volver por el mismo segmento) puede llegar un tick antes o después.
 */

/**
 * Registro por tick de una simulación.
 * @typedef {Object} SimRecord
 * @property {number[]} t  tiempo [s]
 * @property {number[]} delivered  unidades entregadas a la zona de carga
 * @property {number[]} onboard  unidades a bordo del robot
 * @property {number[]} work  carga de trabajo acumulada del equipo [kcal]
 * @property {number[][]} prod  producción en bolsa por trabajador
 * @property {number[][]} workH  carga acumulada por trabajador [kcal]
 * @property {number[][]} flag  bandera de actividad por trabajador (convención MATLAB)
 * @property {number[]} rx  posición x del robot [m]
 * @property {number[]} ry  posición y del robot [m]
 * @property {number[]} rth  orientación del robot [rad]
 * @property {number[]} rst  estado del robot (0 en ruta, 1 esperando, 2 descargando)
 * @property {number[][]} wx  posición x por trabajador [m]
 * @property {number[][]} wy  posición y por trabajador [m]
 * @property {number[][]} wth  orientación por trabajador [rad]
 * @property {number[][]} wst  estado de la máquina de estados por trabajador
 */

/** JSON que conserva Infinity/NaN como texto (p. ej. capacidad ilimitada). */
export const toJSONSafe = (v, space) => JSON.stringify(v, (_k, x) => (typeof x === 'number' && !Number.isFinite(x) ? String(x) : x), space)

/** Límites de entrada: protegen la memoria del navegador (cada tick guarda ~8 + 7·nw valores). */
export const LIMITS = { maxDuration: 4 * 3600, maxWorkers: 48, minDt: 0.05, maxDt: 1 }

/**
 * Combina los parámetros con DEFAULTS (incluidos los objetos anidados costs y prodPeriod)
 * y valida rangos. Lanza un Error con mensaje legible si algo está fuera de rango.
 * @returns {SimParams}
 */
export function resolveParams(opts = {}, extra = {}) {
  const p = {
    ...DEFAULTS,
    ...extra,
    ...opts,
    costs: { ...DEFAULTS.costs, ...(opts.costs || {}) },
    prodPeriod: { ...DEFAULTS.prodPeriod, ...(opts.prodPeriod || {}) },
  }
  const bad = (msg) => {
    throw new Error(`Parámetro inválido: ${msg}`)
  }
  if (!Number.isInteger(p.nw) || p.nw < 1 || p.nw > LIMITS.maxWorkers) bad(`nw debe ser un entero entre 1 y ${LIMITS.maxWorkers} (es ${p.nw})`)
  if (![1, 2, 3].includes(p.row)) bad(`row debe ser 1, 2 o 3 (es ${p.row})`)
  if (![0, 1].includes(p.rp)) bad(`rp debe ser 0 o 1 (es ${p.rp})`)
  if (!(p.dt >= LIMITS.minDt && p.dt <= LIMITS.maxDt)) bad(`dt debe estar entre ${LIMITS.minDt} y ${LIMITS.maxDt} s (es ${p.dt})`)
  if (!(p.duration > 0 && p.duration <= LIMITS.maxDuration)) bad(`duration debe estar entre 0 y ${LIMITS.maxDuration} s (es ${p.duration})`)
  for (const k of [1, 2, 3]) if (!(Number.isFinite(p.prodPeriod[k]) && p.prodPeriod[k] > 0)) bad(`prodPeriod[${k}] debe ser un número positivo`)
  for (const [k, v] of Object.entries(p.costs)) if (!(Number.isFinite(v) && v >= 0)) bad(`costs.${k} debe ser un número ≥ 0`)
  for (const k of ['walkSpeed', 'maxProd', 'capacityBoxes', 'maxBoxStopsPerLap']) if (!(p[k] > 0)) bad(`${k} debe ser > 0`)
  return p
}

/** Hash corto y estable de un objeto (claves ordenadas, FNV-1a de 32 bits). */
export function paramsHash(obj) {
  const stable = (v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
          .join(',')}}`
      : typeof v === 'number' && !Number.isFinite(v)
        ? `"${v}"` // Infinity/NaN como texto (JSON.stringify los convertiría en null)
        : JSON.stringify(v)
  let h = 0x811c9dc5
  for (const c of stable(obj)) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** @type {SimParams} */
export const DEFAULTS = {
  nw: 12,
  row: 3,
  act: 'mixed',
  rp: 0,
  duration: 2700,
  dt: 0.25,
  // mapa (scene_spec.json)
  mapW: 29.7414,
  mapH: 25.7759,
  // trabajadores
  walkSpeed: 0.75,
  ladderTime: 5,
  maxProd: 15,
  costProduction: 4,
  // costos metabólicos ISO 8996 [kcal/s]
  costs: {
    walking: 0.0472,
    walkingCarrying: 0.0794,
    harvestGround: 0.0666,
    harvestLadder: 0.1117,
    harvestPicker: 0.0751,
    ladderClimb: 0.1482,
    ladderDown: 0.0923,
  },
  metabolicMultiplier: 1,
  // robot y protocolo del estudio (STUDY_HANDLING)
  robot: true,
  capacityBoxes: 68,

  loadTimePerBox: 3.6,
  unloadTimePerBox: 1.44,
  waypointTimeout: 60,
  maxBoxStopsPerLap: 10,
  detectorRange: 3,
  detectorFov: (4 * Math.PI) / 6,
  boxRouteOffset: 1.2,
  placement: 'tree_point',
  frontLen: 1.2,
  rearLen: 1.7,
  lapRepeats: 47,
  fixRecallLoop: false, // true: corrige el bucle de re-llamada heredado de MATLAB (ver engine.js); difiere de MATLAB
  prodPeriod: { 1: 4, 2: 6, 3: 5 }, // s por unidad cosechada: suelo, escalera, gancho (16/24/20 ticks de 0,25 s)
}

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

export function hyp(a, b) {
  return Math.hypot(a, b)
}

export function nearestOnPolyline(p, poly) {
  let best = Infinity,
    bp = poly[0]
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i],
      b = poly[i + 1],
      abx = b[0] - a[0],
      aby = b[1] - a[1]
    const den = abx * abx + aby * aby
    let c
    if (den < 1e-9) c = a
    else {
      let t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / den
      t = Math.max(0, Math.min(1, t))
      c = [a[0] + t * abx, a[1] + t * aby]
    }
    const d = hyp(p[0] - c[0], p[1] - c[1])
    if (d < best) {
      best = d
      bp = c
    }
  }
  return bp
}

export function movePose(old, target, speed, dt) {
  const vx = target[0] - old[0],
    vy = target[1] - old[1],
    dist = Math.hypot(vx, vy)
  if (dist < 1e-9) return { pose: [old[0], old[1], old[2]], reached: true }
  const step = Math.min(speed * dt, dist),
    ux = vx / dist,
    uy = vy / dist
  return { pose: [old[0] + step * ux, old[1] + step * uy, Math.atan2(uy, ux)], reached: dist <= speed * dt }
}

// Trabajadores: posición inicial, actividad (suelo / escalera / gancho), costo de cosecha y ritmo de producción
export function initWorkers(p) {
  const NH = p.nw
  const rowY = R3[p.row]
  const refTrees = TREE_X.map((x) => [x, rowY])
  if (p.row === 3) refTrees[2][0] = 18.5
  const offs = p.rp === 0 ? OFFS_RP0 : OFFS_RP1
  const k = p.costs,
    m = p.metabolicMultiplier
  const C = {
    walking: k.walking * m,
    walkingCarrying: k.walkingCarrying * m,
    harvestGround: k.harvestGround * m,
    harvestLadder: k.harvestLadder * m,
    harvestPicker: k.harvestPicker * m,
    ladderClimb: k.ladderClimb * m,
    ladderDown: k.ladderDown * m,
  }
  const { type, ladder } = assignActivities(NH, p.act)
  const tInc = { 1: Math.round(p.prodPeriod[1] / p.dt), 2: Math.round(p.prodPeriod[2] / p.dt), 3: Math.round(p.prodPeriod[3] / p.dt) }
  const costH = { 1: C.harvestGround, 2: C.harvestLadder, 3: C.harvestPicker }
  const W = []
  for (let h = 0; h < NH; h++) {
    const tree = refTrees[h % 4],
      off = offs[Math.floor(h / 4) % offs.length]
    const x = tree[0] + off[0],
      y = tree[1] + off[1]
    W.push({
      h: h + 1,
      tree,
      start: [x, y],
      pose: [x, y, Math.atan2(tree[1] - y, tree[0] - x)],
      state: 1,
      prod: 0,
      last: 0,
      cont: 0,
      work: 0,
      tInc: tInc[type[h]],
      cost: costH[type[h]],
      ladder: ladder[h],
      ladderCount: 0,
      nBoxes: 0,
      prodBox: 0,
      box: null,
      route: null,
      routeIdx: 0,
      ladderAfter: 0,
      call: false,
      done: false,
      stage: 0,
      timer: 0,
      target: null,
      flag: 0,
    })
  }
  return { W, C, type, ladder }
}

export function assignActivities(NH, act) {
  const type = new Array(NH).fill(1),
    ladder = new Array(NH).fill(0)
  if (act === 'ground') type.fill(1)
  else if (act === 'ladder') {
    type.fill(2)
    ladder.fill(1)
  } else if (act === 'picker') type.fill(3)
  else if (act === 'mixed') {
    if (NH === 1) type[0] = 1
    else if (NH === 3) {
      type[0] = 1
      type[1] = 2
      type[2] = 3
      ladder[1] = 1
    } else {
      const base = [1, 1, 2, 2, 3, 3]
      for (let h = 0; h < NH; h++) type[h] = base[h % 6]
      for (let h = 0; h < NH; h++) {
        const q = (h % 6) + 1
        if (q === 3 || q === 4) ladder[h] = 1
      }
    }
  } else throw new Error('act desconocida: ' + act)
  return { type, ladder }
}
