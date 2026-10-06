# HarvestView — maqueta 3D de cosecha humano-robot

Dos modos sobre un núcleo común (`src/shared`): **Workload** (reproduce corridas del simulador MATLAB de WorkloadProductionPaper sobre el huerto real) y **Oclusión** (selección de punto de vista, nivel 2).

## Modo Workload
Carga `public/data/*_timeseries.csv` (+ `*_robot_status_log.txt`) de una corrida y la reproduce en 3D:
trabajadores coloreados por tasa metabólica (ventana 10 s) o por actividad, robot transportador con ruta,
cajas, zona de carga y gráfico de carga acumulada. Botón "Cargar corrida": elige el CSV (y el log) de cualquier corrida.
Geometría exacta de `scene_spec.json` (3 filas × 4 árboles, copa 3,25 m, mapa 29,7 × 25,8 m).
**Posiciones reconstruidas**: el CSV no guarda trayectorias; los trabajadores se ubican en su posición base y viajan a su caja
según las banderas de actividad (1 cosecha, 2 caminata, 3 caja, 4 baja escalera, 5 sube escalera); el robot se interpola entre eventos del log.

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
