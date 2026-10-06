// Datos del huerto: generación sintética, carga/exportación JSON, oclusión por punto de vista.
// `orchard` es un objeto mutable: loadOrchard() reemplaza su contenido en sitio.

function rng(seed) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

export const VIEW_DIST = 0.75
export const orchard = { trees: [], leaves: [], fruits: [], source: 'sintético' }

function segBlocked(a, b, s) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]
  const fx = a[0] - s.x, fy = a[1] - s.y, fz = a[2] - s.z
  const A = dx * dx + dy * dy + dz * dz
  const B = 2 * (fx * dx + fy * dy + fz * dz)
  const C = fx * fx + fy * fy + fz * fz - s.r * s.r
  let disc = B * B - 4 * A * C
  if (disc < 0) return false
  disc = Math.sqrt(disc)
  const t1 = (-B - disc) / (2 * A)
  const t2 = (-B + disc) / (2 * A)
  return t1 < 1 && t2 > 0
}

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

// 25 direcciones candidatas en un hemisferio alrededor del eje 'axis'
function hemisphere(axis) {
  const a = norm(axis)
  const helper = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const u = norm(cross(a, helper))
  const w = cross(a, u)
  const dirs = [{ dir: a, theta: 0, phi: 0 }]
  ;[[25, 8], [50, 8], [70, 8]].forEach(([deg, n]) => {
    const th = (deg * Math.PI) / 180
    for (let i = 0; i < n; i++) {
      const ph = (i / n) * Math.PI * 2
      dirs.push({
        theta: th, phi: ph,
        dir: [0, 1, 2].map((k) => a[k] * Math.cos(th) + (u[k] * Math.cos(ph) + w[k] * Math.sin(ph)) * Math.sin(th)),
      })
    }
  })
  return dirs
}

const clamp01 = (x) => Math.max(0, Math.min(1, x))
const hash = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x) }

// Calcula vistas y oclusión de un fruto. Usa trazado de rayos contra hojas y otros frutos,
// o bien valores aportados por el usuario (views / occ).
function computeFruit(f, leaves, fruits, idx) {
  const axis = [0, 0.25, -f.side]
  const dirs = hemisphere(axis)

  if (Array.isArray(f.views) && f.views.length) {
    // vistas aportadas: {pos:[x,y,z], occ:0..1}; theta/phi se derivan del eje
    const a = norm(axis)
    f.views = f.views.map((v) => {
      const d = norm([v.pos[0] - f.x, v.pos[1] - f.y, v.pos[2] - f.z])
      const th = Math.acos(Math.max(-1, Math.min(1, d[0] * a[0] + d[1] * a[1] + d[2] * a[2])))
      return { pos: v.pos, occ: clamp01(v.occ ?? 0), theta: v.theta ?? th, phi: v.phi ?? 0 }
    })
  } else if (typeof f.occ === 'number' && !leaves.length) {
    // solo oclusión media: se sintetizan vistas con variación determinista
    f._keepOcc = true
    f.views = dirs.map((d, i) => ({
      pos: [f.x + d.dir[0] * VIEW_DIST, f.y + d.dir[1] * VIEW_DIST, f.z + d.dir[2] * VIEW_DIST],
      occ: clamp01(f.occ + (hash(idx + 1, i) - 0.5) * 0.9 + d.theta * 0.15 - 0.05),
      theta: d.theta, phi: d.phi,
    }))
  } else {
    const blockers = [
      ...leaves.filter((l) => l.tree === f.tree && Math.hypot(l.x - f.x, l.y - f.y, l.z - f.z) > l.r + 0.1),
      ...fruits.filter((o) => o !== f).map((o) => ({ x: o.x, y: o.y, z: o.z, r: o.r })),
    ]
    f.views = dirs.map((d) => {
      const pos = [f.x + d.dir[0] * VIEW_DIST, f.y + d.dir[1] * VIEW_DIST, f.z + d.dir[2] * VIEW_DIST]
      const toV = norm(d.dir)
      const p1 = norm(cross(toV, [0, 1, 0]))
      const p2 = cross(toV, p1)
      const offs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
      let blocked = 0
      offs.forEach(([a, b]) => {
        const tgt = [0, 1, 2].map((k) => (k === 0 ? f.x : k === 1 ? f.y : f.z) + toV[k] * f.r * 0.8 + (p1[k] * a + p2[k] * b) * f.r * 0.7)
        if (blockers.some((s) => segBlocked(pos, tgt, s))) blocked++
      })
      return { pos, occ: blocked / offs.length, theta: d.theta, phi: d.phi }
    })
  }

  const mean = f.views.reduce((s, v) => s + v.occ, 0) / f.views.length
  let bi = 0
  f.views.forEach((v, i) => {
    if (v.occ + v.theta * 0.02 < f.views[bi].occ + f.views[bi].theta * 0.02) bi = i
  })
  if (!f._keepOcc) f.occ = mean
  f.bestIdx = bi
  f.best = f.views[bi]
}

function assign(fruits) {
  const sorted = [...fruits].sort((a, b) => a.occ - b.occ)
  const thr = fruits.length < 6 ? 0.55 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.68))].occ
  fruits.forEach((f) => {
    if (f.assigneeFixed) return
    f.assignee = f.occ > thr ? 'human' : 'robot'
  })
}

export function generateOrchard() {
  const r = rng(11)
  const trees = [], leaves = [], fruits = []
  ;[-1, 1].forEach((side) => {
    for (let i = 0; i < 4; i++) {
      const cx = -4.8 + i * 3.2 + (r() - 0.5) * 0.3
      const cz = side * 2.5
      const tree = { id: trees.length, cx, cz, cy: 1.9, R: 1.25, side }
      trees.push(tree)
      for (let k = 0; k < 40; k++) {
        let p
        do p = [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1]
        while (p[0] ** 2 + p[1] ** 2 + p[2] ** 2 > 1)
        leaves.push({
          tree: tree.id,
          x: cx + p[0] * tree.R * 0.95, y: tree.cy + p[1] * tree.R * 0.95, z: cz + p[2] * tree.R * 0.95,
          r: 0.36 + r() * 0.24,
        })
      }
      // follaje exterior colgante hacia el carril (aumenta la oclusión de vistas frontales)
      for (let k = 0; k < 10; k++) {
        const az = (r() - 0.5) * 2.2
        const el = (r() - 0.45) * 1.3
        const rad = 1.0 + r() * 0.4
        leaves.push({
          tree: tree.id,
          x: cx + Math.sin(az) * Math.cos(el) * rad,
          y: tree.cy + Math.sin(el) * rad,
          z: cz - side * Math.cos(az) * Math.cos(el) * rad,
          r: 0.2 + r() * 0.1,
        })
      }
      for (let k = 0; k < 6; k++) {
        const az = (r() - 0.5) * 1.8
        const el = (r() - 0.35) * 1.1
        const rad = 0.6 + r() * 0.55
        const dir = [Math.sin(az) * Math.cos(el), Math.sin(el), -side * Math.cos(az) * Math.cos(el)]
        fruits.push({
          id: `FR-${String(fruits.length + 1).padStart(2, '0')}`,
          tree: tree.id, side,
          x: cx + dir[0] * rad, y: tree.cy + dir[1] * rad, z: cz + dir[2] * rad,
          r: 0.13,
        })
      }
    }
  })
  fruits.forEach((f, i) => computeFruit(f, leaves, fruits, i))
  assign(fruits)
  Object.assign(orchard, { trees, leaves, fruits, source: 'sintético' })
}

// ---------------- Carga / exportación JSON ----------------
// Formato mínimo:
// { "fruits": [ { "id":"F1", "x":0.5, "y":1.8, "z":-1.4, "occ":0.35 } ] }
// Opcionales por fruto: r, side(+1/-1), tree, assignee ("robot"|"human"),
//   views:[{ "pos":[x,y,z], "occ":0..1 }]  (puntos de vista y su oclusión medidos)
// Opcionales globales: trees:[{id,cx,cz,cy,R}], leaves:[{tree,x,y,z,r}]
export function loadOrchard(json) {
  if (!json || !Array.isArray(json.fruits) || json.fruits.length === 0) {
    return { ok: false, msg: 'El JSON debe tener un arreglo "fruits" no vacío.' }
  }
  const fruits = []
  for (let i = 0; i < json.fruits.length; i++) {
    const s = json.fruits[i]
    if (![s.x, s.y, s.z].every((v) => Number.isFinite(v))) {
      return { ok: false, msg: `Fruto #${i + 1}: x, y, z deben ser números.` }
    }
    if (s.views && !s.views.every((v) => Array.isArray(v.pos) && v.pos.length === 3 && v.pos.every(Number.isFinite))) {
      return { ok: false, msg: `Fruto #${i + 1}: cada vista necesita pos:[x,y,z] numérico.` }
    }
    const f = {
      id: String(s.id ?? `FR-${String(i + 1).padStart(2, '0')}`),
      tree: s.tree ?? 0,
      side: s.side ? Math.sign(s.side) : s.z > 0 ? 1 : -1,
      x: s.x, y: s.y, z: s.z, r: Number.isFinite(s.r) ? s.r : 0.13,
    }
    if (Number.isFinite(s.occ)) f.occ = clamp01(s.occ)
    if (s.views) f.views = s.views
    if (s.assignee === 'robot' || s.assignee === 'human') { f.assignee = s.assignee; f.assigneeFixed = true }
    fruits.push(f)
  }
  const trees = Array.isArray(json.trees) ? json.trees.map((t, i) => ({ id: t.id ?? i, cx: t.cx, cz: t.cz, cy: t.cy ?? 1.9, R: t.R ?? 1.25, side: t.side ?? (t.cz > 0 ? 1 : -1) })) : []
  const leaves = Array.isArray(json.leaves) ? json.leaves : []
  fruits.forEach((f, i) => computeFruit(f, leaves, fruits, i))
  assign(fruits)
  Object.assign(orchard, { trees, leaves, fruits, source: 'JSON cargado' })
  return { ok: true, msg: `Cargados ${fruits.length} frutos${trees.length ? ` y ${trees.length} árboles` : ''}.` }
}

export function exportOrchard() {
  const r3 = (n) => Math.round(n * 1000) / 1000
  return {
    version: 1,
    trees: orchard.trees.map((t) => ({ id: t.id, cx: r3(t.cx), cz: r3(t.cz), cy: t.cy, R: t.R, side: t.side })),
    leaves: orchard.leaves.map((l) => ({ tree: l.tree, x: r3(l.x), y: r3(l.y), z: r3(l.z), r: r3(l.r) })),
    fruits: orchard.fruits.map((f) => ({
      id: f.id, tree: f.tree, side: f.side, x: r3(f.x), y: r3(f.y), z: r3(f.z), r: f.r, occ: r3(f.occ), assignee: f.assignee,
      views: f.views.map((v) => ({ pos: v.pos.map(r3), occ: r3(v.occ) })),
    })),
  }
}

generateOrchard()
