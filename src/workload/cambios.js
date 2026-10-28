import { ACOPIO, CARGA, CREW, DURATION, HUERTO, ROBOT, SSM } from './parametros.js'

/* ---------------------------------------------------------------- qué cambió desde la última simulación */
const fila = (rows) => Object.fromEntries(rows.map((r) => [r[0], r[1]]))

/** Etiqueta (en español, la clave de traducción) de cada campo de primer nivel de lo configurado. */
const ETIQUETA = {
  nw: 'Cosecheros',
  act: 'Actividad',
  row: 'Fila de cultivo',
  rp: 'Disposición (RP)',
  huerto: 'Sistema',
  cmp: 'Comparar con',
  profile: 'Comportamiento del robot',
  robotTipo: 'Robot',
  energia: 'Robot',
  reparto: 'Reparto de la cuadrilla',
  flota: 'Cantidad de robots',
  avance: 'Avance del bloque',
  acopio: 'Acopio',
  carga: 'Carga variable y ritmo que cae',
  costs: 'Costos metabólicos (kcal/s)',
  prodPeriod: 'Segundos por unidad cosechada',
  ssm: 'Regla de seguridad activa',
  ...fila([...CREW, ...ROBOT, DURATION]),
}
/** Objetos cuyos campos se nombran uno por uno si el objeto existe antes y después. */
const SUB = {
  huertoParams: { ...fila(HUERTO), pendiente: 'Pendiente a lo largo de las hileras (%)', acopioEnCima: 'Acopio en la cima del cerro' },
  acopio: fila(ACOPIO),
  carga: fila(CARGA),
  ssm: { ...fila(SSM), enabled: 'Regla de seguridad activa' },
  flota: { n: 'Cantidad de robots', estrategia: 'Cómo se reparten' },
}
// la cuadrilla primero: es lo que más se cambia y lo que el título de la escena nombra
const ORDEN = ['nw', 'act', 'row', 'rp', 'huerto']
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Etiquetas de los campos que difieren entre dos configuraciones ({...params, ...cfg, cmp}), sin repetir.
 * Con otro huerto, sus medidas no se nombran aparte: cambiaron con él.
 */
export function camposCambiados(antes, ahora) {
  if (!antes || !ahora) return []
  const keys = [...new Set([...Object.keys(antes), ...Object.keys(ahora)])].sort((a, b) => (ORDEN.indexOf(a) + 1 || 99) - (ORDEN.indexOf(b) + 1 || 99))
  const out = new Set()
  for (const k of keys) {
    if (igual(antes[k], ahora[k])) continue
    if (k === 'huertoParams' && antes.huerto !== ahora.huerto) continue
    const a = antes[k],
      b = ahora[k]
    if (SUB[k] && a && b && typeof a === 'object' && typeof b === 'object') {
      for (const s of new Set([...Object.keys(a), ...Object.keys(b)])) if (!igual(a[s], b[s])) out.add(SUB[k][s] ?? ETIQUETA[k] ?? k)
    } else out.add(ETIQUETA[k] ?? k)
  }
  return [...out]
}
