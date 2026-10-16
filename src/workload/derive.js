// Series derivadas comunes a las corridas de MATLAB (run.js) y a las del simulador JS (hrsim/toRun.js).

/** Altura sobre la escalera por fila: sube durante la bandera 5, baja durante la 4, se mantiene entre medio. */
export function ladderHeights(flags, H = 1.7) {
  const n = flags.length,
    h = new Float32Array(n)
  let cur = 0,
    i = 0
  while (i < n) {
    const f = flags[i]
    if (f === 5 || f === 4) {
      const a = i
      while (i < n && flags[i] === f) i++
      const len = i - a
      for (let k = a; k < i; k++) h[k] = f === 5 ? H * ((k - a + 1) / len) : H * (1 - (k - a + 1) / len)
      cur = f === 5 ? H : 0
    } else {
      h[i] = cur
      i++
    }
  }
  return h
}

/** Tasa metabólica [kcal/s] en ventana móvil de `win` s a partir de la carga acumulada. Agrega muestras (1/s) a `samples`. */
export function metabolicRate(work, dt, samples, win = 10) {
  const n = work.length,
    W = Math.max(1, Math.round(win / dt)),
    rate = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const j = Math.max(0, i - W)
    rate[i] = i === j ? 0 : (work[i] - work[j]) / ((i - j) * dt)
  }
  if (samples) for (let i = W; i < n; i += Math.max(1, Math.round(1 / dt))) samples.push(rate[i])
  return rate
}

/** Escala de color: percentil 97 de las tasas muestreadas. */
export function rateScale(samples) {
  samples.sort((a, b) => a - b)
  return samples.length ? samples[Math.floor(samples.length * 0.97)] || 1 : 1
}
