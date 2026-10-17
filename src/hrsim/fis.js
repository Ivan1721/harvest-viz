// Evaluador de sistemas difusos Mamdani en formato .fis (el de MATLAB Fuzzy Logic Toolbox).
// Réplica de evalfis para: and=min, or=max, imp=min, agg=max, defuzz=centroid, 101 puntos.
// Soporta trimf y trapmf, que son las funciones de pertenencia de los .fis del robot.

export function mfFn(type, p) {
  if (type === 'trimf') {
    const [a, b, c] = p
    return (x) => {
      const l = a === b ? (x >= a ? Infinity : -Infinity) : (x - a) / (b - a)
      const r = b === c ? (x <= c ? Infinity : -Infinity) : (c - x) / (c - b)
      return Math.max(Math.min(l, r), 0)
    }
  }
  if (type === 'trapmf') {
    const [a, b, c, d] = p
    return (x) => {
      const l = a === b ? (x >= a ? Infinity : -Infinity) : (x - a) / (b - a)
      const r = c === d ? (x <= d ? Infinity : -Infinity) : (d - x) / (d - c)
      return Math.max(Math.min(l, 1, r), 0)
    }
  }
  throw new Error('Función de pertenencia no soportada: ' + type)
}

export function parseFis(text) {
  const sys = { inputs: [], outputs: [], rules: [], numPoints: 101 }
  let sec = null,
    cur = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('%')) continue
    const hs = line.match(/^\[(.+)\]$/)
    if (hs) {
      sec = hs[1]
      cur = null
      if (/^Input\d+$/.test(sec)) {
        cur = { mfs: [] }
        sys.inputs.push(cur)
      } else if (/^Output\d+$/.test(sec)) {
        cur = { mfs: [] }
        sys.outputs.push(cur)
      }
      continue
    }
    if (sec === 'Rules') {
      const m = line.match(/^([\d\s-]+),\s*([\d\s-]+)\(([\d.eE+-]+)\)\s*:\s*(\d+)/)
      if (!m) continue
      sys.rules.push({
        ante: m[1].trim().split(/\s+/).map(Number),
        cons: m[2].trim().split(/\s+/).map(Number),
        w: parseFloat(m[3]),
        and: parseInt(m[4], 10) === 1,
      })
    } else if (cur) {
      const kv = line.match(/^(\w+)=(.*)$/)
      if (!kv) continue
      const [, k, v] = kv
      if (k === 'Name') cur.name = v.replace(/'/g, '')
      else if (k === 'Range') cur.range = v.replace(/[[\]]/g, '').trim().split(/\s+/).map(Number)
      else if (/^MF\d+$/.test(k)) {
        const mm = v.match(/^'([^']*)':'(\w+)',\[(.*)\]$/)
        cur.mfs.push(mfFn(mm[2], mm[3].trim().split(/\s+/).map(Number)))
      }
    }
  }
  // universo discretizado de cada salida (evalfis usa 101 puntos por defecto)
  for (const o of sys.outputs) {
    const [lo, hi] = o.range,
      n = sys.numPoints
    o.x = Float64Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1))
    o.mu = o.mfs.map((f) => Float64Array.from(o.x, f))
  }
  return sys
}

// Devuelve un arreglo con una salida por cada Output (en el orden del archivo)
export function evalFis(sys, inputs) {
  const nOut = sys.outputs.length
  const agg = sys.outputs.map((o) => new Float64Array(o.x.length))
  for (const r of sys.rules) {
    let s = r.and ? Infinity : -Infinity,
      any = false
    for (let i = 0; i < r.ante.length; i++) {
      const j = r.ante[i]
      if (!j) continue
      const x = inputs[i],
        [lo, hi] = sys.inputs[i].range
      // como evalfis de MATLAB: una entrada fuera de rango se satura al límite
      const mu = sys.inputs[i].mfs[j - 1](Math.min(hi, Math.max(lo, x)))
      s = r.and ? Math.min(s, mu) : Math.max(s, mu)
      any = true
    }
    if (!any) continue
    s *= r.w
    for (let o = 0; o < nOut; o++) {
      const j = r.cons[o]
      if (!j) continue
      const m = sys.outputs[o].mu[j - 1],
        a = agg[o]
      for (let k = 0; k < a.length; k++) {
        const v = Math.min(m[k], s)
        if (v > a[k]) a[k] = v
      }
    }
  }
  return sys.outputs.map((o, i) => {
    let num = 0,
      den = 0
    for (let k = 0; k < o.x.length; k++) {
      num += o.x[k] * agg[i][k]
      den += agg[i][k]
    }
    return den > 0 ? num / den : (o.range[0] + o.range[1]) / 2
  })
}
