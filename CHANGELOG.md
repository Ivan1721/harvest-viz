# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

## [0.10.0] — 2026-10-29

Interfaz del Simulador: los 3 problemas P1 de la crítica de Impeccable del 23-10 y los decimales y duraciones (P2). H8, fase B: la flota de robots en la interfaz (solo interfaz: el motor no cambia; con flota y Burro con carro registra además la pose del carro de cada robot). H8, fase C: el tramo de regreso del robot solo. Follaje de paltos más variado en calidad Alta (solo visual). **Motor 0.8.1**: cambian las corridas con un robot en palta alta densidad y ladera; la réplica de MATLAB no cambia. H8-exp: el lote de la flota (sin cambios en el motor ni en la interfaz).

### Agregado

- **Lote de la flota** (H8-exp): `experimentos/h8.json` y sus resultados en `experimentos/h8/` (4.518 corridas, motor 0.8.1): 1, 2 y 3 robots × zonas, opuestas y desfase × 6 huertos × Warthog y Burro con carro × avance del bloque 0, 50 y 80 % × 12 y 24 cosecheros, a 4 h, con 5 semillas; sensibilidad de las distancias de convivencia y desempate de estrategias con 5 semillas más. Hallazgos en el documento «H8: experimentos en lote»: donde un robot no alcanza (palta alta densidad y ladera), lo que llega al acopio pasa de 35–70 % de lo cosechado con 1 robot a 73–97 % con 2 y 94–96 % con 3; se recomienda zonas (gana en 32 de 144 comparaciones pareadas, opuestas en 1, desfase en ninguna; el resto, empate). Detalle en `docs/simulador.md` («Experimentos en lote (H8)»).
- **Lotes con flota** (`scripts/experimentos/`): columnas `robots`, `estrategia`, distancias de convivencia, `jain_cajas`, `espera_calle_s`, `cede_s`, `espera_acopio_s`, `estacionado_s`, `dist_min_calle_m` y `recorrido_m`; efecto contra 1 robot del mismo tipo (`efecto1_entregado_pct`, `efecto1_cosecha_pct`); `resumen.csv` con la media y el rango de las semillas de cada celda; bloques con `lista` de celdas en vez de `factores`. Con flota, las métricas de interacción salen de `analizarFlota`, como en el visor. Una caché con columnas de antes se reescribe al reanudar.
- **Follaje de paltos más variado** (calidad Alta, diseño «Follaje de paltos», etapa A): cuatro hojas distintas (adulta, ancha, joven con la base bronceada y vista por el envés) en un atlas de 2×2 racimos; cada tarjeta toma un racimo, un tinte según su altura y su lado de la copa, y la normal de la copa, así la copa se ilumina como un volumen y no como cartones. Luz del sol a través de la hoja, 8 paltos distintos en vez de 6 y, por árbol, ±6 % de tamaño y de brillo. Sin descargas nuevas: el atlas se dibuja en un canvas.
- **Flota de robots en la interfaz** (H8, fase B). Paso Agentes: «Cantidad de robots» (1·2·3) y «Cómo se reparten» (zonas, direcciones opuestas, desfase), solo en huertos generados; enlace `?robots=2&estrategia=opuestas`. La escena muestra todos los robots con su etiqueta (RB-01…RB-03), su color, su ruta vigente y anticipada y su carro; la lista y el detalle del robot son por robot, con su estado en cada instante. La pestaña Robot trae una columna por robot y el total de la flota (cajas, entregado, movimiento, esperas por calle, por cesión y en el acopio, recorrido, energía, batería), el equilibrio de cajas (Jain), las distancias entre robots y el detalle de la flota o de un robot. «Comparar con» → «Otra cantidad de robots». Exportar agrega las poses de los robots 2 y 3. Con flota, la geometría con las personas es hacia el robot más cercano y el resumen dice «de la flota».
- **Barra de «Simular»** fija al pie de la columna izquierda, siempre a la vista: botón principal solo con cambios sin simular («Hay 2 cambios sin simular: Cosecheros, Duración»), «Resultados al día» sin ellos y «Cancelar» mientras simula.
- **Atajo Ctrl+Enter** (⌘+Enter en Mac): simula desde cualquier parte del Simulador.
- El aviso de resultados desactualizados **nombra lo que cambió** (hasta 3 campos y «+N más»), y la escena 3D se atenúa hasta simular. Las tablas no se atenúan, para no bajar el contraste del texto.

### Corregido

- `?perf=1` en calidad Alta marcaba 1 llamada de dibujo y 1 triángulo: el posprocesado reinicia los contadores en cada pasada. Ahora se cuenta el cuadro entero (sombras y oclusión incluidas). `scripts/bench-visual.mjs` acepta `--query` para medir otros huertos y calidades.
- **Tramo de regreso del robot solo** (H8, fase C). Con un número impar de calles, la vuelta replanificada volvía de la cabecera al acopio en un solo tramo de ~100 m: el robot bajaba en diagonal entre las copas (hasta 3,1 m de la calle) al doble de la velocidad que lleva en las calles (61 s contra 124 s en 98 m). Con flota ya llevaba un waypoint cada 3 m (`densificar`); ahora también con un robot, en los huertos generados. **Motor 0.8.1.** La réplica de MATLAB y las huellas del motor no cambian. Cambian las corridas con un robot en palta alta densidad y ladera: lo entregado por corrida varía entre −2,6 % y +10,1 % (5 de 24 casos de prueba, 12 cosecheros, 4 h) y la media casi no se mueve (5 semillas en alta densidad: −1,6 % con Warthog, +2,4 % con Burro con carro, frente a una variación entre semillas de hasta el 25 % de la media). El lote de H7, repetido con el motor corregido, cambia 87 de sus 1.510 celdas con robot (alta densidad, y algunas de uva y arándano) y mantiene sus cuatro conclusiones: el límite de transporte en alta densidad pasa de 21–85 % a 21–91 % de lo cosechado, el efecto de alejar el bloque (Warthog, 45 min) de +33→+55 % a +33→+53 %, y el costo de la regla de seguridad de 3,9 a 1,4 puntos como máximo; el reparto y los resultados de cerezo y palta tradicional no cambian. `experimentos/h7/` conserva los resultados del motor 0.7.0.
- El Simulador decía que sus posiciones eran reconstruidas y aproximadas (pestañas Interacción y Datos, detalle del robot), aunque registra la pose exacta de cada agente cada 0,25 s. La nota depende ahora del origen de la corrida: «exactas» en el simulador, «reconstruidas» en las corridas de MATLAB.
- El punto «modificado» de los pasos no se encendía al cambiar cosecheros, actividad, fila o disposición, y «Restablecer» no los devolvía.
- Decimales con punto en Interacción y en el detalle (p. ej. «0.49 m» junto a «0,66»): todo número usa el formato del idioma. Las duraciones siguen una sola regla: «48 s», «12,5 min», «2 h 05 min».

## [0.9.0] — 2026-10-23

H8, fase A: flota de 2 o 3 robots transportadores en el motor. Escena 3D más realista, fases R1 (luz, suelo y selector de calidad), R2 (robot real) y R3 (paltos con hojas); solo visual. **Motor 0.8.0**. Sin la opción nueva nada cambia: la réplica de MATLAB y las corridas de H2–H7 dan exactamente lo mismo (las huellas de 10 configuraciones representativas coinciden al bit).

### Agregado

- **Paltos con hojas** (R3): en calidad Alta y en huertos de palto, racimos de hojas de palto dibujados en un canvas sobre la copa, ramas visibles, nivel de detalle según la distancia y la opacidad del follaje como densidad de racimos. Elegido frente a ez-tree con un prototipo (más fiel a la forma del palto Hass y ~58 frente a 15 cuadros/s con 1.125 árboles). Sin descargas ni dependencias nuevas.
- **Warthog real** (R2): en calidad Alta, el robot de la escena se arma con las mallas oficiales de Clearpath (BSD-3) según su URDF, con las ruedas girando; ~540 kB que solo se descargan en Alta. Lo genera `node scripts/warthog-glb.mjs`. El Burro sigue con el modelo simple.
- **Calidad de la escena** (R1 del diseño «escena 3D más realista»), en «Capas y estilo»: **Alta** agrega luz de cielo, niebla de distancia, sombras suaves, suelo con fotos CC0 de Poly Haven y sombreado de contacto (N8AO), con el follaje más opaco (80 %); **Básica** es la escena de siempre y es la de partida cuando el navegador dibuja WebGL por software. `?calidad=` la fija desde el enlace. El posprocesado y las fotos solo se descargan en Alta. No cambia ningún resultado.
- **Flota de robots** (`flota: { n, estrategia }`, solo huertos generados; todavía sin interfaz): estrategias zonas (por defecto), direcciones opuestas y desfase; reglas de convivencia (reserva de calle, cesión de paso, una descarga a la vez y cada caja con un solo robot), robots sin zona estacionados junto al acopio; estados del robot 7 «Espera calle libre» y 8 «Cede el paso»; medidas por robot y de la flota (`summary().flota`). En palta alta densidad (12 cosecheros, 4 h) llega al acopio el 94 % de lo cosechado con 2 robots en zonas, frente al 69 % con uno.

### Corregido

- Pruebas: la invariante «robot detenido no se mueve» trataba «velocidad reducida» (4) como detenido, la de «suma de cargas» no contaba al acopiador y la de «resumen finito» fallaba con los textos del resumen de los huertos generados. Ninguna corría en esos casos.
- CI: el job de interfaz superaba su límite de 25 min desde la migración de los runners a Ubuntu 26 (instalar las dependencias de Chromium pasó de 13 s a 12 min) y el sitio dejó de desplegarse. Ahora corre en la imagen oficial de Playwright (fijada por digest; `tests/unit/ci.test.mjs` revisa que siga la versión de `@playwright/test`), con runner `ubuntu-24.04` y 35 min de límite.
- La prueba de interfaz del enlace reproducible fallaba en el primer intento en CI: dibujar dos escenas de palta alta densidad sin GPU tomaba más de 60 s. Ahora usa palta tradicional.

### Cambiado

- Acciones de GitHub en Node 24 (checkout 7, setup-node 7, upload-artifact 7, cache 6, upload-pages-artifact 5, deploy-pages 5), con SHA verificados.
- `CLAUDE.md`: guía para Claude Code (comandos, arquitectura, flujo de trabajo y reglas del proyecto).

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
