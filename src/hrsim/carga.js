// Carga variable por árbol y ritmo que cae (H7, fase B). Opcional: sin `p.carga` cada árbol tiene la carga media del
// sistema, el cosechero arranca a ritmo constante y vacía el lado, como hasta ahora.
//
// - Carga: cada árbol recibe la media × un factor lognormal de media 1 y variabilidad `cv`; la carga total del cuartel
//   no cambia (se reescala). Olalla y Rodríguez 1991: palta de 0 a 123 kg por árbol, media 21,5 kg, CV 74 %.
// - Ritmo: el periodo crece cuando queda poca fruta en el lado, T(f) = T₀ · ln(1 + k) / ln(1 + k·f), con f = fruta que
//   queda / fruta inicial del lado. La forma logarítmica y k = 460 salen de Roka y Hyman 2008 (cítricos: 5,4 cajas/h
//   con 25 cajas por acre y 10,4 con 500, es decir, 52 % del ritmo con 5 % de la fruta). k = 0 apaga la caída.
// - Dejar el árbol: el cosechero pasa al siguiente cuando T(f) > umbral · T₀; lo que queda no se cosecha.
// - Calibración: T₀ se escala para que el periodo medio en una pasada (de f = 1 a f mínimo) sea el calibrado del
//   cultivo; así los rendimientos de H2–H5 se mantienen y k solo da la forma de la caída.
import { mulberry32 } from './common.js'

/** Valores de partida; `cv` depende del cultivo (ver cvDe). */
export const CARGA_DEFAULTS = Object.freeze({ k: 460, umbral: 2 })

/** CV de la carga entre árboles: 0,5 en palta, 0,3 en los demás (supuesto acotado por el 74 % de Olalla y Rodríguez). */
export const cvDe = (huerto) => (/^palta/.test(huerto) ? 0.5 : 0.3)

/** Ritmo relativo con una fracción f de fruta en el lado (1 con el lado lleno). */
export const ritmoRel = (f, k) => (k > 0 ? Math.log1p(k * Math.max(f, 0)) / Math.log1p(k) : 1)

/** Fracción de fruta con la que el cosechero deja el lado: T(f) = umbral · T₀. */
export const fMinima = (k, umbral) => (k > 0 ? (Math.pow(1 + k, 1 / umbral) - 1) / k : 0)

/** Periodo medio en una pasada, en múltiplos de T₀: (1 / (1 − f_min)) ∫ df / g(f) entre f_min y 1 (Simpson). */
export function periodoMedio(k, umbral) {
  if (!(k > 0)) return 1
  const a = fMinima(k, umbral),
    n = 400,
    hh = (1 - a) / n
  let s = 0
  for (let i = 0; i <= n; i++) s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) / ritmoRel(a + i * hh, k)
  return (s * hh) / 3 / (1 - a)
}

/** Factores de carga por árbol: lognormales de media 1 y variabilidad `cv`, reescalados para que sumen n. */
export function factoresCarga(n, cv, semilla) {
  if (!(cv > 0)) return new Float64Array(n).fill(1)
  // corriente propia (no cambia el sorteo de ritmos de H6)
  const rng = mulberry32((semilla ^ 0x9e3779b9) >>> 0)
  const s2 = Math.log(1 + cv * cv),
    s = Math.sqrt(s2),
    mu = -s2 / 2
  const out = new Float64Array(n)
  let tot = 0
  for (let i = 0; i < n; i++) {
    // Box-Muller
    const u = 1 - rng(),
      v = rng()
    out[i] = Math.exp(mu + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v))
    tot += out[i]
  }
  for (let i = 0; i < n; i++) out[i] *= n / tot
  return out
}

/** Configuración lista para la Cosecha: factores, fracción mínima y escala del periodo. */
export function prepararCarga(c, nArboles, semilla) {
  const fmin = fMinima(c.k, c.umbral)
  return { ...c, factores: factoresCarga(nArboles, c.cv, semilla ?? 0), fmin, escala: 1 / periodoMedio(c.k, c.umbral) }
}

/** Resumen de la fase B: fruta dejada en los árboles y ritmo real de cada cosechero mientras cosecha. */
export function resumenCarga(cosecha, W, wst, dt) {
  const ritmo = W.map((w, h) => {
    let n = 0
    for (const x of wst[h]) if (x === 1) n++
    return n ? (w.cosechado || 0) / ((n * dt) / 3600) : 0
  })
  return { carga: { dejado: cosecha.dejado, fMin: cosecha.carga.fmin, ritmo_kgh: ritmo } }
}
