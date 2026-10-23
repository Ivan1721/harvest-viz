// Genera public/modelos/warthog.glb desde las mallas oficiales del Clearpath Warthog (BSD-3-Clause), ubicadas según
// su URDF (warthog_description/urdf/warthog.urdf.xacro, configuración con ruedas y sin accesorios).
// Uso: node scripts/warthog-glb.mjs   (baja las mallas del commit fijado; no necesita ROS ni Blender)
//
// Ejes: el URDF usa x adelante, y izquierda, z arriba; el GLB usa los de three.js (y arriba): (x, y, z) → (x, z, −y).
// El origen del GLB queda en el suelo, bajo el centro del robot. Las cuatro ruedas son nodos aparte (`rueda_*`) que
// comparten una malla, para que la escena las haga girar.
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { mergeGeometries, toCreasedNormals, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js'

export const COMMIT = '55555b6db5fc7aa7b710b5652f7cb5bf0589ec6a' // warthog-cpr/warthog, 30-04-2024
const RAW = `https://raw.githubusercontent.com/warthog-cpr/warthog/${COMMIT}/warthog_description/meshes/`
const OUT = new URL('../public/modelos/warthog.glb', import.meta.url)
const PI = Math.PI

// colores del URDF (material rgba)
const COLOR = {
  amarillo: [0.95, 0.816, 0.082],
  negro: [0.15, 0.15, 0.15],
  grisOscuro: [0.2, 0.2, 0.2],
  grisClaro: [0.4, 0.4, 0.4],
  blanco: [0.9, 0.9, 0.9],
  rojo: [0.9, 0, 0],
}

// piezas: [malla, material, cadena de transformaciones (de la pieza hacia la base), cada una [xyz, rpy]]
const CHASIS = [
  [0, 0, 0.025],
  [0, 0, 0],
] // base_link → chassis_link
const dif = (s) => [
  [0, 0.56821 * s, 0],
  [0, 0, 0],
] // chassis → diff unit (s = 1 izquierda, −1 derecha)
const PIEZAS = [
  ['chassis.stl', 'negro', [CHASIS]],
  ['e-stop.stl', 'rojo', [CHASIS]],
  [
    'diff-link.stl',
    'grisClaro',
    [
      [
        [-0.5826, 0, 0.24979],
        [0, 0, 0],
      ],
      CHASIS,
    ],
  ],
  [
    'susp-link.stl',
    'grisClaro',
    [
      [
        [-0.5826, 0, 0.24979],
        [0, 0, 0],
      ],
      CHASIS,
    ],
  ],
]
for (const [s, lado] of [
  [1, 'left'],
  [-1, 'right'],
]) {
  const unidad = [dif(s), CHASIS]
  const giro = [
    [0, 0, 0],
    [0, 0, (s * PI) / 2],
  ]
  PIEZAS.push(
    ['rocker.stl', 'negro', [giro, ...unidad]],
    ['fenders.stl', 'amarillo', [giro, ...unidad]],
    ['buttons.stl', 'rojo', [giro, ...unidad]],
    [`antenna_${lado}.stl`, 'grisClaro', [giro, ...unidad]],
    [
      'light.stl',
      'blanco',
      [
        [
          [0, -0.029 * s, 0],
          [0, 0, 0],
        ],
        ...unidad,
      ],
    ],
    [
      'light.stl',
      'rojo',
      [
        [
          [0, -0.029 * s, 0],
          [0, 0, s * PI],
        ],
        ...unidad,
      ],
    ],
  )
  if (s === -1) PIEZAS.push(['antenna_estop.stl', 'grisClaro', [giro, ...unidad]])
}
// ruedas: hijas de la unidad diferencial en (±0,457367, 0, −0,012977); la malla va girada π/2 en z
const RUEDAS = []
for (const [s, lado] of [
  [1, 'izq'],
  [-1, 'der'],
])
  for (const [x, pos] of [
    [0.457367, 'del'],
    [-0.457367, 'tras'],
  ])
    RUEDAS.push({
      nombre: `rueda_${pos}_${lado}`,
      cadena: [
        [
          [x, 0, -0.012977],
          [0, 0, 0],
        ],
        dif(s),
        CHASIS,
      ],
    })

/** Matriz de una transformación del URDF (rpy = giros fijos x, y, z). */
const matriz = ([xyz, rpy]) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...xyz), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rpy, 'ZYX')), new THREE.Vector3(1, 1, 1))
// la cadena va de la pieza hacia la base; la matriz es base · … · pieza
const encadenar = (cadena) => cadena.reduceRight((m, t) => m.multiply(matriz(t)), new THREE.Matrix4())
// del URDF (z arriba) a three.js (y arriba)
const A_THREE = new THREE.Matrix4().makeRotationX(-PI / 2)

async function malla(nombre, cache) {
  const f = path.join(cache, nombre)
  if (!fs.existsSync(f)) {
    const r = await fetch(RAW + nombre)
    if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status}`)
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()))
  }
  const b = fs.readFileSync(f)
  return new STLLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}

/** Geometría indexada con normales que respetan las aristas (30°) y sin atributos de más. */
function limpia(g) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k)
  const c = toCreasedNormals(g, PI / 6)
  return mergeVertices(c, 1e-5)
}

// ---- escritor GLB mínimo (glTF 2.0 binario): posiciones y normales float32, índices uint16/uint32 ----
function glb(meshes, nodes, materiales) {
  const partes = [],
    views = [],
    accessors = []
  let off = 0
  const vista = (arr, target) => {
    const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)
    const pad = (4 - (buf.length % 4)) % 4
    partes.push(buf, Buffer.alloc(pad))
    views.push({ buffer: 0, byteOffset: off, byteLength: buf.length, target })
    off += buf.length + pad
    return views.length - 1
  }
  const acc = (arr, type, componentType, target, extra = {}) => {
    accessors.push({ bufferView: vista(arr, target), componentType, count: arr.length / (type === 'VEC3' ? 3 : 1), type, ...extra })
    return accessors.length - 1
  }
  const gm = meshes.map(({ nombre, geometria, material }) => {
    const pos = geometria.attributes.position.array,
      nor = geometria.attributes.normal.array
    const bb = new THREE.Box3().setFromBufferAttribute(geometria.attributes.position)
    const p = acc(Float32Array.from(pos), 'VEC3', 5126, 34962, { min: bb.min.toArray(), max: bb.max.toArray() })
    const n = acc(Float32Array.from(nor), 'VEC3', 5126, 34962)
    const idx = geometria.index.array
    const i = pos.length / 3 < 65536 ? acc(Uint16Array.from(idx), 'SCALAR', 5123, 34963) : acc(Uint32Array.from(idx), 'SCALAR', 5125, 34963)
    return { name: nombre, primitives: [{ attributes: { POSITION: p, NORMAL: n }, indices: i, material }] }
  })
  const json = {
    asset: { version: '2.0', generator: 'harvest-viz scripts/warthog-glb.mjs', copyright: 'Copyright 2021 Clearpath Robotics Inc. BSD-3-Clause' },
    scene: 0,
    scenes: [{ name: 'warthog', nodes: nodes.map((_, k) => k) }],
    nodes,
    meshes: gm,
    materials: materiales,
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: off }],
  }
  const jb = Buffer.from(JSON.stringify(json))
  const jpad = Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)
  const bin = Buffer.concat(partes)
  const head = Buffer.alloc(12),
    jh = Buffer.alloc(8),
    bh = Buffer.alloc(8)
  const total = 12 + 8 + jb.length + jpad.length + 8 + bin.length
  head.writeUInt32LE(0x46546c67, 0)
  head.writeUInt32LE(2, 4)
  head.writeUInt32LE(total, 8)
  jh.writeUInt32LE(jb.length + jpad.length, 0)
  jh.writeUInt32LE(0x4e4f534a, 4)
  bh.writeUInt32LE(bin.length, 0)
  bh.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([head, jh, jb, jpad, bh, bin])
}

export async function generar(cache = path.join(process.env.TEMP || '/tmp', 'warthog-stl')) {
  fs.mkdirSync(cache, { recursive: true })
  // cuerpo: todas las piezas por material, ya en su lugar
  const porMaterial = new Map()
  for (const [nombre, mat, cadena] of PIEZAS) {
    const g = (await malla(nombre, cache)).applyMatrix4(encadenar(cadena)).applyMatrix4(A_THREE)
    if (!porMaterial.has(mat)) porMaterial.set(mat, [])
    porMaterial.get(mat).push(limpia(g))
  }
  // rueda: una malla centrada en su eje; cada rueda es un nodo con su traslación
  // la rueda trae el dibujo de la banda con ~12.700 caras (más de la mitad del archivo): se simplifica al 35 %, que en la
  // vista del huerto no se distingue
  const ruedaBase = mergeVertices(
    (await malla('wheel.stl', cache))
      .applyMatrix4(
        matriz([
          [0, 0, 0],
          [0, 0, PI / 2],
        ]),
      )
      .applyMatrix4(A_THREE)
      .deleteAttribute('normal'),
    1e-5,
  )
  const quitar = Math.floor(ruedaBase.attributes.position.count * 0.65)
  const rueda = limpia(await new SimplifyModifier().modify(ruedaBase, quitar))
  const centros = RUEDAS.map((r) => new THREE.Vector3().applyMatrix4(encadenar(r.cadena)).applyMatrix4(A_THREE))
  // origen en el suelo: el punto más bajo de las ruedas
  const bbR = new THREE.Box3().setFromBufferAttribute(rueda.attributes.position)
  const suelo = Math.min(...centros.map((c) => c.y + bbR.min.y))
  const mats = [...porMaterial.keys()]
  const materiales = [...mats, 'grisOscuro'].map((m) => ({
    name: m,
    pbrMetallicRoughness: { baseColorFactor: [...COLOR[m], 1], metallicFactor: m === 'grisClaro' ? 0.6 : 0, roughnessFactor: m === 'amarillo' ? 0.45 : 0.7 },
  }))
  const meshes = mats.map((m, k) => {
    const g = mergeGeometries(porMaterial.get(m))
    g.translate(0, -suelo, 0)
    return { nombre: `cuerpo_${m}`, geometria: g, material: k }
  })
  meshes.push({ nombre: 'rueda', geometria: rueda, material: mats.length })
  const nodes = [
    ...mats.map((m, k) => ({ name: `cuerpo_${m}`, mesh: k })),
    ...RUEDAS.map((r, k) => ({ name: r.nombre, mesh: mats.length, translation: [centros[k].x, centros[k].y - suelo, centros[k].z] })),
  ]
  const buf = glb(meshes, nodes, materiales)
  fs.mkdirSync(new URL('.', OUT), { recursive: true })
  fs.writeFileSync(OUT, buf)
  // medidas para comprobar contra el manual (1,52 × 1,38 × 0,83 m; neumático de 0,61 m)
  const caja = new THREE.Box3()
  for (const { geometria } of meshes.slice(0, -1)) caja.union(new THREE.Box3().setFromBufferAttribute(geometria.attributes.position))
  for (const c of centros) caja.union(bbR.clone().translate(new THREE.Vector3(c.x, c.y - suelo, c.z)))
  const tam = caja.getSize(new THREE.Vector3())
  return {
    bytes: buf.length,
    largo: tam.x,
    alto: tam.y,
    ancho: tam.z,
    diametroRueda: bbR.max.y - bbR.min.y,
    triangulos: meshes.reduce((a, m) => a + m.geometria.index.count / 3, 0),
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('warthog-glb.mjs')) {
  const r = await generar()
  console.log(
    `public/modelos/warthog.glb: ${(r.bytes / 1024).toFixed(0)} kB, ${r.triangulos} triángulos; ` +
      `${r.largo.toFixed(3)} × ${r.ancho.toFixed(3)} × ${r.alto.toFixed(3)} m (largo × ancho × alto), rueda de ${r.diametroRueda.toFixed(3)} m`,
  )
}
