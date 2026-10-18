# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con [SemVer](https://semver.org/lang/es/).

## [0.6.0] — 2026-10-18

Migración de dependencias mayores (tanda 8 de la auditoría).

### Cambiado

- **React 19**, **react-three-fiber 9**, **drei 10** y **three.js 0.186**.
- **Vite 8** (Rolldown): el build pasa de ~25 s a ~1 s; `@vitejs/plugin-react` 6, jsdom 29.
- **ESLint 10** con `@eslint-react/eslint-plugin` (reemplaza a `eslint-plugin-react`, que no soporta ESLint 10) y `eslint-plugin-react-hooks` 7. Lint sin avisos: se corrigieron las 9 dependencias de hooks pendientes y un componente definido dentro de otro (`DataPanel`).
- **Stryker 10** con runner TAP y cobertura por prueba. El motor tiene su propia configuración (`npm run test:mutation:engine`) con un oráculo rápido de sesiones de 5 min (`tests/mutation/`); corre en ~25 min.
- Playwright 1.64, c8 12, cross-env 10, globals 17. Sombras con PCF (three.js retiró PCFSoft).

### Corregido

- Etiquetas de la escena (H1…, RB-01): `<Html>` de drei fallaba al desmontarse con React 19 (`removeChild`). Ahora una sola capa HTML por lienzo (`TagLayer`), sin una raíz de React por etiqueta.
- `ErrorBoundary` se reinicia con `getDerivedStateFromProps` (antes `setState` en `componentDidUpdate`).

## [0.5.0] — 2026-10-17

Correcciones de la auditoría profunda de la v0.4.0.

### Agregado

- **Motor 0.3.0:** opción `fixRecallLoop` (corrige el bucle de re-llamada de MATLAB; por defecto se replica), contador `capacityBlocked`.
- Cancelar la simulación y tiempo máximo de 120 s; topes de parámetros (`LIMITS`), de video, de CSV y de JSON de huerto, con mensajes claros.
- Pruebas: modo Oclusión (unitarias + property-based), reproducción, biblioteca, exportación, cliente del worker, VideoPanel, controles accesibles; invariantes de velocidad del robot, banderas de escalera y conservación a bordo.
- Dependabot (mensual) y caché de navegadores de Playwright en CI.

### Cambiado

- Cobertura medida sobre todo `src/**/*.js` con c8 (antes solo lo importado): ≈ 98 % de líneas, umbrales 96/90/92.
- Regresión contra MATLAB: 3 desviaciones conocidas (antes 8; 5 estaban dentro de la tolerancia normal), cada una con tope por métrica. Causa documentada en `docs/simulador.md`: empate de redondeo en `movePose`.
- El FIS satura las entradas fuera de rango, como `evalfis`.
- CI: un solo workflow; el despliegue a Pages espera a las pruebas de interfaz. Permisos mínimos, timeouts, concurrencia y acciones fijadas por SHA. Stryker también muta el motor (caché incremental); `bench --strict`.
- Visor: cajas con instancias; geometrías y materiales compartidos entre personas y escaleras; texturas liberadas al desmontar; frutos y copas esquemáticas sin sombra. La cámara conserva la vista del usuario al cambiar de tamaño (también al grabar video).
- Accesibilidad: pestañas con `role=tab` y flechas, grupos nombrados, `aria-pressed`, avisos con `role=alert` y botón de cierre, diálogo de video con foco inicial y Escape, contraste del naranja y del aviso.

### Corregido

- La escalera y el anillo del trabajador ya no se elevan con él.
- La animación de carga de cajas usaba ticks como segundos en corridas con `dt ≠ 1`.
- Tras grabar un video, el reloj de animación no volvía a su valor.
- El indicador «simulando» podía quedar activo al cambiar de fuente.
- Cifras de validación en la interfaz y en la documentación (360/360 Solo humano, 352/360 Humano-robot).

### Eliminado

- Código sin uso (`AvocadoTree`, `BigTree`, `DT`, `scripts/torun_test.mjs`) y estilos huérfanos.

## [0.4.0] — 2026-10-17

### Agregado

- **Exportar video (MP4):** panel «Video» y `npm run export:video`. Render cuadro a cuadro con tiempo fijo (fluido aunque el equipo sea lento), 720p a 4K, 30/60 fps, H.264 (respaldo VP9/AV1), vista Comparar en un solo video, con encabezado, reloj y etiquetas.
- Diagnóstico de rendimiento `?perf=1` y `npm run bench:visual` (FPS, p95, draw calls por estilo y vista; resultados en `bench/visual-*.json`).
- Parámetros de URL `?view=ho|hr|cmp` y `?speed=`.

### Cambiado

- Interpolación entre ticks: posición, altura y rumbo continuos (antes 4 posiciones/s; 1/s con CSV de MATLAB).
- Huerto con instancias (de ~43 llamadas de dibujo por árbol a 4 en total), sombras 2048 px, sin `preserveDrawingBuffer`. En el PC del laboratorio (GTX 1660 Ti), Realista · Comparar pasa de 46 a 80 FPS.

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
