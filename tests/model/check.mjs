// Invariantes que toda corrida debe cumplir, sea cual sea la configuración o los parámetros.
import assert from 'node:assert/strict'

const EPS = 1e-9
const nondecreasing = (a, what) => {
  for (let i = 1; i < a.length; i++) if (a[i] < a[i - 1] - EPS) assert.fail(`${what} disminuye en el tick ${i}: ${a[i - 1]} → ${a[i]}`)
}

export function checkInvariants(sim, { robot }) {
  const { rec, p, NH } = sim
  const n = rec.t.length
  assert.equal(n, Math.round(p.duration / p.dt) + 1, 'número de ticks')
  for (const k of robot ? ['delivered', 'work', 'onboard'] : ['delivered', 'work']) assert.equal(rec[k].length, n, `largo de ${k}`)
  // tiempo uniforme
  for (let i = 1; i < n; i++) assert.ok(Math.abs(rec.t[i] - rec.t[i - 1] - p.dt) < 1e-9, 'paso de tiempo')
  // acumulados que nunca bajan
  nondecreasing(rec.delivered, 'lo entregado')
  nondecreasing(rec.work, 'la carga del equipo')
  for (let h = 0; h < NH; h++) nondecreasing(rec.workH[h], `la carga de H${h + 1}`)
  // la carga del equipo es la suma de las cargas individuales
  for (let i = 0; i < n; i += 97) {
    let s = 0
    for (let h = 0; h < NH; h++) s += rec.workH[h][i]
    assert.ok(Math.abs(s - rec.work[i]) < 1e-6 * Math.max(1, s), 'suma de cargas')
  }
  for (let h = 0; h < NH; h++)
    for (let i = 0; i < n; i++) {
      const pr = rec.prod[h][i],
        f = rec.flag[h][i]
      if (!(pr >= 0 && pr <= p.maxProd)) assert.fail(`bolsa de H${h + 1} fuera de [0, ${p.maxProd}]: ${pr}`)
      if (!(f >= 0 && f <= 5)) assert.fail(`bandera inválida ${f}`)
      if ((f === 4 || f === 5) && sim.ladder[h] !== 1) assert.fail(`H${h + 1} no usa escalera pero tiene bandera ${f} en t=${rec.t[i]}`)
      const x = rec.wx[h][i],
        y = rec.wy[h][i]
      if (!(x >= 0 && x <= sim.huerto.limites.w && y >= 0 && y <= sim.huerto.limites.h)) assert.fail(`H${h + 1} fuera del mapa en t=${rec.t[i]}: (${x}, ${y})`)
    }
  if (robot) {
    const cap = p.capacityBoxes * p.maxProd
    const [om, vel] = sim.fis.outputs.map((o) => Math.max(...o.range.map(Math.abs)))
    const vBound = Math.hypot(vel, 0.5 * om * (p.frontLen + p.rearLen))
    for (let i = 0; i < n; i++) {
      const o = rec.onboard[i]
      if (!(o >= 0 && o <= cap + EPS)) assert.fail(`carga a bordo fuera de [0, ${cap}]: ${o}`)
      const x = rec.rx[i],
        y = rec.ry[i]
      if (!(x >= 0 && x <= sim.huerto.limites.w && y >= 0 && y <= sim.huerto.limites.h)) assert.fail(`robot fuera del mapa en t=${rec.t[i]}: (${x}, ${y})`)
      if (i === 0) continue
      // el robot no pierde fruta: lo que baja a bordo aparece como entregado en el mismo tick
      const dOn = o - rec.onboard[i - 1],
        dDel = rec.delivered[i] - rec.delivered[i - 1]
      if (dOn < -EPS && dDel <= EPS) assert.fail(`la carga a bordo baja sin entrega en t=${rec.t[i]}: ${rec.onboard[i - 1]} → ${o}`)
      if (o + rec.delivered[i] < rec.onboard[i - 1] + rec.delivered[i - 1] - EPS) assert.fail(`a bordo + entregado disminuye en t=${rec.t[i]}`)
      // velocidad acotada por las salidas del FIS (v ≤ vMax, deriva lateral ≤ ½·ωMax·L) y nula si está detenido
      const v = Math.hypot(x - rec.rx[i - 1], y - rec.ry[i - 1]) / p.dt
      if (v > vBound + 1e-9) assert.fail(`robot a ${v.toFixed(3)} m/s en t=${rec.t[i]} (máx. ${vBound.toFixed(3)})`)
      if (rec.rst[i] !== 0 && v > EPS) assert.fail(`robot detenido (estado ${rec.rst[i]}) pero se mueve en t=${rec.t[i]}`)
    }
  } else assert.equal(rec.onboard, undefined, 'sin robot no hay serie a bordo')
  // conservación: todo lo cosechado está en bolsas, cajas, robot o zona de carga
  const s = sim.summary()
  const parts =
    s.TotalProductionCargoZone_crop_units + s.RemainingCropsHumanBags_crop_units + s.RemainingCropsBoxes_crop_units + s.RemainingCropsRobot_crop_units
  assert.ok(Math.abs(parts - s.TotalRecollectedCrops_crop_units) < 1e-6, 'conservación (partes = total)')
  assert.ok(
    Math.abs(s.AverageHumanProduction_crop_units * NH - s.TotalRecollectedCrops_crop_units) < 1e-6,
    'conservación (cosechado por trabajadores = recolectado)',
  )
  assert.ok(Math.abs(s.TotalProductionCargoZone_crop_units - rec.delivered[n - 1]) < 1e-9, 'entregado final = serie')
  for (const [k, v] of Object.entries(s)) assert.ok(Number.isFinite(v), `${k} no es finito`)
}
