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

El motor recibe el huerto como dato (`src/hrsim/huertos/`): árboles y su carga de fruta, puestos de los cosecheros, acopio, pose inicial y vuelta base del robot, límites del mapa, grafo de calles y terreno. El parámetro `huerto` elige el sistema (en el visor: Simulador → Huerto):

| Sistema                    | Qué es                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `matlab-2026`              | La geometría fija del estudio (3 hileras × 4 árboles, carga infinita, desplazamientos en línea recta). La réplica de MATLAB y la regresión usan siempre este.                                                                                                                                                                                                                                                                                                         |
| `palta-alta-densidad` (H3) | Mismo generador: 25 hileras × 45 árboles en marco 4 × 2 m, árboles de 2 m con copa de 1 m de radio, 9 kg por árbol, sin escalera (quien iba a usarla cosecha desde el suelo). La calle deja 2 m libres: el robot entra. Ritmo calibrado a 1.000–1.600 kg por cosechero en 8 h (`prodPeriod` 14 / 14 / 18 s por kg; cuadrilla mixta sin robot: 1.209 kg). Variante 3 × 3 m con `huertoParams` (`calle: 3, sobreHilera: 3`): 1 m libre y el robot vuelve a la cabecera. |
| `palta-tradicional` (H2)   | Cuartel de 1 ha generado (`huertos/rectangular.js`): 16 hileras × 15 árboles en marco 6 × 6 m, copa de 2,5 m de radio y 6 m de alto, 42 kg por árbol (10.100 kg/ha, ODEPA 2025), cabeceras de 6 m y acopio al centro de la cabecera inferior. Parámetros editables en `huertoParams` (Simulador → Parámetros → Huerto).                                                                                                                                               |

Reglas de los huertos generados (especificación H0), iguales en Humano-robot y Solo humano:

- **Tramos**: los cosecheros trabajan por parejas en una calle, cada uno en el lado de hilera que da a ella, empezando por la calle frente al acopio y hacia afuera. Si hay más cosecheros que lados de hilera (30), cada lado se parte en tramos. Quien termina su tramo toma el tramo libre más cercano.
- **Agotamiento**: cada árbol tiene la mitad de su carga en cada lado. Al vaciar su lado, el cosechero (bajando de la escalera si la usa) camina por la calle al siguiente árbol de su tramo (estado 13; estado 15 si ya no queda fruta). La fruta se conserva: cosechada + restante = inicial.
- **Calles**: cosecheros y robot se mueven por el eje de las calles y por las cabeceras (`rutaCalles`), nunca a través de las copas.
- **Caja**: si el robot cabe en la calle (ancho libre ≥ 1,38 m + 0,5 m de holgura), la caja queda en el eje de la calle frente al árbol y el robot recorre las calles ocupadas en zigzag. Si no cabe (palta tradicional: 1 m libre), el cosechero lleva la caja a la boca de su calle en la cabecera inferior y el robot recorre esa cabecera, ida y vuelta, por un carril a un tercio de su ancho (gira en U sin acercarse a las copas).
- **Unidades**: 1 unidad = 1 kg y la caja es de 15 kg. El ritmo de cosecha (`prodPeriod` 60 / 90 / 75 s por kg en suelo / escalera / vara, la misma proporción que en MATLAB) está calibrado para que una cuadrilla mixta rinda 320–420 kg por cosechero en 8 h (373 kg con 12 cosecheros). Por actividad: suelo ~450, vara ~360, escalera ~310 kg.

Cuando el robot entra a las calles (H3):

- La vuelta base pasa en zigzag por las calles ocupadas con un waypoint cada 3 m: el controlador apunta al waypoint, y con uno solo al fondo de una calle de 2 m rozaba las copas tras el giro de entrada.
- La caja se inserta en el tramo de la ruta que pasa por ella (no antes del waypoint actual) y, al alcanzar un waypoint, el control del mismo tick ya apunta al siguiente. En `matlab-2026` ambas cosas siguen como en MATLAB.
- Con el robot al 90 % de su capacidad (o si una caja no cabe), va a descargar al acopio por las calles y vuelve a donde estaba.
- La bolsa no saca del árbol más fruta de la que cabe (el MATLAB recorta la bolsa y descarta el excedente; con fruta finita rompería la conservación).

Resultados de referencia (45 min, cuadrilla mixta): en 4 × 2 m el robot sube la cosecha 27 % con 12 cosecheros (1.360 → 1.734 kg) y 34 % con 24, con la misma carga metabólica; con 24 un solo robot no da abasto (1.530 kg en cajas esperando al final). En 3 × 3 m, donde no cabe, no aporta (−3 %), igual que en la palta tradicional.

En ladera (H4), siempre como factor sobre el valor en plano (`huertos/pendiente.js`; con pendiente 0 todo da exactamente igual que en plano, verificado):

- **Marcha**: función de Tobler (Tobler 1993, NCGIA Technical Report 93-1), v(S)/v(0) con v = 6·exp(−3,5·|S + 0,05|) km/h y S la pendiente del tramo (+ subiendo). A 20 %: 0,50 subiendo y 0,70 bajando.
- **Gasto al caminar**: ecuación de Pandolf (Pandolf, Givoni y Goldman 1977, J. Appl. Physiol. 43(4):577–581), cociente M(G)/M(0) a la misma velocidad con W = 70 kg, L = 0 o 15 kg (caja) y η = 1,1 (camino de tierra); escala los costos de caminar de ISO 8996 del modelo. En bajada, factor 1 (Pandolf no la cubre bien; supuesto conservador). La cosecha en sí no cambia.
- **Robot (fase 3)**: cuesta abajo la frenada efectiva es a − g·senθ. Con a = 1,5 m/s² y 20 % (θ ≈ 11,3°) da negativa; se usa un piso de 0,1·a, así que bajando con gente cerca el robot se detiene mucho antes. La velocidad máxima del robot en pendiente no cambia.
- **Visor**: la escena completa se inclina con el terreno (los árboles quedan perpendiculares al suelo, una simplificación visual).

Resultados de referencia (12 cosecheros, mixta, 45 min, acopio al pie): sin robot la ladera de 20 % baja la cosecha de 1.360 a 1.200 kg y sube el gasto de 1,60 a 2,19 kcal/kg; con robot se cosechan 1.672 kg a 1,40 kcal/kg (+39 % sobre sin robot). Con el acopio en la cima, sin robot el gasto sube a 2,55 kcal/kg (las cajas se suben) y el robot lo deja en 1,29.

Cultivos de H5 (especificación «H5: uva de mesa, arándano y cerezo»): sin escalera; la unidad de cosecha (`maxProd`, kg por caja o bandeja) y el ritmo son del cultivo, calibrados sin robot con una cuadrilla mixta de 12: uva 39 kg/h cosechando (supuesto de 40 kg/h, sin fuente publicada), arándano 62 kg por persona en 8 h (promedio de 60 kg, Redagrícola), cerezo 47 kg/h cosechando (47–56 kg/h en UFO, Ampatzidis y Whiting 2013). La capacidad del robot se cuenta en kg (272 / 226 / 390 kg): con bandejas de 2 kg el Warthog lleva 136. En el visor, el parrón se dibuja con postes y un techo semitransparente.

Simplificaciones de H2: la caja siempre va a la cabecera inferior (la del acopio; en 45 min los cosecheros no pasan del tercer árbol); la capacidad del robot sigue en 68 cajas; terreno plano. Alta densidad (H3), ladera (H4) y otras frutas (H5) usan el mismo generador.

## Robots y energía (huertos generados)

En los huertos generados se elige el robot (Simulador → Robot; `robotTipo`), con datos de fabricante (`src/hrsim/robots.js`; especificación «Robots y energía»). El mapa del estudio no cambia: Warthog de 68 cajas y sin energía.

|                            | Warthog                       | Burro           | Burro con carro               |
| -------------------------- | ----------------------------- | --------------- | ----------------------------- |
| Ancho · masa               | 1,38 m · 280 kg               | 0,92 m · 146 kg | 0,92 m · 146 kg + carro 60 kg |
| Capacidad (cajas de 15 kg) | 18 (272 kg)                   | 15 (226 kg)     | 26 (≈ 390 kg en el carro)     |
| Velocidad máxima           | 5 m/s                         | 2 m/s           | 2 m/s                         |
| Batería utilizable         | 2,4 kWh (50 % de 4,8 kWh AGM) | 2,4 kWh LiFePO₄ | 2,4 kWh                       |

- **Energía**: P = max(0, m·g·(C_rr·cos θ + sen θ) + m·a)·v/η + P_aux, sin regeneración; m incluye la fruta a bordo (y el carro). C_rr = 0,08 y η = 0,43 reproducen la autonomía publicada del Burro (16 km con 2,4 kWh, 136 kg a 1,2 m/s en tierra); P_aux = 60 W (Warthog) y 30 W (Burro), supuestos. El giro en el lugar no está modelado (subestima).
- **Tracción**: solo empujan las ruedas del robot: m_tot·g·(C_rr·cos θ + sen θ) ≤ μ·m_robot·g·cos θ, con μ = 0,65 (la especificación proponía 0,6; con 0,6 el Burro no subiría el 15 % con 250 kg que garantiza su ficha). Si no alcanza, el robot no avanza (`rst = 5`, «sin tracción») y, pasado el tiempo máximo en el waypoint, salta al siguiente. Con el carro lleno el Burro sube hasta ≈ 8 %.
- **Frenada**: a_ef = min(a_ctrl, μ·g·cos θ·m_frena/m_tot + g·sen θ) (θ < 0 cuesta abajo; m_frena = masa sobre ruedas que frenan, sin el carro). Reemplaza al piso provisorio de H4: el robot solo frena igual en ladera que en plano; con el carro sin freno cuesta abajo, si a_ef < 0,3 m/s² baja a 0,3 m/s, y en el perfil `hri` S_p usa max(0,3; a_ef).
- **Carro**: remolque con enganche en el eje (orientación del carro → la del robot a razón de (v/L)·sen(θ_r − θ_c), L = 1,5 m); el cosechero carga la caja en el carro o en el robot, el que esté más cerca. Ni el robot ni el carro rozan copas (verificado).
- **Lleno**: con el 90 % de la capacidad va a descargar. Dentro de una calle sigue hasta la cabecera; desde la de arriba baja por la calle vecina (sin giro en U entre copas). El acopio está sobre el carril del robot.

Métricas (Interacción → Fluidez y `indice.csv`): energía (Wh), Wh por kg entregado, batería restante, descargas y tiempo sin tracción.

## Métricas de fluidez y seguridad (fase 2)

Se calculan en `src/workload/hri.js` (`analyzeHRI(run).fluency`) desde las series que el motor ya registra, sin modificarlo, para ambos perfiles. Definiciones exactas:

- **Reparto del tiempo del robot**: fracción de ticks con `rst` = 0 (se mueve), 1 (espera junto a una caja a que llegue su dueño) y 2 (detenido descargando o cargando).
- **Espera del robot**: tramos contiguos con `rst` = 1; cada uno se atribuye a la caja que el robot recoge al terminar.
- **Espera de la caja**: detección → recogida (media, p90, máximo; ya existía).
- **Tiempo atendiendo al robot**: por trabajador, ticks en los estados 10 (camina a la caja), 11 (la carga) y 12 (baja la escalera para atenderlo). Equidad con el índice de Jain entre los trabajadores que atendieron al menos una vez.
- **Exposición por zona**: tiempo en cada zona de Hall separado en robot en movimiento (velocidad del tick > 0,05 m/s) y detenido; los traspasos de caja no cuentan.
- **Distancia de protección**: ticks con el robot en movimiento y algún trabajador que no está cargando su caja a menos de S_p(v_c) = v_h (T_r + v_c/a) + v_c T_r + v_c²/(2a) + C + Z_d + Z_r, donde v_c es la velocidad de acercamiento del robot a ese trabajador (componente hacia él, como define ISO/TS 15066; alejarse o pasar de lado no agranda la distancia exigida) (`src/hrsim/ssm.js`; v_h = 1,6 m/s, T_r = 0,1 s, a = 1,5 m/s², C = 0,2 m, Z_d = 0,107 m, Z_r = 0,1 m; detenido: 0,57 m). En `matlab-2026` mide cuánto se infringiría la norma.
- **Distancia mínima**: mínimo de la jornada (sin traspasos) y p5 de la distancia al trabajador más cercano con el robot en movimiento.

Réplica (12 trabajadores, fila 3, mixta, 45 min): robot 50 % en movimiento, 33 % esperando, 17 % descargando; 70 s dentro de S_p(v_c). Con CSV de MATLAB no hay estados del robot ni de los trabajadores: solo se separa movimiento / detenido y las posiciones son reconstruidas.

## Regla de seguridad (fase 3, perfil `hri`)

Monitorización de velocidad y separación (`HRSim._ssmScale`, parámetros `ssm` en `src/hrsim/ssm.js`), evaluada en cada tick antes de mover el robot y solo cuando el robot se desplaza (no al esperar ni al descargar):

1. **Advertencia**: si algún trabajador está a menos de S_p(v_c) + margen (1 m), la velocidad se limita a 0,3 m/s (`rst = 4`). Incluye a quien viene a cargar su caja (silenciamiento a velocidad lenta, ISO 3691-4).
2. **Protección**: si algún trabajador que no está atendiendo al robot (estados 10–12) quedaría a menos de S_p(v_c) + v_c·dt, el robot se detiene (`rst = 3`). El término v_c·dt cubre lo que avanza dentro del tick, así que la distancia tampoco se viola al final del tick.
3. **Reanudación**: vuelve a moverse cuando el campo de protección, a velocidad lenta, está libre durante 1 s.
4. **Recuperación**: una parada de seguridad cuenta para el tiempo máximo en el waypoint (60 s); si se prolonga, el robot pasa al siguiente waypoint, la misma recuperación que tiene el MATLAB. Ir lento no cuenta.

El perfil `hri` también activa `fixRecallLoop`: sin él, un trabajador llamado por un robot lleno queda girando junto a él y la regla dejaría al robot detenido para siempre. Con `ssm.enabled = false` y `fixRecallLoop = false`, `hri` da exactamente lo mismo que `matlab-2026` (prueba de coherencia). La invariante «ningún trabajador, salvo quien atiende al robot, queda dentro de S_p(v_c) con el robot en movimiento» se verifica tick a tick con parámetros al azar (`tests/model/safety.test.mjs`).

En el visor: dos anillos alrededor del robot (protección S_p, naranja/rojo al detenerse; advertencia, gris/violeta al ir lento), marcas de parada en la franja de proximidad y, en Interacción → Fluidez, paradas, tiempo lento y el resto de métricas. Los parámetros se editan en Simulador → Parámetros.

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
