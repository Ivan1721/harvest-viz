# Prototipo R3: paltos con hojas

Compara tres formas de dibujar un palto con la misma cámara y la misma luz de la calidad Alta. No forma parte del sitio
(el build solo incluye `index.html`).

    npx vite --port 4177
    # http://localhost:4177/prototipos/r3/index.html?modo=actual|ezt|propio&huerto=estudio|ad&cerca=1

- `actual`: el palto de hoy (esferas de follaje).
- `ezt`: [ez-tree](https://github.com/dgreenheck/ez-tree) (MIT, dependencia de desarrollo) con parámetros de palto.
- `propio`: nuestro generador más tarjetas con racimos de hojas de palto sobre las esferas.

La hoja de palto se dibuja en un canvas (`texturaHoja`), así que no hay imágenes externas. `window.__stats` da los
triángulos, las llamadas de dibujo y los cuadros por segundo de cada vista.
