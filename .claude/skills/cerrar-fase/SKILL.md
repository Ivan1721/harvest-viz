---
name: cerrar-fase
description: Lista de entrega de una fase de HarvestView (lint, formato, cobertura, componentes, regresión completa si se tocó el motor, build, e2e) ejecutada en orden, informando solo los fallos, más el informe para pedir «aprobado» y, tras el «aprobado», la fusión y el cierre de etapa. Úsala cuando Ivan pida "cerrar la fase", "entregar", "verificar antes de aprobar", "fusionar la rama" o "cerrar la etapa".
---

# cerrar-fase: entregar una fase sin repetir la lista a mano

Fuente de las reglas: `CLAUDE.md` («Workflow» y «Rules that are easy to miss»). Si cambian ahí, manda `CLAUDE.md`.

## 1. Verificación (antes del informe)

Corre cada paso en orden. **No muestres la salida de los que pasan**: solo `✔ paso`. Si uno falla, detente, muestra
las últimas ~30 líneas del error, corrígelo y vuelve a correr desde ese paso.

| # | Comando | Cuándo |
|---|---|---|
| 1 | `npm run lint` | siempre |
| 2 | `npm run format:check` (si falla: `npm run format` y repetir) | siempre |
| 3 | `npm run test:coverage` | siempre |
| 4 | `npm run test:components` | siempre |
| 5 | `npm run test:full` (en segundo plano, ~2 min) | si `git diff main --name-only` toca `src/hrsim/` |
| 6 | `npm run build` | siempre |
| 7 | `npm run test:e2e` (en segundo plano; necesita el build del paso 6) | siempre |

Para filtrar la salida: `npm run <x> > "$TMP/x.log" 2>&1 && echo ✔ <x> || tail -30 "$TMP/x.log"`.

Además, si se tocó el motor (`src/hrsim/`), comprueba sin leer archivos enteros:

- `git diff main -- src/hrsim/common.js | grep ENGINE_VERSION`: si cambian los resultados, la versión debe subir.
- `git diff main --stat -- CHANGELOG.md docs/simulador.md src/i18n/`: una opción nueva necesita entrada en los tres.
- Cada función visible nueva tiene su prueba e2e (`git diff main --stat -- e2e/`).

## 2. Informe para «aprobado»

En español, corto, en tablas: qué cambió, qué cambia en los resultados (o «nada»), la verificación (lista ✔ del paso 1)
y una captura de la función nueva (navegador integrado, `?look=schem` si es la escena). Termina pidiendo «aprobado».
No fusiones nada sin esa palabra de Ivan.

## 3. Tras «aprobado»

1. `git switch main && git merge --no-ff <rama>`; commit en español terminado en
   `Co-Authored-By: Claude <noreply@anthropic.com>`.
2. `git push origin main`, luego borra la rama local y remota (`git branch -d <rama>`, `git push origin --delete <rama>`).
3. Revisa la CI con `gh run list --branch main --limit 1` (si `gh` no tiene sesión, dilo y da el enlace de Actions).
4. Actualiza `docs/estado.md` con lo que cerró y lo pendiente.

## 4. Cierre de etapa (solo si Ivan lo pide)

Sube la versión en `package.json`, mueve las entradas de `CHANGELOG.md` a `## [X.Y.0] - <fecha>`, commit, y
`git tag vX.Y.0 && git push origin vX.Y.0`.
