# Modelos del escenario: dimensiones, animaciones y plan

Estado del modelado 3D del modo Workload. Cada medida lleva su fuente; **estimado** significa que no tiene fuente y debe reemplazarse por una medición o un dato del fabricante. Unidades: metros.

## 1. Dimensiones y fuentes

| Parte | Dimensión en el visor | Fuente | Estado |
|---|---|---|---|
| Mapa | 29,74 × 25,78 | `scene_spec.json` (simulador MATLAB) | Fuente |
| Árboles | 3 filas × 4; posiciones por fila | `scene_spec.json` | Fuente |
| Copa | Radio 3,25 | `scene_spec.json` | Fuente |
| Copa (altura) | Centro a 3,1 ± 0,7; tope cercano a 6 | Generada en el visor | Estimado |
| Tronco | Altura 1,8; radio 0,16 a 0,28 | Generada en el visor | Estimado |
| Robot | 1,52 × 1,38 × 0,83 | Manual del Clearpath Warthog | Fuente |
| Neumático | Diámetro 0,61; ancho 0,25 | Manual (diámetro); ancho estimado | Parcial |
| Holgura al suelo | 0,254 | Manual del Warthog | Fuente |
| Distancia entre ejes | 0,91 (ruedas en los extremos) | El manual no la da | Estimado |
| Capacidad del robot | 68 cajas × 15 u = 1.020 u | `HumanRobot_RunBatch.m` (parámetro del estudio) | Fuente |
| Trabajador | Altura total cercana a 1,8 | Generado en el visor | Estimado |
| Escalera | Altura 2,2; inclinación 0,28 rad; 7 peldaños | Generada en el visor | Estimado |
| Caja de cosecha | 0,44 × 0,30 × 0,38 (pila de carga); 0,6 × 0,4 × 0,5 (en el huerto) | Generada en el visor | Estimado, y las dos medidas no coinciden |
| Detector del robot | Alcance 3 m, campo 120° | `HumanRobot_Sim.m` | Fuente |
| LIDAR del robot | Alcance 1,5 m, ±90° | `HumanRobot_Sim.m` | Fuente |
| Zonas de cortesía | 0,45 / 1,2 / 3,6 | Proxemia (Hall), criterio del análisis | Criterio, no medición |

Diferencia conocida con el simulador: el MATLAB dibuja un vehículo de 3,2 m con ruedas de 1 m y dirección 4WS. El visor usa el Warthog real (dirección diferencial) porque el modelo se está reformulando.

## 2. Animaciones por acción

| Entidad | Acción (bandera / evento) | Hoy | Falta |
|---|---|---|---|
| Trabajador | Cosecha (1) | Brazos arriba fijos; vara en "Gancho" | Alcance, recolección, bolsa que se llena |
| Trabajador | Caminata (2) | Piernas y brazos oscilan | Cajón en las manos al transportar; reloj propio (no depende de la velocidad de reproducción) |
| Trabajador | Colocar caja (3) | Brazos al frente fijos | Agacharse, dejar la caja, traspaso al robot |
| Trabajador | Bajar y subir escalera (4, 5) | Cambia la altura | Piernas por peldaño |
| Robot | Desplazarse | Posición, rumbo, rodadura diferencial | Velocidad real (hoy interpolada) |
| Robot | Recoger caja | Sube la carga a bordo | Espera detenido 3,6 s; carga visible |
| Robot | Descargar | La carga vuelve a cero | Descarga progresiva (1,44 s por caja) |
| Escena | Cajas | Aparecen y desaparecen | Trayectoria trabajador → robot → pila |

## 3. Plan de perfeccionamiento

1. **Tabla de dimensiones con fuente**: cerrar los "estimado" de la sección 1, empezando por trabajador, caja y escalera.
2. **Robot**: modelo `.glb` con jerarquía de chasis y 4 ruedas; animar por nodos.
3. **Trabajador**: personaje articulado con clips (cosechar, caminar con caja, depositar, escalera) y mezcla entre clips.
4. **Árbol**: copa generada por ramas con las medidas reales; tope y altura de copa medidos.
5. **Caja y traspaso**: una sola medida de caja y animación del traspaso.
6. **Verificación**: capturas lateral y cenital con regla de escala tras cada cambio.

Las animaciones dependen de la pose por tick: mientras las posiciones estén reconstruidas, el traspaso y la velocidad del robot serán aproximados.
