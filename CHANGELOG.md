# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

H8, fase A: flota de 2 o 3 robots transportadores en el motor. Escena 3D más realista, fase R1: luz, suelo y selector de calidad (solo visual). **Motor 0.8.0**. Sin la opción nueva nada cambia: la réplica de MATLAB y las corridas de H2–H7 dan exactamente lo mismo (las huellas de 10 configuraciones representativas coinciden al bit).

### Agregado

- **Calidad de la escena** (R1 del diseño «escena 3D más realista»), en «Capas y estilo»: **Alta** agrega luz de cielo, niebla de distancia, sombras suaves, suelo con fotos CC0 de Poly Haven y sombreado de contacto (N8AO), con el follaje más opaco (80 %); **Básica** es la escena de siempre y es la de partida cuando el navegador dibuja WebGL por software. `?calidad=` la fija desde el enlace. El posprocesado y las fotos solo se descargan en Alta. No cambia ningún resultado.
- **Flota de robots** (`flota: { n, estrategia }`, solo huertos generados; todavía sin interfaz): estrategias zonas (por defecto), direcciones opuestas y desfase; reglas de convivencia (reserva de calle, cesión de paso, una descarga a la vez y cada caja con un solo robot), robots sin zona estacionados junto al acopio; estados del robot 7 «Espera calle libre» y 8 «Cede el paso»; medidas por robot y de la flota (`summary().flota`). En palta alta densidad (12 cosecheros, 4 h) llega al acopio el 94 % de lo cosechado con 2 robots en zonas, frente al 69 % con uno.

### Corregido

- Pruebas: la invariante «robot detenido no se mueve» trataba «velocidad reducida» (4) como detenido, la de «suma de cargas» no contaba al acopiador y la de «resumen finito» fallaba con los textos del resumen de los huertos generados. Ninguna corría en esos casos.

## [0.8.0] — 2026-10-21

H7: logística del acopio, carga de los árboles y reparto de la cuadrilla, con un lote de 2.000 corridas que revisa los hallazgos de H6. **Motor 0.7.0**. La réplica de MATLAB no cambia. Cambian las corridas con las opciones nuevas y, por la corrección de la ruta del robot, las corridas con robot en huertos generados donde la cuadrilla cambia de calles (alta densidad y ladera desde la primera hora).

### Agregado

- **Acopio con acopiador y camión** (H7, fase A), opcional en el paso Escenario: cola por orden de llegada, bins de 380 kg con tope, camión que sale lleno o cada 60 min; estados «Espera en el acopio» del cosechero (16) y del robot (6), «Despachado en camión» en el Resumen, bins y camión en la escena.
- **Carga variable por árbol y ritmo que cae** (H7, fase B), opcional en huertos generados: carga lognormal por árbol (misma carga total), periodo que crece al vaciarse el lado (Roka y Hyman 2008) y regla para dejar el árbol a 2 × T₀; «Fruta dejada en los árboles» en el Resumen y ritmo real por cosechero en Personas. La calibración de H2–H5 se mantiene.
- **Reparto de la cuadrilla** (H7, fase C): «cerca del acopio» (de siempre), «frente» (uno por calle, tramos cortos, el frente avanza) y «repartida» (calles espaciadas a todo el ancho).
- **Avance del bloque** (H7, fase C): parte del huerto ya cosechada en días anteriores; la cuadrilla parte más lejos del acopio.
- **Estado de las plantas** en la escena (cosechada, en curso, pendiente), caminata por cosechero y calles recorridas por el robot.
- **Lote de experimentos de H7** (`experimentos/h7.json`, resultados en `experimentos/h7/`): acopiador y carga variable, avance del bloque, reparto y costo de la regla de seguridad; columnas nuevas en el CSV.

### Corregido

- La ruta del robot se fijaba al inicio con las calles ocupadas; cuando la cuadrilla se cambiaba de calles, el robot seguía recorriendo las vacías. Ahora se recalcula al terminar cada vuelta.

## [0.7.0] — 2026-10-20

De la réplica de MATLAB a un simulador de sistemas de cosecha: métricas de interacción, seguridad, huertos generados, robots y experimentos en lote. **Motor 0.4.0** (los huertos generados cambian resultados desde la 0.3.0; la réplica de MATLAB no cambia y sigue pasando sus 720 configuraciones).

### Agregado

- **Métricas de fluidez y seguridad** (fase 2): reparto del tiempo del robot, esperas de cajas y del robot, atención y su equidad (Jain), tiempo dentro de S_p(v) (ISO/TS 15066) con velocidad de acercamiento direccional.
- **Perfil `hri`** con regla de seguridad SSM (fase 3): parada y velocidad reducida según S_p(v), paradas marcadas en la línea de tiempo.
- **Huertos generados** (H2–H5): palta tradicional, palta alta densidad, palta en ladera (Tobler y Pandolf), uva en parrón, arándano y cerezo UFO, con fruta finita por planta, tramos por cosechero y caminos por calles y cabeceras.
- **Robots y energía**: Warthog, Burro y Burro con carro; potencia, batería, tracción y frenada según la pendiente.
- **Interfaz en modos y pasos** (I1): Simulador, Réplica MATLAB y Oclusión; pasos Escenario → Agentes → Simulación; un solo disparador con aviso de resultados desactualizados; barra de vista sobre la escena.
- **Variabilidad entre cosecheros** (H6): `semilla` opcional que da a cada cosechero su ritmo (±10 %); sin ella todo sigue determinista.
- **Experimentos en lote** (H6): `npm run experimentos -- experimentos/h6.json`, en paralelo y con caché; resultados del diseño de H6 en `experimentos/h6/` (1316 celdas).

### Corregido

- Un cosechero sin tramo libre que llenaba una caja hacía caer la simulación (`Cosecha.drop`); ahora deja la caja donde trabajó por última vez. Se vio con 24 cosecheros durante 4 h en alta densidad.

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
