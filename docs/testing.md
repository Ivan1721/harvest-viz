# Pruebas

Cada familia de pruebas responde a una pregunta distinta. Las rápidas corren en cada PR; las lentas, cada lunes y a demanda (workflow «Pruebas extendidas»).

| Familia                 | Pregunta                                                                                   | Dónde                                              | Comando                                                      | Cuándo corre                       |
| ----------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------- |
| Regresión contra MATLAB | ¿Sigue dando lo mismo que MATLAB?                                                          | `tests/model/regression.test.mjs`                  | `npm test` (muestra) · `npm run test:full` (720)             | PR y despliegue · semanal          |
| Invariantes             | ¿Se cumplen las leyes del modelo (conservación, acumulados que no bajan, capacidad, mapa)? | `tests/model/check.mjs`, `invariants.test.mjs`     | `npm test`                                                   | PR                                 |
| Property-based          | ¿Se cumplen con parámetros al azar?                                                        | `invariants.test.mjs` (fast-check)                 | `PBT_RUNS=500 npm test`                                      | PR (30 casos) · semanal (500)      |
| Metamórficas            | ¿Se cumplen las relaciones entre corridas (prefijo, escalas, costos)?                      | `tests/model/metamorphic.test.mjs`                 | `npm test`                                                   | PR                                 |
| Analíticas              | ¿Coincide con lo calculable a mano?                                                        | `tests/model/analytical.test.mjs`                  | `npm test`                                                   | PR                                 |
| Unitarias               | ¿Funciona cada pieza? (FIS, geometría, series derivadas, nombres)                          | `tests/unit/`                                      | `npm test`                                                   | PR                                 |
| Contratos y fuzzing     | ¿Se leen bien los archivos de MATLAB y fallan con un mensaje claro los malformados?        | `tests/data/contracts.test.mjs`                    | `npm test` · `FUZZ_RUNS=5000`                                | PR · semanal                       |
| Rendimiento             | ¿Sigue siendo rápido?                                                                      | `tests/perf/` · `scripts/bench.mjs`                | `npm test` · `npm run bench`                                 | PR (presupuesto holgado) · semanal |
| Componentes             | ¿Los paneles reaccionan bien?                                                              | `tests/components/` (Vitest + Testing Library)     | `npm run test:components`                                    | PR y despliegue                    |
| Extremo a extremo       | ¿Funcionan los flujos en un navegador real?                                                | `e2e/workload.spec.js`, `occlusion.spec.js`        | `npm run test:e2e`                                           | PR (Chromium)                      |
| Accesibilidad           | ¿Cumple WCAG 2.1 AA (sin violaciones críticas ni graves)?                                  | `e2e/a11y.spec.js` (axe-core)                      | `npm run test:e2e`                                           | PR                                 |
| Multi-navegador         | ¿Funciona en Firefox y Safari (WebKit)?                                                    | los mismos `e2e/`                                  | `npm run test:e2e:all`                                       | semanal                            |
| Regresión visual        | ¿Cambió algo que se ve?                                                                    | `e2e/visual.spec.js`                               | `npm run test:visual` (`-- --update-snapshots` para aceptar) | semanal                            |
| Cobertura               | ¿Qué código no ejecuta ninguna prueba?                                                     | `.c8rc.json` (c8, todos los `src/**/*.js`)         | `npm run test:coverage` (umbrales en `.c8rc.json`)           | PR                                 |
| Mutación                | ¿Detectan las pruebas errores introducidos a propósito?                                    | `stryker.config.json`                              | `npm run test:mutation`                                      | semanal                            |
| Sensibilidad            | ¿Qué parámetros mueven las conclusiones?                                                   | `scripts/sensitivity.mjs` → `docs/sensibilidad.md` | `npm run sensitivity`                                        | semanal (artefacto)                |

## Lo que encontraron al implementarlas

- **Property-based:** con «unidades por caja» distinto de 15, la capacidad del robot se medía con cajas de 15 u fijas (`boxUnits`), así que admitía más cajas de las configuradas. Ahora una caja = una bolsa llena (`maxProd`), como en MATLAB. Motor 0.2.1.
- **Property-based:** el simulador se caía (`w.box` nulo) cuando el robot recogía la caja antes de que el trabajador llegara al punto de entrega, con parámetros no estándar. Corregido.
- **E2E:** «Exportar corridas» descargaba 6 archivos con un clic y Chrome bloquea las descargas múltiples. Ahora descarga un `.zip`.
- **Componentes:** vaciar un campo de parámetro lo ponía en 0 (velocidad 0 inmoviliza a los trabajadores). Ahora los campos no aplican valores vacíos ni bajo su mínimo y se marcan en rojo.
- **Contratos/fuzzing:** un CSV vacío o con columnas faltantes daba un error interno. Ahora da un mensaje claro (`FormatError`) y tolera BOM, CRLF y espacios en la cabecera.
- **Accesibilidad:** contraste insuficiente del gris y del azul de la interfaz (4,1–4,5:1), línea de tiempo sin etiqueta y lista de Oclusión sin acceso por teclado. Corregidos.

- **Cobertura honesta:** el umbral anterior (95 % de líneas) solo medía los archivos que alguna prueba importaba; `sim.js`, `playback.js`, `library.js` y `simClient.js` no aparecían. Con c8 `--all` la cobertura real de `src/**/*.js` es ≈ 80 % de líneas, 88 % de ramas y 86 % de funciones; los umbrales quedan justo debajo para que no baje, y suben a medida que se agregan pruebas. Los `.jsx` se miden con las pruebas de componentes (Vitest).
- **Regresión:** de las 8 «desviaciones conocidas», 5 estaban dentro de la tolerancia normal. Quedan 3 (7-3-mixta-RP0, 24-1-gancho-RP0/RP1), cada una con la diferencia observada por métrica como tope (`tests/helpers.mjs`), en vez de una tolerancia amplia común.

- **Mutación (primera corrida, 1120 de 1147 mutantes antes de cortarla):** las pruebas detectaron ~49 % (550 eliminados, 570 sobrevivientes). Es el próximo frente: el informe HTML (`reports/mutation/index.html`, `npm run test:mutation` o el artefacto del workflow semanal) muestra qué líneas cambian sin que ninguna prueba falle. El porcentaje es la proporción de mutantes detectados (no cobertura); ahora también se mutan `engine.js` y `humanonly.js`, con caché incremental entre corridas.

## No automatizable (todavía)

- **Validación con datos de campo:** requiere mediciones reales del huerto (tiempos, consumo metabólico). Cuando existan, van como pruebas de rango con su incertidumbre.
- **Estadísticas entre réplicas:** el modelo es determinista; cuando tenga ruido, se agregan pruebas de distribución (media en intervalo, KS entre versiones).
- **Validación por expertos (face validity):** revisión de la animación con alguien de campo.

## Notas prácticas

- En equipos sin GPU (CI, contenedores) WebGL corre por software: las pruebas de interfaz abren el visor con `?look=schem` (estilo Esquemático, más liviano) y pausan la reproducción.
- Las referencias visuales (`e2e/__screenshots__/`) dependen de las fuentes del sistema; si cambian de máquina, regenéralas con `npm run test:visual -- --update-snapshots` y revisa las imágenes antes de hacer commit.
