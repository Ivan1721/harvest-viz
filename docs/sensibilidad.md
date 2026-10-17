# Sensibilidad del simulador (uno a la vez, ±20 %)

Configuración: 12 trabajadores, fila 3, mixed, RP0, 45 min. Motor 0.2.1. Generado con `npm run sensitivity` (28 s).

Elasticidad = cambio relativo de la salida / cambio relativo del parámetro (1 = proporcional; 0 = no influye; negativo = efecto inverso). Ordenado por influencia sobre lo entregado y la eficiencia (kcal/u). Los parámetros enteros (capacidad, unidades por caja, paradas) se redondean, así que su cambio real puede diferir de ±20 %.

### Solo humano

Base: entregado 3780 u, carga 2508.8 kcal, 0.664 kcal/u.

| Parámetro                                  | Elasticidad: Entregado | Elasticidad: Carga total | Elasticidad: kcal por unidad entregada |
| ------------------------------------------ | ---------------------: | -----------------------: | -------------------------------------: |
| Periodo de cosecha (todas las actividades) |                  -0.61 |                     0.06 |                                   0.66 |
| Unidades por caja                          |                   0.44 |                     0.05 |                                  -0.39 |
| Velocidad de caminata                      |                   0.42 |                     0.06 |                                  -0.37 |
| Costo: cosechar escalera                   |                      0 |                     0.29 |                                   0.29 |
| Costo: caminar con caja                    |                      0 |                     0.21 |                                   0.21 |
| Costo: cosechar gancho                     |                      0 |                     0.20 |                                   0.20 |
| Costo: cosechar suelo                      |                      0 |                     0.16 |                                   0.16 |
| Costo: caminar                             |                      0 |                     0.11 |                                   0.11 |
| Tiempo de escalera                         |                  -0.04 |                     0.01 |                                   0.05 |
| Costo: subir escalera                      |                      0 |                     0.02 |                                   0.02 |
| Costo: bajar escalera                      |                      0 |                     0.01 |                                   0.01 |

### Humano-robot

Base: entregado 4875 u, carga 2632.1 kcal, 0.540 kcal/u.

| Parámetro                                  | Elasticidad: Entregado | Elasticidad: Carga total | Elasticidad: kcal por unidad entregada |
| ------------------------------------------ | ---------------------: | -----------------------: | -------------------------------------: |
| Periodo de cosecha (todas las actividades) |                  -0.84 |                     0.02 |                                   0.79 |
| Unidades por caja                          |                   0.20 |                     0.01 |                                  -0.18 |
| Costo: cosechar escalera                   |                      0 |                     0.33 |                                   0.33 |
| Velocidad de caminata                      |                   0.18 |                     0.03 |                                  -0.14 |
| Costo: cosechar gancho                     |                      0 |                     0.27 |                                   0.27 |
| Alcance del detector                       |                  -0.13 |                        0 |                                   0.12 |
| Costo: cosechar suelo                      |                      0 |                     0.25 |                                   0.25 |
| Tiempo de escalera                         |                  -0.05 |                     0.01 |                                   0.05 |
| Descarga del robot por caja                |                   0.05 |                        0 |                                  -0.04 |
| Costo: caminar                             |                      0 |                     0.04 |                                   0.04 |
| Costo: subir escalera                      |                      0 |                     0.04 |                                   0.04 |
| Costo: caminar con caja                    |                      0 |                     0.04 |                                   0.04 |
| Costo: bajar escalera                      |                      0 |                     0.03 |                                   0.03 |
| Carga al robot por caja                    |                      0 |                    -0.01 |                                  -0.01 |
| Capacidad del robot                        |                      0 |                        0 |                                      0 |
| Paradas máx. por vuelta                    |                      0 |                        0 |                                      0 |
| Tiempo máx. en waypoint                    |                      0 |                        0 |                                      0 |
