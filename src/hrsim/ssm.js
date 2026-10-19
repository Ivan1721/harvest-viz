// Monitorización de velocidad y separación (SSM, ISO/TS 15066 adaptada a robot móvil, campos como ISO 3691-4).
// Fase 2: solo se usa para MEDIR cuánto se infringiría la norma (no cambia el motor).
// Fase 3: la misma fórmula decidirá la parada y la velocidad reducida del perfil `hri`.
// Valores por defecto y fuentes: documento «Especificación del modelo HRI (fases 2 y 3)».
export const SSM_DEFAULTS = Object.freeze({
  vh: 1.6, // velocidad humana supuesta, m/s (ISO 13855)
  Tr: 0.1, // tiempo de reacción del sistema, s (Campomaggiore et al. 2019)
  a: 1.5, // desaceleración de frenado, m/s² (supuesto, a confirmar para el Warthog)
  C: 0.2, // intrusión antes de detectar, m
  Zd: 0.107, // incertidumbre de posición del trabajador, m
  Zr: 0.1, // incertidumbre de posición del robot, m (supuesto)
  warn: 1.0, // margen del campo de advertencia más allá de S_p, m
  vSlow: 0.3, // velocidad en el campo de advertencia, m/s
  tResume: 1.0, // tiempo libre antes de reanudar, s
})

/** Distancia de protección S_p(v_r) = v_h (T_r + v_r/a) + v_r T_r + v_r²/(2a) + C + Z_d + Z_r  [m] */
export function protectionDistance(vr, s = SSM_DEFAULTS) {
  const v = Math.max(0, vr)
  return s.vh * (s.Tr + v / s.a) + v * s.Tr + (v * v) / (2 * s.a) + s.C + s.Zd + s.Zr
}
