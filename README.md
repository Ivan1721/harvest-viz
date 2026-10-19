# HarvestView — maqueta 3D de cosecha humano-robot

Dos modos sobre un núcleo común (`src/shared`): **Workload** (reproduce y compara corridas del simulador MATLAB sobre el huerto real) y **Oclusión** (selección de punto de vista, nivel 2).

## Modo Workload

**Simulador integrado:** además de reproducir corridas, `Fuente → Simulador` ejecuta en el navegador una réplica del modelo MATLAB con parámetros editables (ver `docs/simulador.md`).

Reproduce en 3D las corridas del simulador MATLAB de `WorkloadProductionPaper` (huerto de 3 filas × 4 árboles, copa 3,25 m, mapa 29,7 × 25,8 m) y las compara.

**Interfaz.** Panel izquierdo: configuración (trabajadores, fila, actividad, disposición RP), vista (Solo humano / Humano-robot / Comparar), cámara (isométrica, cenital, lateral), color de los trabajadores (carga metabólica o actividad), capas de cortesía y ruta anticipada, y carga de archivos. Centro: una o dos escenas sincronizadas. Panel derecho: Resumen (tabla comparativa y gráficos con clic para saltar en el tiempo), Trabajadores, Interacción y Datos. Pie: línea de tiempo (×1 a ×120) y barra de proximidad robot–humano.

**Datos.** `public/data/manifest.json` lista las corridas incluidas (hoy: 12 trabajadores, fila 3, mixta, RP0, sesión de 45 min, solo humano y humano-robot). Desde la interfaz se pueden cargar otras: el `*_timeseries.csv` y, con robot, su `*_robot_status_log.txt`; el nombre debe seguir el patrón `HUMAN_ROBOT_12_ROW3_harv_mixed_RP0_…`. Todo se procesa en el navegador.
Se leen el paso de muestreo del CSV (1 s) y el índice de tick del log (0,25 s). Las entregas siguen el protocolo del estudio (`tree_point`: un punto de caja por árbol; el robot se detiene y el trabajador carga la caja).

**Posiciones reconstruidas (corridas de MATLAB).** Los CSV no guardan trayectorias. Los trabajadores se ubican en su posición base y viajan a su caja según las banderas de actividad (1 cosecha, 2 caminata, 3 caja, 4 baja escalera, 5 sube escalera); el robot se interpola linealmente entre eventos del log. Producción y carga de trabajo son datos exactos del simulador; las distancias y el rumbo no. Con el simulador integrado las trayectorias son exactas por tick; MATLAB las exporta con `EXPORT_POSE_LOG` (`*_poses.csv`) junto con `*_meta.json` (versión del script y parámetros).

**Video.** El panel «Video» exporta la reproducción a MP4 (720p–4K, 30/60 fps) cuadro a cuadro, así que sale fluido en cualquier equipo; también desde la terminal: `npm run export:video -- --url http://localhost:4173/ --view cmp --from 0 --to 45 --speed 30 --res 1080 --fps 60 --channel chrome`. Para medir la fluidez: abrir con `?perf=1` o correr `npm run bench:visual`.

**Estilo visual.** Por defecto "Realista": palto Hass con fruta, suelo con textura, cielo, sombras y trabajadores con sombrero y bolsa de cosecha; el follaje es semitransparente y regulable. "Esquemático" conserva el aspecto sobrio para figuras. Medidas y fuentes en `docs/modelos_escenario.md`.

**Robot.** Dimensiones reales del Clearpath Warthog (1,52 × 1,38 × 0,83 m, neumático de 0,61 m, holgura 0,254 m) y dirección diferencial: al girar, las ruedas de un lado ruedan más que las del otro. El simulador MATLAB usa un vehículo más grande (icono de 3,2 m, ruedas de 1 m, dirección 4WS); el visor prioriza el robot real porque el modelo se está reformulando. La capacidad (68 cajas × 15 u) es un parámetro del estudio.

### Análisis HRI (paso 2, etapa A)

Pestaña Interacción, con dos capas 3D opcionales (zonas de cortesía y ruta anticipada):

- **Cortesía**: zonas de proxemia (íntima < 0,45 m, personal < 1,2 m, social < 3,6 m) alrededor del robot; distancia mínima y tiempo en zona personal por trabajador. Los traspasos de caja no cuentan como invasión.
- **Encuentros**: robot–humano a menos de 1,5 m, con instante, trabajador, distancia mínima y veredicto (traspaso de caja, ambos en movimiento, robot debe ceder…); clic para saltar al instante.
- **Asignación**: espera de cada caja (detección → recogida), equidad entre trabajadores (índice de Jain) y atención fuera de orden de detección.
- **Fluidez** (fase 2): reparto del tiempo del robot (en movimiento / esperando al trabajador / descargando), retardos en ambos sentidos (la caja espera al robot, el robot espera al trabajador), tiempo de cada trabajador atendiendo al robot y su equidad (Jain), y seguridad medida según ISO/TS 15066: tiempo y eventos con un trabajador dentro de la distancia de protección S_p(v) mientras el robot se mueve, distancia mínima y p5 en movimiento. En Cortesía, la exposición por zona se separa en robot en movimiento / detenido.
- **Regla de seguridad** (fase 3, perfil HRI): el robot va lento si alguien entra al campo de advertencia y se detiene si alguien (salvo quien viene a cargar) entra al de protección S_p(v_c); anillos en la escena 3D y marcas de parada en la línea de tiempo. Detalle en `docs/simulador.md`.
- **Ruta anticipada**: próximos 8 s del robot, verde / naranja / roja si se prevé conflicto; la barra de proximidad va sobre la línea de tiempo.

Limitaciones de la etapa A: posiciones reconstruidas (distancias aproximadas); el controlador del robot es el del simulador (sin evitación social); una réplica determinista por celda, por lo que las diferencias entre escenarios son descriptivas. La etapa B ya existe: el simulador propio en JS (`src/hrsim/`, `docs/simulador.md`) permite probar reglas y parámetros.

## Desarrollo

    npm install --include=dev
    npm run dev           # servidor local
    npm test              # modelo, datos y rendimiento (~30 s)
    npm run test:full     # + regresión completa: 720 configuraciones de MATLAB (~2 min)
    npm run test:components
    npm run test:e2e      # interfaz y accesibilidad en Chromium (requiere npm run build)
    npm run test:coverage # cobertura con umbral
    npm run bench         # rendimiento vs bench/baseline.json
    npm run sensitivity   # elasticidades de los parámetros
    npm run lint          # ESLint
    npm run format        # Prettier
    npm run build         # sitio estático en dist/

**Estructura.**

| Carpeta         | Contenido                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/hrsim/`    | Simulador (motor HR/HO, FIS, Web Worker, exportación) — sin dependencias de React                            |
| `src/workload/` | Modo Workload: app, escena 3D, lectura de CSV MATLAB, análisis HRI; `panels/` con los paneles de la interfaz |
| `src/shared/`   | Modelos 3D comunes y ErrorBoundary                                                                           |
| `tests/`        | Pruebas `node:test` (unit, model, data, perf) y de componentes (Vitest); guía en `docs/testing.md`           |
| `e2e/`          | Pruebas de interfaz, accesibilidad y visuales (Playwright)                                                   |
| `scripts/`      | Comparaciones y benchmark contra salidas de MATLAB fuera del repo                                            |
| `public/data/`  | Corridas de ejemplo y `matlab_summary.json` (referencia de la regresión)                                     |

**Idiomas.** Español, inglés y portugués, con el selector ES · EN · PT junto al selector de modo (se recuerda en el navegador; también `?lang=en`). El texto en español del código es la clave: los diccionarios están en `src/i18n/<idioma>/` y lo que falte se muestra en español. Para agregar un idioma, un diccionario nuevo y una entrada en `LANGS` (`src/i18n/index.js`).

**Sistemas de huerto.** En Simulador → Huerto: el mapa del estudio (réplica de MATLAB) o una palta tradicional de 1 ha generada (240 árboles, fruta que se agota, desplazamientos por calles); detalle en `docs/simulador.md`.

**Simulaciones guardadas.** Con `npm run dev`, cada simulación del visor se guarda en `simulaciones/` (carpeta local, fuera de git): `motor-<versión>/<config>_SIM-<hash>/` con los CSV de HO y HR en formato MATLAB, poses y `meta.json`, más `simulaciones/indice.csv` con una fila por simulación (métricas principales y, desde la fase 2, las de fluidez y seguridad: columnas `HR_robot_*`, `HR_espera_*`, `HR_atencion_media_s`, `HR_jain_*`, `HR_dentro_Sp_s`, `HR_eventos_Sp`, `HR_dist_*`). Una simulación repetida (misma versión del motor y mismos parámetros) no se duplica. Carpeta configurable con `HV_SIM_DIR`; `HV_SAVE_SIMS=0` lo desactiva. El sitio publicado, `vite preview`, las pruebas y GitHub Actions no guardan nada.

**Flujo de trabajo.** Cambios en una rama y Pull Request contra `main`: el workflow `CI` corre lint, formato, pruebas, cobertura, build e interfaz (Playwright). Al fusionar en `main` corre lo mismo y, solo si todo pasa, publica en GitHub Pages. Las acciones están fijadas por SHA y Dependabot propone actualizaciones mensuales. Si un cambio altera resultados del simulador, sube `ENGINE_VERSION` (`src/hrsim/common.js`) y anota el motivo en `CHANGELOG.md`. Para regenerar la referencia: `node scripts/build_matlab_summary.mjs <carpeta NuevaVersion>`.

**Copias del visor.** Este repositorio es la única fuente. `WorkloadProductionSim` lo incluye como submódulo en `viz/` (`git submodule update --remote viz` para actualizarlo).

# Modo Oclusión (nivel 2)

## Ejecutar

    npm install --include=dev
    npm run dev        # http://localhost:5173

## Qué hay

- Huerto 3D con robot (brazo 2 eslabones + cámara + pinza) y operario.
- Oclusión por punto de vista (25 candidatos en hemisferio) con trazado de rayos.
- **Selector de vista parametrizable**: costo = w1·oclusión + w2·movimiento + w3·extensión.
  Presets: Mín. oclusión / Mín. movimiento / Balanceada, o sliders (Personalizada).
  La tabla compara las estrategias sobre los frutos del robot.
- **Datos propios**: botón "Cargar JSON" (o arrastrar el archivo) y "Exportar".

## Formato JSON

    { "fruits": [ { "id": "F1", "x": 0.5, "y": 1.8, "z": -1.4, "occ": 0.35 } ] }

Por fruto (opcionales): `r` (radio, m), `side` (+1/-1, lado del carril), `tree`,
`assignee` ("robot"|"human"), `views`: [{ "pos":[x,y,z], "occ":0..1 }] con tus puntos de vista medidos.
Globales (opcionales): `trees`: [{id,cx,cz,cy,R}], `leaves`: [{tree,x,y,z,r}].

- Con `views`: se usan tal cual (tus oclusiones medidas).
- Con solo `occ` y sin `leaves`: se sintetizan 25 vistas alrededor de ese valor (aproximado).
- Con `leaves`: la oclusión se calcula por trazado de rayos.
- Coordenadas en metros; el robot avanza por el carril z=0 a lo largo de x.
  Usa "Exportar" para obtener un ejemplo completo.

## Archivos

- src/data.js generación, carga/exportación JSON, oclusión
- src/sim.js estados robot/humano, estrategias de vista
- src/Scene.jsx escena 3D · src/App.jsx paneles
