// Interpolación entre ticks: la simulación avanza en pasos de 0,25 s (1 s en los CSV de MATLAB),
// pero la pantalla dibuja a 60 Hz. Sin interpolar, los agentes se mueven "a saltos".

/** Índices y fracción para el instante t: valor = (1 − f)·serie[i] + f·serie[j]. */
export function sampleAt(n, dt, t) {
  const pos = Math.max(0, t / dt)
  const i = Math.min(n - 1, Math.floor(pos))
  const j = Math.min(n - 1, i + 1)
  return { i, j, f: j === i ? 0 : Math.min(1, pos - i) }
}

/** Ángulo interpolado por el giro más corto (sin vueltas de 360°). */
export function lerpAngle(a, b, f) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a))
  return a + d * f
}

/**
 * Posición interpolada de una pista intercalada (stride valores por tick: x, y, …).
 * `angleIdx` marca qué componente es un ángulo. Si entre dos ticks el salto supera `maxJump` m
 * (teletransporte, cambio de estado brusco), no se interpola: se mantiene el tick i.
 */
export function trackAt(track, stride, s, out, { angleIdx = -1, maxJump = 3 } = {}) {
  const a = s.i * stride,
    b = s.j * stride
  const jump = Math.hypot(track[b] - track[a], track[b + 1] - track[a + 1]) > maxJump
  const f = jump ? 0 : s.f
  for (let k = 0; k < stride; k++) out[k] = k === angleIdx ? lerpAngle(track[a + k], track[b + k], f) : track[a + k] + (track[b + k] - track[a + k]) * f
  return out
}
