# Simulador Workload en el navegador

El modo Workload puede **ejecutar** las simulaciones (no solo reproducir CSV): `Fuente → Simulador`. Corre en un Web Worker
(`src/hrsim/sim.worker.js`); 45 min con 12 trabajadores toman ≈0,5 s, así que cualquier combinación nw/fila/actividad/RP se
simula al instante y los parámetros se pueden cambiar en el panel «Simulador → Parámetros».

## Qué replica
Réplica fiel del modelo MATLAB (`HumanRobot_Sim.m`, `HumanOnly_Sim.m`) con el protocolo del estudio (`STUDY_HANDLING`):
`worker_loads`, carga 3,6 s/caja, descarga 1,44 s/caja, capacidad 68 cajas × 15 u, timeout de waypoint 60 s, máx. 10 paradas
por vuelta, colocación `tree_point`, inserción de cajas `distance_sorted`, tick 0,25 s, sin evasión de obstáculos.
El robot usa el FIS `Robot_HRI_NEW_GoalSeeking_V3.fis` (parser Mamdani propio en `src/hrsim/fis.js`) y cinemática de
dirección delantera (FourWheelSteering). Código: `common.js` (parámetros), `engine.js` (HR), `humanonly.js` (HO), `toRun.js`
(convierte la simulación en el objeto `run` del visor, con trayectorias exactas por tick).

## Validación (métricas agregadas)
| Prueba | Resultado |
|---|---|
| Solo humano, resúmenes de MATLAB (`scripts/sim_batch_compare.mjs`) | 366/366 configuraciones idénticas |
| Humano-robot, resúmenes de MATLAB | 352/360 idénticas; 8 con desfase de 1 tick en un traspaso raro (p. ej. 6-3-mixta: 1319,0298 vs 1319,0250 kcal) |
| Corrida de ejemplo (series por tick) | 0 discrepancias en trabajo, producción, bandera, a bordo y entregado |

La pestaña **Validación** compara en vivo el simulador con `public/data/matlab_summary.json` (generado con
`scripts/build_matlab_summary.mjs` desde los CSV resumen de MATLAB, 720 configuraciones).

## Hallazgo de reproducibilidad
El `*_timeseries.csv` de ejemplo (`public/data`) se generó con costo de **bajar escalera = 0,106145 kcal/s** (=0,0923×1,15),
mientras que el script actual y los CSV resumen usan **0,0923**. Con 0,106145 el simulador reproduce el ejemplo al bit
(`LD=0.106145 node scripts/sim_compare.mjs`). Conviene fijar cuál es el valor oficial.

## Pendiente
Calibrar contra métricas agregadas con parámetros libres, depurar las 8 configuraciones HR con desfase, validar trayectorias
con el parche de poses de MATLAB (`EXPORT_POSE_LOG`, sección 0 de `HumanRobot_Sim.m`) y reformular el modelo sobre la base calibrada.
