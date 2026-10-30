# Estado del proyecto y pendientes

Traspaso para seguir en otra sesión (por ejemplo, en la nube). Léelo junto con `CLAUDE.md` al empezar. Al 29-10-2026.

## Dónde estamos

- **Aplicación 0.10.0, motor 0.8.1**, etiqueta `v0.10.0` en `main` (29-10): cierra **H8**, la flota de robots (fases
  A–C y el lote H8-exp), más la interfaz `ui-p1` y la etapa A del follaje de paltos. Detalle en `CHANGELOG.md`.
- **H8-exp** (29-10): lote de 4.518 corridas en `experimentos/h8/` e informe «H8: experimentos en lote»
  (https://claude.ai/artifact/G7TrM9s2MYFA95LyT9cVaQ). Donde un robot no alcanza (palta alta densidad y ladera), el
  segundo lleva lo entregado de 35–70 % a 73–97 % de lo cosechado y el tercero a 94–96 %; se recomienda zonas. Detalle
  en `docs/simulador.md` («Experimentos en lote (H8)»).
- La 0.9.0 trajo **H8, fase A** (flota de 2–3 robots en el motor, opción `flota`, todavía sin interfaz) y la **escena 3D
  más realista** completa (R1 luz y suelo con selector de calidad, R2 Warthog real, R3 paltos con hojas). Detalle en
  `CHANGELOG.md`, `docs/simulador.md` («Flota de robots») y `docs/modelos_escenario.md`.
- En la 0.10.0 (antes en `main` sin versión): la interfaz `ui-p1` (27-10) y
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
   desde el 27-10. Falta: a 1.024 px la columna derecha desborda y las pestañas se cortan (P2), y la ayuda que solo
   está en `title` (inaccesible con teclado o táctil).
2. **Después de H8** (cerrada en la 0.10.0), sin diseño todavía:
   - Un Burro con carro trabado por tracción salta su waypoint y cruza la hilera hacia una calle reservada por otro
     robot (27 de 2.592 corridas con flota del lote H8). Corregirlo cambia el motor: otra fase.
   - Lo que el diseño de H8 dejó fuera: flota mixta, despacho por demanda y relevo de batería.
   - El visor no lee `semilla` desde la URL: las corridas con semilla no tienen enlace reproducible.
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

| Documento                                | Enlace                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Follaje de paltos (aprobado)             | https://claude.ai/artifact/XwuENSResPLc9ApkEQeBsk                                                     |
| Interfaz: los 3 P1 de la crítica (hecho) | https://claude.ai/artifact/V3yVi97T549ATWcXxmp7DF                                                     |
| Escena 3D más realista (aprobado, hecho) | https://claude.ai/artifact/NKKGEQxSFDFgJaSsq71P94                                                     |
| H8: experimentos en lote (informe)       | https://claude.ai/artifact/G7TrM9s2MYFA95LyT9cVaQ                                                     |
| H8-exp: diseño del lote (aprobado)       | https://claude.ai/artifact/U7WNYEtot5HkPSK7UhAGSm                                                     |
| H8: dos o más robots (aprobado, hecho)   | https://claude.ai/artifact/YQ2TBi8tu5t7CP83AiFXLM                                                     |
| H7: experimentos en lote                 | https://claude.ai/artifact/7YY8og3F2bF3BtvBQSFApd                                                     |
| H7: diseño                               | https://claude.ai/artifact/RqERGRHDwRo9DxnsFrNBZC                                                     |
| Escenarios y árboles sin trabajar        | https://claude.ai/artifact/PdPLJePMfNRH15HPQSLeuV                                                     |
| H6: resultados · H6: diseño              | https://claude.ai/artifact/Czes1GGRtswWAHNgGvVYwL · https://claude.ai/artifact/XZU6KDmFonAWTh71mWCQea |
| Análisis de la interfaz                  | https://claude.ai/artifact/1FifagoPsWiuxuPsWr354g                                                     |
| Arquitectura de HarvestView              | https://claude.ai/artifact/BxjF92gnLAk5TBEXY2nd5c                                                     |
| Modelo HRI (fases 2 y 3)                 | https://claude.ai/artifact/X2MuzVrrd7q1ngLkZFAuwz                                                     |
| Perfil MATLAB congelado                  | https://claude.ai/artifact/C4JH8P1AALBQ3vwaamBPCt                                                     |
| Estado del arte HRI en cosecha           | https://claude.ai/artifact/6J4HskDnYrCiwt3oCk1178                                                     |

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
