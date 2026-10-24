---
name: HarvestView
description: Visor 3D y simulador de cosecha colaborativa humano-robot; modo Simulador (workbench)
colors:
  azul-tinta: '#1f56e8'
  naranja-cosecha: '#ff8a1f'
  azul-profundo: '#1f3a8a'
  azul-profundo-hover: '#1b327a'
  verde-entrega: '#16a34a'
  ambar-aviso: '#b45309'
  ambar-modificado: '#d97706'
  tinta: '#1c2540'
  tinta-suave: '#5b6680'
  papel: '#ffffff'
  papel-mesa: '#f4f6fb'
  papel-control: '#f1f4fb'
  linea: '#d9dfec'
  cuadricula: '#e3e8f3'
  aviso-fondo: '#fff7e6'
typography:
  title:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '13px'
    fontWeight: 700
  body:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '13px'
    fontWeight: 400
  body-small:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '11.5px'
    fontWeight: 400
  label:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '11px'
    fontWeight: 600
    letterSpacing: '0.06em'
  axis:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '9.5px'
    fontWeight: 400
rounded:
  xs: '5px'
  sm: '6px'
  md: '7px'
  lg: '8px'
  seg: '10px'
  full: '999px'
spacing:
  xxs: '3px'
  xs: '4px'
  sm: '6px'
  md: '8px'
  lg: '10px'
  xl: '14px'
components:
  button:
    backgroundColor: '{colors.papel-control}'
    textColor: '{colors.tinta}'
    rounded: '{rounded.md}'
    padding: '7px 10px'
  button-primary:
    backgroundColor: '{colors.azul-profundo}'
    textColor: '{colors.papel}'
    rounded: '{rounded.md}'
    padding: '7px 10px'
  button-primary-hover:
    backgroundColor: '{colors.azul-profundo-hover}'
  segmented:
    backgroundColor: '{colors.papel-control}'
    rounded: '{rounded.seg}'
    padding: '3px'
  segmented-option-on:
    backgroundColor: '{colors.papel}'
    textColor: '{colors.azul-tinta}'
    rounded: '{rounded.lg}'
  panel:
    backgroundColor: '{colors.papel}'
    rounded: '{rounded.lg}'
    padding: '10px'
  input:
    backgroundColor: 'transparent'
    textColor: '{colors.tinta}'
    rounded: '{rounded.sm}'
    padding: '3px 6px'
  stale-banner:
    backgroundColor: '{colors.aviso-fondo}'
    textColor: '#8a4b08'
    padding: '6px 10px'
---

# Design System: HarvestView

## Overview

**Creative North Star: "El cuaderno de campo"**

El Simulador es un cuaderno de laboratorio abierto sobre la mesa: una escena 3D al centro, flanqueada por dos columnas de notas y mediciones, y una línea de tiempo al pie. La interfaz es sobria y precisa: neutros fríos de papel, una sola tinta azul para lo activo y el naranja de la cosecha para distinguir la corrida sin robot. Nada decorativo; cada color y cada número están ahí porque informan algo, y todo debe poder ir tal cual a una figura de la tesis.

La densidad es alta a propósito (paneles de 240 y 380 px, texto base de 13 px), porque el usuario es un investigador que compara corridas. La legibilidad se cuida con números tabulares, contraste WCAG AA verificado y etiquetas en versalitas.

**Key Characteristics:**

- Tres columnas fijas: configuración (izquierda), escena (centro), resultados (derecha), y pie con la línea de tiempo.
- Una sola tinta de acento (azul) para estado activo; el naranja solo identifica la corrida «Solo humano».
- Números tabulares en todo dato comparable.
- Textos de interfaz en español como fuente; inglés y portugués traducidos.

## Colors

Neutros fríos de papel con dos tintas de identidad y un ámbar reservado para avisos.

### Primary

- **Azul tinta** (`azul-tinta`): estado activo de segmentos y pestañas, la corrida «Humano-robot» en escena y gráficos, enlaces. Contraste ≥ 4,5:1 sobre blanco.
- **Azul profundo** (`azul-profundo`): solo el botón principal («Simular»). Su peso lo distingue del azul tinta.

### Secondary

- **Naranja cosecha** (`naranja-cosecha`): la corrida «Solo humano» y los chalecos de los cosecheros en la escena. Nunca como texto sobre blanco (no alcanza 4,5:1).

### Tertiary

- **Verde entrega** (`verde-entrega`): mejoras y valores favorables en las tablas comparativas.
- **Ámbar aviso** (`ambar-aviso`) y **ámbar modificado** (`ambar-modificado`): advertencias en texto, y el punto que marca un paso con valores cambiados.

### Neutral

- **Tinta** (`tinta`): texto principal, números de paso, logo.
- **Tinta suave** (`tinta-suave`): etiquetas, notas y ejes. Contraste ≥ 4,5:1 sobre blanco.
- **Papel** (`papel`): superficie de paneles y barras.
- **Papel de mesa** (`papel-mesa`): fondo general detrás de los paneles.
- **Papel de control** (`papel-control`): fondo de botones y controles segmentados.
- **Línea** (`linea`) y **cuadrícula** (`cuadricula`): bordes de 1 px, divisores y rejilla de gráficos.
- **Fondo de aviso** (`aviso-fondo`): banda «Resultados de la configuración anterior».

**The One Ink Rule.** El azul tinta marca lo que está activo o seleccionado y nada más; si todo es azul, nada lo es.

**The Run Identity Rule.** Azul = con robot, naranja = sin robot, en la escena, los gráficos y las tablas por igual. No se reutilizan para otra cosa.

## Typography

**Body Font:** Inter (con system-ui, -apple-system, Segoe UI)

**Character:** Una sola familia sans neutra en tamaños pequeños; la jerarquía viene del peso, las versalitas y el color, no del tamaño.

### Hierarchy

- **Title** (700, 13px): título de la corrida en la barra superior y encabezados de tabla.
- **Body** (400, 13px): texto base del workbench.
- **Body small** (400, 11.5px): notas, ayudas y texto secundario de paneles.
- **Label** (600, 11px, 0.06em, versalitas): encabezados de panel y etiquetas de campo, en tinta suave.
- **Axis** (400, 9.5px): marcas de ejes de los gráficos SVG.

**The Tabular Numbers Rule.** Todo número que se compara (tablas, KPI, ejes) usa `font-variant-numeric: tabular-nums`.

## Layout

Rejilla de tres columnas fijas (240 px · flexible · 380 px) y tres filas (barra superior de 46 px · escena · pie). La escena ocupa el centro y puede dividirse en dos vistas sincronizadas («Comparar»), separadas por 2 px. Las columnas laterales hacen scroll propio con 10 px de margen interior y 6–10 px entre paneles. El ritmo de espaciado es de 3, 4, 6, 8, 10 y 14 px. Hoy hay un solo punto de quiebre (1.200 px); no hay disposición para tablet ni móvil.

## Elevation & Depth

**Hoy:** plano con bordes. Los paneles son superficies blancas separadas por bordes de 1 px (`linea`); la única sombra está en los menús desplegables («Capas y estilo»: `0 6px 20px rgba(20, 30, 60, 0.15)`) y en la opción activa de un control segmentado (`0 1px 4px rgba(35, 55, 110, 0.15)`).

**Dirección elegida (23-10-2026, pendiente de implementar):** capas con sombra suave. Los paneles flotan levemente sobre el papel de mesa con sombras difusas y frías del mismo tono (`rgba(35, 55, 110, …)`), sin perder los bordes de 1 px que separan secciones dentro de un panel.

**The Cold Shadow Rule.** Las sombras son azul-pizarra translúcidas, nunca negras ni grises puros.

## Shapes

Esquinas suavemente redondeadas y pequeñas: 5–8 px en botones, campos y paneles, 10 px en el contenedor de los controles segmentados, círculos para los números de paso y puntos de estado, y píldoras (999 px) para etiquetas. Bordes de 1 px en tono `linea`; el aviso de resultados desactualizados usa borde ámbar.

## Components

Los controles son **discretos y exactos**: pequeños, sin adornos y con un estado activo inequívoco; el dato importa más que el control.

### Buttons

- **Shape:** suavemente redondeado (7px).
- **Default:** papel de control con borde de línea, texto tinta, 12px semibold, ancho completo en paneles.
- **Primary:** azul profundo con texto blanco; solo «Simular».
- **Hover:** un paso más oscuro del fondo (`#e6ecf8` en el normal; azul profundo hover en el principal).
- **Link:** sin fondo ni borde, texto tinta suave.

### Segmented controls

- **Style:** contenedor papel de control (radio 10px, 3px de relleno) con opciones de texto 11px semibold en tinta suave.
- **On:** opción en papel blanco, texto azul tinta y sombra mínima.
- **Disabled:** opacidad 0,4.

### Tabs

- **Style:** texto sin fondo sobre una línea inferior de 1 px; la pestaña activa lleva subrayado de 2 px en tinta.

### Cards / Containers (panel)

- **Corner Style:** 8px.
- **Background:** papel, borde de línea, relleno de 10px.
- **Header:** etiqueta en versalitas, 11px, tinta suave; en los pasos del panel izquierdo, número de paso circular en tinta y punto ámbar si hay valores modificados.

### Inputs / Fields

- **Style:** fondo transparente, borde de línea, radio 6px, texto heredado.
- **Error:** el campo inválido se marca en rojo y no aplica el valor.

### Stale banner (signature)

Banda ámbar clara sobre la escena y los resultados («Resultados de la configuración anterior») con un botón para simular: la interfaz nunca muestra resultados que no corresponden a lo configurado sin decirlo.

## Do's and Don'ts

### Do:

- **Do** usar azul tinta solo para lo activo o seleccionado, y azul profundo solo para «Simular».
- **Do** mantener azul = con robot y naranja = sin robot en todas las vistas.
- **Do** usar números tabulares en todo dato comparable.
- **Do** verificar contraste ≥ 4,5:1 en texto (tinta suave y ámbar aviso ya cumplen).
- **Do** escribir los textos en español y traducirlos al inglés y al portugués (`src/i18n`).

### Don't:

- **Don't** poner texto en naranja cosecha sobre blanco.
- **Don't** usar sombras negras o grises puras.
- **Don't** agregar colores de acento nuevos para estados que ya cubren azul, verde y ámbar.
- **Don't** convertir el Simulador en una página llamativa: es una herramienta de investigación.
