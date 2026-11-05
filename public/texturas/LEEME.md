# Texturas del suelo (calidad alta)

Fotos de Poly Haven, licencia **CC0** (dominio público: uso libre, sin atribución obligatoria). Solo el mapa de color
(_diffuse_) a 1k, en JPG. Se usan en `src/shared/realistic.jsx` (`FOTOS`, `LADO_FOTO`), en mosaico a su escala real.

| Archivo                | Uso                           | Lado real | Fuente                                                                   |
| ---------------------- | ----------------------------- | --------- | ------------------------------------------------------------------------ |
| `leafy_grass.jpg`      | Pasto de las calles y entorno | 2 m       | [Poly Haven: Leafy Grass](https://polyhaven.com/a/leafy_grass)           |
| `forest_ground_06.jpg` | Mantillo bajo las hileras     | 2,1 m     | [Poly Haven: Forest Ground 06](https://polyhaven.com/a/forest_ground_06) |
| `gravel_ground_01.jpg` | Grava de la zona de carga     | 3 m       | [Poly Haven: Gravel Ground 01](https://polyhaven.com/a/gravel_ground_01) |

Descargadas el 23-10-2026 desde la API de Poly Haven. Licencia: <https://polyhaven.com/license>.

## Follaje de paltos (calidad alta)

`palto-racimos.png`: atlas de 2×2 racimos de hojas de palto Hass (2048 × 2048 px, con transparencia), dibujo propio sobre
`docs/plantillas/palto-racimos.svg` (diseño «Follaje de paltos», etapa B). Se regenera desde la plantilla con
`npm run atlas:follaje`. Lo carga `src/shared/paltoHojas.jsx` (`ATLAS_PNG`); sin él, la escena dibuja el atlas en un canvas.
