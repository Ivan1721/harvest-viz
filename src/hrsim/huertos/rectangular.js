// Generador de huertos rectangulares (H2): hileras paralelas al eje y, calles entre hileras, cabeceras arriba y
// abajo, acopio al centro de la cabecera inferior. Especificación: documento «H0 · Especificación de sistemas de huerto».
//
// Coordenadas: x a lo ancho (perpendicular a las hileras), y a lo largo de las hileras; origen en la esquina inferior
// izquierda. La hilera r tiene su eje en x = calle·(r + ½); la calle s (entre las hileras s y s+1) en x = calle·(s + 1).
// Los árboles de una hilera van de abajo hacia arriba: y = cabecera + sobreHilera·(t + ½).

export const GENERADOR_VERSION = 1
export const ROBOT_ANCHO = 1.38 // m, Warthog
export const HOLGURA_CALLE = 0.5 // m: el robot entra a una calle si ancho libre ≥ ancho + holgura

/** Valores de partida de la palta tradicional (tabla de H0, aprobada). */
export const PALTA_TRADICIONAL = Object.freeze({
  calle: 6, // m entre hileras
  sobreHilera: 6, // m entre árboles de una hilera
  hileras: 16,
  arbolesPorHilera: 15,
  altura: 6, // m
  radioCopa: 2.5, // m
  cargaArbol: 42, // kg (10.100 kg/ha ÷ 240 árboles, ODEPA 2025)
  cabecera: 6, // m
  escalera: true, // árboles altos: parte de la cuadrilla cosecha con escalera
  pendiente: 0, // % a lo largo de las hileras (camellones a favor de la pendiente)
  acopioEnCima: false, // el acopio está al pie del cerro (false) o en la cima (true)
  forma: 'arbol', // cómo se dibuja la planta: árbol, arbusto (hilera continua), plano (cerezo peatonal) o parrón
})

/** Palta alta densidad (H3): marco 4 × 2 m, árboles bajos (≤ 2 m) cosechados desde el suelo; el Warthog entra justo. */
export const PALTA_ALTA_DENSIDAD = Object.freeze({
  calle: 4,
  sobreHilera: 2,
  hileras: 25,
  arbolesPorHilera: 45,
  altura: 2,
  radioCopa: 1,
  cargaArbol: 9, // kg (10.100 kg/ha ÷ 1.125 árboles)
  cabecera: 6,
  escalera: false,
  pendiente: 0,
  acopioEnCima: false,
})

// H5: otros cultivos (especificación «H5: uva de mesa, arándano y cerezo»). Mismo generador; cambian la planta,
// el marco y la carga. La unidad de cosecha (kg por caja) y el ritmo van en los parámetros del sistema (huertos/index.js).

/** Uva de mesa en parrón español: techo a 2 m sobre postes (la «copa» es el poste); se camina bajo el techo. */
export const UVA_PARRON = Object.freeze({
  ...PALTA_ALTA_DENSIDAD,
  calle: 3.5,
  sobreHilera: 3.5,
  hileras: 28,
  arbolesPorHilera: 27,
  altura: 2,
  radioCopa: 0.3,
  cargaArbol: 30, // 24,6 t/ha (3.000 cajas de 8,2 kg) ÷ 816 plantas
  forma: 'parron',
})

/** Arándano: arbustos en hilera continua, marco 3 × 1 m. */
export const ARANDANO = Object.freeze({
  ...PALTA_ALTA_DENSIDAD,
  calle: 3,
  sobreHilera: 1,
  hileras: 33,
  arbolesPorHilera: 95,
  altura: 1.8,
  radioCopa: 0.6,
  cargaArbol: 4.8, // 16 t/ha ÷ 3.333 plantas
  forma: 'arbusto',
})

/** Cerezo peatonal UFO: plano de fruta de 1 m de ancho, marco 3,2 × 1,8 m, sin escalera. */
export const CEREZO_UFO = Object.freeze({
  ...PALTA_ALTA_DENSIDAD,
  calle: 3.2,
  sobreHilera: 1.8,
  hileras: 31,
  arbolesPorHilera: 52,
  altura: 2.5,
  radioCopa: 0.5,
  cargaArbol: 7.3, // 12,7 t/ha ÷ 1.736 plantas
  forma: 'plano',
})

/** Palta en ladera (H4): como la alta densidad, en una pendiente de 20 % (rango usual 15–30 %). */
export const PALTA_LADERA = Object.freeze({ ...PALTA_ALTA_DENSIDAD, pendiente: 20 })

/** Comprueba los parámetros del generador; lanza un Error legible. */
export function validarRectangular(g) {
  const bad = (m) => {
    throw new Error(`Parámetro inválido: huertoParams.${m}`)
  }
  for (const k of ['calle', 'sobreHilera', 'altura', 'radioCopa', 'cabecera']) if (!(Number.isFinite(g[k]) && g[k] > 0)) bad(`${k} debe ser > 0`)
  if (!(Number.isFinite(g.cargaArbol) && g.cargaArbol >= 0)) bad('cargaArbol debe ser ≥ 0')
  if (typeof g.escalera !== 'boolean') bad('escalera debe ser true o false')
  if (g.forma !== undefined && !['arbol', 'arbusto', 'plano', 'parron'].includes(g.forma)) bad('forma debe ser arbol, arbusto, plano o parron')
  if (!(Number.isFinite(g.pendiente) && g.pendiente >= 0 && g.pendiente <= 60)) bad('pendiente debe estar entre 0 y 60 %')
  if (typeof g.acopioEnCima !== 'boolean') bad('acopioEnCima debe ser true o false')
  for (const k of ['hileras', 'arbolesPorHilera']) if (!(Number.isInteger(g[k]) && g[k] >= 2 && g[k] <= 200)) bad(`${k} debe ser un entero entre 2 y 200`)
  if (2 * g.radioCopa >= g.calle) bad('radioCopa: las copas de dos hileras se tocan (2·radio ≥ calle), no queda calle para caminar')
  if (2 * g.radioCopa > g.sobreHilera + 1e-9 && g.radioCopa > g.calle) bad('radioCopa demasiado grande')
}

/**
 * Genera el huerto. `nw` define cuántos tramos se asignan al inicio.
 * @returns {import('./index.js').Huerto}
 */
export function generarRectangular(g, { nw, sistema, robotAncho = ROBOT_ANCHO, reparto = null, avance = 0 }) {
  validarRectangular(g)
  const { calle, sobreHilera, hileras, arbolesPorHilera: nA, radioCopa: R, cabecera } = g
  const w = hileras * calle,
    h = 2 * cabecera + nA * sobreHilera
  const rowX = (r) => calle * (r + 0.5)
  const treeY = (t) => cabecera + sobreHilera * (t + 0.5)
  const arboles = []
  const zOf = (y) => (g.acopioEnCima ? (g.pendiente / 100) * (h - y) : (g.pendiente / 100) * y)
  for (let r = 0; r < hileras; r++)
    for (let t = 0; t < nA; t++) arboles.push({ x: rowX(r), y: treeY(t), z: zOf(treeY(t)), hilera: r, pos: t, altura: g.altura, radio: R, carga: g.cargaArbol })
  const tree = (r, t) => r * nA + t
  const ejes = Array.from({ length: hileras - 1 }, (_, s) => calle * (s + 1))
  // acopio sobre el carril del robot en la cabecera inferior (a un tercio de su ancho): llega y sale sin girar en U
  const acopio = [w / 2, cabecera / 3]
  // terreno: plano inclinado a lo largo de las hileras; el acopio (cabecera inferior) queda al pie o en la cima
  const sl = g.pendiente / 100
  const z = (x, y) => (g.acopioEnCima ? sl * (h - y) : sl * y)
  const anchoLibre = calle - 2 * R
  const robotCabe = anchoLibre >= robotAncho + HOLGURA_CALLE

  // lados de hilera que dan a cada calle, de la calle más cercana al acopio hacia afuera (a igual distancia, la izquierda)
  const calles = ejes.map((x, s) => ({ s, x })).sort((a, b) => Math.abs(a.x - acopio[0]) - Math.abs(b.x - acopio[0]) || a.x - b.x)
  const lado = (s, k) => (k === 0 ? [s, +1] : [s + 1, -1]) // hilera a la izquierda de la calle (lado +x) o a la derecha (−x)
  const tramoDe = (s, x, k, t0, t1) => {
    const [r, l] = lado(s, k)
    return { calle: s, eje: x, hilera: r, lado: l, arboles: Array.from({ length: t1 - t0 }, (_, i) => tree(r, t0 + i)) }
  }
  // H7 fase C: avance del bloque. Los lados de las calles más cercanas al acopio ya se cosecharon en días anteriores
  // (supuesto: el bloque se cosecha desde el acopio hacia afuera); la cuadrilla parte en los que siguen.
  const nLados = 2 * ejes.length
  const nHechos = Math.min(nLados - 1, Math.floor(avance * nLados + 1e-9))
  const hechos = [] // [árbol, lado] ya cosechados
  const libres = [] // { s, x, k } lados por cosechar, en el orden de cercanía al acopio
  let iLado = 0
  calles.forEach(({ s, x }) =>
    [0, 1].forEach((k) => {
      if (iLado++ < nHechos) {
        const [r, l] = lado(s, k)
        for (let t = 0; t < nA; t++) hechos.push([tree(r, t), l])
      } else libres.push({ s, x, k })
    }),
  )
  // H7 fase C: reparto inicial de la cuadrilla
  //   acopio (de siempre): parejas por calle desde las calles cercanas al acopio; cada uno un lado entero
  //   frente: tramos cortos de `tramo` árboles; uno por calle a la misma altura, sobre el doble de calles, y el frente
  //           avanza hacia el fondo (la reserva sigue por altura)
  //   repartida: parejas en calles espaciadas a todo el ancho; cada uno un lado entero
  const modo = reparto?.modo ?? 'acopio'
  let tramos = []
  if (modo === 'frente') {
    const T = Math.max(1, Math.min(nA, Math.round(reparto.tramo ?? 4)))
    const niveles = Math.ceil(nA / T)
    for (let n = 0; n < niveles; n++) {
      const t0 = n * T,
        t1 = Math.min(nA, t0 + T)
      // primero un lado de cada calle (alternando para que el frente no quede todo del mismo lado), después el otro
      const porCalle = new Map()
      libres.forEach((l) => porCalle.set(l.s, [...(porCalle.get(l.s) || []), l]))
      const orden = [...porCalle.values()]
      for (const pasada of [0, 1])
        orden.forEach((ls, i) => {
          const l = ls.length === 2 ? ls[(i + pasada) % 2] : pasada === 0 ? ls[0] : null
          if (l) tramos.push(tramoDe(l.s, l.x, l.k, t0, t1))
        })
    }
  } else {
    let orden = libres
    if (modo === 'repartida') {
      // calles elegidas espaciadas a todo el ancho (entre las que quedan por cosechar), luego el resto por cercanía
      const callesLibres = [...new Set(libres.map((l) => l.s))].sort((a, b) => a - b)
      const nUsar = Math.min(callesLibres.length, Math.max(1, Math.ceil(nw / 2)))
      const elegidas = new Set(Array.from({ length: nUsar }, (_, i) => callesLibres[Math.floor(((i + 0.5) * callesLibres.length) / nUsar)]))
      orden = [...libres.filter((l) => elegidas.has(l.s)), ...libres.filter((l) => !elegidas.has(l.s))]
    }
    // si hay más cosecheros que lados, cada lado se parte en m tramos contiguos (de abajo hacia arriba)
    const m = Math.max(1, Math.ceil(nw / Math.max(1, libres.length)))
    if (modo === 'acopio' && !nHechos) {
      // exactamente el orden de siempre (los hashes y resultados de H2–H6 no cambian)
      for (const { s, x } of calles)
        for (let k = 0; k < m; k++)
          for (const kk of [0, 1]) {
            const t0 = Math.floor((k * nA) / m),
              t1 = Math.floor(((k + 1) * nA) / m)
            if (t1 > t0) tramos.push(tramoDe(s, x, kk, t0, t1))
          }
    } else {
      const porCalle = []
      orden.forEach((l) => {
        const g = porCalle.find((q) => q[0].s === l.s)
        if (g) g.push(l)
        else porCalle.push([l])
      })
      for (const ls of porCalle)
        for (let k = 0; k < m; k++)
          for (const l of ls) {
            const t0 = Math.floor((k * nA) / m),
              t1 = Math.floor(((k + 1) * nA) / m)
            if (t1 > t0) tramos.push(tramoDe(l.s, l.x, l.k, t0, t1))
          }
    }
  }
  // puesto de cosecha: al borde de la copa, del lado de la calle
  const puesto = (ti, lado) => [arboles[ti].x + lado * 0.9 * R, arboles[ti].y]
  const asignados = tramos.slice(0, nw)
  const puestos = asignados.map((tr) => ({ tree: [arboles[tr.arboles[0]].x, arboles[tr.arboles[0]].y], start: puesto(tr.arboles[0], tr.lado) }))
  const yb = cabecera / 3,
    yt = h - cabecera / 3
  const callesG = { ejes, cabecera, yb, yt, robotCabe, anchoLibre, calle, w }
  const vueltaRobot = vueltaPorCalles(callesG, acopio, [...new Set(asignados.map((t) => t.eje))])
  return {
    sistema,
    version: GENERADOR_VERSION,
    params: { ...g },
    limites: { w, h },
    arboles,
    puestos,
    tramos: asignados,
    reserva: tramos.slice(nw), // tramos libres: los toma quien termina el suyo
    cosechados: hechos, // H7 fase C: [árbol, lado] cosechados antes de la corrida (avance del bloque)
    puesto,
    acopio,
    inicioRobot: [acopio[0], acopio[1], 0],
    vueltaRobot,
    calles: { ejes, cabecera, yb, yt, robotCabe, anchoLibre, calle },
    vuelta: (ocupadas) => vueltaPorCalles(callesG, acopio, ocupadas), // H7 fase C: la ruta que sigue a la cuadrilla
    terreno: { pendiente: g.pendiente, acopioEnCima: g.acopioEnCima },
    z,
  }
}

/**
 * Vuelta del robot por las calles `ocupadas` (ejes x): zigzag por ellas si el robot cabe en las calles; si no, por la
 * cabecera inferior pasando por la boca de cada una, ida y vuelta. Empieza y termina en el acopio.
 */
export function vueltaPorCalles(c, acopio, ocupadas) {
  const { yb, yt, robotCabe, w } = c
  const occ = [...new Set(ocupadas)].sort((a, b) => a - b)
  if (!occ.length) return [acopio, acopio]
  if (robotCabe) {
    // zigzag por las calles ocupadas: sube por una, baja por la siguiente
    const out = [[...acopio]]
    // dentro de la calle, un waypoint cada PASO m: el controlador (que apunta al waypoint) corrige el desvío lateral
    // tras el giro de entrada en pocos metros; con un solo waypoint al fondo de la calle rozaría las copas
    const PASO = 3
    occ.forEach((x, i) => {
      const [a, b] = i % 2 === 0 ? [yb, yt] : [yt, yb]
      const n = Math.max(1, Math.round(Math.abs(b - a) / PASO))
      for (let k = 0; k <= n; k++) out.push([x, a + ((b - a) * k) / n])
    })
    if (occ.length % 2 === 1) out.push([occ.at(-1), yb])
    out.push([...acopio])
    return out
  }
  // por la cabecera inferior, pasando por la boca de cada calle ocupada, ida y vuelta
  const xL = Math.max(0.5, occ[0] - 1.5),
    xR = Math.min(w - 0.5, occ.at(-1) + 1.5)
  return [[...acopio], [xR, yb], [xL, yb], [...acopio]]
}

/** ¿Está el punto en una cabecera (zona abierta, abajo o arriba)? */
const enCabecera = (c, h, y) => y <= c.cabecera + 1e-9 || y >= h - c.cabecera - 1e-9

/** Eje de calle más cercano a x. */
export function ejeCercano(c, x) {
  let best = c.ejes[0]
  for (const e of c.ejes) if (Math.abs(e - x) < Math.abs(best - x)) best = e
  return best
}

/**
 * Camino por calles y cabeceras de `a` a `b` (lista de waypoints que termina en b). Nadie atraviesa copas: se sale
 * al eje de la calle, se recorre la calle y se cambia de calle por la cabecera más conveniente.
 */
export function rutaCalles(huerto, a, b) {
  const c = huerto.calles,
    H = huerto.limites.h
  const out = []
  const push = (x, y) => {
    const q = out.at(-1) || a
    if (Math.hypot(q[0] - x, q[1] - y) > 1e-6) out.push([x, y])
  }
  const aCab = enCabecera(c, H, a[1]),
    bCab = enCabecera(c, H, b[1])
  if (aCab && bCab) {
    // misma cabecera: en línea recta; cabeceras distintas: por la calle más cercana
    if (a[1] < H / 2 !== b[1] < H / 2) {
      const e = ejeCercano(c, a[0])
      push(e, a[1])
      push(e, b[1])
    }
  } else if (aCab) {
    const e = ejeCercano(c, b[0])
    push(e, a[1])
    push(e, b[1])
  } else if (bCab) {
    const e = ejeCercano(c, a[0])
    push(e, a[1])
    push(e, b[1])
  } else {
    const ea = ejeCercano(c, a[0]),
      eb = ejeCercano(c, b[0])
    push(ea, a[1])
    if (Math.abs(ea - eb) > 1e-9) {
      const yH = Math.abs(a[1] - c.yb) + Math.abs(b[1] - c.yb) <= Math.abs(a[1] - c.yt) + Math.abs(b[1] - c.yt) ? c.yb : c.yt
      push(ea, yH)
      push(eb, yH)
    }
    push(eb, b[1])
  }
  push(b[0], b[1])
  if (!out.length) out.push([b[0], b[1]])
  return out
}

/**
 * Estado de la cosecha durante una simulación: fruta que queda en cada lado de cada árbol y tramos libres.
 * Lo usan HRSim y HOSim (mismas reglas en ambos).
 */
export class Cosecha {
  /** @param {object|null} carga carga variable y ritmo que cae (H7, fase B), de prepararCarga; null = como siempre */
  constructor(huerto, W, carga = null) {
    this.h = huerto
    this.carga = carga
    // fruta por lado: índice 2·árbol + (lado > 0 ? 1 : 0); mitad de la carga en cada lado
    this.fruta = new Float64Array(huerto.arboles.length * 2)
    huerto.arboles.forEach((a, i) => {
      this.fruta[2 * i] = this.fruta[2 * i + 1] = (a.carga * (carga ? carga.factores[i] : 1)) / 2
    })
    // H7 fase C: lados cosechados antes de la corrida (avance del bloque)
    for (const [i, l] of huerto.cosechados || []) this.fruta[2 * i + (l > 0 ? 1 : 0)] = 0
    this.ini = carga ? Float64Array.from(this.fruta) : null
    this.dejado = 0 // fruta que quedó en los lados que los cosecheros dejaron (fase B)
    // estado de cada planta para la escena (H7, fase C): cuándo se tocó por primera vez y cuándo se terminó cada lado
    // (−1 = antes de la corrida; Infinity = nunca)
    this.t = 0
    this.toque = new Float64Array(huerto.arboles.length).fill(Infinity)
    this.ladoFin = new Float64Array(huerto.arboles.length * 2).fill(Infinity)
    for (const [i, l] of huerto.cosechados || []) {
      this.toque[i] = -1
      this.ladoFin[2 * i + (l > 0 ? 1 : 0)] = -1
    }
    this.inicial = this.fruta.reduce((s, v) => s + v, 0)
    this.reserva = huerto.reserva.map((t) => ({ ...t }))
    W.forEach((w, k) => {
      w.tramo = huerto.tramos[k]
      w.ti = 0
    })
  }

  _idx(w) {
    return 2 * w.tramo.arboles[w.ti] + (w.tramo.lado > 0 ? 1 : 0)
  }

  /** Toma hasta `kg` del lado que cosecha el trabajador; devuelve lo tomado. */
  take(w, kg) {
    if (!w.tramo) return 0
    const i = this._idx(w),
      got = Math.min(kg, this.fruta[i])
    this.fruta[i] -= got
    if (got > 0 && this.toque[i >> 1] === Infinity) this.toque[i >> 1] = this.t
    w.cosechado = (w.cosechado || 0) + got
    return got
  }

  _terminar(i) {
    if (this.ladoFin[i] === Infinity) this.ladoFin[i] = this.t
  }

  /** Por planta: [primer toque, fin] en s (fin = cuando sus dos lados quedaron terminados; Infinity = nunca). */
  estadoPlantas() {
    const n = this.toque.length,
      ini = new Float32Array(n),
      fin = new Float32Array(n)
    // los lados exteriores de las hileras de los bordes no dan a ninguna calle: nadie los cosecha y no cuentan
    const ultima = (this.h.params?.hileras ?? 0) - 1
    for (let i = 0; i < n; i++) {
      const hil = this.h.arboles[i].hilera
      const a = hil === 0 ? -Infinity : this.ladoFin[2 * i],
        b = hil === ultima ? -Infinity : this.ladoFin[2 * i + 1]
      fin[i] = Math.max(a, b)
      ini[i] = Math.min(this.toque[i], a === -Infinity ? Infinity : a, b === -Infinity ? Infinity : b)
    }
    return { ini, fin }
  }

  /** Multiplicador del periodo de cosecha según la fruta que queda en el lado (fase B; 1 sin carga variable). */
  periodo(w) {
    const c = this.carga
    if (!c || !(c.k > 0) || !w.tramo) return 1
    const i = this._idx(w),
      f = this.ini[i] > 0 ? this.fruta[i] / this.ini[i] : 0
    return c.escala * (Math.log1p(c.k) / Math.log1p(c.k * Math.max(f, 1e-9)))
  }

  /** ¿Deja el lado? Sin fruta o, con el ritmo que cae, cuando cosechar lo que queda ya no conviene. */
  agotado(w) {
    if (this.empty(w)) return true
    const c = this.carga
    if (!c || !(c.fmin > 0)) return false
    const i = this._idx(w)
    return this.fruta[i] < c.fmin * this.ini[i] - 1e-12
  }

  /** ¿Se agotó el lado del árbol que cosecha? */
  empty(w) {
    return !w.tramo || this.fruta[this._idx(w)] <= 1e-9
  }

  /** Avanza al siguiente árbol del tramo o toma el tramo libre más cercano; devuelve el puesto o null si no queda fruta. */
  next(w) {
    if (this.carga && w.tramo) this.dejado += this.fruta[this._idx(w)] // lo que queda en el lado que deja
    if (w.tramo) this._terminar(this._idx(w))
    while (w.tramo) {
      if (w.ti < w.tramo.arboles.length - 1) w.ti++
      else {
        w.ultimaCaja = this.drop(w) // si ya no quedan tramos, sus cajas siguen yendo al último lugar que usó
        let best = -1,
          bd = Infinity
        this.reserva.forEach((t, k) => {
          const a = this.h.arboles[t.arboles[0]]
          const d = Math.hypot(a.x - w.pose[0], a.y - w.pose[1])
          if (d < bd) {
            bd = d
            best = k
          }
        })
        w.tramo = best >= 0 ? this.reserva.splice(best, 1)[0] : null
        w.ti = 0
        if (!w.tramo) return null
      }
      if (!this.agotado(w)) break
      this._terminar(this._idx(w)) // lado sin fruta (o que no conviene): se salta
    }
    if (!w.tramo) return null
    const ti = w.tramo.arboles[w.ti]
    w.tree = [this.h.arboles[ti].x, this.h.arboles[ti].y]
    return this.h.puesto(ti, w.tramo.lado)
  }

  /** Dónde deja el trabajador la caja: en el eje de su calle frente al árbol si el robot cabe; si no, en la boca de la calle. */
  drop(w) {
    const c = this.h.calles
    if (!w.tramo) return w.ultimaCaja ? [...w.ultimaCaja] : [this.h.acopio[0], this.h.acopio[1]]
    if (c.robotCabe) return [w.tramo.eje, this.h.arboles[w.tramo.arboles[w.ti]].y]
    return [w.tramo.eje, c.cabecera]
  }

  restante() {
    return this.fruta.reduce((s, v) => s + v, 0)
  }
}
