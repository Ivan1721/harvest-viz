# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

HarvestView: a React + three.js (react-three-fiber) static site that visualizes and simulates human–robot collaborative fruit harvesting. It started as a JS port of the MATLAB simulators `HumanRobot_Sim.m` / `HumanOnly_Sim.m` and grew into a harvest-systems simulator. Code comments, identifiers, docs, commit messages and the CHANGELOG are in **Spanish**; keep writing them in Spanish. Node ≥ 22, ESM throughout.

Owner: Ivan García (DISA doctorate, UNAB); this is the 3D viewer and simulator for his research. Reply to him in Spanish, concise and structured (short lists and tables), no filler.

## Workflow

- **Spec first.** Each new phase (H6, H7, H8…) starts from a design document with options, a recommendation and numbered decisions. Implement only after Ivan says «aprobado».
- **One phase = one branch.** Report in chat (what changed, what changes in results, verification, a screenshot of the new feature) and ask for «aprobado». Merge into `main` with `git merge --no-ff <rama>` only after that, then delete the local and remote branch and check CI.
- Claude runs all git; Ivan doesn't run commands. Commits in Spanish, ending with `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Closing a stage: bump the app version in `package.json`, update `CHANGELOG.md` and create tag `vX.Y.0`.
- Before delivering a phase: `npm run lint`, `npm run format:check`, `npm run test:coverage`, `npm run test:components`, `npm run test:full` if the engine was touched, `npm run build`, `npm run test:e2e` (one new e2e test per visible feature).

## Commands

```bash
npm install --include=dev
npm run dev                 # Vite dev server (also saves every simulation to simulaciones/, see below)
npm run build               # static site in dist/ (base './', deployed to GitHub Pages)
npm test                    # node:test: unit, model, data, perf (~30 s); MATLAB regression on a sample
npm run test:full           # same with FULL=1: full regression, 720 MATLAB configurations (~2 min)
npm run test:components     # Vitest + Testing Library (jsdom), tests/components/**/*.test.jsx only
npm run test:e2e            # Playwright, Chromium; serves the BUILT site via vite preview :4175, so build first
npm run test:coverage       # c8 with thresholds in .c8rc.json (what CI runs instead of npm test)
npm run lint                # ESLint
npm run format:check        # Prettier (no semicolons, single quotes, printWidth 160)
```

Single tests:

```bash
node --test tests/model/engine.test.mjs
node --test --test-name-pattern="<name>" tests/unit/fis.test.mjs
npx vitest run tests/components/panels.test.jsx
npx playwright test e2e/workload.spec.js
```

Useful env vars: `PBT_RUNS=500` (property-based cases), `FUZZ_RUNS=5000` (contract fuzzing), `UPDATE_GOLDEN=1 node --test tests/mutation/engine-fast.test.mjs` (regenerate engine fingerprints after an intentional engine change), `PW_CHROMIUM=/path/to/chrome` (use an installed Chromium), `npm run test:visual -- --update-snapshots` (accept visual changes; screenshots depend on system fonts). Slow suites (mutation via Stryker, all browsers, visual, sensitivity) run in the weekly `extended.yml` workflow. `docs/testing.md` maps each test family to its question and command.

Other scripts: `npm run bench` (vs `bench/baseline.json`), `npm run sensitivity` (→ `docs/sensibilidad.md`), `npm run experimentos -- experimentos/h7.json` (parallel, cached batch experiments; results in `experimentos/<name>/`), `npm run export:video -- --url … ` (MP4 export via Playwright).

CI (`.github/workflows/ci.yml`) on every PR: lint, format:check, test:coverage, test:components, build, e2e. Push to `main` runs the same and deploys to Pages only if all pass.

## Architecture

Three header modes over shared code, each lazy-loaded from `src/App.jsx` (`?modo=sim|replica|occlusion`):

- **Simulador** and **Réplica MATLAB** → `src/workload/WorkloadApp.jsx` (same app, different data source).
- **Oclusión** → `src/OcclusionApp.jsx` with `src/data.js`, `src/sim.js`, `src/Scene.jsx` (independent viewpoint-selection demo).

### Simulation engine — `src/hrsim/` (no React, runs identically in Node and the browser)

- `common.js`: `DEFAULTS`, `resolveParams`, geometry helpers and **`ENGINE_VERSION`**. Parameters resolve as `DEFAULTS → perfil → sistema (huerto) → explicit options`.
- `engine.js` (`HRSim`, human–robot) and `humanonly.js` (`HOSim`): tick-by-tick (dt 0.25 s) state machines. Worker state numbers and activity flags follow MATLAB's conventions (documented at the top of `engine.js`); keep them aligned with MATLAB.
- `fis.js` parses/evaluates the Mamdani FIS in `goal_seeking.fis` (robot goal seeking).
- `huertos/`: orchards are data. `matlab-2026` is the fixed study map; `rectangular.js`/`pendiente.js` generate orchards (palta tradicional/alta densidad/ladera, uva, arándano, cerezo). `robots.js` (Warthog, Burro…, energy/traction), `ssm.js` (ISO/TS 15066 separation distance), `acopio.js`, `carga.js` are optional feature modules.
- Two **profiles**: `matlab-2026` (default, frozen validated replica; MATLAB regression and golden fingerprints always run with it) and `hri` (adds HRI/safety behaviour; every addition is a parameter that is off in `matlab-2026`). The `matlab-2026` replica (profile and orchard) never changes.
- **Every new engine option is off by default** and `resolveParams` deletes it when not requested (see how `semilla`, `acopio`, `carga`, `reparto`, `avance` are handled), so resolved params and `paramsHash` stay identical without it. A new option means: bump `ENGINE_VERSION`, a section in `docs/simulador.md`, a CHANGELOG entry, and `en`/`pt` translations.
- In the browser: `simClient.js` → `sim.worker.js` (Web Worker, typed-array transfer; a new run cancels the previous one) → `toRun.js` converts sim output into the viewer's `run` object, then `workload/hri.js` (`analyzeHRI`) computes interaction metrics.

### Viewer — `src/workload/`

- `run.js` parses MATLAB outputs (`*_timeseries.csv` + optional `*_robot_status_log.txt`, file name pattern `HUMAN_ROBOT_12_ROW3_harv_mixed_RP0_…`). MATLAB CSVs have no trajectories, so positions are **reconstructed**; simulator runs have exact per-tick poses. Both produce the same `run` shape consumed by the scene and panels.
- `WorkloadScene.jsx` + `src/shared/` (3D models, orchard, realistic/schematic styles), `panels/` (UI steps and right-hand tabs), `urlState.js` (reproducible run URLs), `playback.js` (clock), `saveSim.js` + `scripts/vite-save-sims.js` (dev-only saving).

### i18n — `src/i18n/`

The Spanish string in code **is the key**: `t('Simular', { var })`; dictionaries live in `src/i18n/en|pt/`, missing keys fall back to Spanish. Components call `useLang()` to re-render on language change. Every new UI string needs `en` and `pt` entries; `tests/unit/i18n.test.mjs` enforces it.

## Rules that are easy to miss

- If a change alters simulator results, bump `ENGINE_VERSION` in `src/hrsim/common.js` and record why in `CHANGELOG.md` (Keep a Changelog, Spanish). The MATLAB regression (`tests/model/regression.test.mjs`, reference `public/data/matlab_summary.json`) must keep passing; known deviations are capped per metric in `tests/helpers.mjs` (`KNOWN_HR_DEVIATIONS`). Regenerate the reference with `node scripts/build_matlab_summary.mjs <NuevaVersion folder>`.
- `npm run dev` writes each simulation to `simulaciones/motor-<version>/<perfil>/…` plus `simulaciones/indice.csv` (gitignored). `HV_SAVE_SIMS=0` disables it, `HV_SIM_DIR` relocates it; preview, tests and CI never save.
- E2E runs WebGL in software (swiftshader): tests open the viewer with `?look=schem` and pause playback; timeouts are deliberately long. Scene quality (`src/workload/calidad.js`) defaults to «Básica» on software WebGL; `?calidad=alta` forces the heavy path (sky light, textures, N8AO), only one e2e test uses it.
- Coverage counts all `src/**/*.js` (c8 `--all`); `.jsx` is covered by Vitest component tests. Don't lower thresholds in `.c8rc.json`.
- Parameters without a source are marked `'Supuesto: …'` in the parameter tables (`src/workload/parametros.js`) and in the ODD description (`src/workload/modelo.js`).
- Don't add a LICENSE file.
- This repo is the single source; `WorkloadProductionSim` consumes it as a submodule in `viz/`.
- Further detail: `docs/simulador.md` (engine, profiles, orchard systems, safety rule), `docs/modelos_escenario.md` (3D model measurements/sources), `docs/testing.md`.
