// Experimentos en lote (H6): expansión del diseño, una corrida → una fila, efectos contra «sin robot» (y, con flota, contra
// 1 robot), resumen de las semillas y CSV.
// Lo usa scripts/experimentos.mjs (paralelo en hilos) y lo prueban tests/unit/experimentos.test.mjs.
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { ENGINE_VERSION, paramsHash, resolveParams } from '../../src/hrsim/common.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { analyzeHRI, fluencyIndex } from '../../src/workload/hri.js'
import { analizarFlota } from '../../src/workload/flota.js'

export const SIN_ROBOT = 'ninguno'

/** Producto cartesiano de { factor: [niveles] } en el orden de las claves (la última varía más rápido). */
export function cartesiano(factores) {
  return Object.entries(factores).reduce((acc, [k, vs]) => acc.flatMap((c) => vs.map((v) => ({ ...c, [k]: v }))), [{}])
}

/** Fija `a.b.c = v` creando los objetos intermedios (factores como «huertoParams.pendiente»). */
function asignar(o, ruta, v) {
  const ks = ruta.split('.')
  let x = o
  for (const k of ks.slice(0, -1)) x = x[k] = { ...(x[k] || {}) }
  x[ks.at(-1)] = v
}

/**
 * Celdas de un bloque: fijos + cada combinación de factores, con «robot» = ninguno | tipo de robot.
 * Sin robot el perfil y la flota no aplican: esas celdas se colapsan en una sola (perfil matlab-2026, sin `flota`).
 * Con `repeticiones`, las celdas que cumplen `solo` se repiten con cada semilla (además de la corrida sin semilla).
 */
export function celdas(bloque) {
  const out = [],
    vistos = new Set()
  const reps = bloque.repeticiones
  for (const comb of cartesiano(bloque.factores)) {
    const c = { bloque: bloque.id, ...structuredClone(bloque.fijos || {}) }
    for (const [k, v] of Object.entries(comb)) asignar(c, k, v)
    if (c.robot === SIN_ROBOT) {
      c.profile = 'matlab-2026'
      delete c.flota
    }
    const semillas = [null]
    if (reps && Object.entries(reps.solo || {}).every(([k, v]) => c[k] === v)) semillas.push(...reps.semillas)
    for (const s of semillas) {
      const cs = s == null ? c : { ...c, semilla: s }
      const k = JSON.stringify(cs)
      if (vistos.has(k)) continue
      vistos.add(k)
      out.push(cs)
    }
  }
  return out
}

/** Opciones del motor para una celda (sin las claves del diseño). */
export function opciones(c) {
  const o = { ...c }
  delete o.bloque
  delete o.robot
  if (c.robot !== SIN_ROBOT) o.robotTipo = c.robot
  return o
}

/** Clave estable de una corrida: versión del motor, tipo (HO/HR) y hash de los parámetros resueltos. */
export function clave(c) {
  const hr = c.robot !== SIN_ROBOT
  return `${ENGINE_VERSION}|${hr ? 'HR' : 'HO'}|${paramsHash(resolveParams(opciones(c)))}`
}

const r = (x, d = 3) => (x == null || !Number.isFinite(x) ? '' : +x.toFixed(d))

/** Columnas del CSV de resultados (en orden). */
export const COLS = [
  'clave',
  'bloque',
  'huerto',
  'cosecheros',
  'robot',
  // H8: robots (0 sin robot, 1 el de siempre) y cómo se reparten; las distancias de convivencia, solo con flota
  'robots',
  'estrategia',
  'ceder_m',
  'reserva_m',
  'espera_acopio_dist_m',
  'perfil',
  'duracion_s',
  'pendiente_pct',
  'acopio_en_cima',
  'semilla',
  'acopiador',
  'carga_variable',
  'reparto',
  'avance_pct',
  'motor',
  'paramsHash',
  'cosecha_kg',
  'entregado_kg',
  'cajas_esperando_kg',
  'en_robot_kg',
  'en_bolsas_kg',
  'kg_por_cosechero_8h',
  'kcal_total',
  'kcal_por_kg',
  'entregas_robot',
  'robot_mov_pct',
  'robot_espera_pct',
  'robot_detenido_pct',
  'robot_parada_seg_pct',
  'robot_lento_pct',
  'paradas_seg',
  'espera_robot_s',
  'espera_caja_media_s',
  'espera_caja_p90_s',
  'atencion_media_s',
  'jain_atencion',
  'dentro_Sp_s',
  'eventos_Sp',
  'dist_min_m',
  'dist_p5_mov_m',
  'energia_Wh',
  'Wh_por_kg',
  'bateria_pct',
  'descargas',
  'traccion_s',
  // H7: logística del acopio, carga variable, reparto y avance del bloque
  'despachado_kg',
  'acopiador_ocupado_pct',
  'espera_robot_acopio_s',
  'fruta_dejada_kg',
  'caminata_media_m',
  'calles_robot',
  // H8: la flota (con 1 robot quedan vacías, salvo el recorrido); espera_acopio_s = esperando a que otro robot descargue
  'jain_cajas',
  'espera_calle_s',
  'cede_s',
  'espera_acopio_s',
  'estacionado_s',
  'dist_min_calle_m',
  'recorrido_m',
  'ms',
]
// columnas de efecto contra la corrida sin robot del mismo escenario, cuadrilla, duración y semilla, y (efecto1_) contra la
// de 1 robot del mismo tipo (H8)
export const EFECTO_COLS = ['efecto_entregado_pct', 'efecto_cosecha_pct', 'efecto_kcal_por_kg_pct', 'efecto1_entregado_pct', 'efecto1_cosecha_pct']

/** Corre una celda y devuelve su fila (objeto con COLS). `fis` = texto del FIS del robot. */
export function correr(c, fis) {
  const t0 = performance.now()
  const o = opciones(c)
  const hr = c.robot !== SIN_ROBOT
  const s = hr ? new HRSim(o, fis).run() : new HOSim(o).run()
  const sm = s.summary()
  const p = s.p
  const run = hr ? simToRun(s, { robot: true }) : null
  // con flota, como en el visor: la geometría con las personas hacia el robot más cercano, lo de cada robot sumado
  const f = hr ? fluencyIndex(run.flota ? analizarFlota(run) : analyzeHRI(run)) : {}
  const fl = sm.flota
  const camino = (xs, ys) => {
    let d = 0
    for (let i = 1; i < xs.length; i++) d += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1])
    return d
  }
  let cam = 0
  for (let k = 0; k < s.W.length; k++) cam += camino(s.rec.wx[k], s.rec.wy[k])
  // lo recorrido por todos los robots (con flota es la suma del odómetro de cada uno)
  const recorrido = !hr ? null : s.rec.fx ? s.rec.fx.reduce((a, xs, k) => a + camino(xs, s.rec.fy[k]), 0) : camino(s.rec.rx, s.rec.ry)
  const g = (k) => (k in f ? f[k] : '')
  const cosecha = sm.TotalRecollectedCrops_crop_units
  return {
    clave: clave(c),
    bloque: c.bloque,
    huerto: p.huerto,
    cosecheros: p.nw,
    robot: c.robot,
    robots: hr ? (p.flota?.n ?? 1) : 0,
    estrategia: p.flota?.estrategia ?? '',
    ceder_m: p.flota?.ceder ?? '',
    reserva_m: p.flota?.reserva ?? '',
    espera_acopio_dist_m: p.flota?.esperaAcopio ?? '',
    perfil: p.profile,
    duracion_s: p.duration,
    pendiente_pct: p.huertoParams?.pendiente ?? '',
    acopio_en_cima: p.huertoParams ? (p.huertoParams.acopioEnCima ? 1 : 0) : '',
    semilla: p.semilla ?? '',
    acopiador: p.acopio ? 1 : 0,
    carga_variable: p.carga ? 1 : 0,
    reparto: p.huertoParams ? (p.reparto?.modo ?? 'acopio') : '',
    avance_pct: p.huertoParams ? Math.round(100 * (p.avance ?? 0)) : '',
    motor: ENGINE_VERSION,
    paramsHash: paramsHash(p),
    cosecha_kg: r(cosecha),
    entregado_kg: r(sm.TotalProductionCargoZone_crop_units),
    cajas_esperando_kg: r(sm.RemainingCropsBoxes_crop_units),
    en_robot_kg: r(sm.RemainingCropsRobot_crop_units),
    en_bolsas_kg: r(sm.RemainingCropsHumanBags_crop_units),
    kg_por_cosechero_8h: r(((cosecha / p.nw) * 8 * 3600) / p.duration, 1),
    kcal_total: r(sm.TotalHumanWorkload_kcal, 1),
    kcal_por_kg: r(sm.TotalHumanWorkload_kcal / Math.max(1e-9, cosecha)),
    entregas_robot: hr ? sm.handoffs : '',
    robot_mov_pct: g('HR_robot_mov_pct'),
    robot_espera_pct: g('HR_robot_espera_pct'),
    robot_detenido_pct: g('HR_robot_detenido_pct'),
    robot_parada_seg_pct: g('HR_robot_parada_seg_pct'),
    robot_lento_pct: g('HR_robot_lento_pct'),
    paradas_seg: g('HR_paradas_seg'),
    espera_robot_s: g('HR_espera_robot_s'),
    espera_caja_media_s: g('HR_espera_caja_media_s'),
    espera_caja_p90_s: g('HR_espera_caja_p90_s'),
    atencion_media_s: g('HR_atencion_media_s'),
    jain_atencion: g('HR_jain_atencion'),
    dentro_Sp_s: g('HR_dentro_Sp_s'),
    eventos_Sp: g('HR_eventos_Sp'),
    dist_min_m: g('HR_dist_min_m'),
    dist_p5_mov_m: g('HR_dist_p5_mov_m'),
    energia_Wh: g('HR_energia_Wh'),
    Wh_por_kg: g('HR_Wh_por_kg'),
    bateria_pct: g('HR_bateria_pct'),
    descargas: g('HR_descargas'),
    traccion_s: g('HR_traccion_s'),
    despachado_kg: sm.acopio ? r(sm.acopio.despachado) : '',
    acopiador_ocupado_pct: sm.acopio ? r(sm.acopio.ocupadoPct, 1) : '',
    espera_robot_acopio_s: sm.acopio && hr ? r(sm.acopio.esperaRobot_s, 1) : '',
    fruta_dejada_kg: sm.carga ? r(sm.carga.dejado, 1) : '',
    caminata_media_m: r(cam / s.W.length, 0),
    calles_robot: run?.robot?.calles ?? '',
    jain_cajas: fl ? r(fl.jainCajas) : '',
    espera_calle_s: fl ? r(fl.esperaCalle_s, 1) : '',
    cede_s: fl ? r(fl.cede_s, 1) : '',
    espera_acopio_s: fl
      ? r(
          fl.robots.reduce((a, q) => a + q.esperaAcopio_s, 0),
          1,
        )
      : '',
    estacionado_s: fl
      ? r(
          fl.robots.reduce((a, q) => a + q.estacionado_s, 0),
          1,
        )
      : '',
    dist_min_calle_m: fl ? r(fl.distMinCalle_m, 2) : '',
    recorrido_m: r(recorrido, 0),
    ms: Math.round(performance.now() - t0),
  }
}

/** Escenario de referencia de una fila (todo menos robot y perfil). */
const escenario = (f) =>
  [f.bloque, f.huerto, f.cosecheros, f.duracion_s, f.pendiente_pct, f.acopio_en_cima, f.semilla, f.acopiador, f.carga_variable, f.reparto, f.avance_pct].join(
    '|',
  )
const pct = (a, b) => (a === '' || b === '' || !(+b > 0) ? '' : +((100 * (+a - +b)) / +b).toFixed(2))

/**
 * Agrega a cada fila con robot el efecto contra su corrida sin robot (mismo escenario y semilla) y, si es una flota, contra la
 * de 1 robot del mismo tipo (mismo escenario y semilla). Las filas sin `robots` (lotes anteriores a H8) cuentan como 1 robot.
 */
export function conEfectos(filas) {
  const n = (f) => (f.robots === '' || f.robots == null ? 1 : +f.robots)
  const ref = new Map(filas.filter((f) => f.robot === SIN_ROBOT).map((f) => [escenario(f), f]))
  const ref1 = new Map(filas.filter((f) => f.robot !== SIN_ROBOT && n(f) === 1).map((f) => [`${escenario(f)}|${f.robot}`, f]))
  return filas.map((f) => {
    const b = f.robot === SIN_ROBOT ? null : ref.get(escenario(f))
    const b1 = f.robot !== SIN_ROBOT && n(f) > 1 ? ref1.get(`${escenario(f)}|${f.robot}`) : null
    return {
      ...f,
      efecto_entregado_pct: b ? pct(f.entregado_kg, b.entregado_kg) : '',
      efecto_cosecha_pct: b ? pct(f.cosecha_kg, b.cosecha_kg) : '',
      efecto_kcal_por_kg_pct: b ? pct(f.kcal_por_kg, b.kcal_por_kg) : '',
      efecto1_entregado_pct: b1 ? pct(f.entregado_kg, b1.entregado_kg) : '',
      efecto1_cosecha_pct: b1 ? pct(f.cosecha_kg, b1.cosecha_kg) : '',
    }
  })
}

// columnas que describen una celda del diseño (todas menos la semilla): el resumen agrupa por ellas
export const CELDA_COLS = [
  'bloque',
  'huerto',
  'cosecheros',
  'robot',
  'robots',
  'estrategia',
  'ceder_m',
  'reserva_m',
  'espera_acopio_dist_m',
  'perfil',
  'duracion_s',
  'pendiente_pct',
  'acopio_en_cima',
  'acopiador',
  'carga_variable',
  'reparto',
  'avance_pct',
]
// medidas de resumen.csv (media, mínimo y máximo entre las corridas de una celda); entregado_pct = entregado / cosecha
export const RESUMEN_MEDIDAS = [
  'entregado_kg',
  'cosecha_kg',
  'entregado_pct',
  'kg_por_cosechero_8h',
  'efecto_entregado_pct',
  'efecto1_entregado_pct',
  'efecto_cosecha_pct',
  'efecto1_cosecha_pct',
  'kcal_por_kg',
  'Wh_por_kg',
  'caminata_media_m',
  'jain_cajas',
  'espera_calle_s',
  'cede_s',
  'espera_acopio_s',
  'estacionado_s',
  'dist_min_calle_m',
  'recorrido_m',
  'dentro_Sp_s',
  'eventos_Sp',
  'paradas_seg',
]
export const RESUMEN_COLS = [...CELDA_COLS, 'corridas', ...RESUMEN_MEDIDAS.flatMap((m) => [`${m}_media`, `${m}_min`, `${m}_max`])]

/** Una fila por celda del diseño: media, mínimo y máximo de cada medida entre la corrida de siempre y sus semillas. */
export function resumen(filas) {
  const grupos = new Map()
  for (const f of filas) {
    const k = CELDA_COLS.map((c) => f[c] ?? '').join('|')
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k).push(f)
  }
  const valor = (f, m) => (m === 'entregado_pct' ? (+f.cosecha_kg > 0 ? (100 * f.entregado_kg) / f.cosecha_kg : '') : f[m])
  return [...grupos.values()].map((g) => {
    const o = Object.fromEntries(CELDA_COLS.map((c) => [c, g[0][c] ?? '']))
    o.corridas = g.length
    for (const m of RESUMEN_MEDIDAS) {
      const xs = g
        .map((f) => valor(f, m))
        .filter((x) => x !== '' && x != null && Number.isFinite(+x))
        .map(Number)
      o[`${m}_media`] = xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3) : ''
      o[`${m}_min`] = xs.length ? +Math.min(...xs).toFixed(3) : ''
      o[`${m}_max`] = xs.length ? +Math.max(...xs).toFixed(3) : ''
    }
    return o
  })
}

const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
export const aCSV = (filas, cols) => [cols.join(','), ...filas.map((f) => cols.map((c) => esc(f[c] ?? '')).join(','))].join('\n') + '\n'

/** Lee un CSV simple (sin comillas con comas dentro, como los que escribe aCSV con estas columnas). */
export function deCSV(texto) {
  const [head, ...ls] = texto.trim().split('\n')
  if (!head) return []
  const cols = head.split(',')
  return ls.filter(Boolean).map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])))
}
