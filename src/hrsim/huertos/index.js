// Sistemas de huerto: el motor recibe el huerto como dato (ver docs/simulador.md, «Sistemas de huerto»).
import { huertoMatlab2026 } from './matlab2026.js'
import { generarRectangular, PALTA_TRADICIONAL } from './rectangular.js'

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
 * (parámetros del cultivo que reemplazan a DEFAULTS: DEFAULTS → perfil → sistema → opciones).
 */
export const SISTEMAS = {
  'matlab-2026': { label: 'MATLAB 2026 (mapa del estudio)', build: huertoMatlab2026 },
  'palta-tradicional': {
    label: 'Palta tradicional (6 × 6 m, 1 ha)',
    generador: PALTA_TRADICIONAL,
    // 1 unidad = 1 kg; caja de 15 kg. Ritmo calibrado a 320–420 kg por cosechero en 8 h (ver docs/simulador.md)
    params: { prodPeriod: { 1: 60, 2: 90, 3: 75 } },
    build: (p) => generarRectangular(p.huertoParams, { nw: p.nw, sistema: 'palta-tradicional' }),
  },
}

/** Huerto de una simulación a partir de sus parámetros resueltos. */
export function buildHuerto(p) {
  const s = SISTEMAS[p.huerto]
  if (!s) throw new Error(`Parámetro inválido: sistema de huerto "${p.huerto}" desconocido (${Object.keys(SISTEMAS).join(', ')})`)
  return s.build(p)
}
