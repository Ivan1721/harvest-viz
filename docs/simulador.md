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

## Perfiles de modelo

El motor tiene dos perfiles, elegibles en el panel Simulador («Modelo») o con `?perfil=hri` en la URL:

| Perfil                      | Qué es                                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `matlab-2026` (por defecto) | Réplica validada de HumanRobot_Sim/HumanOnly_Sim. Congelada: no cambia ningún parámetro de MATLAB, y la regresión contra MATLAB y el oráculo de huellas (`tests/mutation/`) corren siempre con él. Estado del código marcado en git como `matlab-replica-v1`. |
| `hri`                       | Extiende la réplica con consideraciones de interacción humano-robot (seguridad por separación, métricas de fluidez…). Cada consideración es un parámetro que en `matlab-2026` está apagado.                                                                   |

Los parámetros se aplican en orden `DEFAULTS → perfil → opciones explícitas` (`resolveParams`). El perfil queda en `meta.json`, en el `paramsHash` y en la carpeta de cada simulación guardada (`simulaciones/motor-<v>/<perfil>/…`).

## Sistemas de huerto

El motor recibe el huerto como dato (`src/hrsim/huertos/`): árboles y su carga de fruta, puestos de los cosecheros, acopio, pose inicial y vuelta base del robot, límites del mapa, grafo de calles y terreno. El parámetro `huerto` elige el sistema; hoy existe `matlab-2026`, la geometría fija del estudio (3 hileras × 4 árboles, carga infinita, desplazamientos en línea recta), que el visor también lee desde ahí. Los huertos generados (palta tradicional, alta densidad, ladera) se agregan en las fases siguientes según la especificación H0.

## Validación (métricas agregadas)

Las referencias son los CSV resumen de MATLAB: 732 filas (principal, extended y scaling), que se reducen a **720 configuraciones únicas** (360 Solo humano + 360 Humano-robot) en `public/data/matlab_summary.json`.

| Prueba                               | Resultado                                                                                                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solo humano                          | 360/360 configuraciones idénticas (error relativo < 1e-6 en las 8 métricas)                                                                                                               |
| Humano-robot                         | 352/360 idénticas. De las 8 restantes, 5 difieren < 4e-5 (dentro de la tolerancia normal); 3 difieren más: 7-3-mixta-RP0 (entregado 3075 vs 3045 u) y 24-1-gancho-RP0/RP1 (4 u en bolsas) |
| Corrida de ejemplo (series por tick) | 0 discrepancias en trabajo, producción, bandera, a bordo y entregado                                                                                                                      |

La pestaña **Validación** compara en vivo el simulador con `matlab_summary.json` (generado con `scripts/build_matlab_summary.mjs`).

### Por qué difieren esas configuraciones

No es un error del port. Cuando un trabajador que vuelve a su árbol (estado 9) es llamado por el robot, da la vuelta (estado 10) y recorre el mismo segmento al revés; la distancia que le queda es un múltiplo exacto del paso (0,75 m/s × 0,25 s = 0,1875 m). La llegada se decide con `dist <= v·dt`, y en ese empate exacto el resultado depende de los últimos bits del redondeo: `Math.hypot` (V8) y `norm` (MKL de MATLAB) redondean distinto, así que el trabajador puede llegar un tick antes o después y desplazar en cascada el resto de la corrida. Se probó cambiar `hypot` por `sqrt`: el set principal pasa a 144/144, pero otras configuraciones del set extendido dejan de coincidir. No existe una implementación en JavaScript que reproduzca MKL bit a bit; la propia referencia de MATLAB tampoco es reproducible entre máquinas o versiones de MKL. Decisión: documentarlo y acotar las 3 desviaciones con tolerancias fijas al valor observado (`tests/helpers.mjs`).

### Otros supuestos que difieren de MATLAB

- **Sin lidar ni FIS de seguimiento.** MATLAB activa `fis_tracking` cuando el lidar (1,5 m) ve un tronco, aunque la evasión de obstáculos esté apagada. Con la ruta del estudio el robot nunca pasa tan cerca (lo confirma la regresión), pero cambiar `boxRouteOffset` podría activarlo en MATLAB y no en JS.
- **`dt` distinto de 0,25 s.** El JS convierte los periodos de cosecha (`prodPeriod`, en segundos) a ticks con `dt`; MATLAB los fija en 16/24/20 ticks, así que en MATLAB la tasa de cosecha cambia al cambiar `dt`. Con `dt = 0,25` coinciden.
- **Bucle de re-llamada.** En MATLAB, si el robot se llena justo cuando un trabajador terminó de cargar, ese trabajador vuelve a girar y cargar sin cosechar. El JS lo replica por defecto; `fixRecallLoop: true` lo corrige (no afecta al protocolo del estudio, donde el robot nunca se llena).
- **Entradas del FIS fuera de rango** se saturan al límite, como `evalfis`.

## Pruebas

`npm test` corre una muestra fija de la regresión (1 de cada 12 configuraciones + las desviaciones conocidas) además de las pruebas de modelo, datos y rendimiento; `npm run test:full` corre las 720. Ver `docs/testing.md`.

## Rendimiento

Node 22, 1 hilo: HO ≈ 20 ms y HR ≈ 240 ms por sesión de 45 min (máx. 410 ms con 24 trabajadores); las 732 filas en ~100 s con ≈ 310 MB de memoria pico. Topes de entrada: 4 h de simulación, 48 trabajadores, `dt` entre 0,05 y 1 s (`LIMITS` en `common.js`).

## Hallazgo de reproducibilidad

El `*_timeseries.csv` de ejemplo (`public/data`) se generó con costo de **bajar escalera = 0,106145 kcal/s** (=0,0923×1,15),
mientras que el script actual y los CSV resumen usan **0,0923**. Con 0,106145 el simulador reproduce el ejemplo al bit
(`LD=0.106145 node scripts/sim_compare.mjs`). Conviene fijar cuál es el valor oficial.

## Pendiente

Calibrar contra métricas agregadas con parámetros libres, validar trayectorias
con el parche de poses de MATLAB (`EXPORT_POSE_LOG`, sección 0 de `HumanRobot_Sim.m`) y reformular el modelo sobre la base calibrada.
