// Pendiente (H4): velocidad de marcha y gasto metabólico al caminar en ladera, como factor sobre el valor en plano
// (en terreno plano los factores valen exactamente 1 y nada cambia).
//
// - Velocidad: función de marcha de Tobler (Tobler 1993, «Three presentations on geographical analysis and modeling»,
//   NCGIA Technical Report 93-1): v = 6·exp(−3,5·|S + 0,05|) km/h, S = pendiente como fracción (+ subiendo).
//   Se usa el cociente v(S)/v(0), así la velocidad en plano sigue siendo la del modelo (0,75 m/s).
// - Gasto: ecuación de Pandolf (Pandolf, Givoni y Goldman 1977, J. Appl. Physiol. 43(4):577–581), en W:
//   M = 1,5·W + 2·(W + L)·(L/W)² + η·(W + L)·(1,5·V² + 0,35·V·G), G en %. Se usa M(G)/M(0) a la misma velocidad
//   para escalar los costos de caminar de ISO 8996 del modelo. Pandolf no cubre bien la bajada: en bajada, factor 1.

export const PANDOLF = Object.freeze({ W: 70, carga: 15, eta: 1.1 }) // kg, kg (caja llena), suelo de tierra

/** Cociente de velocidad de Tobler v(S)/v(0). */
export const tobler = (S) => Math.exp(-3.5 * Math.abs(S + 0.05)) / Math.exp(-3.5 * 0.05)

/** Gasto de Pandolf [W]. */
export function pandolf(W, L, V, G, eta = PANDOLF.eta) {
  return 1.5 * W + 2 * (W + L) * (L / W) ** 2 + eta * (W + L) * (1.5 * V * V + 0.35 * V * G)
}

/** Factor de gasto al caminar en pendiente G [%] (subiendo > 0) a velocidad V [m/s], con o sin caja. */
export function factorGasto(G, V, cargando) {
  if (!(G > 0)) return 1
  const L = cargando ? PANDOLF.carga : 0
  return pandolf(PANDOLF.W, L, V, G) / pandolf(PANDOLF.W, L, V, 0)
}

/**
 * Paso de un trabajador hacia `target`: velocidad y factor de gasto según la pendiente del tramo.
 * Sin pendiente devuelve exactamente { v: walkSpeed, k: 1 }.
 */
export function paso(huerto, pose, target, walkSpeed, cargando = false) {
  const t = huerto?.terreno
  if (!t || !t.pendiente || !huerto.z) return { v: walkSpeed, k: 1 }
  const dx = target[0] - pose[0],
    dy = target[1] - pose[1],
    d = Math.hypot(dx, dy)
  if (d < 1e-9) return { v: walkSpeed, k: 1 }
  const S = (huerto.z(target[0], target[1]) - huerto.z(pose[0], pose[1])) / d
  const v = walkSpeed * tobler(S)
  return { v, k: factorGasto(S * 100, v, cargando) }
}
