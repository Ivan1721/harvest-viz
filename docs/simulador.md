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

| Prueba                                                                              | Resultado                                                                                                                               |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Solo humano, resúmenes de MATLAB (`npm run test:full`, `scripts/bench_compare.mjs`) | 366/366 configuraciones idénticas                                                                                                       |
| Humano-robot, resúmenes de MATLAB                                                   | 358/366 idénticas; 8 con desfase de 1 tick en un traspaso raro (carga ≤ 0,03 %; solo 7-3-mixta-RP0 cambia lo entregado: 3075 vs 3045 u) |
| Corrida de ejemplo (series por tick)                                                | 0 discrepancias en trabajo, producción, bandera, a bordo y entregado                                                                    |

La pestaña **Validación** compara en vivo el simulador con `public/data/matlab_summary.json` (generado con
`scripts/build_matlab_summary.mjs` desde los CSV resumen de MATLAB, 720 configuraciones).

## Pruebas

`npm test` corre una muestra fija de la regresión (1 de cada 12 configuraciones + las 8 desviaciones conocidas) más pruebas del FIS, determinismo y exportación; `npm run test:full` corre las 720. El despliegue a GitHub Pages se bloquea si fallan. Las desviaciones conocidas están en `tests/helpers.mjs` con tolerancia propia: si se corrige la causa, hay que sacarlas de la lista.

## Rendimiento

Node 22, 1 hilo: HO ≈ 20 ms y HR ≈ 240 ms por sesión de 45 min (máx. 410 ms con 24 trabajadores); las 732 configuraciones en 97 s con ≈ 310 MB de memoria pico.

## Hallazgo de reproducibilidad

El `*_timeseries.csv` de ejemplo (`public/data`) se generó con costo de **bajar escalera = 0,106145 kcal/s** (=0,0923×1,15),
mientras que el script actual y los CSV resumen usan **0,0923**. Con 0,106145 el simulador reproduce el ejemplo al bit
(`LD=0.106145 node scripts/sim_compare.mjs`). Conviene fijar cuál es el valor oficial.

## Pendiente

Calibrar contra métricas agregadas con parámetros libres, depurar las 8 configuraciones HR con desfase, validar trayectorias
con el parche de poses de MATLAB (`EXPORT_POSE_LOG`, sección 0 de `HumanRobot_Sim.m`) y reformular el modelo sobre la base calibrada.
