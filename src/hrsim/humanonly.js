// Escenario Solo humano: port a JavaScript de HumanOnly_Sim.m (MATLAB).
// Cada trabajador cosecha, lleva su caja llena a la zona de carga, la descarga y vuelve.
// Estados: 1 cosecha, 2 baja escalera, 3 camina cargando a la zona de carga, 4 descarga,
//          5 vuelve al árbol, 7 sube escalera. Banderas: 1 cosecha, 2 camina, 3 descarga, 4 baja, 5 sube.
import { resolveParams, initWorkers, movePose } from './common.js'
import { buildHuerto } from './huertos/index.js'
import { Cosecha, rutaCalles } from './huertos/rectangular.js'
import { paso } from './huertos/pendiente.js'
import { Acopio, recordAcopio, resumenAcopio } from './acopio.js'
import { prepararCarga, resumenCarga } from './carga.js'

export class HOSim {
  constructor(opts = {}) {
    const p = (this.p = resolveParams(opts, { cargoUnloadTime: 1.44, tolerance: 0.35 }))
    const NH = (this.NH = p.nw),
      dt = (this.dt = p.dt)
    this.N = Math.round(p.duration / dt) + 1
    this.idx = 0
    const huerto = (this.huerto = buildHuerto(p))
    const { W, C, type, ladder } = initWorkers(p, huerto)
    this.W = W
    this.C = C
    this.type = type
    this.ladder = ladder
    this.cargo = [...huerto.acopio]
    // huertos generados: fruta que se agota, tramos y desplazamientos por calles (matlab-2026: null, como MATLAB)
    // carga variable por árbol y ritmo que cae (H7, fase B; opcional)
    this.cosecha = huerto.calles ? new Cosecha(huerto, W, p.carga ? prepararCarga(p.carga, huerto.arboles.length, p.semilla) : null) : null
    this.delivered = 0
    // acopio con acopiador, bins y camión (H7, fase A; opcional): el mismo que con robot
    this.acopio = p.acopio ? new Acopio(p.acopio, dt, { recibir: C.walkingCarrying, cargar: C.harvestGround }) : null
    this.rec = {
      t: [],
      delivered: [],
      work: [],
      ...(this.acopio ? { desp: [], acop: [], bins: [], cam: [], cola: [] } : {}),
      ...(this.cosecha?.carga ? { dej: [] } : {}),
      prod: Array.from({ length: NH }, () => []),
      workH: Array.from({ length: NH }, () => []),
      flag: Array.from({ length: NH }, () => []),
      wx: Array.from({ length: NH }, () => []),
      wy: Array.from({ length: NH }, () => []),
      wth: Array.from({ length: NH }, () => []),
      wst: Array.from({ length: NH }, () => []),
    }
    for (const w of W) {
      w.carried = 0
      w.deliveredLoad = 0
      w.trips = 0
      w.timer = 0
    }
    this._record()
  }

  _record() {
    const r = this.rec
    r.t.push(this.idx * this.dt)
    r.delivered.push(this.delivered)
    r.work.push(this.W.reduce((a, w) => a + w.work, 0) + (this.acopio ? this.acopio.work : 0))
    if (this.acopio) recordAcopio(r, this.acopio)
    if (r.dej) r.dej.push(this.cosecha.dejado)
    this.W.forEach((w, h) => {
      r.prod[h].push(w.prod)
      r.workH[h].push(w.work)
      r.flag[h].push(w.flag)
      r.wx[h].push(w.pose[0])
      r.wy[h].push(w.pose[1])
      r.wth[h].push(w.pose[2])
      r.wst[h].push(w.state)
    })
  }

  _stepWorker(w) {
    const p = this.p,
      dt = this.dt,
      C = this.C
    // en ladera la velocidad y el gasto dependen de la pendiente del tramo (en plano: v = walkSpeed, k = 1)
    const slope = (cargando) => paso(this.huerto, w.pose, w.route[w.routeIdx], p.walkSpeed, cargando)
    let sv = p.walkSpeed
    const walkTo = (target) => {
      const { pose, reached } = movePose(w.pose, target, sv, dt)
      w.pose = pose
      return reached || Math.hypot(pose[0] - target[0], pose[1] - target[1]) <= p.tolerance
    }
    switch (w.state) {
      case 1: {
        w.cont += 1
        const tInc = this.cosecha?.carga ? w.tInc * this.cosecha.periodo(w) : w.tInc // fase B: el periodo crece al vaciarse el lado
        if (w.cont >= tInc) {
          const inc = Math.min(p.costProduction * dt, p.maxProd - w.prod)
          w.prod = this.cosecha ? w.prod + this.cosecha.take(w, inc) : Math.min(w.prod + p.costProduction * dt, p.maxProd)
          w.last = w.prod
          w.cont = p.semilla == null && !p.carga ? 0 : w.cont - tInc // periodo no entero (semilla o fase B): se guarda el resto
        } else w.prod = w.last
        w.work += w.cost * dt
        w.flag = 1
        if (w.prod >= p.maxProd) {
          if (w.ladder === 1) w.state = 2
          else this._startTrip(w)
        } else if (this.cosecha && this.cosecha.agotado(w)) {
          // el lado del árbol se agotó: baja de la escalera si hace falta y camina al siguiente árbol
          if (w.ladder === 1) {
            w.goNext = true
            w.state = 2
          } else this._goNextTree(w)
        }
        break
      }
      case 2:
        w.work += C.ladderDown * dt
        w.flag = 4
        w.timer += dt
        if (w.timer >= p.ladderTime) {
          w.timer = 0
          if (w.goNext) this._goNextTree(w)
          else this._startTrip(w)
        }
        break
      case 3:
        w.prod = 0
        {
          const { v, k } = slope(true)
          sv = v
          w.work += C.walkingCarrying * dt * k
        }
        w.flag = 2
        w.box = [w.pose[0], w.pose[1]]
        if (walkTo(w.route[w.routeIdx])) {
          if (w.routeIdx < w.route.length - 1) w.routeIdx += 1
          else if (this.acopio) {
            // H7: hace cola hasta que el acopiador lo atiende (16) y espera a que reciba su caja (4)
            w.state = 16
            w.recibido = false
            this.acopio.pedir({ kg: w.carried, dur: p.cargoUnloadTime, onStart: () => (w.state = 4), onDone: () => (w.recibido = true) })
          } else {
            w.state = 4
            w.timer = 0
          }
        }
        break
      case 16:
        // en la cola del acopio, de pie con la caja
        w.prod = 0
        w.work += C.harvestGround * dt
        w.flag = 3
        break
      case 4:
        w.prod = 0
        w.work += C.walkingCarrying * dt
        w.flag = 3
        w.timer += dt
        if (this.acopio ? w.recibido : w.timer >= p.cargoUnloadTime) {
          w.recibido = false
          w.deliveredLoad += w.carried
          this.delivered += w.carried
          w.trips += 1
          w.carried = 0
          w.box = null
          w.timer = 0
          w.state = 5
          w.route = this._path(w.pose, w.start)
          w.routeIdx = 0
        }
        break
      case 5:
        w.prod = 0
        {
          const { v, k } = slope(false)
          sv = v
          w.work += C.walking * dt * k
        }
        w.flag = 2
        if (walkTo(w.route[w.routeIdx])) {
          if (w.routeIdx < w.route.length - 1) w.routeIdx += 1
          else {
            w.pose[2] = Math.atan2(w.tree[1] - w.pose[1], w.tree[0] - w.pose[0])
            if (w.ladder === 1) {
              w.state = 7
              w.timer = 0
            } else w.state = 1
          }
        }
        break
      case 13:
        // camina por la calle al siguiente árbol de su tramo
        {
          const { v, k } = slope(false)
          sv = v
          w.work += C.walking * dt * k
        }
        w.flag = 2
        if (walkTo(w.route[w.routeIdx])) {
          if (w.routeIdx < w.route.length - 1) w.routeIdx += 1
          else {
            w.pose = [w.start[0], w.start[1], Math.atan2(w.tree[1] - w.start[1], w.tree[0] - w.start[0])]
            if (w.ladder === 1) {
              w.state = 7
              w.timer = 0
            } else w.state = 1
          }
        }
        break
      case 15:
        w.flag = 0 // sin fruta que cosechar
        break
      case 7:
        w.work += C.ladderClimb * dt
        w.flag = 5
        w.timer += dt
        if (w.timer >= p.ladderTime) {
          w.timer = 0
          w.state = 1
        }
        break
    }
  }

  _startTrip(w) {
    w.carried = w.prod
    w.prod = 0
    w.last = 0
    w.box = [w.pose[0], w.pose[1]]
    w.state = 3
    w.route = this._path(w.pose, this.cargo)
    w.routeIdx = 0
  }

  /** Camino de a hasta b: por calles en huertos generados; en línea recta en matlab-2026 (como MATLAB). */
  _path(a, b) {
    return this.cosecha ? rutaCalles(this.huerto, a, b) : [b]
  }

  _goNextTree(w) {
    w.goNext = false
    const spot = this.cosecha.next(w)
    if (!spot) {
      w.state = 15
      return
    }
    w.state = 13
    w.route = this._path(w.pose, spot)
    w.routeIdx = 0
    w.start = [spot[0], spot[1]]
  }

  step() {
    if (this.idx >= this.N - 1) return false
    this.idx += 1
    for (const w of this.W) {
      w.flag = 0
      this._stepWorker(w)
    }
    if (this.acopio) this.acopio.step(this.idx * this.dt)
    this._record()
    return true
  }

  run(until = this.p.duration) {
    while (this.idx * this.dt < until && this.step());
    return this
  }

  summary() {
    const NH = this.NH,
      rec = this.rec
    const finalProd = rec.prod.map((s) => s.at(-1))
    const totalHuman = this.W.map((w, h) => w.deliveredLoad + w.carried + finalProd[h] - rec.prod[h][0])
    const V5 = this.W.reduce((a, w, h) => a + finalProd[h] + w.carried, 0)
    const meanWork = rec.workH.map((s) => s.reduce((a, b) => a + b, 0) / s.length)
    return {
      Humans: NH,
      TimeWeightedAverageMetabolicRate_kcal: meanWork.reduce((a, b) => a + b, 0) / NH,
      AverageHumanProduction_crop_units: totalHuman.reduce((a, b) => a + b, 0) / NH,
      TotalHumanWorkload_kcal: rec.work.reduce((m, v) => (v > m ? v : m), -Infinity),
      TotalProductionCargoZone_crop_units: this.delivered,
      RemainingCropsHumanBags_crop_units: V5,
      RemainingCropsBoxes_crop_units: 0,
      RemainingCropsRobot_crop_units: 0,
      TotalRecollectedCrops_crop_units: this.delivered + V5,
      ...(this.cosecha?.carga ? resumenCarga(this.cosecha, this.W, this.rec.wst, this.dt) : {}),
      ...(this.acopio ? resumenAcopio(this.acopio, 0, this.rec.t.length) : {}),
    }
  }
}
