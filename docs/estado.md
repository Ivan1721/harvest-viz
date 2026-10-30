# Estado del proyecto y pendientes

Traspaso para seguir en otra sesión (por ejemplo, en la nube). Léelo junto con `CLAUDE.md` al empezar. Al 29-10-2026.

## Dónde estamos

- **Aplicación 0.9.0, motor 0.8.0**, etiqueta `v0.9.0` en `main` (commit `8b21399`); CI en verde y desplegado en
  GitHub Pages.
- La 0.9.0 trae **H8, fase A** (flota de 2–3 robots en el motor, opción `flota`, todavía sin interfaz) y la **escena 3D
  más realista** completa (R1 luz y suelo con selector de calidad, R2 Warthog real, R3 paltos con hojas). Detalle en
  `CHANGELOG.md`, `docs/simulador.md` («Flota de robots») y `docs/modelos_escenario.md`.
- Desde la 0.9.0, en `main` y sin versión nueva (la siguiente es la 0.10.0, al cerrar H8): la interfaz `ui-p1` (27-10) y
  **H8, fase B** (28-10), la flota en la interfaz: paso Agentes «Cantidad de robots» y «Cómo se reparten», escena con
  RB-01…RB-03 (color, ruta y etiqueta), pestaña Robot por robot y total de la flota, «Comparar con» otra cantidad de
  robots y enlace `?robots=2&estrategia=…`. Solo interfaz: el motor sigue en 0.8.0 y no cambia ningún resultado (con
  Burro con carro registra además la pose del carro de cada robot). Detalle en `docs/simulador.md` («En el visor») y
  `CHANGELOG.md`.
- **H8, fase C** (29-10, **motor 0.8.1**): el robot solo también recorre la vuelta densificada (un waypoint cada 3 m en
  las calles de los huertos generados), como ya lo hacía la flota. Antes, con número impar de calles, bajaba la última
  calle de ~100 m en diagonal entre las copas y al doble de velocidad. Cambia corridas de 1 robot en palta alta densidad
  y ladera (−2,6 % a +10,1 % por corrida, media casi igual); la réplica de MATLAB y la flota no cambian. El lote de H7
  se repitió con 0.8.1 y sus conclusiones se mantienen (los CSV de `experimentos/h7/` siguen con el motor 0.7.0).
  Detalle en `CHANGELOG.md` y `docs/simulador.md` («Tramo de regreso»).
- **Entorno de trabajo:** `.claude/settings.json` permite sin preguntar lint, pruebas, build y git de lectura, y la skill
  `cerrar-fase` (`.claude/skills/cerrar-fase/`) corre la lista de entrega de una fase y arma el informe para el
  «aprobado». En el PC de Ivan, `gh` está instalado pero sin sesión, y los e2e corren con el Chrome instalado
  (`PW_CHROMIUM`).
- **Impeccable** 4.7.0 (skill de diseño de interfaz, Apache-2.0) está en `.claude/skills/impeccable`, sin hooks.
  `DESIGN.md` es el sistema de diseño del Simulador («El cuaderno de campo»); `.impeccable/critique/` guarda la crítica
  del 23-10 (26/40).

## Pendientes, en orden sugerido

1. **Interfaz, lo que queda de la crítica:** la fase `ui-p1` (los 3 P1 y los decimales y duraciones) está en `main`
   desde el 27-10. La fase `ui-p2` (diseño aprobado el 29-10: https://claude.ai/artifact/SHDHf4P8a3b7Hi2Cvp86Xa;
   pestañas que caben desde 1.024 px, un solo punto de quiebre en 1.200 px, componente `Ayuda` en lugar de `title`)
   está en la rama `ui-p2`, a la espera del «aprobado»; entra en la 0.10.0. Las capturas de `e2e/visual.spec.js`
   cambian por las pestañas: aceptarlas con `npm run test:visual -- --update-snapshots` en la máquina que las generó.
2. **H8-exp: el lote de la flota** (diseño aprobado el 29-10: https://claude.ai/artifact/U7WNYEtot5HkPSK7UhAGSm; las
   fases A, B y C están en `main`). Rama `h8-exp`: columnas de flota en `scripts/experimentos/lib.mjs`, `resumen.csv`
   con las repeticiones, `experimentos/h8.json` (6 huertos × Warthog y Burro con carro × 1–3 robots × estrategia ×
   avance 0/50/80 % × 12 y 24 cosecheros, 4 h, semillas 1–5; ~3.240 corridas, ~1 h 10 min) e informe en Claude Docs.
   El cierre de H8 será la **0.10.0** (etiqueta `v0.10.0`).
   - Anotado en la fase B: el análisis HRI de la flota (`src/workload/flota.js`) corre en el hilo de la interfaz y suma
     ~2 s en el caso más pesado (4 h, 24 cosecheros, 3 robots); si molesta, pasarlo al worker. La distancia mínima entre
     robots «de toda la corrida» sale ~0,2 m porque los robots parten del mismo punto del acopio; la que importa es la
     de «con alguno en una calle».
3. **Pruebas de interfaz:** `e2e/workload.spec.js` tarda ~15 min de los ~18 del job; dividirlo en varios archivos.
   En local, tras ~25 pruebas en el mismo navegador, alguna simulación supera los 60 s de `waitSim` (cada vez una prueba
   distinta; sola pasa). En CI lo cubre el reintento. Probar un navegador nuevo por archivo.
4. **Follaje de paltos** (diseño aprobado el 29-10: https://claude.ai/artifact/XwuENSResPLc9ApkEQeBsk). Etapa A
   (hojas variadas, atlas de 2×2 racimos, tinte, normales de copa, contraluz, 8 variantes) en `main` desde el 29-10. Etapa B:
   Ivan dibuja `public/texturas/palto-racimos.png` sobre `docs/plantillas/palto-racimos.svg`; luego una rama corta
   `follaje-b` carga el PNG con respaldo al atlas de canvas. Uva, arándano y cerezo con hojas quedan para otra fase.
5. Del diseño de H7: nada pendiente.

## Documentos de diseño (Claude Docs)

| Documento                                     | Enlace                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Follaje de paltos (aprobado)                  | https://claude.ai/artifact/XwuENSResPLc9ApkEQeBsk                                                     |
| Interfaz P2: columna derecha y ayuda (aprob.) | https://claude.ai/artifact/SHDHf4P8a3b7Hi2Cvp86Xa                                                     |
| Interfaz: los 3 P1 de la crítica (hecho)      | https://claude.ai/artifact/V3yVi97T549ATWcXxmp7DF                                                     |
| Escena 3D más realista (aprobado, hecho)      | https://claude.ai/artifact/NKKGEQxSFDFgJaSsq71P94                                                     |
| H8-exp: diseño del lote (aprobado)            | https://claude.ai/artifact/U7WNYEtot5HkPSK7UhAGSm                                                     |
| H8: dos o más robots (aprobado, A y B hechas) | https://claude.ai/artifact/YQ2TBi8tu5t7CP83AiFXLM                                                     |
| H7: experimentos en lote                      | https://claude.ai/artifact/7YY8og3F2bF3BtvBQSFApd                                                     |
| H7: diseño                                    | https://claude.ai/artifact/RqERGRHDwRo9DxnsFrNBZC                                                     |
| Escenarios y árboles sin trabajar             | https://claude.ai/artifact/PdPLJePMfNRH15HPQSLeuV                                                     |
| H6: resultados · H6: diseño                   | https://claude.ai/artifact/Czes1GGRtswWAHNgGvVYwL · https://claude.ai/artifact/XZU6KDmFonAWTh71mWCQea |
| Análisis de la interfaz                       | https://claude.ai/artifact/1FifagoPsWiuxuPsWr354g                                                     |
| Arquitectura de HarvestView                   | https://claude.ai/artifact/BxjF92gnLAk5TBEXY2nd5c                                                     |
| Modelo HRI (fases 2 y 3)                      | https://claude.ai/artifact/X2MuzVrrd7q1ngLkZFAuwz                                                     |
| Perfil MATLAB congelado                       | https://claude.ai/artifact/C4JH8P1AALBQ3vwaamBPCt                                                     |
| Estado del arte HRI en cosecha                | https://claude.ai/artifact/6J4HskDnYrCiwt3oCk1178                                                     |

## Notas para una sesión en la nube (Linux, sin GPU)

- `npm ci --include=dev`. Para Playwright: `npx playwright install --with-deps chromium` (o `PW_CHROMIUM=<ruta>`). Las
  pruebas de interfaz necesitan `npm run build` antes.
- Sin GPU, WebGL corre por software: el visor abre en calidad **Básica** (`src/workload/calidad.js`); `?calidad=alta`
  fuerza la escena completa, que ahí es lenta. Las capturas comparables de la escena se hicieron con GPU real.
- **Impeccable:** su motor se baja solo la primera vez (no está en git). La telemetría se apagó solo en el PC de Ivan
  (`~/.impeccable/config.json`): en otra máquina, `export DO_NOT_TRACK=1` o
  `./.claude/skills/impeccable/scripts/impeccable telemetry off` antes de usarlo. No instalar sus hooks.
- `npm run dev` guarda cada simulación en `simulaciones/` (fuera de git); `HV_SAVE_SIMS=0` lo apaga.
- `.claude/launch.json` es la configuración de vista previa del panel del navegador de la app de escritorio.
- Flujo de trabajo, commits y reglas del motor: `CLAUDE.md`. Ivan aprueba cada fase con «aprobado» antes de fusionar.
