// Modelo de agentes (I3): máquinas de estado del cosechero y del robot, tal como las implementa el motor
// (src/hrsim/engine.js y humanonly.js), y la descripción del modelo con el protocolo ODD (Grimm et al. 2020).
// Todo texto es una clave en español para t(); los valores salen de los parámetros de la corrida, no se escriben a mano.
import { COSTS, CREW, HUERTO, ROBOT, SSM } from './parametros.js'
import { SISTEMAS } from '../hrsim/huertos/index.js'
import { ROBOTS, MU } from '../hrsim/robots.js'

/**
 * Cosechero con robot (HRSim, protocolo worker_loads). x, y = posición del nodo en el diagrama (viewBox 380 × 340).
 * Los números son los del motor: el estado que se registra en cada tick (rec.wst).
 */
export const ESTADOS_HR = [
  { id: 7, label: 'Sube la escalera', x: 60, y: 40 },
  { id: 1, label: 'Cosecha', x: 190, y: 40 },
  { id: 2, label: 'Baja la escalera', x: 320, y: 40 },
  { id: 13, label: 'Va al siguiente árbol', x: 60, y: 120 },
  { id: 15, label: 'Sin fruta', x: 190, y: 120 },
  { id: 6, label: 'Arma la caja', x: 320, y: 120 },
  { id: 9, label: 'Vuelve a su puesto', x: 120, y: 200 },
  { id: 8, label: 'Lleva la caja', x: 300, y: 200 },
  { id: 12, label: 'Baja para el robot', x: 60, y: 290 },
  { id: 10, label: 'Camina al robot', x: 190, y: 290 },
  { id: 11, label: 'Carga la caja', x: 320, y: 290 },
]

/** Transiciones del cosechero con robot: la regla dice qué la dispara, con los parámetros que usa. */
export const TRANSICIONES_HR = [
  { de: 1, a: 6, regla: 'La bolsa llega a {maxProd} kg (o unidades) y cosecha desde el suelo.' },
  { de: 1, a: 2, regla: 'La bolsa se llena o el lado del árbol se agota, y está en la escalera.' },
  { de: 1, a: 13, regla: 'Se agota la fruta de su lado del árbol: camina al siguiente árbol de su tramo.' },
  { de: 1, a: 15, regla: 'No queda fruta en su tramo ni tramos libres.' },
  { de: 2, a: 6, regla: 'Termina de bajar ({ladderTime} s) con la bolsa llena.' },
  { de: 2, a: 13, regla: 'Termina de bajar ({ladderTime} s) para ir a otro árbol.' },
  { de: 6, a: 8, regla: 'Arma la caja y sale a dejarla junto a la ruta del robot (en el mismo tick).' },
  { de: 8, a: 9, regla: 'Deja la caja en el punto de entrega y vuelve.' },
  { de: 8, a: 11, regla: 'Al llegar, el robot ya está junto a su caja: la carga.' },
  { de: 9, a: 1, regla: 'Llega a su puesto y cosecha desde el suelo.' },
  { de: 9, a: 7, regla: 'Llega a su puesto y sube a la escalera.' },
  { de: 9, a: 10, regla: 'El robot se detuvo a menos de 0,75 m de su caja y tiene espacio: da la vuelta.' },
  { de: 13, a: 1, regla: 'Llega al árbol y cosecha desde el suelo.' },
  { de: 13, a: 7, regla: 'Llega al árbol y sube a la escalera.' },
  { de: 1, a: 10, regla: 'El robot se detuvo a menos de 0,75 m de su caja y tiene espacio: deja de cosechar y va.' },
  { de: 13, a: 10, regla: 'El robot se detuvo a menos de 0,75 m de su caja y tiene espacio.' },
  { de: 15, a: 10, regla: 'El robot se detuvo a menos de 0,75 m de su caja y tiene espacio.' },
  { de: 1, a: 12, regla: 'El robot lo llama mientras está en la escalera: baja primero.' },
  { de: 12, a: 10, regla: 'Termina de bajar ({ladderTime} s) y camina al robot.' },
  { de: 10, a: 11, regla: 'Llega al robot.' },
  { de: 11, a: 9, regla: 'Carga sus cajas ({loadTimePerBox} s por caja) y vuelve a su puesto.' },
  { de: 7, a: 1, regla: 'Termina de subir ({ladderTime} s).' },
]

/** Cosechero sin robot (HOSim): lleva cada caja a pie hasta el acopio. */
export const ESTADOS_HO = [
  { id: 7, label: 'Sube la escalera', x: 60, y: 40 },
  { id: 1, label: 'Cosecha', x: 190, y: 40 },
  { id: 2, label: 'Baja la escalera', x: 320, y: 40 },
  { id: 13, label: 'Va al siguiente árbol', x: 60, y: 130 },
  { id: 15, label: 'Sin fruta', x: 190, y: 130 },
  { id: 3, label: 'Lleva la caja al acopio', x: 320, y: 130 },
  { id: 5, label: 'Vuelve al árbol', x: 120, y: 220 },
  { id: 4, label: 'Descarga en el acopio', x: 320, y: 220 },
]
export const TRANSICIONES_HO = [
  { de: 1, a: 3, regla: 'La bolsa llega a {maxProd} kg (o unidades) y cosecha desde el suelo: sale al acopio.' },
  { de: 1, a: 2, regla: 'La bolsa se llena o el lado del árbol se agota, y está en la escalera.' },
  { de: 1, a: 13, regla: 'Se agota la fruta de su lado del árbol: camina al siguiente árbol de su tramo.' },
  { de: 1, a: 15, regla: 'No queda fruta en su tramo ni tramos libres.' },
  { de: 2, a: 3, regla: 'Termina de bajar ({ladderTime} s) con la bolsa llena.' },
  { de: 2, a: 13, regla: 'Termina de bajar ({ladderTime} s) para ir a otro árbol.' },
  { de: 3, a: 4, regla: 'Llega al acopio.' },
  { de: 4, a: 5, regla: 'Descarga ({cargoUnloadTime} s) y vuelve.' },
  { de: 5, a: 1, regla: 'Llega a su árbol y cosecha desde el suelo.' },
  { de: 5, a: 7, regla: 'Llega a su árbol y sube a la escalera.' },
  { de: 13, a: 1, regla: 'Llega al árbol y cosecha desde el suelo.' },
  { de: 13, a: 7, regla: 'Llega al árbol y sube a la escalera.' },
  { de: 7, a: 1, regla: 'Termina de subir ({ladderTime} s).' },
]

/** Estados del robot (rec.rst). Se evalúan en este orden en cada tick; el último que aplica es el que queda. */
export const ESTADOS_ROBOT = [
  { id: 0, label: 'En ruta', regla: 'Sigue sus waypoints con el controlador difuso de búsqueda de meta.' },
  { id: 1, label: 'Espera al cosechero', regla: 'Está a menos de 0,75 m de una caja con espacio: se detiene hasta que el dueño la carga.' },
  { id: 2, label: 'Descarga', regla: 'En el acopio vacía su carga ({unloadTimePerBox} s por caja).' },
  { id: 3, label: 'Parada de seguridad', regla: 'Con la regla SSM: una persona está dentro de S_p(v); reanuda tras {tResume} s libre.' },
  { id: 4, label: 'Velocidad reducida', regla: 'Con la regla SSM: una persona está en el margen de advertencia o lo atiende; va a {vSlow} m/s.' },
  { id: 5, label: 'Sin tracción', regla: 'La pendiente pide más fuerza que la adherencia de sus ruedas (μ = {mu}): no avanza.' },
]

/** Valores para las reglas: parámetros de la corrida con formato corto. */
export function valoresReglas(p) {
  const f = (v) => (v == null ? '—' : String(Math.round(v * 100) / 100).replace('.', ','))
  return {
    maxProd: f(p.maxProd),
    ladderTime: f(p.ladderTime),
    loadTimePerBox: f(p.loadTimePerBox),
    unloadTimePerBox: f(p.unloadTimePerBox),
    cargoUnloadTime: f(p.cargoUnloadTime ?? 1.44),
    tResume: f(p.ssm?.tResume),
    vSlow: f(p.ssm?.vSlow),
    mu: f(MU),
  }
}

/** Segundos en cada estado de una serie de estados (Uint8Array por tick). */
export function tiempoPorEstado(serie, dt) {
  const out = new Map()
  if (!serie) return out
  for (let i = 0; i < serie.length; i++) out.set(serie[i], (out.get(serie[i]) || 0) + dt)
  return out
}

const num = (v) => (typeof v === 'number' ? v : null)
const fuente = (src) => (src ? { fuente: src, supuesto: /^Supuesto/.test(src) } : { fuente: '', supuesto: false })

/**
 * Descripción ODD del modelo para unos parámetros (los de la corrida que se ve). Devuelve secciones con texto
 * (claves para t() con {variables}) y tablas de parámetros con su valor actual y su fuente.
 */
export function describirModelo(p) {
  const generado = !!p.huertoParams
  const rb = generado ? ROBOTS[p.robotTipo] || ROBOTS.warthog : null
  const hp = p.huertoParams || {}
  const sis = SISTEMAS[p.huerto]
  const fila = (k, label, valor, src, unidad = '') => ({ k, label, valor: num(valor) ?? valor, unidad, ...fuente(src) })
  return [
    {
      id: 'proposito',
      titulo: 'Propósito y patrones',
      textos: [
        'Comparar sistemas de cosecha con y sin un robot transportador: cuánto cosechan los trabajadores, cuánto gastan, cuánto esperan el robot y las cajas, cuánta energía usa el robot y cuánto tiempo pasa cerca de las personas.',
        'Patrones que reproduce: la réplica de MATLAB (720 configuraciones del estudio) y el rendimiento por cosechero calibrado para cada cultivo (docs/simulador.md).',
      ],
    },
    {
      id: 'entidades',
      titulo: 'Entidades, variables de estado y escalas',
      tabla: [
        fila('huerto', 'Huerto', sis?.label ?? p.huerto, generado ? 'Generador rectangular (H2–H5)' : 'Mapa del estudio (MATLAB)'),
        fila('nw', 'Cosecheros: estado, posición, bolsa, cajas, gasto', p.nw, 'Uno por puesto; actividad suelo, escalera o gancho'),
        fila('robot', 'Robot: estado, pose, carga a bordo, energía', rb ? rb.label : 'Warthog (estudio)', rb ? 'Ficha del fabricante' : 'MATLAB'),
        fila('dt', 'Paso de tiempo', p.dt, 'MATLAB: 0,25', 's'),
        fila('duration', 'Duración', p.duration, 'Estudio: 2700', 's'),
        ...(generado
          ? [
              fila(
                'superficie',
                'Superficie',
                +((hp.hileras * hp.calle * (2 * hp.cabecera + hp.arbolesPorHilera * hp.sobreHilera)) / 10000).toFixed(2),
                '',
                'ha',
              ),
            ]
          : []),
      ],
    },
    {
      id: 'proceso',
      titulo: 'Proceso y calendario',
      textos: [
        'En cada tick, en este orden: (1) cada cosechero, de H1 a Hn, avanza su máquina de estados; (2) el robot detecta cajas, decide su próximo waypoint, aplica la regla de seguridad y sus límites físicos, se mueve y recoge o descarga; (3) se registran posiciones, estados, producción y gasto.',
        'La corrida termina al cumplir la duración. No hay eventos asíncronos: todo ocurre en ticks de {dt} s.',
      ],
    },
    {
      id: 'diseno',
      titulo: 'Conceptos de diseño',
      textos: [
        'Interacción: traspaso de cajas con el protocolo del estudio (worker_loads): el robot se detiene junto a la caja y el dueño camina a cargarla.',
        p.ssm?.enabled
          ? 'Seguridad: regla de velocidad y separación (ISO/TS 15066), activa en esta corrida.'
          : 'Seguridad: la regla de velocidad y separación (ISO/TS 15066) no está activa en esta corrida; solo se mide.',
        p.semilla != null
          ? 'Estocasticidad: semilla {semilla}; el ritmo de cada cosechero varía ±{var} %.'
          : 'Estocasticidad: ninguna; misma configuración, mismo resultado.',
        'Sin aprendizaje ni adaptación: las reglas son fijas durante la corrida.',
      ],
      vars: { semilla: p.semilla, var: Math.round((p.variacionRitmo ?? 0.1) * 100) },
    },
    {
      id: 'inicializacion',
      titulo: 'Inicialización y datos de entrada',
      tabla: [
        ...CREW.map(([k, l, , src]) => fila(k, l, p[k], src)),
        ...[1, 2, 3].map((k) =>
          fila(
            `prodPeriod.${k}`,
            ['', 'Ritmo de cosecha: suelo (s por unidad)', 'Ritmo de cosecha: escalera (s por unidad)', 'Ritmo de cosecha: gancho (s por unidad)'][k],
            p.prodPeriod[k],
            generado ? 'Calibrado por cultivo (docs/simulador.md)' : 'MATLAB',
          ),
        ),
        ...COSTS.map(([k, l]) => fila(`costs.${k}`, l, p.costs[k], 'MATLAB (costos del script)', 'kcal/s')),
        ...ROBOT.map(([k, l, , src]) => fila(k, l, p[k], src)),
        ...(generado ? HUERTO.map(([k, l]) => fila(`huertoParams.${k}`, l, hp[k], 'Generador del sistema')) : []),
        ...(generado ? [fila('huertoParams.pendiente', 'Pendiente a lo largo de las hileras (%)', hp.pendiente, 'Generador del sistema')] : []),
        ...(p.ssm ? SSM.map(([k, l, , src]) => fila(`ssm.${k}`, l, p.ssm[k], src)) : []),
      ],
    },
    {
      id: 'submodelos',
      titulo: 'Submodelos',
      textos: [
        'Gasto metabólico: costo por actividad (kcal/s) × tiempo; en ladera, factor de Pandolf según la pendiente.',
        'Marcha: velocidad de caminata; en ladera, función de Tobler.',
        ...(generado
          ? [
              'Energía del robot: P = max(0, m·g·(C_rr·cos θ + sen θ) + m·a)·v / η + P_aux, con C_rr = {crr} y η = {eta}.',
              'Tracción y frenada: adherencia μ = {mu}; sin tracción el robot se detiene.',
            ]
          : []),
        'Distancia de protección: S_p(v) = v_h·(T_r + v/a) + v·T_r + v²/(2a) + C + Z_d + Z_r.',
        'Navegación del robot: controlador difuso de búsqueda de meta de MATLAB (Robot_HRI_NEW_GoalSeeking_V3.fis).',
      ],
      vars: { crr: p.energia?.crr, eta: p.energia?.eta, mu: MU },
    },
  ]
}

/** La descripción como Markdown (para pegar en la tesis). `tr` = función de traducción, `fmt` = formato de números. */
export function oddMarkdown(secciones, vars, tr = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v?.[k] ?? `{${k}}`), fmt = String) {
  const out = []
  secciones.forEach((s, i) => {
    out.push(`## ${i + 1}. ${tr(s.titulo)}`, '')
    for (const tx of s.textos || []) out.push(tr(tx, { ...vars, ...s.vars }), '')
    if (s.tabla) {
      out.push(`| ${tr('Parámetro')} | ${tr('Valor')} | ${tr('Fuente')} |`, '| --- | --- | --- |')
      for (const f of s.tabla)
        out.push(
          `| ${tr(f.label)} | ${typeof f.valor === 'number' ? fmt(f.valor) : tr(String(f.valor))}${f.unidad ? ` ${f.unidad}` : ''} | ${f.fuente ? tr(f.fuente) : ''}${f.supuesto ? ' *' : ''} |`,
        )
      out.push('')
    }
  })
  return out.join('\n')
}
