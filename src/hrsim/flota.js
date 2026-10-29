// Flota de robots transportadores (H8, fase A; opcional): 2 o 3 robots del mismo tipo en un huerto generado.
// Estrategias (qué calles recorre cada robot y en qué orden) y reparto de zonas. Las reglas de convivencia viven en
// engine.js. Ver docs/simulador.md, «Flota de robots».

export const FLOTA_ESTRATEGIAS = ['zonas', 'opuestas', 'desfase']
export const FLOTA_MAX = 3

/**
 * Valores de partida. Las distancias de convivencia son supuestos del modelo (sin fuente):
 * - ceder: dos robots en movimiento fuera de las calles a menos de esta distancia → el de número mayor se detiene [m]
 * - reserva: a esta distancia de la boca de una calle ocupada por otro robot, el robot espera en la cabecera [m]
 * - esperaAcopio: con otro robot descargando, el robot con carga espera a esta distancia del acopio [m]
 */
export const FLOTA_DEFAULTS = { estrategia: 'zonas', ceder: 2, reserva: 3, esperaAcopio: 3 }

/**
 * Reparte las calles `ejes` (ordenadas de izquierda a derecha) en `n` grupos contiguos, con un peso parecido
 * (cosecheros trabajando + cajas esperando). Minimiza el grupo más pesado; con menos calles que robots, los robots de
 * número mayor quedan sin zona ([]).
 */
export function repartirZonas(ejes, peso, n) {
  const grupos = Array.from({ length: n }, () => [])
  const k = Math.min(n, ejes.length)
  if (!k) return grupos
  const acum = [0]
  for (const e of ejes) acum.push(acum.at(-1) + Math.max(1, peso(e)))
  const suma = (a, b) => acum[b] - acum[a]
  // cortes en orden: probar todos (a lo más 3 grupos y unas 25 calles)
  let mejor = null
  const probar = (cortes) => {
    const lim = [0, ...cortes, ejes.length]
    const pesos = lim.slice(1).map((b, i) => suma(lim[i], b))
    const max = Math.max(...pesos),
      dif = max - Math.min(...pesos)
    if (!mejor || max < mejor.max - 1e-9 || (Math.abs(max - mejor.max) < 1e-9 && dif < mejor.dif - 1e-9)) mejor = { max, dif, lim }
  }
  const rec = (desde, cortes) => {
    if (cortes.length === k - 1) return probar(cortes)
    for (let c = desde; c <= ejes.length - (k - 1 - cortes.length); c++) rec(c + 1, [...cortes, c])
  }
  rec(1, [])
  for (let i = 0; i < k; i++) grupos[i] = ejes.slice(mejor.lim[i], mejor.lim[i + 1])
  return grupos
}

/** La misma vuelta en sentido contrario: sale y vuelve al acopio, recorriendo las calles al revés. */
export const invertir = (lap) => (lap.length <= 2 ? lap : [lap[0], ...lap.slice(1, -1).reverse(), lap.at(-1)])

/**
 * Calles y vuelta del robot `i` según la estrategia. `zonas`: las calles de su grupo; `opuestas`: todas, los robots
 * impares al revés; `desfase`: todas, en el mismo sentido (la salida escalonada la maneja el motor).
 */
export function vueltaDeRobot(huerto, estrategia, i, n, ejes, peso) {
  const mias = estrategia === 'zonas' ? repartirZonas(ejes, peso, n)[i] : ejes
  // sin zona (menos calles que robots): descarga lo que traiga y espera estacionado junto al acopio
  if (!mias.length) return { ejes: mias, lap: [[...huerto.acopio], estacionamiento(huerto, i)] }
  const lap = densificar(huerto.vuelta(mias))
  return { ejes: mias, lap: estrategia === 'opuestas' && i % 2 === 1 ? invertir(lap) : lap }
}

/**
 * Un waypoint cada `paso` m en los tramos largos por una calle. La vuelta con un número impar de calles vuelve de la
 * cabecera de arriba al acopio en un solo tramo; con un único waypoint al fondo, el controlador se abre al girar y baja
 * en diagonal entre las copas, y con flota entra a la calle vecina sin reservarla. Vale con uno o con varios robots (con
 * uno, desde el motor 0.8.1: antes su vuelta no se densificaba).
 */
export function densificar(lap, paso = 3) {
  const out = [lap[0]]
  for (let i = 1; i < lap.length; i++) {
    const [a, b] = [lap[i - 1], lap[i]]
    const d = Math.abs(b[1] - a[1])
    if (Math.abs(b[0] - a[0]) < 1e-9 && d > paso + 1e-9) {
      const n = Math.round(d / paso)
      for (let k = 1; k < n; k++) out.push([a[0], a[1] + ((b[1] - a[1]) * k) / n])
    }
    out.push(b)
  }
  return out
}

/** Donde espera un robot sin zona: a un costado del acopio y hacia el borde del huerto, fuera del paso de los demás. */
export function estacionamiento(huerto, i) {
  const [x, y] = huerto.acopio
  return [x + (i % 2 ? -3 : 3) * Math.ceil(i / 2), Math.max(0.6, y - 1.5)]
}

/** Índice de Jain de una lista de cantidades (1 = todas iguales). */
export const jain = (xs) => {
  const s = xs.reduce((a, b) => a + b, 0),
    s2 = xs.reduce((a, b) => a + b * b, 0)
  return s2 > 0 ? (s * s) / (xs.length * s2) : 1
}
