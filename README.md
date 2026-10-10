# HarvestView — maqueta 3D de cosecha humano-robot

Dos modos sobre un núcleo común (`src/shared`): **Workload** (reproduce y compara corridas del simulador MATLAB sobre el huerto real) y **Oclusión** (selección de punto de vista, nivel 2).

## Modo Workload
Reproduce en 3D las corridas del simulador MATLAB de `WorkloadProductionPaper` (huerto de 3 filas × 4 árboles, copa 3,25 m, mapa 29,7 × 25,8 m) y las compara.

**Interfaz.** Panel izquierdo: configuración (trabajadores, fila, actividad, disposición RP), vista (Solo humano / Humano-robot / Comparar), cámara (isométrica, cenital, lateral), color de los trabajadores (carga metabólica o actividad), capas de cortesía y ruta anticipada, y carga de archivos. Centro: una o dos escenas sincronizadas. Panel derecho: Resumen (tabla comparativa y gráficos con clic para saltar en el tiempo), Trabajadores, Interacción y Datos. Pie: línea de tiempo (×1 a ×120) y barra de proximidad robot–humano.

**Datos.** `public/data/manifest.json` lista las corridas incluidas (hoy: 12 trabajadores, fila 3, mixta, RP0, sesión de 45 min, solo humano y humano-robot). Desde la interfaz se pueden cargar otras: el `*_timeseries.csv` y, con robot, su `*_robot_status_log.txt`; el nombre debe seguir el patrón `HUMAN_ROBOT_12_ROW3_harv_mixed_RP0_…`. Todo se procesa en el navegador.
Se leen el paso de muestreo del CSV (1 s) y el índice de tick del log (0,25 s). Las entregas siguen el protocolo del estudio (`tree_point`: un punto de caja por árbol; el robot se detiene y el trabajador carga la caja).

**Posiciones reconstruidas.** Los CSV no guardan trayectorias. Los trabajadores se ubican en su posición base y viajan a su caja según las banderas de actividad (1 cosecha, 2 caminata, 3 caja, 4 baja escalera, 5 sube escalera); el robot se interpola linealmente entre eventos del log. Producción y carga de trabajo son datos exactos del simulador; las distancias y el rumbo no. Registrar la pose por tick en MATLAB las haría exactas.

**Robot.** Dimensiones reales del Clearpath Warthog (1,52 × 1,38 × 0,83 m, neumático de 0,61 m, holgura 0,254 m) y dirección diferencial: al girar, las ruedas de un lado ruedan más que las del otro. El simulador MATLAB usa un vehículo más grande (icono de 3,2 m, ruedas de 1 m, dirección 4WS); el visor prioriza el robot real porque el modelo se está reformulando. La capacidad (68 cajas × 15 u) es un parámetro del estudio.

### Análisis HRI (paso 2, etapa A)
Pestaña Interacción, con dos capas 3D opcionales (zonas de cortesía y ruta anticipada):
- **Cortesía**: zonas de proxemia (íntima < 0,45 m, personal < 1,2 m, social < 3,6 m) alrededor del robot; distancia mínima y tiempo en zona personal por trabajador. Los traspasos de caja no cuentan como invasión.
- **Encuentros**: robot–humano a menos de 1,5 m, con instante, trabajador, distancia mínima y veredicto (traspaso de caja, ambos en movimiento, robot debe ceder…); clic para saltar al instante.
- **Asignación**: espera de cada caja (detección → recogida), equidad entre trabajadores (índice de Jain) y atención fuera de orden de detección.
- **Ruta anticipada**: próximos 8 s del robot, verde / naranja / roja si se prevé conflicto; la barra de proximidad va sobre la línea de tiempo.

Limitaciones de la etapa A: posiciones reconstruidas (distancias aproximadas); el controlador del robot es el del simulador (sin evitación social); una réplica determinista por celda, por lo que las diferencias entre escenarios son descriptivas. La etapa B (simulador propio en JS para probar reglas) queda pendiente.

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
- src/data.js  generación, carga/exportación JSON, oclusión
- src/sim.js   estados robot/humano, estrategias de vista
- src/Scene.jsx escena 3D · src/App.jsx paneles
