# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con [SemVer](https://semver.org/lang/es/).

## [0.3.0] — 2026-10-16

### Agregado

- Suite de pruebas completa (ver `docs/testing.md`): unitarias, invariantes, property-based (fast-check), metamórficas, analíticas, contratos de formato y fuzzing, rendimiento, componentes (Vitest), extremo a extremo y accesibilidad (Playwright + axe), multi-navegador, regresión visual, cobertura con umbral y mutación (Stryker).
- `npm run bench` (línea base en `bench/baseline.json`) y `npm run sensitivity` (elasticidades, `docs/sensibilidad.md`).
- Workflow semanal «Pruebas extendidas»; CI de PR con cobertura, componentes y E2E.
- `?look=schem` abre el visor en estilo Esquemático.

### Corregido

- Capacidad del robot con «unidades por caja» ≠ 15 (motor 0.2.1).
- Caída del simulador cuando el robot recoge la caja antes de que el trabajador llegue al punto de entrega.
- «Exportar corridas» descarga un único `.zip` (antes 6 descargas, bloqueadas por el navegador).
- Campos de parámetros: no aplican vacíos ni valores bajo su mínimo.
- CSV malformados: mensaje claro (`FormatError`); tolera BOM, CRLF y espacios.
- Accesibilidad: contraste (WCAG AA), etiqueta de la línea de tiempo, lista de Oclusión accesible por teclado.

## [0.2.0] — 2026-10-16

### Agregado

- Simulador en el navegador (`src/hrsim/`): réplica del modelo MATLAB Humano-robot y Solo humano en un Web Worker, con parámetros editables y pestaña Validación contra los resúmenes de MATLAB.
- Exportación de corridas simuladas: `*_timeseries.csv` (formato MATLAB, recargable), `*_poses.csv` y `*_meta.json` (parámetros, hash y versión del motor).
- Pruebas automáticas (`npm test`, `node:test`): regresión contra `public/data/matlab_summary.json`, FIS, determinismo y exportación. `npm run test:full` corre las 720 configuraciones.
- CI: el despliegue a GitHub Pages solo ocurre si lint y pruebas pasan; workflow de PR con lint, formato, pruebas y build.
- ESLint y Prettier; tipos JSDoc del motor (`SimParams`, `SimRecord`).
- ErrorBoundary por aplicación y por vista 3D.

### Cambiado

- Carga diferida de los modos Workload y Oclusión; three.js y react-three en chunks propios (antes un bundle de 1,1 MB).
- El Web Worker envía las series como typed arrays transferibles y una simulación nueva cancela la anterior.
- Estado de reproducción en `src/workload/playback.js` con suscripción (antes sondeo cada 200 ms); `WorkloadApp.jsx` dividido en `src/workload/panels/`.
- Series derivadas comunes en `src/workload/derive.js` (antes duplicadas en `run.js` y `toRun.js`).
- Imports relativos con extensión explícita (el motor corre en Node sin cargadores).
- Vite 6 (corrige vulnerabilidades del servidor de desarrollo).

### Conocido

- 8 de 366 configuraciones Humano-robot difieren de MATLAB por un desfase de 1 tick en un traspaso poco frecuente (lista en `tests/helpers.mjs`).

## [0.1.0] — 2026-10

- Visor 3D de corridas MATLAB (modo Workload) y modo Oclusión.
