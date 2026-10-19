// Escenario Solo humano: port a JavaScript de HumanOnly_Sim.m (MATLAB).
// Cada trabajador cosecha, lleva su caja llena a la zona de carga, la descarga y vuelve.
// Estados: 1 cosecha, 2 baja escalera, 3 camina cargando a la zona de carga, 4 descarga,
//          5 vuelve al árbol, 7 sube escalera. Banderas: 1 cosecha, 2 camina, 3 descarga, 4 baja, 5 sube.
import { resolveParams, initWorkers, movePose } from './common.js'
import { buildHuerto } from './huertos/index.js'

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
    this.delivered = 0
    this.rec = {
      t: [],
      delivered: [],
      work: [],
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
    r.work.push(this.W.reduce((a, w) => a + w.work, 0))
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
    const walkTo = (target) => {
      const { pose, reached } = movePose(w.pose, target, p.walkSpeed, dt)
      w.pose = pose
      return reached || Math.hypot(pose[0] - target[0], pose[1] - target[1]) <= p.tolerance
    }
    switch (w.state) {
      case 1:
        w.cont += 1
        if (w.cont >= w.tInc) {
          w.prod = Math.min(w.prod + p.costProduction * dt, p.maxProd)
          w.last = w.prod
          w.cont = 0
        } else w.prod = w.last
        w.work += w.cost * dt
        w.flag = 1
        if (w.prod >= p.maxProd) {
          if (w.ladder === 1) w.state = 2
          else this._startTrip(w)
        }
        break
      case 2:
        w.work += C.ladderDown * dt
        w.flag = 4
        w.timer += dt
        if (w.timer >= p.ladderTime) {
          w.timer = 0
          this._startTrip(w)
        }
        break
      case 3:
        w.prod = 0
        w.work += C.walkingCarrying * dt
        w.flag = 2
        w.box = [w.pose[0], w.pose[1]]
        if (walkTo(w.route[w.routeIdx])) {
          if (w.routeIdx < w.route.length - 1) w.routeIdx += 1
          else {
            w.state = 4
            w.timer = 0
          }
        }
        break
      case 4:
        w.prod = 0
        w.work += C.walkingCarrying * dt
        w.flag = 3
        w.timer += dt
        if (w.timer >= p.cargoUnloadTime) {
          w.deliveredLoad += w.carried
          this.delivered += w.carried
          w.trips += 1
          w.carried = 0
          w.box = null
          w.timer = 0
          w.state = 5
          w.route = [w.start]
          w.routeIdx = 0
        }
        break
      case 5:
        w.prod = 0
        w.work += C.walking * dt
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
    w.route = [this.cargo]
    w.routeIdx = 0
  }

  step() {
    if (this.idx >= this.N - 1) return false
    this.idx += 1
    for (const w of this.W) {
      w.flag = 0
      this._stepWorker(w)
    }
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
    }
  }
}
