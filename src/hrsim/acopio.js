// Acopio con acopiador, bins y camión (H7, fase A). Opcional: sin `p.acopio` el acopio es el de siempre
// (lo que llega se da por entregado, sin cola ni tope) y la réplica de MATLAB no cambia.
//
// Un acopiador atiende por orden de llegada: recibe las cajas (del robot o de un cosechero) y las vacía en bins;
// cuando hay un camión en el acopio, le carga los bins llenos. El camión sale con su capacidad completa o, si ya
// tiene algo, al cumplirse el intervalo; vuelve vacío tras el tiempo de viaje. Si el acopio llega al tope de bins
// llenos, no recibe más hasta que el camión se los lleve. Especificación: «H7: diseño», fase A.

/** Valores de partida (los supuestos están marcados en el documento de diseño). */
export const ACOPIO_DEFAULTS = Object.freeze({
  enabled: true,
  binKg: 380, // González-Araya et al. 2017: bins de manzana de 379–386 kg en Chile
  topeBins: 8, // supuesto
  camionBins: 4, // supuesto: tractor con carro
  viajeS: 2400, // supuesto: ida y vuelta, 40 min
  intervaloS: 3600, // supuesto: sale cada 60 min aunque no esté lleno
  cargaBinS: 90, // supuesto: cargar un bin al camión
})

// estados del acopiador (registro por tick)
export const ACOPIADOR = { LIBRE: 0, RECIBE: 1, CARGA: 2 }

export class Acopio {
  /** @param {object} cfg p.acopio · @param {number} dt · @param {{recibir:number, cargar:number}} costo kcal/s */
  constructor(cfg, dt, costo) {
    this.c = { ...ACOPIO_DEFAULTS, ...cfg }
    this.dt = dt
    this.costo = costo
    this.cola = [] // tareas de recepción: { kg, dur, onStart?, onDone }
    this.tarea = null // { tipo: 'recibir'|'cargar', resta, t? }
    this.binActual = 0 // kg en el bin que se está llenando
    this.binsLlenos = 0
    this.camion = { enAcopio: true, carga: 0, llegada: 0, vuelve: 0 }
    this.recibido = 0 // kg recibidos por el acopiador (= llegados al acopio)
    this.despachado = 0 // kg que salieron en camión
    this.viajes = 0
    this.work = 0 // kcal del acopiador
    this.ocupado = 0 // ticks ocupado
    this.estado = ACOPIADOR.LIBRE
  }

  /** Pide una recepción: `kg` de fruta que tarda `dur` s. onStart al empezar, onDone al terminar. */
  pedir(t) {
    this.cola.push(t)
  }

  get lleno() {
    return this.binsLlenos >= this.c.topeBins
  }

  /** Un tick (después de mover a los cosecheros y al robot). `t` = tiempo actual [s]. */
  step(t) {
    const c = this.c,
      cam = this.camion
    // el camión vuelve vacío
    if (!cam.enAcopio && t >= cam.vuelve - 1e-9) {
      cam.enAcopio = true
      cam.carga = 0
      cam.llegada = t
    }
    // avanza la tarea en curso
    if (this.tarea) {
      this.tarea.resta -= this.dt
      if (this.tarea.resta <= 1e-9) {
        const k = this.tarea
        this.tarea = null
        if (k.tipo === 'recibir') {
          this.recibido += k.t.kg
          this.binActual += k.t.kg
          while (this.binActual >= c.binKg - 1e-9) {
            this.binActual -= c.binKg
            this.binsLlenos += 1
          }
          k.t.onDone?.()
        } else {
          this.binsLlenos -= 1
          cam.carga += 1
        }
      }
    }
    // sale el camión: lleno, o con algo cargado cuando se cumple el intervalo y no quedan bins llenos por cargar
    const vence = t - cam.llegada >= c.intervaloS - 1e-9
    if (cam.enAcopio && !(this.tarea?.tipo === 'cargar') && cam.carga > 0 && (cam.carga >= c.camionBins || (vence && this.binsLlenos === 0))) {
      this.despachado += cam.carga * c.binKg
      this.viajes += 1
      cam.enAcopio = false
      cam.vuelve = t + c.viajeS
      cam.carga = 0
    }
    // el acopiador libre elige: cargar el camión si el acopio está lleno o si toca que salga; si no, recibir
    if (!this.tarea) {
      const puedeCargar = cam.enAcopio && this.binsLlenos > 0 && cam.carga < c.camionBins
      const urgeCargar = this.lleno || this.binsLlenos + cam.carga >= c.camionBins || vence
      if (puedeCargar && (urgeCargar || !this.cola.length)) this.tarea = { tipo: 'cargar', resta: c.cargaBinS }
      else if (this.cola.length && !this.lleno) {
        const tr = this.cola.shift()
        tr.onStart?.()
        this.tarea = { tipo: 'recibir', resta: tr.dur, t: tr }
      }
    }
    this.estado = !this.tarea ? ACOPIADOR.LIBRE : this.tarea.tipo === 'recibir' ? ACOPIADOR.RECIBE : ACOPIADOR.CARGA
    if (this.tarea) {
      this.ocupado += 1
      this.work += (this.tarea.tipo === 'recibir' ? this.costo.recibir : this.costo.cargar) * this.dt
    }
  }

  /** Fruta que está en el acopio (bins llenos, bin a medio llenar y bins en el camión que no salió). */
  get enAcopio() {
    return this.recibido - this.despachado
  }
}

/** Registro por tick del acopio (H7). */
export function recordAcopio(r, a) {
  r.desp.push(a.despachado)
  r.acop.push(a.estado)
  r.bins.push(a.binsLlenos)
  r.cam.push(a.camion.enAcopio ? a.camion.carga : -1) // −1 = el camión está de viaje
  r.cola.push(a.cola.length)
}

/** Resumen del acopio (H7): lo despachado, lo que queda, el trabajo del acopiador y las esperas. */
export function resumenAcopio(a, esperaRobot_s, nTicks) {
  return {
    dispatched: a.despachado,
    acopio: {
      recibido: a.recibido,
      despachado: a.despachado,
      enAcopio: a.enAcopio,
      viajes: a.viajes,
      binsLlenos: a.binsLlenos,
      ocupadoPct: (100 * a.ocupado) / Math.max(1, nTicks),
      kcal: a.work,
      esperaRobot_s,
    },
  }
}
