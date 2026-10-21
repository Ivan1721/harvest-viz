// Sistemas de huerto: el motor recibe el huerto como dato (ver docs/simulador.md, «Sistemas de huerto»).
import { huertoMatlab2026 } from './matlab2026.js'
import { ROBOTS } from '../robots.js'
import { generarRectangular, PALTA_TRADICIONAL, PALTA_ALTA_DENSIDAD, PALTA_LADERA, UVA_PARRON, ARANDANO, CEREZO_UFO } from './rectangular.js'

/**
 * @typedef {object} Huerto
 * @property {string} sistema  id del sistema (p. ej. 'matlab-2026')
 * @property {number} version  versión del generador (cambia si cambia la geometría generada)
 * @property {object} params   parámetros con que se generó
 * @property {{w:number,h:number}} limites  tamaño del huerto [m]
 * @property {{x:number,y:number,z:number,carga:number}[]} arboles  carga de fruta en kg (Infinity = no se agota)
 * @property {{tree:number[],start:number[]}[]} puestos  árbol y puesto inicial de cada cosechero
 * @property {number[]} acopio  zona de carga [x, y]
 * @property {number[]} inicioRobot  pose inicial del robot [x, y, θ]
 * @property {number[][]} vueltaRobot  waypoints de una vuelta base del robot
 * @property {object|null} calles  grafo de calles (null = línea recta)
 * @property {{pendiente:number}} terreno  pendiente en %
 */

/**
 * Sistemas disponibles. Los generados tienen `generador` (valores de partida de huertoParams) y `params`
 * (parámetros del cultivo que reemplazan a DEFAULTS: DEFAULTS → perfil → sistema → opciones). Los generados corrigen
 * el bucle de llamada de MATLAB (fixRecallLoop): con la capacidad real del robot, un trabajador llamado por un robot
 * lleno quedaría girando a su lado.
 */
export const SISTEMAS = {
  'matlab-2026': { label: 'MATLAB 2026 (mapa del estudio)', build: huertoMatlab2026 },
  'palta-tradicional': {
    label: 'Palta tradicional (6 × 6 m, 1 ha)',
    generador: PALTA_TRADICIONAL,
    // 1 unidad = 1 kg; caja de 15 kg. Ritmo calibrado a 320–420 kg por cosechero en 8 h (ver docs/simulador.md)
    params: { prodPeriod: { 1: 60, 2: 90, 3: 75 }, fixRecallLoop: true },
    build: (p) => generarRectangular(p.huertoParams, opcionesGen(p, 'palta-tradicional')),
  },
  'palta-alta-densidad': {
    label: 'Palta alta densidad (4 × 2 m, 1 ha)',
    generador: PALTA_ALTA_DENSIDAD,
    // sin escalera; ritmo calibrado a 1.000–1.600 kg por cosechero en 8 h (ver docs/simulador.md)
    params: { prodPeriod: { 1: 14, 2: 14, 3: 18 }, fixRecallLoop: true },
    build: (p) => generarRectangular(p.huertoParams, opcionesGen(p, 'palta-alta-densidad')),
  },
  'palta-ladera': {
    label: 'Palta en ladera (4 × 2 m, 20 %)',
    generador: PALTA_LADERA,
    // mismo ritmo de cosecha que en plano: la ladera solo cambia la marcha (Tobler) y su gasto (Pandolf)
    params: { prodPeriod: { 1: 14, 2: 14, 3: 18 }, fixRecallLoop: true },
    build: (p) => generarRectangular(p.huertoParams, opcionesGen(p, 'palta-ladera')),
  },
  // H5: el ritmo de cosecha (s por kg, igual para todas las actividades: no hay escalera) está calibrado a la fuente de
  // cada cultivo; maxProd = kg de la caja o bandeja que el cosechero llena y entrega (ver docs/simulador.md)
  'uva-parron': {
    label: 'Uva de mesa en parrón (3,5 × 3,5 m)',
    generador: UVA_PARRON,
    params: { prodPeriod: { 1: 90, 2: 90, 3: 90 }, maxProd: 9, fixRecallLoop: true },
    build: (p) => generarRectangular(p.huertoParams, opcionesGen(p, 'uva-parron')),
  },
  arandano: {
    label: 'Arándano (3 × 1 m)',
    generador: ARANDANO,
    params: { prodPeriod: { 1: 340, 2: 340, 3: 340 }, maxProd: 2, fixRecallLoop: true },
    build: (p) => generarRectangular(p.huertoParams, opcionesGen(p, 'arandano')),
  },
  'cerezo-ufo': {
    label: 'Cerezo peatonal UFO (3,2 × 1,8 m)',
    generador: CEREZO_UFO,
    params: { prodPeriod: { 1: 63, 2: 63, 3: 63 }, maxProd: 5, fixRecallLoop: true },
    build: (p) => generarRectangular(p.huertoParams, opcionesGen(p, 'cerezo-ufo')),
  },
}

// el robot elegido define si entra a las calles (su ancho)
const anchoRobot = (p) => (ROBOTS[p.robotTipo] || ROBOTS.warthog).ancho
// opciones del generador; reparto y avance del bloque (H7, fase C) solo si se piden
const opcionesGen = (p, sistema) => ({ nw: p.nw, sistema, robotAncho: anchoRobot(p), reparto: p.reparto ?? null, avance: p.avance ?? 0 })

/** Huerto de una simulación a partir de sus parámetros resueltos. */
export function buildHuerto(p) {
  const s = SISTEMAS[p.huerto]
  if (!s) throw new Error(`Parámetro inválido: sistema de huerto "${p.huerto}" desconocido (${Object.keys(SISTEMAS).join(', ')})`)
  return s.build(p)
}
