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
import { DEFAULTS, resolveParams, hyp, nearestOnPolyline, movePose, initWorkers } from './common.js'
import { buildHuerto } from './huertos/index.js'
import { protectionDistance } from './ssm.js'
import { Cosecha, rutaCalles, ejeCercano } from './huertos/rectangular.js'
import { paso } from './huertos/pendiente.js'
import { ROBOTS, potencia, fuerzaAvance, limiteTraccion, frenadaEfectiva } from './robots.js'
import { Acopio, recordAcopio, resumenAcopio } from './acopio.js'
import { prepararCarga, resumenCarga } from './carga.js'

// estados del trabajador dedicados al robot (camina a la caja, la carga, baja la escalera para atenderlo):
// en la regla de seguridad ese trabajador no detiene al robot, solo lo obliga a ir lento (silenciamiento, ISO 3691-4)
const ATTENDING = new Set([10, 11, 12])
export { DEFAULTS }

// Radios y tiempos fijos del MATLAB (HumanRobot_Sim.m), con nombre para leer el código
const PICKUP_RADIUS = 0.75 // m: el robot "está en la caja" (MATLAB 3925)
const CARGO_RADIUS = 0.5 // m: el robot "está en la zona de carga" (MATLAB 3994)
const WAYPOINT_RADIUS = 0.5 // m: waypoint alcanzado
const UNLOAD_COOLDOWN_TICKS = 10 // ticks antes de poder volver a descargar

const maxOf = (a) => {
  let m = -Infinity
  for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i]
  return m
}

export class HRSim {
  constructor(opts = {}, goalFisText) {
    const p = (this.p = resolveParams(opts))
    this.fis = parseFis(goalFisText)
    const dt = (this.dt = p.dt)
    const NH = (this.NH = p.nw)
    this.N = Math.round(p.duration / dt) + 1
    this.idx = 0 // tick actual (0-based; el MATLAB usa 1-based)
    // --- trabajadores ---
    const huerto = (this.huerto = buildHuerto(p))
    this.trees = huerto.arboles.map((a) => [a.x, a.y])
    const { W, C, type, ladder } = initWorkers(p, huerto)
    this.C = C
    this.type = type
    this.ladder = ladder
    this.W = W
    // huertos generados: fruta que se agota, tramos y desplazamientos por calles (matlab-2026: null, como MATLAB)
    // carga variable por árbol y ritmo que cae (H7, fase B; opcional)
    this.cosecha = huerto.calles ? new Cosecha(huerto, W, p.carga ? prepararCarga(p.carga, huerto.arboles.length, p.semilla) : null) : null
    // --- ruta base del robot ---
    const lap = huerto.vueltaRobot
    this.baseRoute = []
    for (let i = 0; i < p.lapRepeats; i++) for (const w of lap) this.baseRoute.push([w[0], w[1]])
    this.cargoZone = [...huerto.acopio]
    this.initPose = [...huerto.inicioRobot]
    // --- robot ---
    this.waypoints = this.baseRoute.map((w) => [w[0], w[1]])
    // huertos generados (H7, fase C): cada vuelta termina en el acopio (marca `fin`); ahí la ruta se recalcula con las
    // calles que tienen gente o cajas esperando, así el robot sigue a la cuadrilla cuando cambia de calle
    if (this.cosecha) {
      for (let i = 0; i < p.lapRepeats; i++) this.waypoints[(i + 1) * lap.length - 1].fin = true
      this.rutaEjes = this._ejesOcupados(W)
    }
    this.kWp = 1 // índice 0-based (MATLAB k=2)
    this.rpose = [...huerto.inicioRobot]
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
    this.ev = { picks: [], boxes: [], unloads: [], crates: [], ...(this.cosecha ? { rutas: [{ idx: 0, puntos: lap.map((q) => [q[0], q[1]]) }] } : {}) }
    this.rstatus = 0
    // seguridad SSM (fase 3, perfil hri)
    this.ssmStopped = false
    this.ssmClear = 0
    this.ssmStops = 0
    // robot elegido, energía y carro (solo huertos generados; la réplica de MATLAB no los tiene)
    this.robotSpec = this.cosecha ? ROBOTS[p.robotTipo] || ROBOTS.warthog : null
    this.energyJ = 0
    this.vPrev = 0
    this.tractionTicks = 0
    this.maxPull = 0
    const cr = this.robotSpec?.carro
    this.carro = cr ? this._carroInicial(cr) : null
    // acopio con acopiador, bins y camión (H7, fase A; opcional)
    this.acopio = p.acopio ? new Acopio(p.acopio, dt, { recibir: C.walkingCarrying, cargar: C.harvestGround }) : null
    this.acopioWait = false
    this.acopioRecibe = false
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
      ...(this.cosecha ? { energy: [], cx: [], cy: [], cth: [] } : {}),
      ...(this.acopio ? { desp: [], acop: [], bins: [], cam: [], cola: [] } : {}),
      ...(this.cosecha?.carga ? { dej: [] } : {}),
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

  /** Camino de a hasta b: por calles en huertos generados; en línea recta en matlab-2026 (como MATLAB). */
  _path(a, b) {
    return this.cosecha ? rutaCalles(this.huerto, a, b) : [[b[0], b[1]]]
  }

  /** El lado del árbol se agotó: baja de la escalera si hace falta y camina al siguiente árbol de su tramo. */
  _leaveTree(w) {
    if (w.ladder === 1) {
      w.goNext = true
      w.state = 2
    } else this._goNextTree(w)
  }

  _goNextTree(w) {
    w.goNext = false
    const spot = this.cosecha.next(w)
    if (!spot) {
      w.state = 15 // sin fruta en su tramo ni tramos libres
      return
    }
    w.state = 13
    w.route = this._path(w.pose, spot)
    w.routeIdx = 0
    w.start = [spot[0], spot[1]]
  }

  _boxPos(pose, w) {
    const p = this.p
    let hxy = [pose[0], pose[1]]
    if (this.cosecha) {
      hxy = this.cosecha.drop(w)
      // la caja queda sobre la ruta del robot (calle en la que cabe) o junto a ella, en la boca de la calle
      const near0 = nearestOnPolyline(hxy, this.baseRoute)
      if (Math.hypot(hxy[0] - near0[0], hxy[1] - near0[1]) < 1e-6) return hxy
      const d0 = Math.hypot(hxy[0] - near0[0], hxy[1] - near0[1]),
        off0 = Math.min(p.boxRouteOffset, Math.max(0.35, 0.6 * d0))
      const b = [near0[0] + (off0 * (hxy[0] - near0[0])) / d0, near0[1] + (off0 * (hxy[1] - near0[1])) / d0]
      // en la cabecera, a no menos de 1,5 m del borde de las copas: el robot que va a buscarla no las roza
      const c = this.huerto.calles,
        H = this.huerto.limites.h
      if (b[1] < c.cabecera) b[1] = Math.min(b[1], c.cabecera - 1.5)
      else if (b[1] > H - c.cabecera) b[1] = Math.max(b[1], H - c.cabecera + 1.5)
      return b
    } else if (p.placement === 'tree_point') {
      let bi = 0,
        bd = Infinity
      this.trees.forEach((t, i) => {
        const d = hyp(t[0] - hxy[0], t[1] - hxy[1])
        if (d < bd) {
          bd = d
          bi = i
        }
      })
      hxy = this.trees[bi]
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
    r.work.push(this.W.reduce((a, w) => a + w.work, 0) + (this.acopio ? this.acopio.work : 0))
    if (this.acopio) recordAcopio(r, this.acopio)
    if (r.dej) r.dej.push(this.cosecha.dejado)
    r.rx.push(this.rpose[0])
    r.ry.push(this.rpose[1])
    r.rth.push(this.rpose[2])
    r.rst.push(this.rstatus)
    if (r.energy) {
      r.energy.push(this.energyJ / 3600) // Wh acumulados
      r.cx.push(this.carro ? this.carro[0] : NaN)
      r.cy.push(this.carro ? this.carro[1] : NaN)
      r.cth.push(this.carro ? this.carro[2] : NaN)
    }
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
        w.route = this._path(w.pose, w.target)
        w.routeIdx = 0
      }
    }
    switch (w.state) {
      case 1: {
        const prevProd = w.prod
        w.cont += 1
        const tInc = this.cosecha?.carga ? w.tInc * this.cosecha.periodo(w) : w.tInc // fase B: el periodo crece al vaciarse el lado
        if (w.cont >= tInc) {
          // huertos generados: no se cosecha más fruta de la que queda en el lado del árbol
          // huertos generados: no se saca del árbol más de lo que cabe en la bolsa (el MATLAB recorta la bolsa y descarta
          // el excedente; con fruta finita eso rompería la conservación)
          w.prod = prevProd + (this.cosecha ? this.cosecha.take(w, Math.max(0, Math.min(p.costProduction * dt, maxProd - prevProd))) : p.costProduction * dt)
          w.last = w.prod
          w.cont = p.semilla == null && !p.carga ? 0 : w.cont - tInc // periodo no entero (semilla o fase B): se guarda el resto
        } else w.prod = w.last
        if (prevProd >= maxProd) {
          w.prod = maxProd
          w.last = maxProd
          w.state = w.ladder === 1 ? 2 : 6
        } else if (this.cosecha && this.cosecha.agotado(w)) this._leaveTree(w)
        w.work += w.cost * dt
        w.flag = 1
        if (loads && w.state === 1 && w.call && w.stage === 0) startHandoff()
        break
      }
      case 2:
        w.work += C.ladderDown * dt
        w.flag = 4
        if (w.ladderCount >= p.ladderTime) {
          w.ladderCount = 0
          if (w.goNext) this._goNextTree(w)
          else w.state = 6
        } else w.ladderCount += dt
        break
      case 6: {
        if (w.prod >= maxProd) {
          w.prod = 0
          w.last = 0
          w.nBoxes += 1
          w.box = this._boxPos(w.pose, w)
          w.prodBox = maxProd * w.nBoxes
        } else w.prod = w.last
        w.flag = 3
        w.route = this._path(w.pose, w.box)
        w.routeIdx = 0
        w.ladderAfter = w.ladder
        w.state = 8
        break
      }
      case 8: {
        // en ladera la velocidad y el gasto dependen de la pendiente del tramo (en plano: v = walkSpeed, k = 1)
        const { v, k } = paso(this.huerto, w.pose, w.route[w.routeIdx], p.walkSpeed, true)
        const { pose, reached } = movePose(w.pose, w.route[w.routeIdx], v, dt)
        w.pose = pose
        w.work += C.walkingCarrying * dt * k
        w.flag = 2
        if (reached) {
          if (w.routeIdx < w.route.length - 1) w.routeIdx += 1
          else {
            // punto de entrega = último punto de la ruta (w.box puede ser null si el robot ya recogió la caja)
            const drop = w.route[w.route.length - 1]
            w.state = 9
            w.route = this._path(drop, w.start)
            w.routeIdx = 0
            this.ev.crates.push({ h: w.h, x: drop[0], y: drop[1], placed: this.idx, picked: Infinity })
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
        const { v, k } = paso(this.huerto, w.pose, w.route[w.routeIdx], p.walkSpeed)
        const { pose, reached } = movePose(w.pose, w.route[w.routeIdx], v, dt)
        w.work += C.walking * dt * k
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
          w.route = this._path(w.pose, w.target)
          w.routeIdx = 0
        }
        break
      }
      case 13: {
        // camina por la calle al siguiente árbol de su tramo
        const { v, k } = paso(this.huerto, w.pose, w.route[w.routeIdx], p.walkSpeed)
        const { pose, reached } = movePose(w.pose, w.route[w.routeIdx], v, dt)
        w.pose = pose
        w.work += C.walking * dt * k
        w.flag = 2
        if (reached) {
          if (w.routeIdx < w.route.length - 1) w.routeIdx += 1
          else {
            w.pose[2] = Math.atan2(w.tree[1] - w.pose[1], w.tree[0] - w.pose[0])
            w.state = w.ladder === 1 ? 7 : 1
          }
        }
        if (loads && w.state === 13 && w.call && w.stage === 0) startHandoff()
        break
      }
      case 15:
        // sin fruta que cosechar: espera (y sigue atendiendo al robot si lo llama)
        w.flag = 0
        if (loads && w.call && w.stage === 0) startHandoff()
        break
      case 12:
        w.work += C.ladderDown * dt
        w.flag = 4
        if (w.ladderCount >= p.ladderTime) {
          w.ladderCount = 0
          w.state = 10
          w.route = this._path(w.pose, w.target)
          w.routeIdx = 0
        } else w.ladderCount += dt
        break
      case 10: {
        const { v, k } = paso(this.huerto, w.pose, w.route[w.routeIdx], p.walkSpeed)
        const { pose, reached } = movePose(w.pose, w.route[w.routeIdx], v, dt)
        w.pose = pose
        w.work += C.walking * dt * k
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
          w.route = this._path(w.pose, w.start)
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

  /** Calles (ejes x) con cosecheros trabajando o con cajas esperando al robot (H7, fase C). */
  _ejesOcupados(W = this.W) {
    const c = this.huerto.calles,
      set = new Set()
    for (const w of W) {
      if (w.tramo && w.state !== 15) set.add(w.tramo.eje)
      if (w.nBoxes > 0 && w.box) set.add(ejeCercano(c, w.box[0]))
    }
    return [...set].sort((a, b) => a - b)
  }

  /** Al terminar una vuelta (en el acopio): si la cuadrilla cambió de calles, las vueltas que quedan se recalculan. */
  _replanificarRuta() {
    const ejes = this._ejesOcupados()
    if (!ejes.length || ejes.join() === this.rutaEjes.join()) return
    const W = this.waypoints,
      k = this.kWp
    const resto = W.slice(k + 1)
    const vueltas = resto.filter((q) => q.fin).length
    const cajas = resto.filter((q) => q.caja)
    const lap = this.huerto.vuelta(ejes)
    const nuevo = []
    const marcar = (pts) =>
      pts.forEach((q, j) => {
        const r = [q[0], q[1]]
        if (j === pts.length - 1) r.fin = true
        nuevo.push(r)
      })
    for (let i = 0; i < vueltas; i++) marcar(lap)
    this.waypoints = [...W.slice(0, k + 1), ...nuevo]
    this.baseRoute = lap.map((q) => [q[0], q[1]])
    for (const q of cajas) this.waypoints.splice(this._insertAt(q), 0, q)
    this.rutaEjes = ejes
    this.ev.rutas.push({ idx: this.idx, puntos: lap.map((q) => [q[0], q[1]]) })
    this.log(`Robot route re-planned | lanes=[${ejes.map((x) => x.toFixed(1)).join(' ')}] | ${vueltas} laps left`)
  }

  /** Índice donde insertar un waypoint de caja: el del tramo de la ruta próxima más cercano a la caja. */
  _insertAt(pos) {
    const W = this.waypoints,
      n = W.length
    let best = this.kWp,
      bd = Infinity,
      a = [this.rpose[0], this.rpose[1]]
    for (let k = 0; k < Math.min(60, n); k++) {
      const j = (this.kWp + k) % n,
        b = W[j]
      const d = hyp(...(([x, y]) => [x - pos[0], y - pos[1]])(nearestOnPolyline(pos, [a, b])))
      if (d < bd - 1e-9) {
        bd = d
        best = j
      }
      a = b
    }
    return best
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
    const unit = p.maxProd // una caja = una bolsa llena (en MATLAB ROBOT_BOX_UNITS = capacidad de la bolsa = 15)
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
          let kk = Math.min(Math.max(this.kWp, 0), this.waypoints.length - 1)
          // huertos generados: la caja se inserta en el tramo de la ruta que pasa por ella (no siempre antes del waypoint
          // actual: con waypoints densos en la calle, eso haría volver al robot a un punto que ya quedó atrás)
          if (this.cosecha) kk = this._insertAt(pos)
          const wp = [pos[0], pos[1]]
          wp.caja = true // H7 fase C: se conserva si la ruta se recalcula
          this.waypoints.splice(kk, 0, wp)
          if (kk < this.kWp) this.kWp += 1 // la inserción quedó antes del waypoint actual (vuelta siguiente)
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
      // con carro, el cosechero carga la caja en el carro: cuenta el más cercano de los dos
      let dist = hyp(rpos[0] - w.box[0], rpos[1] - w.box[1])
      if (this.carro) dist = Math.min(dist, hyp(this.carro[0] - w.box[0], this.carro[1] - w.box[1]))
      const hasRoom = this.prodRobot + w.prodBox <= p.capacityBoxes * unit + 1e-9
      if (dist < PICKUP_RADIUS && !hasRoom) {
        this.capacityBlocked++
        this.needUnload = true
        // MATLAB deja call=true aunque el robot ya no tenga espacio: el trabajador vuelve a girar y cargar
        // indefinidamente sin cosechar. Con fixRecallLoop se cancela la llamada (difiere de MATLAB).
        if (p.fixRecallLoop) w.call = false
      }
      let ready = true
      if (dist < PICKUP_RADIUS && hasRoom && !w.done) {
        w.call = true
        this.waiting = true
        ready = false
      }
      if (dist < PICKUP_RADIUS && hasRoom && ready) {
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
    // huertos generados: con el robot lleno, va a descargar al acopio por las calles y vuelve a donde estaba
    // (en el mapa del estudio la vuelta base ya pasa por la zona de carga a cada rato; en 1 ha, no)
    if (this.cosecha && !this.goingToUnload && (this.needUnload || this.prodRobot >= 0.9 * p.capacityBoxes * unit - 1e-9)) {
      // dentro de una calle no puede dar la vuelta (no cabe): sigue hasta el próximo waypoint en una cabecera y
      // desde ahí va al acopio por el carril; si está en la cabecera de arriba, baja por la calle vecina (dos giros de
      // 90°, sin giro en U entre copas). Después vuelve a ese punto y retoma la vuelta.
      const c = this.huerto.calles,
        H = this.huerto.limites.h,
        W = this.waypoints,
        acop = this.cargoZone
      // «en la cabecera» = sobre el carril del robot (los waypoints densos de la calle llegan hasta el borde de las copas)
      const enCab = (q) => q[1] <= c.yb + 0.5 || q[1] >= c.yt - 0.5
      let j = this.kWp
      for (let k = 0; k < W.length && !enCab(W[j]); k++) j = (j + 1) % W.length
      const here = enCab([rpos[0], rpos[1]])
      const from = here ? [rpos[0], rpos[1] < H / 2 ? c.yb : c.yt] : [W[j][0], W[j][1]]
      const at = here ? this.kWp : j + 1
      let ida, vuelta
      if (from[1] < H / 2) {
        ida = [[acop[0], acop[1]]]
        vuelta = [[from[0], from[1]]]
      } else {
        const e = ejeCercano(c, from[0])
        const k = c.ejes.indexOf(e),
          e2 = c.ejes[k + (acop[0] > e ? 1 : -1)] ?? c.ejes[k - (acop[0] > e ? 1 : -1)] ?? e
        // por la calle, un waypoint cada 3 m como en la vuelta base (el controlador apunta al waypoint)
        const n = Math.max(1, Math.round((c.yt - c.yb) / 3))
        const baja = Array.from({ length: n + 1 }, (_, k) => [e2, c.yt - ((c.yt - c.yb) * k) / n])
        ida = [...baja, [acop[0], acop[1]]]
        vuelta = [...[...baja].reverse(), [from[0], from[1]]]
      }
      const detour = [...ida, ...vuelta]
      this.waypoints.splice(at, 0, ...detour)
      if (at < this.kWp) this.kWp += detour.length
      this.goingToUnload = true
      this.log(`Robot FULL | going to CARGO ZONE | ${detour.length} waypoints inserted`)
    }
    // descarga en la zona de carga
    if (hyp(rpos[0] - this.initPose[0], rpos[1] - this.initPose[1]) < CARGO_RADIUS && this.contaT === 0 && this.acopio && !this.acopioWait) {
      // H7: el acopiador recibe la carga cuando está libre; mientras tanto el robot espera en la cola
      this.goingToUnload = false
      this.needUnload = false
      this.lapBoxStops = 0
      const kg = this.prodRobot
      this.contaT = 1
      this.timeT1 = 0
      if (kg > 0) {
        this.log(`Robot reached CARGO ZONE | waiting for the loader | ${kg.toFixed(2)} crops on board`)
        this.acopioWait = true
        this.acopio.pedir({
          kg,
          dur: p.unloadTimePerBox * (kg / unit),
          onStart: () => (this.acopioRecibe = true),
          onDone: () => {
            this.ev.unloads.push({ idx: this.idx, amount: kg })
            this.prodRobotTotal += kg
            this.prodRobot -= kg
            this.acopioWait = false
            this.acopioRecibe = false
            this.contaT = 1
            this.timeT1 = 0
          },
        })
      }
    } else if (hyp(rpos[0] - this.initPose[0], rpos[1] - this.initPose[1]) < CARGO_RADIUS && this.contaT === 0 && !this.acopio) {
      this.goingToUnload = false
      this.needUnload = false
      this.lapBoxStops = 0
      this.log(`Robot reached CARGO ZONE | unloading ${this.prodRobot.toFixed(2)} crops | Prod_ROBOT_total before=${this.prodRobotTotal.toFixed(2)}`)
      // MATLAB suma UNLOAD_TIME_S (0 en el estudio) + tiempo por caja
      if (this.prodRobot > 0) this.holdSteps += Math.round((p.unloadTimePerBox * (this.prodRobot / unit)) / dt)
      this.ev.unloads.push({ idx: this.idx, amount: this.prodRobot })
      this.prodRobotTotal += this.prodRobot
      this.prodRobot = 0
      this.contaT = 1
      this.timeT1 = 0
    }
    if (this.contaT === 1 && !this.acopioWait) this.timeT1 += 1
    if (this.timeT1 === UNLOAD_COOLDOWN_TICKS) this.contaT = 0
    // control hacia el waypoint actual
    const cur = [
      Math.max(Math.min(this.rpose[0], this.huerto.limites.w - 0.05), 0.05),
      Math.max(Math.min(this.rpose[1], this.huerto.limites.h - 0.05), 0.05),
      this.rpose[2],
    ]
    if (this.kWp > this.waypoints.length - 1) this.kWp = this.waypoints.length - 1
    const c = Math.cos(cur[2]),
      s = Math.sin(cur[2])
    let g, xl, yl, goalD, targetDir
    const aim = () => {
      g = this.waypoints[this.kWp]
      const gx = g[0] - cur[0],
        gy = g[1] - cur[1]
      xl = c * gx + s * gy
      yl = -s * gx + c * gy // inv(T)*goal
      goalD = Math.hypot(xl, yl)
      targetDir = goalD < 1e-6 ? 0 : (-Math.atan2(yl, xl) * 180) / Math.PI
    }
    aim()
    // timeout de waypoint
    let timedOut = false
    const sameTarget = this.wpTimeoutTarget && this.wpTimeoutTarget[0] === g[0] && this.wpTimeoutTarget[1] === g[1]
    const nowIdx = this.idx + 1
    // ir lento por seguridad no cuenta como «atascado» en el waypoint; una parada de seguridad sí: si se prolonga
    // más que waypointTimeout, el robot salta al siguiente waypoint (la misma recuperación que ya tiene el MATLAB)
    if (!sameTarget || this.holdSteps > 0 || this.waiting || this.acopioWait || this.rstatus === 4) {
      this.wpTimeoutTarget = [g[0], g[1]]
      this.wpTimeoutStart = nowIdx
    } else if ((nowIdx - this.wpTimeoutStart) * dt > p.waypointTimeout) {
      timedOut = true
      this.skips++
    }
    if (goalD < WAYPOINT_RADIUS || timedOut) {
      this.log(`Robot reached ROUTE waypoint | k=${this.kWp + 1}/${this.waypoints.length} | pos=[${this.rpose[0].toFixed(2)} ${this.rpose[1].toFixed(2)}]`)
      // H7 fase C: al terminar la vuelta, en el acopio. (Recalcular también al salir de cada calle se probó: el robot
      // vuelve una y otra vez a las calles cercanas y entrega menos.)
      if (this.cosecha && !this.goingToUnload && this.waypoints[this.kWp]?.fin) this._replanificarRuta()
      this.kWp += 1
      if (this.kWp > this.waypoints.length - 1) this.kWp = 0
      const n = this.waypoints[this.kWp]
      this.log(`Next waypoint selected | k=${this.kWp + 1}/${this.waypoints.length} | target=[${n[0].toFixed(2)} ${n[1].toFixed(2)}]`)
      // huertos generados: el control de este tick ya apunta al waypoint nuevo (y salta los que también están
      // alcanzados). El MATLAB, en cambio, usa el waypoint recién alcanzado en ese tick; con waypoints densos en calles
      // angostas eso hace girar al robot hacia un punto que quedó atrás.
      if (this.cosecha) {
        aim()
        for (let k = 0; k < 4 && goalD < WAYPOINT_RADIUS; k++) {
          this.kWp = (this.kWp + 1) % this.waypoints.length
          aim()
        }
      }
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
    } else if (this.acopioWait) {
      // H7: en la cola del acopio (6) o recibiendo el acopiador su carga (2, descarga)
      wxv = wyv = wth = 0
      this.rstatus = this.acopioRecibe ? 2 : 6
    } else if (p.ssm?.enabled) {
      const k = this._ssmScale(wxv, wyv)
      if (k === 0) {
        wxv = wyv = wth = 0
        this.rstatus = 3
      } else if (k < 1) {
        wxv *= k
        wyv *= k
        wth *= k
        this.rstatus = 4
      }
    }
    // huertos generados: límites físicos del robot elegido (velocidad máxima, frenada en bajada, tracción)
    if (this.robotSpec && (wxv || wyv)) {
      const k = this._limitesFisicos(wxv, wyv)
      if (k === 0) {
        wxv = wyv = wth = 0
        this.rstatus = 5 // tracción insuficiente
      } else if (k < 1) {
        wxv *= k
        wyv *= k
        wth *= k
      }
    }
    // la integración usa pose(:,idx-1) sin recorte, igual que el MATLAB
    const old = this.rpose
    const nx = this.rpose[0] + wxv * dt,
      ny = this.rpose[1] + wyv * dt,
      nth = this.rpose[2] + wth * dt
    this.rpose = [Math.max(Math.min(nx, this.huerto.limites.w - 0.05), 0.05), Math.max(Math.min(ny, this.huerto.limites.h - 0.05), 0.05), nth]
    if (this.robotSpec) this._energiaYCarro(old, this.rpose)
  }

  /** Masas del conjunto: total que se mueve, la del robot (tracción) y la que está sobre ruedas que frenan. */
  _masas() {
    const r = this.robotSpec,
      cr = r.carro
    const fruta = this.prodRobot // 1 unidad = 1 kg en los huertos generados
    const mTot = r.masa + (cr ? cr.masa : 0) + fruta
    return { mTot, mRobot: r.masa, mFrena: cr ? r.masa : mTot }
  }

  /** Pendiente (rad) del terreno en la dirección (ux, uy) desde la pose del robot; 0 en plano. */
  _theta(ux, uy, at = this.rpose) {
    const h = this.huerto
    if (!h.terreno?.pendiente || !h.z) return 0
    return Math.atan(h.z(at[0] + ux, at[1] + uy) - h.z(at[0], at[1]))
  }

  /** Factor de escala por velocidad máxima, frenada efectiva en bajada y tracción (0 = no puede avanzar). */
  _limitesFisicos(vx, vy) {
    const r = this.robotSpec,
      v = Math.hypot(vx, vy)
    let k = v > r.vMax ? r.vMax / v : 1
    const th = this._theta(vx / v, vy / v)
    const { mTot, mRobot, mFrena } = this._masas()
    // tracción: solo empujan las ruedas del robot
    const F = fuerzaAvance(mTot, th, this.p.energia),
      lim = limiteTraccion(mRobot, th)
    if (F > this.maxPull) this.maxPull = F
    if (F > lim) {
      this.tractionTicks++
      return 0
    }
    // frenada: si el suelo no deja detenerse a tiempo (carro sin freno cuesta abajo), baja a velocidad lenta
    const aCtrl = this.p.ssm?.a ?? 1.5
    if (frenadaEfectiva(aCtrl, th, mFrena, mTot) < 0.3) k = Math.min(k, (this.p.ssm?.vSlow ?? 0.3) / v)
    return k
  }

  /** Energía del tick (sin regeneración) y movimiento del carro (remolque con enganche en el eje). */
  _energiaYCarro(a, b) {
    const dt = this.dt,
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      d = Math.hypot(dx, dy),
      v = d / dt
    const th = d > 1e-9 ? this._theta(dx / d, dy / d, a) : 0
    const acc = (v - this.vPrev) / dt
    this.vPrev = v
    this.energyJ += potencia(this._masas().mTot, v, acc, th, this.p.energia) * dt
    if (this.carro) {
      const cr = this.robotSpec.carro,
        hb = this.robotSpec.largo / 2
      const vf = dx * Math.cos(b[2]) + dy * Math.sin(b[2]) // avance en la dirección del cuerpo
      const tc = this.carro[2] + (vf / dt / cr.L) * Math.sin(b[2] - this.carro[2]) * dt
      const hx = b[0] - hb * Math.cos(b[2]),
        hy = b[1] - hb * Math.sin(b[2])
      this.carro = [hx - cr.L * Math.cos(tc), hy - cr.L * Math.sin(tc), tc]
    }
  }

  _carroInicial(cr) {
    const [x, y, th] = this.rpose,
      hb = this.robotSpec.largo / 2
    return [x - (hb + cr.L) * Math.cos(th), y - (hb + cr.L) * Math.sin(th), th]
  }

  /**
   * Monitorización de velocidad y separación (fase 3). Devuelve el factor de escala de la velocidad comandada:
   * 0 = parada de protección, (0, 1) = velocidad reducida, 1 = sin cambio.
   * Como en ISO/TS 15066, la velocidad que cuenta es la del robot HACIA cada trabajador (componente de acercamiento,
   * ≥ 0): alejarse o pasar de lado no agranda la distancia exigida. Un trabajador a distancia d es seguro si
   * d ≥ S_p(v_c) + v_c·dt (el término v_c·dt cubre lo que el robot se acerca dentro del tick).
   */
  _ssmScale(vx, vy) {
    let s = this.p.ssm
    // huertos generados: frenada efectiva = mínimo entre lo que decide el control (a) y lo que permite el suelo
    // (adherencia de las ruedas que frenan; cuesta abajo resta g·senθ). Piso 0,3 m/s²: por debajo, el robot ya va
    // a velocidad lenta (_limitesFisicos)
    if (this.robotSpec && Math.hypot(vx, vy) > 1e-9) {
      const v = Math.hypot(vx, vy)
      const { mTot, mFrena } = this._masas()
      s = { ...s, a: Math.max(0.3, frenadaEfectiva(s.a, this._theta(vx / v, vy / v), mFrena, mTot)) }
    }
    const dt = this.dt,
      [rx, ry] = this.rpose
    const vCmd = Math.hypot(vx, vy)
    const kSlow = vCmd > s.vSlow ? s.vSlow / vCmd : 1
    const near = this.W.map((w) => {
      const dx = w.pose[0] - rx,
        dy = w.pose[1] - ry,
        d = Math.hypot(dx, dy)
      // velocidad de acercamiento con la velocidad comandada completa (a escala k se acerca k·vc)
      const vc = d > 1e-9 ? Math.max(0, (vx * dx + vy * dy) / d) : vCmd
      return { d, vc, attending: ATTENDING.has(w.state) }
    })
    const safe = (k) => near.every((q) => q.attending || q.d >= protectionDistance(k * q.vc, s) + k * q.vc * dt)
    // reanudación: el campo de protección (a velocidad lenta) debe estar libre durante tResume
    if (this.ssmStopped) {
      this.ssmClear = safe(kSlow) ? this.ssmClear + dt : 0
      if (this.ssmClear + 1e-9 < s.tResume) return 0
      this.ssmStopped = false
    }
    // campo de advertencia: cualquiera (también quien viene a cargar) dentro de S_p(v_c) + margen → velocidad lenta
    const k = near.some((q) => q.d < protectionDistance(q.vc, s) + s.warn) ? kSlow : 1
    // campo de protección: parada
    if (!safe(k)) {
      this.ssmStopped = true
      this.ssmClear = 0
      this.ssmStops++
      return 0
    }
    return k
  }

  step() {
    if (this.idx >= this.N - 1) return false
    this.idx += 1
    if (this.cosecha) this.cosecha.t = this.idx * this.dt
    for (const w of this.W) this._stepWorker(w)
    if (this.p.robot) this._stepRobot()
    if (this.acopio) this.acopio.step(this.idx * this.dt)
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
      TotalHumanWorkload_kcal: maxOf(rec.work),
      TotalProductionCargoZone_crop_units: V4,
      RemainingCropsHumanBags_crop_units: V5,
      RemainingCropsBoxes_crop_units: V5a1,
      RemainingCropsRobot_crop_units: V6,
      TotalRecollectedCrops_crop_units: V4 + V5 + V5a1 + V6,
      handoffs: this.handoffCount,
      waypointSkips: this.skips,
      capacityBlocked: this.capacityBlocked,
      ...(this.p.ssm?.enabled ? { safetyStops: this.ssmStops } : {}),
      ...(this.cosecha?.carga ? resumenCarga(this.cosecha, this.W, this.rec.wst, this.dt) : {}),
      ...(this.acopio ? resumenAcopio(this.acopio, this.rec.rst ? this.rec.rst.filter((v) => v === 6).length * this.dt : 0, this.rec.t.length) : {}),
      ...(this.robotSpec
        ? {
            robot: this.p.robotTipo,
            energyWh: this.energyJ / 3600,
            batteryPct: 100 * Math.max(0, 1 - this.energyJ / 3600 / this.p.energia.bateriaWh),
            unloads: this.ev.unloads.filter((u) => u.amount > 0).length,
            tractionLimited_s: this.tractionTicks * this.dt,
            maxPull_N: this.maxPull,
            tractionLimit_N: limiteTraccion(this.robotSpec.masa, 0),
          }
        : {}),
    }
  }
}
