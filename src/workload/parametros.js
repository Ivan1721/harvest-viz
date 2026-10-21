// Parámetros editables del simulador con su etiqueta, paso, fuente y rango válido. Los usan el panel de pasos
// (SimPanel) y la descripción del modelo (pestaña Modelo, ODD): una sola definición para ambos.
/* ---------------------------------------------------------------- parámetros del simulador */
// cuadrilla: [clave, etiqueta, paso, fuente/valor de MATLAB, mínimo válido, máximo válido]
export const CREW = [
  ['walkSpeed', 'Velocidad de caminata (m/s)', 0.05, 'MATLAB: 0,75', 0.05],
  ['ladderTime', 'Tiempo de escalera (s)', 0.5, 'MATLAB: 5', 0],
  ['loadTimePerBox', 'Carga al robot (s/caja)', 0.1, 'Protocolo: 3,6 (worker_loads)', 0],
  ['maxProd', 'Unidades por caja', 1, 'MATLAB: 15', 1],
  ['metabolicMultiplier', 'Multiplicador metabólico', 0.05, '1 = costos del script', 0],
]
// robot transportador
export const ROBOT = [
  ['unloadTimePerBox', 'Descarga del robot (s/caja)', 0.1, 'Protocolo: 1,44', 0],
  ['capacityBoxes', 'Capacidad del robot (cajas)', 1, 'Protocolo: 68', 1],
  ['maxBoxStopsPerLap', 'Paradas máx. por vuelta', 1, 'Protocolo: 10', 1],
  ['waypointTimeout', 'Tiempo máx. en waypoint (s)', 5, 'Protocolo: 60', 1],
  ['detectorRange', 'Alcance del detector (m)', 0.5, 'MATLAB: 3', 0.1],
  ['boxRouteOffset', 'Desvío de ruta a caja (m)', 0.1, 'MATLAB: 1,2', 0],
]
export const DURATION = ['duration', 'Duración (s)', 60, 'Estudio: 2700 (45 min) · máx. 14 400 (4 h)', 60, 14400]
export const COSTS = [
  ['walking', 'Caminar'],
  ['walkingCarrying', 'Caminar con caja'],
  ['harvestGround', 'Cosechar (suelo)'],
  ['harvestLadder', 'Cosechar (escalera)'],
  ['harvestPicker', 'Cosechar (gancho)'],
  ['ladderClimb', 'Subir escalera'],
  ['ladderDown', 'Bajar escalera'],
]
// regla de seguridad SSM (fase 3, solo perfil hri): [clave, etiqueta, paso, fuente, mínimo]
export const SSM = [
  ['vh', 'Velocidad humana supuesta v_h (m/s)', 0.1, 'ISO 13855: 1,6', 0.1],
  ['Tr', 'Tiempo de reacción T_r (s)', 0.05, 'Campomaggiore et al. 2019: 0,10', 0],
  ['a', 'Desaceleración de frenado a (m/s²)', 0.1, 'Supuesto: 1,5 (conservador: 1,0)', 0.1],
  ['C', 'Intrusión antes de detectar C (m)', 0.05, 'Campomaggiore et al. 2019: 0,20', 0],
  ['Zd', 'Incertidumbre del trabajador Z_d (m)', 0.01, 'Campomaggiore et al. 2019: 0,107', 0],
  ['Zr', 'Incertidumbre del robot Z_r (m)', 0.01, 'Supuesto: 0,10', 0],
  ['warn', 'Margen de advertencia (m)', 0.1, 'Supuesto: 1,0', 0],
  ['vSlow', 'Velocidad lenta (m/s)', 0.05, 'ISO 3691-4: 0,3', 0.05],
  ['tResume', 'Tiempo libre para reanudar (s)', 0.25, 'Supuesto: 1,0', 0],
]
// parámetros del generador de huertos (H2): [clave, etiqueta, paso, mínimo, máximo, entero]
export const HUERTO = [
  ['hileras', 'Hileras', 1, 2, 200, true],
  ['arbolesPorHilera', 'Árboles por hilera', 1, 2, 200, true],
  ['calle', 'Distancia entre hileras (m)', 0.5, 1, 20],
  ['sobreHilera', 'Distancia sobre la hilera (m)', 0.5, 0.5, 20],
  ['radioCopa', 'Radio de copa (m)', 0.1, 0.2, 9],
  ['altura', 'Altura del árbol (m)', 0.5, 0.5, 12],
  ['cargaArbol', 'Carga por árbol (kg)', 1, 0, 500],
  ['cabecera', 'Ancho de cabecera (m)', 0.5, 3, 20],
]
export const PERIODS = [
  [1, 'Suelo'],
  [2, 'Escalera'],
  [3, 'Gancho'],
]
// acopio con acopiador, bins y camión (H7, fase A): [clave, etiqueta, paso, fuente, mínimo, máximo, entero]
export const ACOPIO = [
  ['binKg', 'Capacidad del bin (kg)', 10, 'González-Araya et al. 2017: 379–386 kg (manzana)', 10, 2000],
  ['topeBins', 'Tope de bins llenos en el acopio', 1, 'Supuesto: 8', 1, 100, true],
  ['camionBins', 'Bins por camión', 1, 'Supuesto: 4 (tractor con carro)', 1, 60, true],
  ['viajeS', 'Viaje de ida y vuelta del camión (s)', 60, 'Supuesto: 2400 (40 min)', 60, 14400],
  ['intervaloS', 'El camión sale como máximo cada (s)', 60, 'Supuesto: 3600 (60 min)', 60, 14400],
  ['cargaBinS', 'Cargar un bin al camión (s)', 5, 'Supuesto: 90', 1, 3600],
]
