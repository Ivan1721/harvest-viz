# Modelos del escenario: dimensiones, animaciones y plan

Estado del modelado 3D del modo Workload. Cada medida lleva su fuente; **estimado** significa que no tiene fuente y debe reemplazarse por una medición o un dato del fabricante. Unidades: metros.

## 1. Dimensiones y fuentes

| Parte                | Dimensión en el visor                               | Fuente                                                                                | Estado                                 |
| -------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------- |
| Mapa                 | 29,74 × 25,78                                       | `scene_spec.json` (simulador MATLAB)                                                  | Fuente                                 |
| Árboles              | 3 filas × 4; posiciones por fila                    | `scene_spec.json`                                                                     | Fuente                                 |
| Copa                 | Radio 3,25                                          | `scene_spec.json`                                                                     | Fuente                                 |
| Copa (altura)        | Base a 1,9; tope cercano a 5,8 (modo realista)      | Árboles >4 m en sistemas antiguos de Chile (Gardiazábal 2011); valor exacto sin medir | Estimado, acotado                      |
| Tronco               | Altura 1,8; radio 0,16 a 0,28                       | Generada en el visor                                                                  | Estimado                               |
| Robot                | 1,52 × 1,38 × 0,83                                  | Manual del Clearpath Warthog                                                          | Fuente                                 |
| Neumático            | Diámetro 0,61; ancho 0,25                           | Manual (diámetro); ancho estimado                                                     | Parcial                                |
| Holgura al suelo     | 0,254                                               | Manual del Warthog                                                                    | Fuente                                 |
| Distancia entre ejes | 0,91 (ruedas en los extremos)                       | El manual no la da                                                                    | Estimado                               |
| Capacidad del robot  | 68 cajas × 15 u = 1.020 u                           | `HumanRobot_RunBatch.m` (parámetro del estudio)                                       | Fuente                                 |
| Trabajador           | Altura total cercana a 1,8                          | Antropometría de trabajadores chilenos (ISO 7250-1, n = 2.346); media no obtenida     | Estimado                               |
| Escalera             | Altura 2,2; inclinación 0,28 rad; 7 peldaños        | Escalera de cosecha comercial de 2,0 m abierta (Midland Ladders) como referencia      | Estimado, orden de magnitud respaldado |
| Caja de cosecha      | 0,60 × 0,30 × 0,40 en ambos lugares (modo realista) | Caja plástica de campo típica; sin fuente del huerto real                             | Estimado, unificado                    |
| Detector del robot   | Alcance 3 m, campo 120°                             | `HumanRobot_Sim.m`                                                                    | Fuente                                 |
| LIDAR del robot      | Alcance 1,5 m, ±90°                                 | `HumanRobot_Sim.m`                                                                    | Fuente                                 |
| Zonas de cortesía    | 0,45 / 1,2 / 3,6                                    | Proxemia (Hall), criterio del análisis                                                | Criterio, no medición                  |

**Modelo 3D del robot** (R2). En calidad Alta, el Warthog de la escena se arma con las mallas oficiales de Clearpath (BSD-3, `public/modelos/LEEME.md`) ubicadas según su URDF: guardabarros amarillos, chasis negro, faros y antenas, y las cuatro ruedas girando con la rodadura diferencial. Las medidas del modelo coinciden con la tabla (1,52 × 1,39 m, neumático de 0,61 m). En Básica, y para el Burro y el Burro con carro (sin mallas públicas), sigue el modelo simple de cajas y cilindros escalado a las medidas de cada robot.

Diferencia conocida con el simulador: el MATLAB dibuja un vehículo de 3,2 m con ruedas de 1 m y dirección 4WS. El visor usa el Warthog real (dirección diferencial) porque el modelo se está reformulando.

## 2. Animaciones por acción

| Entidad    | Acción (bandera / evento)     | Hoy                                                                                                                                                                      | Falta                                     |
| ---------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Trabajador | Cosecha (1)                   | Ciclo de alcance (brazo sube, recolecta, baja a la bolsa); bolsa que se llena con la producción                                                                          | Fruta cayendo a la bolsa                  |
| Trabajador | Caminata (2)                  | Piernas y brazos oscilan con manos vacías (protocolo `worker_loads` del estudio: va a la caja, no la lleva); reloj propio, independiente de la velocidad de reproducción | Pasos sincronizados con la velocidad real |
| Trabajador | Cargar caja al robot (3)      | De pie junto al robot, levanta cada caja del suelo a la cubierta (3,6 s por caja)                                                                                        | Agacharse; caja visible en la cubierta    |
| Trabajador | Bajar y subir escalera (4, 5) | Cambia la altura                                                                                                                                                         | Piernas por peldaño                       |
| Robot      | Desplazarse                   | Posición, rumbo, rodadura diferencial                                                                                                                                    | Velocidad real (hoy interpolada)          |
| Robot      | Recoger caja                  | Carga a bordo gradual (15 u en 3,6 s)                                                                                                                                    | Espera detenido 3,6 s                     |
| Robot      | Descargar                     | Descarga gradual (15 u en 1,44 s por caja)                                                                                                                               | Cajas apilándose una a una                |
| Escena     | Cajas                         | Aparecen y desaparecen                                                                                                                                                   | Trayectoria trabajador → robot → pila     |

Las animaciones dependen de la pose por tick: mientras las posiciones estén reconstruidas, el traspaso y la velocidad del robot serán aproximados.

## 4. Fuentes aproximadas y supuestos del huerto

**Supuesto de trabajo.** El huerto real aún no está definido. La demo asume un huerto de **palto Hass en Chile**: la separación de 6,8 a 7 m entre árboles y el radio de copa de 3,25 m del simulador caen dentro del rango de plantaciones tradicionales. Es un supuesto, no un dato del sitio de estudio.

| Dato                                           | Valor                                                                                       | Fuente                                                                                                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Peso del fruto Hass                            | 200 a 300 g                                                                                 | [Wikipedia, Hass avocado](https://en.wikipedia.org/wiki/Hass_avocado)                                                                                                                                    |
| Marcos de plantación tradicionales en Chile    | 6 × 6 m (278 árb/ha), 6 × 4, 4,25 × 4,25; ensayos de baja densidad de 6 × 3 a 8 × 8 m       | [Gardiazábal, WAC 2011](https://www.avocadosource.com/WAC7/Section_10/GardiazabalFrancisco2011.pdf)                                                                                                      |
| Altura de árboles en sistemas de poda antiguos | Más de 4 m; sistemas nuevos apuntan a 2 m o menos                                           | Gardiazábal, WAC 2011                                                                                                                                                                                    |
| Plantaciones nuevas de alta densidad en Chile  | 2,29 × 2,29 m (cerca de 1.900 árb/ha); no es el caso del simulador                          | [California Avocado Growers, perspectiva chilena](https://www.californiaavocadogrowers.com/sites/default/files/2023-11/5-High-Density-Planting-for-Avocado-Production-A-Chilean-Perspective-Fall-16.pdf) |
| Marco comercial en EE. UU.                     | 20 a 35 ft en la hilera × 35 a 40 ft entre hileras                                          | [Purdue, Persea americana](https://www.hort.purdue.edu/NEWCROP/hort_403/pp_pdf/pp_33.pdf)                                                                                                                |
| Robot (Warthog)                                | 1,52 × 1,38 × 0,83 m; neumático de 0,61 m; holgura de 0,254 m                               | [Manual de Clearpath](https://docs.clearpathrobotics.com/docs/robots/outdoor_robots/warthog/user_manual_warthog/)                                                                                        |
| Escalera de cosecha                            | 2,0 m abierta (ejemplo comercial)                                                           | [Midland Ladders](https://www.midlandladders.com/drabest-m-16/9-rung-fruit-picking-tripod-p-3079)                                                                                                        |
| Antropometría de trabajadores chilenos         | 32 medidas, n = 2.346, ISO 7250-1; tendencia de +1 cm de estatura por década                | [Solent University](https://pure.solent.ac.uk/en/publications/anthropometric-data-of-chilean-male-workers/) (medias en el manuscrito, no leídas)                                                         |
| Cosecha de palta                               | Cortar el pedúnculo; usar ladders, pértigas, tijeras y bolsas de lona; no sobrellenar cajas | [Avocado Handbook, cosecha](https://www.avocadosource.com/books/AvocadoHandbook/Harvesting_files/harvesting_avo.pdf)                                                                                     |

**Sin fuente todavía:** altura real del árbol del huerto, dimensiones de la caja de campo, tamaño del fruto (el visor usa unos 8 × 11 cm), tamaño y capacidad de la bolsa de cosecha, y la media de estatura del manuscrito de Solent.

## 5. Estilo realista del visor

El modo **Realista** (por defecto) agrega: palto con follaje denso y 90 frutos por árbol, suelo con textura (calles de pasto, franja de suelo bajo las hileras con riego por goteo, huellas del robot y grava en la zona de carga), cielo, sol con sombras y trabajadores con sombrero y bolsa de cosecha que se llena con la fruta recolectada. El follaje es semitransparente, con opacidad regulable, para no ocultar a los trabajadores; en un huerto real quedarían bajo la copa. El modo **Esquemático** se mantiene para figuras científicas.

**Calidad de la escena** («Capas y estilo», R1 del diseño «escena 3D más realista»). En estilo Realista hay dos calidades; solo cambian cómo se ve, nunca la simulación:

| Calidad    | Qué agrega                                                                                                                                                                                                                                                                                                                            | Cuándo es la de partida                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Alta**   | Luz de cielo (cielo atmosférico procedural de drei como mapa de entorno, sin descargas), niebla de distancia que sigue a la cámara, sombras suaves de 4.096 px, suelo con fotos CC0 de Poly Haven a escala real (`public/texturas/LEEME.md`) y sombreado de contacto N8AO a media resolución. Follaje de partida al 80 % de opacidad. | Si el navegador tiene GPU                                                                   |
| **Básica** | La escena de siempre: degradado de cielo, colores planos, sombras de 2.048 px. Follaje al 42 %.                                                                                                                                                                                                                                       | Si WebGL corre por software (SwiftShader, llvmpipe, adaptador básico): CI y equipos sin GPU |

`?calidad=alta|basica` la fija desde el enlace; la que se elige a mano se recuerda en el navegador. El posprocesado (~100 kB comprimido) y las fotos (~3 MB) solo se descargan en Alta. Con una GTX 1660 Ti ambas calidades van a 60 cuadros/s, también en palta alta densidad (1.125 árboles).
