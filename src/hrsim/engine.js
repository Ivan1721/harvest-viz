// Simulador humano-robot de cosecha: port a JavaScript de HumanRobot_Sim.m (MATLAB).
// Réplica tick a tick (paso 0,25 s) de la máquina de estados de los trabajadores, el robot
// (waypoints + FIS de búsqueda de meta + cinemática de dirección frontal) y el protocolo de
// traspaso "worker_loads" del estudio. Sin dependencias: corre igual en Node y en el navegador.
//
// Correspondencia con el MATLAB (nombres entre paréntesis):
//   estados del trabajador (bandera_latencia): 1 cosecha, 2 baja escalera, 6 crea caja,
//     8 lleva caja al punto de entrega, 9 vuelve, 7 sube escalera,
//     10 camina al robot, 11 carga la caja, 12 baja escalera para atender al robot
//   banderas de actividad (w_flag): 1 cosecha, 2 camina, 3 caja/carga, 4 baja escalera, 5 sube escalera
import { parseFis, evalFis } from './fis.js'
import { DEFAULTS, TREES_ALL, hyp, nearestOnPolyline, movePose, initWorkers } from './common.js'
export { DEFAULTS }

export class HRSim {
  constructor(opts = {}, goalFisText) {
    const p = (this.p = { ...DEFAULTS, ...opts, costs: { ...DEFAULTS.costs, ...(opts.costs || {}) } })
    this.fis = parseFis(goalFisText)
    const dt = (this.dt = p.dt)
    const NH = (this.NH = p.nw)
    this.N = Math.round(p.duration / dt) + 1
    this.idx = 0 // tick actual (0-based; el MATLAB usa 1-based)
    // --- trabajadores ---
    const { W, C, type, ladder } = initWorkers(p)
    this.C = C
    this.type = type
    this.ladder = ladder
    this.W = W
    // --- ruta base del robot ---
    const init = [15, 2],
      cargo = [15, 2]
    const gy = { 3: 24, 2: 16.2, 1: 9 }[p.row]
    const goal1 = [8, gy],
      goal2 = [15, gy],
      goal3 = [22, gy],
      ini1 = [8, 2],
      ini2 = [22, 2]
    const lap = [init, ini2, goal3, goal2, cargo, ini1, goal1, goal2, cargo]
    this.baseRoute = []
    for (let i = 0; i < p.lapRepeats; i++) for (const w of lap) this.baseRoute.push([w[0], w[1]])
    this.cargoZone = cargo
    this.initPose = [15, 2, 0]
    // --- robot ---
    this.waypoints = this.baseRoute.map((w) => [w[0], w[1]])
    this.kWp = 1 // índice 0-based (MATLAB k=2)
    this.rpose = [15, 2, 0]
    this.prodRobot = 0
    this.prodRobotTotal = 0
    this.holdSteps = 0
    this.waiting = false
    this.lapBoxStops = 0
    this.contaT = 0
    this.timeT1 = 0
    this.boxInserted = new Array(NH).fill(false)
    this.boxWpPos = new Array(NH).fill(null)
    this.bBox = new Array(NH).fill(0)
    this.wpTimeoutTarget = null
    this.wpTimeoutStart = 0
    this.skips = 0
    this.handoffCount = 0
    this.capacityBlocked = 0
    this.events = []
    this.ev = { picks: [], boxes: [], unloads: [], crates: [] }
    this.rstatus = 0
    // --- registro ---
    this.rec = {
      t: [],
      delivered: [],
      onboard: [],
      work: [],
      prod: Array.from({ length: NH }, () => []),
      workH: Array.from({ length: NH }, () => []),
      flag: Array.from({ length: NH }, () => []),
      rx: [],
      ry: [],
      rth: [],
      rst: [],
      wx: Array.from({ length: NH }, () => []),
      wy: Array.from({ length: NH }, () => []),
      wth: Array.from({ length: NH }, () => []),
      wst: Array.from({ length: NH }, () => []),
    }
    this._record(true)
  }

  log(msg) {
    this.events.push({ idx: this.idx + 1, t: this.idx * this.dt, msg })
  }

  _boxPos(pose) {
    const p = this.p
    let hxy = [pose[0], pose[1]]
    if (p.placement === 'tree_point') {
      let bi = 0,
        bd = Infinity
      TREES_ALL.forEach((t, i) => {
        const d = hyp(t[0] - hxy[0], t[1] - hxy[1])
        if (d < bd) {
          bd = d
          bi = i
        }
      })
      hxy = TREES_ALL[bi]
    }
    const near = nearestOnPolyline(hxy, this.baseRoute)
    let dx = hxy[0] - near[0],
      dy = hxy[1] - near[1],
      d = Math.hypot(dx, dy)
    if (d < 1e-6) {
      dx = -Math.cos(pose[2])
      dy = -Math.sin(pose[2])
      d = Math.hypot(dx, dy)
    }
    const off = Math.min(p.boxRouteOffset, Math.max(0.35, 0.6 * d))
    return [near[0] + (off * dx) / d, near[1] + (off * dy) / d]
  }

  _record(first = false) {
    const r = this.rec,
      NH = this.NH
    r.t.push(this.idx * this.dt)
    r.delivered.push(this.prodRobotTotal)
    r.onboard.push(this.prodRobot)
    r.work.push(this.W.reduce((a, w) => a + w.work, 0))
    r.rx.push(this.rpose[0])
    r.ry.push(this.rpose[1])
    r.rth.push(this.rpose[2])
    r.rst.push(this.rstatus)
    for (let h = 0; h < NH; h++) {
      const w = this.W[h]
      r.prod[h].push(w.prod)
      r.workH[h].push(w.work)
      // convención del MATLAB: w_flag(idx-1) describe lo que se hizo al calcular el tick idx
      // (en los bloques de los trabajadores 1-6 la subida de escalera escribe w_flag(idx), no idx-1)
      const quirk = h < 6 && w.state === 7 && w.flag === 5
      if (!first && !quirk) r.flag[h][r.flag[h].length - 1] = w.flag
      r.flag[h].push(quirk ? w.flag : 0)
      r.wx[h].push(w.pose[0])
      r.wy[h].push(w.pose[1])
      r.wth[h].push(w.pose[2])
      r.wst[h].push(w.state)
    }
  }

  // ---- un trabajador, un tick (idx = tick que se calcula; los valores previos son los del tick anterior) ----
  _stepWorker(w) {
    const p = this.p,
      dt = this.dt,
      C = this.C,
      loads = true // protocolo worker_loads del estudio
    const maxProd = p.maxProd
    w.flag = 0
    const startHandoff = () => {
      // el robot llama: ir a cargar la caja
      w.target = [w.box[0], w.box[1]]
      w.stage = 1
      if (w.ladder === 1) w.state = 12
      else {
        w.state = 10
        w.route = [w.target]
        w.routeIdx = 0
      }
    }
    switch (w.state) {
      case 1: {
        const prevProd = w.prod
        w.cont += 1
        if (w.cont >= w.tInc) {
          w.prod = prevProd + p.costProduction * dt
          w.last = w.prod
          w.cont = 0
        } else w.prod = w.last
        if (prevProd >= maxProd) {
          w.prod = maxProd
          w.last = maxProd
          w.state = w.ladder === 1 ? 2 : 6
        }
        w.work += w.cost * dt
        w.flag = 1
        if (loads && w.state === 1 && w.call && w.stage === 0) startHandoff()
        break
      }
      case 2:
        w.work += C.ladderDown * dt
        w.flag = 4
        if (w.ladderCount >= p.ladderTime) {
          w.state = 6
          w.ladderCount = 0
        } else w.ladderCount += dt
        break
      case 6: {
        if (w.prod >= maxProd) {
          w.prod = 0
          w.last = 0
          w.nBoxes += 1
          w.box = this._boxPos(w.pose)
          w.prodBox = maxProd * w.nBoxes
        } else w.prod = w.last
        w.flag = 3
        w.route = [[w.box[0], w.box[1]]]
        w.routeIdx = 0
        w.ladderAfter = w.ladder
        w.state = 8
        break
      }
      case 8: {
        const { pose, reached } = movePose(w.pose, w.route[w.routeIdx], p.walkSpeed, dt)
        w.pose = pose
        w.work += C.walkingCarrying * dt
        w.flag = 2
        if (reached) {
          if (w.routeIdx < w.route.length - 1) w.routeIdx += 1
          else {
            w.state = 9
            w.route = [w.start]
            w.routeIdx = 0
            this.ev.crates.push({ h: w.h, x: w.box[0], y: w.box[1], placed: this.idx, picked: Infinity })
          }
        }
        if (loads && w.state === 9 && w.call && w.stage === 0) {
          // el robot ya está en la caja
          w.stage = 1
          w.state = 11
          w.timer = p.loadTimePerBox * Math.max(w.nBoxes, 1)
        }
        break
      }
      case 9: {
        const { pose, reached } = movePose(w.pose, w.route[w.routeIdx], p.walkSpeed, dt)
        w.work += C.walking * dt
        w.flag = 2
        if (reached) {
          if (w.routeIdx < w.route.length - 1) {
            w.routeIdx += 1
            w.pose = pose
          } else {
            w.pose = [w.start[0], w.start[1], pose[2]]
            w.state = w.ladderAfter === 1 ? 7 : 1
          }
        } else w.pose = pose
        if (loads && w.state === 9 && w.call && w.stage === 0) {
          // llamado mientras vuelve: da la vuelta
          w.target = [w.box[0], w.box[1]]
          w.stage = 1
          w.state = 10
          w.route = [w.target]
          w.routeIdx = 0
        }
        break
      }
      case 12:
        w.work += C.ladderDown * dt
        w.flag = 4
        if (w.ladderCount >= p.ladderTime) {
          w.ladderCount = 0
          w.state = 10
          w.route = [w.target]
          w.routeIdx = 0
        } else w.ladderCount += dt
        break
      case 10: {
        const { pose, reached } = movePose(w.pose, w.route[w.routeIdx], p.walkSpeed, dt)
        w.pose = pose
        w.work += C.walking * dt
        w.flag = 2
        if (reached) {
          if (w.routeIdx < w.route.length - 1) w.routeIdx += 1
          else {
            w.state = 11
            w.timer = p.loadTimePerBox * Math.max(w.nBoxes, 1)
          }
        }
        break
      }
      case 11:
        w.work += C.harvestGround * dt
        w.flag = 3
        w.timer -= dt
        if (w.timer <= 1e-9) {
          w.done = true
          w.stage = 0
          w.ladderAfter = w.ladder
          w.state = 9
          w.route = [w.start]
          w.routeIdx = 0
        }
        break
      case 7:
        w.work += C.ladderClimb * dt
        w.flag = 5
        if (w.ladderCount >= p.ladderTime) {
          w.state = 1
          w.ladderCount = 0
        } else w.ladderCount += dt
        break
    }
  }

  _detectBox(h) {
    // ObjectDetector: dentro del alcance y del campo de visión del cuerpo
    const w = this.W[h],
      r = this.rpose,
      p = this.p
    if (!(w.nBoxes > 0 && w.prodBox > 0 && w.box)) return false
    const dx = w.box[0] - r[0],
      dy = w.box[1] - r[1],
      d = Math.hypot(dx, dy)
    if (d > p.detectorRange) return false
    let ang = Math.atan2(dy, dx) - r[2]
    ang = Math.atan2(Math.sin(ang), Math.cos(ang))
    return Math.abs(ang) <= p.detectorFov / 2
  }

  _stepRobot() {
    const p = this.p,
      dt = this.dt,
      NH = this.NH,
      W = this.W
    const unit = p.boxUnits
    const rpos = [this.rpose[0], this.rpose[1]]
    // detección de cajas
    const det = []
    for (let h = 0; h < NH; h++) {
      const d = this._detectBox(h)
      det.push(d)
      this.bBox[h] = d ? this.bBox[h] + 1 : 0
    }
    // inserción de waypoints de caja (distance_sorted)
    const pend = []
    const robotFull = this.prodRobot + unit > p.capacityBoxes * unit + 1e-9
    for (let h = 0; h < NH; h++) {
      const w = W[h]
      const exists = w.nBoxes >= 1 && w.prodBox > 0 && w.box
      if (exists && det[h] && this.bBox[h] === 1 && !this.boxInserted[h] && !robotFull) {
        pend.push({ h, pos: [w.box[0], w.box[1]], dist: hyp(rpos[0] - w.box[0], rpos[1] - w.box[1]) })
      }
    }
    const nAllowed = p.maxBoxStopsPerLap - this.lapBoxStops
    const atWp = (pos) => this.waypoints.some((q) => hyp(q[0] - pos[0], q[1] - pos[1]) < 0.05)
    let list = pend
    if (p.placement === 'tree_point') {
      const newStop = list.map((e, i) => !(atWp(e.pos) || (i > 0 && list.slice(0, i).some((q) => hyp(q.pos[0] - e.pos[0], q.pos[1] - e.pos[1]) < 0.05))))
      const nNew = newStop.filter(Boolean).length
      let keep = list.map((_, i) => i),
        ns = newStop
      if (nNew > nAllowed) {
        const cand = list
          .map((_, i) => i)
          .filter((i) => newStop[i])
          .sort((a, b) => list[a].dist - list[b].dist)
        const drop = cand.slice(Math.max(0, nAllowed))
        for (let i = 0; i < list.length; i++) {
          if (!newStop[i] && !atWp(list[i].pos) && drop.some((d) => hyp(list[d].pos[0] - list[i].pos[0], list[d].pos[1] - list[i].pos[1]) < 0.05)) drop.push(i)
        }
        keep = keep.filter((i) => !drop.includes(i))
        ns = keep.map((i) => newStop[i])
        list = keep.map((i) => list[i])
      }
      this.lapBoxStops += ns.filter(Boolean).length
    } else {
      if (list.length && list.length > nAllowed) list = [...list].sort((a, b) => a.dist - b.dist).slice(0, Math.max(0, nAllowed))
      this.lapBoxStops += list.length
    }
    if (list.length) {
      list = [...list].sort((a, b) => b.dist - a.dist)
      for (const e of list) {
        const { h, pos } = e
        const exists = this.waypoints.some((q) => hyp(q[0] - pos[0], q[1] - pos[1]) < 0.05)
        if (!exists) {
          const kk = Math.min(Math.max(this.kWp, 0), this.waypoints.length - 1)
          this.waypoints.splice(kk, 0, [pos[0], pos[1]])
          this.log(
            `Robot detected BOX from h${h + 1} and inserted waypoint | box=[${pos[0].toFixed(2)} ${pos[1].toFixed(2)}] | dist=${e.dist.toFixed(2)} | inserted before k=${kk + 1} | total waypoints=${this.waypoints.length}`,
          )
        } else this.log(`Robot detected BOX from h${h + 1} | box already existed as waypoint at [${pos[0].toFixed(2)} ${pos[1].toFixed(2)}]`)
        this.ev.boxes.push({ idx: this.idx, h: h + 1, x: pos[0], y: pos[1], picked: Infinity, served: false })
        this.boxInserted[h] = true
        this.boxWpPos[h] = [pos[0], pos[1]]
      }
    }
    // recogida (protocolo worker_loads: el dueño carga la caja)
    this.waiting = false
    for (let h = 0; h < NH; h++) {
      const w = W[h]
      if (!(w.nBoxes >= 1 && w.prodBox > 0 && w.box && this.boxInserted[h])) continue
      const dist = hyp(rpos[0] - w.box[0], rpos[1] - w.box[1])
      const hasRoom = this.prodRobot + w.prodBox <= p.capacityBoxes * unit + 1e-9
      if (dist < 0.75 && !hasRoom) this.capacityBlocked++
      let ready = true
      if (dist < 0.75 && hasRoom && !w.done) {
        w.call = true
        this.waiting = true
        ready = false
      }
      if (dist < 0.75 && hasRoom && ready) {
        const picked = w.prodBox
        w.call = false
        w.done = false
        this.handoffCount++
        this.log(
          `Robot picked BOX from h${h + 1} | box_product=${picked.toFixed(2)} | Prod_ROBOT before=${this.prodRobot.toFixed(2)} | robot=[${rpos[0].toFixed(2)} ${rpos[1].toFixed(2)}]`,
        )
        this.prodRobot += picked
        this.ev.picks.push({ idx: this.idx, h: h + 1, amount: picked })
        for (const c of this.ev.crates) if (c.h === h + 1 && c.picked === Infinity) c.picked = this.idx
        {
          const b = this.ev.boxes.find((q) => q.h === h + 1 && !q.served)
          if (b) {
            b.picked = this.idx
            b.served = true
          }
        }
        if (this.boxWpPos[h]) {
          let imin = -1,
            dmin = Infinity
          this.waypoints.forEach((q, i) => {
            const d = hyp(q[0] - this.boxWpPos[h][0], q[1] - this.boxWpPos[h][1])
            if (d < dmin) {
              dmin = d
              imin = i
            }
          })
          if (dmin < 0.1 && this.waypoints.length > 1) {
            this.waypoints.splice(imin, 1)
            if (imin < this.kWp) this.kWp -= 1
            if (this.kWp > this.waypoints.length - 1) this.kWp = 0
            if (this.kWp < 0) this.kWp = 0
            this.log(`Box waypoint removed for h${h + 1} | next k=${this.kWp + 1}/${this.waypoints.length}`)
          }
        }
        w.prodBox = 0
        w.nBoxes = 0
        w.box = null
        this.boxInserted[h] = false
        this.boxWpPos[h] = null
        this.bBox[h] = 0
      }
    }
    // descarga en la zona de carga
    if (hyp(rpos[0] - this.initPose[0], rpos[1] - this.initPose[1]) < 0.5 && this.contaT === 0) {
      this.lapBoxStops = 0
      this.log(`Robot reached CARGO ZONE | unloading ${this.prodRobot.toFixed(2)} crops | Prod_ROBOT_total before=${this.prodRobotTotal.toFixed(2)}`)
      if (this.prodRobot > 0) this.holdSteps += Math.round(0 / dt) + Math.round((p.unloadTimePerBox * (this.prodRobot / unit)) / dt)
      this.ev.unloads.push({ idx: this.idx, amount: this.prodRobot })
      this.prodRobotTotal += this.prodRobot
      this.prodRobot = 0
      this.contaT = 1
      this.timeT1 = 0
    }
    if (this.contaT === 1) this.timeT1 += 1
    if (this.timeT1 === 10) this.contaT = 0
    // control hacia el waypoint actual
    const cur = [Math.max(Math.min(this.rpose[0], p.mapW - 0.05), 0.05), Math.max(Math.min(this.rpose[1], p.mapH - 0.05), 0.05), this.rpose[2]]
    if (this.kWp > this.waypoints.length - 1) this.kWp = this.waypoints.length - 1
    const g = this.waypoints[this.kWp]
    const gx = g[0] - cur[0],
      gy = g[1] - cur[1],
      c = Math.cos(cur[2]),
      s = Math.sin(cur[2])
    const xl = c * gx + s * gy,
      yl = -s * gx + c * gy // inv(T)*goal
    const goalD = Math.hypot(xl, yl)
    const targetDir = goalD < 1e-6 ? 0 : (-Math.atan2(yl, xl) * 180) / Math.PI
    // timeout de waypoint
    let timedOut = false
    const sameTarget = this.wpTimeoutTarget && this.wpTimeoutTarget[0] === g[0] && this.wpTimeoutTarget[1] === g[1]
    const nowIdx = this.idx + 1
    if (!sameTarget || this.holdSteps > 0 || this.waiting) {
      this.wpTimeoutTarget = [g[0], g[1]]
      this.wpTimeoutStart = nowIdx
    } else if ((nowIdx - this.wpTimeoutStart) * dt > p.waypointTimeout) {
      timedOut = true
      this.skips++
    }
    if (goalD < 0.5 || timedOut) {
      this.log(`Robot reached ROUTE waypoint | k=${this.kWp + 1}/${this.waypoints.length} | pos=[${this.rpose[0].toFixed(2)} ${this.rpose[1].toFixed(2)}]`)
      this.kWp += 1
      if (this.kWp > this.waypoints.length - 1) this.kWp = 0
      const n = this.waypoints[this.kWp]
      this.log(`Next waypoint selected | k=${this.kWp + 1}/${this.waypoints.length} | target=[${n[0].toFixed(2)} ${n[1].toFixed(2)}]`)
    }
    const [wRef, vRef] = evalFis(this.fis, [goalD, targetDir])
    // FourWheelSteering, dirección frontal: v_x = vRef, v_y = 0.5 w L, giro w
    const L = p.frontLen + p.rearLen
    const vx = vRef,
      vy = vx > 1e-12 ? 0.5 * wRef * L : 0,
      om = vx > 1e-12 ? wRef : 0
    const th = this.rpose[2]
    let wxv = vx * Math.cos(th) - vy * Math.sin(th),
      wyv = vx * Math.sin(th) + vy * Math.cos(th),
      wth = om
    this.rstatus = 0
    if (this.holdSteps > 0) {
      wxv = wyv = wth = 0
      this.holdSteps -= 1
      this.rstatus = 2
    } else if (this.waiting) {
      wxv = wyv = wth = 0
      this.rstatus = 1
    }
    // la integración usa pose(:,idx-1) sin recorte, igual que el MATLAB
    const nx = this.rpose[0] + wxv * dt,
      ny = this.rpose[1] + wyv * dt,
      nth = this.rpose[2] + wth * dt
    this.rpose = [Math.max(Math.min(nx, p.mapW - 0.05), 0.05), Math.max(Math.min(ny, p.mapH - 0.05), 0.05), nth]
  }

  step() {
    if (this.idx >= this.N - 1) return false
    this.idx += 1
    for (const w of this.W) this._stepWorker(w)
    if (this.p.robot) this._stepRobot()
    this._record()
    return true
  }

  run(until = this.p.duration) {
    while (this.idx * this.dt < until && this.step());
    return this
  }

  // métricas finales (V1..V7 de FinalResults)
  summary() {
    const NH = this.NH,
      rec = this.rec,
      N = rec.t.length
    const boxesDropped = rec.prod.map((s) => {
      let c = 0
      for (let i = 0; i < N - 1; i++) if (s[i] - s[i + 1] === this.p.maxProd) c++
      return c
    })
    const finalProd = rec.prod.map((s) => s[N - 1])
    const totalHuman = boxesDropped.map((b, h) => b * this.p.maxProd + finalProd[h] - rec.prod[h][0])
    const V4 = this.prodRobotTotal
    const V5 = finalProd.reduce((a, b) => a + b, 0)
    const V5a1 = this.W.reduce((a, w) => a + w.nBoxes * this.p.maxProd, 0)
    const V6 = this.prodRobot
    const meanWork = rec.workH.map((s) => s.slice(0, N - 1).reduce((a, b) => a + b, 0) / (N - 1))
    return {
      Humans: NH,
      TimeWeightedAverageMetabolicRate_kcal: meanWork.reduce((a, b) => a + b, 0) / NH,
      AverageHumanProduction_crop_units: totalHuman.reduce((a, b) => a + b, 0) / NH,
      TotalHumanWorkload_kcal: Math.max(...rec.work),
      TotalProductionCargoZone_crop_units: V4,
      RemainingCropsHumanBags_crop_units: V5,
      RemainingCropsBoxes_crop_units: V5a1,
      RemainingCropsRobot_crop_units: V6,
      TotalRecollectedCrops_crop_units: V4 + V5 + V5a1 + V6,
      handoffs: this.handoffCount,
      waypointSkips: this.skips,
    }
  }
}
