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
})

/** Comprueba los parámetros del generador; lanza un Error legible. */
export function validarRectangular(g) {
  const bad = (m) => {
    throw new Error(`Parámetro inválido: huertoParams.${m}`)
  }
  for (const k of ['calle', 'sobreHilera', 'altura', 'radioCopa', 'cabecera']) if (!(Number.isFinite(g[k]) && g[k] > 0)) bad(`${k} debe ser > 0`)
  if (!(Number.isFinite(g.cargaArbol) && g.cargaArbol >= 0)) bad('cargaArbol debe ser ≥ 0')
  if (typeof g.escalera !== 'boolean') bad('escalera debe ser true o false')
  for (const k of ['hileras', 'arbolesPorHilera']) if (!(Number.isInteger(g[k]) && g[k] >= 2 && g[k] <= 200)) bad(`${k} debe ser un entero entre 2 y 200`)
  if (2 * g.radioCopa >= g.calle) bad('radioCopa: las copas de dos hileras se tocan (2·radio ≥ calle), no queda calle para caminar')
  if (2 * g.radioCopa > g.sobreHilera + 1e-9 && g.radioCopa > g.calle) bad('radioCopa demasiado grande')
}

/**
 * Genera el huerto. `nw` define cuántos tramos se asignan al inicio.
 * @returns {import('./index.js').Huerto}
 */
export function generarRectangular(g, { nw, sistema }) {
  validarRectangular(g)
  const { calle, sobreHilera, hileras, arbolesPorHilera: nA, radioCopa: R, cabecera } = g
  const w = hileras * calle,
    h = 2 * cabecera + nA * sobreHilera
  const rowX = (r) => calle * (r + 0.5)
  const treeY = (t) => cabecera + sobreHilera * (t + 0.5)
  const arboles = []
  for (let r = 0; r < hileras; r++)
    for (let t = 0; t < nA; t++) arboles.push({ x: rowX(r), y: treeY(t), z: 0, hilera: r, pos: t, altura: g.altura, radio: R, carga: g.cargaArbol })
  const tree = (r, t) => r * nA + t
  const ejes = Array.from({ length: hileras - 1 }, (_, s) => calle * (s + 1))
  const acopio = [w / 2, cabecera / 2]
  const anchoLibre = calle - 2 * R
  const robotCabe = anchoLibre >= ROBOT_ANCHO + HOLGURA_CALLE

  // lados de hilera que dan a cada calle, de la calle más cercana al acopio hacia afuera (a igual distancia, la izquierda)
  const calles = ejes.map((x, s) => ({ s, x })).sort((a, b) => Math.abs(a.x - acopio[0]) - Math.abs(b.x - acopio[0]) || a.x - b.x)
  // si hay más cosecheros que lados, cada lado se parte en m tramos contiguos (de abajo hacia arriba)
  const nLados = 2 * ejes.length
  const m = Math.max(1, Math.ceil(nw / nLados))
  const tramos = []
  for (const { s, x } of calles)
    for (let k = 0; k < m; k++)
      for (const [r, lado] of [
        [s, +1], // hilera a la izquierda de la calle: su lado +x da a la calle
        [s + 1, -1], // hilera a la derecha: su lado −x
      ]) {
        const t0 = Math.floor((k * nA) / m),
          t1 = Math.floor(((k + 1) * nA) / m)
        if (t1 <= t0) continue
        tramos.push({ calle: s, eje: x, hilera: r, lado, arboles: Array.from({ length: t1 - t0 }, (_, i) => tree(r, t0 + i)) })
      }
  // puesto de cosecha: al borde de la copa, del lado de la calle
  const puesto = (ti, lado) => [arboles[ti].x + lado * 0.9 * R, arboles[ti].y]
  const asignados = tramos.slice(0, nw)
  const puestos = asignados.map((tr) => ({ tree: [arboles[tr.arboles[0]].x, arboles[tr.arboles[0]].y], start: puesto(tr.arboles[0], tr.lado) }))
  // vuelta base del robot
  // carril de la cabecera a un tercio de su ancho: el robot (4WS) gira en U sin acercarse a las copas
  const yb = cabecera / 3,
    yt = h - cabecera / 3
  const ocupadas = [...new Set(asignados.map((t) => t.eje))].sort((a, b) => a - b)
  let vueltaRobot
  if (!ocupadas.length) vueltaRobot = [acopio, acopio]
  else if (robotCabe) {
    // zigzag por las calles ocupadas: sube por una, baja por la siguiente
    vueltaRobot = [[...acopio]]
    // dentro de la calle, un waypoint cada PASO m: el controlador (que apunta al waypoint) corrige el desvío lateral
    // tras el giro de entrada en pocos metros; con un solo waypoint al fondo de la calle rozaría las copas
    const PASO = 3
    ocupadas.forEach((x, i) => {
      const [a, b] = i % 2 === 0 ? [yb, yt] : [yt, yb]
      const n = Math.max(1, Math.round(Math.abs(b - a) / PASO))
      for (let k = 0; k <= n; k++) vueltaRobot.push([x, a + ((b - a) * k) / n])
    })
    if (ocupadas.length % 2 === 1) vueltaRobot.push([ocupadas.at(-1), yb])
    vueltaRobot.push([...acopio])
  } else {
    // por la cabecera inferior, pasando por la boca de cada calle ocupada, ida y vuelta
    const xL = Math.max(0.5, ocupadas[0] - 1.5),
      xR = Math.min(w - 0.5, ocupadas.at(-1) + 1.5)
    vueltaRobot = [[...acopio], [xR, yb], [xL, yb], [...acopio]]
  }
  return {
    sistema,
    version: GENERADOR_VERSION,
    params: { ...g },
    limites: { w, h },
    arboles,
    puestos,
    tramos: asignados,
    reserva: tramos.slice(nw), // tramos libres: los toma quien termina el suyo
    puesto,
    acopio,
    inicioRobot: [acopio[0], acopio[1], 0],
    vueltaRobot,
    calles: { ejes, cabecera, yb, yt, robotCabe, anchoLibre, calle },
    terreno: { pendiente: 0 },
  }
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
  constructor(huerto, W, fraccion = 1) {
    this.h = huerto
    // fruta por lado: índice 2·árbol + (lado > 0 ? 1 : 0); mitad de la carga en cada lado
    this.fruta = new Float64Array(huerto.arboles.length * 2)
    huerto.arboles.forEach((a, i) => {
      this.fruta[2 * i] = this.fruta[2 * i + 1] = (a.carga * fraccion) / 2
    })
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
    return got
  }

  /** ¿Se agotó el lado del árbol que cosecha? */
  empty(w) {
    return !w.tramo || this.fruta[this._idx(w)] <= 1e-9
  }

  /** Avanza al siguiente árbol del tramo o toma el tramo libre más cercano; devuelve el puesto o null si no queda fruta. */
  next(w) {
    while (w.tramo) {
      if (w.ti < w.tramo.arboles.length - 1) w.ti++
      else {
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
      if (!this.empty(w)) break
    }
    if (!w.tramo) return null
    const ti = w.tramo.arboles[w.ti]
    w.tree = [this.h.arboles[ti].x, this.h.arboles[ti].y]
    return this.h.puesto(ti, w.tramo.lado)
  }

  /** Dónde deja el trabajador la caja: en el eje de su calle frente al árbol si el robot cabe; si no, en la boca de la calle. */
  drop(w) {
    const c = this.h.calles
    if (c.robotCabe) return [w.tramo.eje, this.h.arboles[w.tramo.arboles[w.ti]].y]
    return [w.tramo.eje, c.cabecera]
  }

  restante() {
    return this.fruta.reduce((s, v) => s + v, 0)
  }
}
