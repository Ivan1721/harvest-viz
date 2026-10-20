// Robots disponibles en los huertos generados y modelo de energía. Especificación: «Especificación: robots y energía
// (antes de H5)». Datos de fabricante: Clearpath Warthog (clearpathrobotics.com/warthog) y Burro Gen 8 (ficha técnica);
// lo marcado como supuesto es editable.
//
// La réplica de MATLAB (mapa del estudio) no usa nada de esto: sigue con el Warthog de 68 cajas y sin energía.

export const G = 9.81
// adherencia neumático–suelo seco, para tracción y frenada. La especificación propuso 0,6; con 0,6 el Burro no subiría
// el 15 % con 250 kg que garantiza su ficha (hace falta ≥ 0,62), así que se usa 0,65
export const MU = 0.65

const ENERGIA_BASE = { crr: 0.08, eta: 0.43 } // calibrados con la autonomía publicada del Burro (16 km con 2,4 kWh)

export const ROBOTS = Object.freeze({
  warthog: {
    label: 'Warthog',
    ancho: 1.38,
    largo: 1.52,
    alto: 0.83,
    masa: 280,
    capacidad: 18, // cajas de 15 kg (carga útil 272 kg)
    vMax: 5, // 18 km/h
    energia: { ...ENERGIA_BASE, paux: 60, bateriaWh: 2400 }, // 48 V · 100 Ah AGM, 50 % utilizable (supuesto)
    carro: null,
  },
  burro: {
    label: 'Burro',
    ancho: 0.92,
    largo: 1.39,
    alto: 0.72,
    masa: 146,
    capacidad: 15, // carga útil 226 kg
    vMax: 2,
    energia: { ...ENERGIA_BASE, paux: 30, bateriaWh: 2400 }, // 24 V · 100 Ah LiFePO4
    carro: null,
  },
  'burro-carro': {
    label: 'Burro con carro',
    ancho: 0.92,
    largo: 1.39,
    alto: 0.72,
    masa: 146,
    capacidad: 26, // la fruta va en el carro: ≈ 390 kg (453 kg remolcados en total)
    vMax: 2,
    energia: { ...ENERGIA_BASE, paux: 30, bateriaWh: 2400 },
    // carro de arrastre continuo (supuestos): 60 kg vacío, sin freno propio; L = barra + medio carro desde el enganche
    carro: { masa: 60, largo: 1.2, ancho: 0.92, L: 1.5 },
  },
})

/**
 * Potencia que sale de la batería [W]:
 * P = max(0, m·g·(C_rr·cos θ + sen θ) + m·a)·v / η + P_aux   (sin regeneración).
 * @param {number} m masa total [kg]; v [m/s] ≥ 0; a [m/s²]; theta pendiente en la dirección de avance [rad]
 */
export function potencia(m, v, a, theta, e) {
  const F = m * G * (e.crr * Math.cos(theta) + Math.sin(theta)) + m * a
  return (Math.max(0, F) * Math.max(0, v)) / e.eta + e.paux
}

/** Fuerza que deben hacer las ruedas motrices para avanzar a velocidad constante [N]. */
export const fuerzaAvance = (mTot, theta, e) => mTot * G * (e.crr * Math.cos(theta) + Math.sin(theta))

/** Límite de tracción: solo las ruedas del robot empujan (el carro no tiene motor) [N]. */
export const limiteTraccion = (mRobot, theta) => MU * mRobot * G * Math.cos(theta)

/**
 * Desaceleración efectiva: lo que decide el control (aCtrl) acotado por lo que permite el suelo; cuesta abajo
 * (theta < 0 en la dirección de avance) resta g·sen|θ|. mFrena = masa sobre ruedas que frenan.
 */
export function frenadaEfectiva(aCtrl, theta, mFrena, mTot) {
  const suelo = MU * G * Math.cos(theta) * (mFrena / mTot) + G * Math.sin(theta) // sen θ < 0 bajando
  return Math.min(aCtrl, suelo)
}
