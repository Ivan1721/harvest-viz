# Estado del proyecto y pendientes

Traspaso para seguir en otra sesión (por ejemplo, en la nube). Léelo junto con `CLAUDE.md` al empezar. Al 24-10-2026.

## Dónde estamos

- **Aplicación 0.9.0, motor 0.8.0**, etiqueta `v0.9.0` en `main` (commit `8b21399`); CI en verde y desplegado en
  GitHub Pages.
- La 0.9.0 trae **H8, fase A** (flota de 2–3 robots en el motor, opción `flota`, todavía sin interfaz) y la **escena 3D
  más realista** completa (R1 luz y suelo con selector de calidad, R2 Warthog real, R3 paltos con hojas). Detalle en
  `CHANGELOG.md`, `docs/simulador.md` («Flota de robots») y `docs/modelos_escenario.md`.
- **Impeccable** 4.7.0 (skill de diseño de interfaz, Apache-2.0) está en `.claude/skills/impeccable`, sin hooks.
  `DESIGN.md` es el sistema de diseño del Simulador («El cuaderno de campo»); `.impeccable/critique/` guarda la crítica
  del 23-10 (26/40).

## Pendientes, en orden sugerido

1. **Interfaz, lo que queda de la crítica:** la fase `ui-p1` (los 3 P1 y los decimales y duraciones) está en `main`
   desde el 27-10. Falta: a 1.024 px la columna derecha desborda y las pestañas se cortan (P2), y la ayuda que solo
   está en `title` (inaccesible con teclado o táctil).
2. **H8, fase B: interfaz de la flota** (diseño: https://claude.ai/artifact/YQ2TBi8tu5t7CP83AiFXLM): paso Agentes
   «Robots: 1 · 2 · 3» y estrategia; escena con varios robots (RB-01, RB-02, su ruta en su color); pestaña Robot por
   robot; «Comparar con» otra cantidad de robots. El motor ya registra `fx…fen` por robot y `ev.rutasFlota`; `toRun.js`
   todavía muestra solo el robot 1.
   - **Decisión abierta antes de H8-exp:** corregir el tramo de regreso de la vuelta con número impar de calles también
     para un robot (hoy solo con flota, `densificar` en `src/hrsim/flota.js`). Cambia H7 hasta −2,6 % (palta alta
     densidad y ladera, 12 cosecheros, 4 h); recomendado hacerlo, con `ENGINE_VERSION` nuevo.
   - Luego **H8-exp** (lote de 1–3 robots × estrategia × huerto × avance × 12 y 24 cosecheros). El cierre de H8 será la
     **0.10.0**.
3. **Pruebas de interfaz:** `e2e/workload.spec.js` tarda ~15 min de los ~18 del job; dividirlo en varios archivos.
   En local, tras ~25 pruebas en el mismo navegador, alguna simulación supera los 60 s de `waitSim` (cada vez una prueba
   distinta; sola pasa). En CI lo cubre el reintento. Probar un navegador nuevo por archivo.
4. Del diseño de H7: nada pendiente.

## Documentos de diseño (Claude Docs)

| Documento                                     | Enlace                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Interfaz: los 3 P1 de la crítica (hecho)      | https://claude.ai/artifact/V3yVi97T549ATWcXxmp7DF                                                     |
| Escena 3D más realista (aprobado, hecho)      | https://claude.ai/artifact/NKKGEQxSFDFgJaSsq71P94                                                     |
| H8: dos o más robots (aprobado, fase A hecha) | https://claude.ai/artifact/YQ2TBi8tu5t7CP83AiFXLM                                                     |
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
