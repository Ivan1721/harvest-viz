// Prototipo R3: ?modo=actual|ezt|propio  ?huerto=estudio|ad  ?cerca=1 (cámara cerca de un árbol)
// Misma cámara isométrica ortográfica y misma luz (la de calidad Alta) para las tres opciones.
import * as THREE from 'three'
import { paltoActual, paltoEzt, paltoPropio, texturaHoja, texturaRacimo } from './arboles.js'

const q = new URLSearchParams(location.search)
const modo = q.get('modo') || 'propio',
  huerto = q.get('huerto') || 'estudio',
  cerca = q.get('cerca') === '1'

// posiciones: mapa del estudio (3 hileras × 4, copa de 3,25 m) o palta alta densidad (25 × 45, marco 4 × 2 m, 2 m de alto)
const arboles = []
let R = 3.25,
  H = 5.6,
  extent = 30
if (huerto === 'ad') {
  R = 1
  H = 2
  extent = 100
  for (let i = 0; i < 25; i++) for (let j = 0; j < 45; j++) arboles.push([-48 + i * 4, -44 + j * 2])
} else for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) arboles.push([-9 + i * 9, -10.5 + j * 7])

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(1.5, devicePixelRatio))
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color('#cfe2ee')
const asp = innerWidth / innerHeight,
  half = cerca ? 4.5 : extent * 0.62
const cam = new THREE.OrthographicCamera(-half * asp, half * asp, half, -half, -200, 400)
if (cerca) {
  cam.position.set(arboles[5][0] + 10, 9, arboles[5][1] + 14)
  cam.lookAt(arboles[5][0], H * 0.5, arboles[5][1])
} else {
  cam.position.set(10, 24, 22)
  cam.lookAt(0, 0, 0)
}
scene.add(new THREE.HemisphereLight('#e4f0ff', '#8a7650', 1.25))
const sol = new THREE.DirectionalLight('#fff1d6', 2)
sol.position.set(-14, 24, 10).multiplyScalar(extent / 30)
sol.castShadow = true
sol.shadow.mapSize.set(4096, 4096)
const sh = extent / 2 + 6
Object.assign(sol.shadow.camera, { left: -sh, right: sh, top: sh, bottom: -sh, near: 0.5, far: 4 * sh + 40 })
sol.shadow.bias = -0.0004
sol.shadow.normalBias = 0.04
scene.add(sol)
const suelo = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#7f9a56', roughness: 1 }))
suelo.rotation.x = -Math.PI / 2
suelo.receiveShadow = true
scene.add(suelo)

// tres variantes por opción, repartidas entre los árboles e instanciadas por pieza (una llamada de dibujo por pieza y variante)
const t0 = performance.now()
const hoja = texturaHoja()
const racimo = texturaRacimo(hoja)
const SEMILLAS = [3, 11, 27]
const variantes = SEMILLAS.map((s) =>
  modo === 'actual'
    ? { piezas: paltoActual(s) }
    : modo === 'ezt'
      ? paltoEzt(s, hoja)
      : { piezas: paltoPropio(s, racimo, { hojas: huerto === 'ad' ? 400 : 700 }) },
)
const tGen = performance.now() - t0
const k = R / 3.25,
  ky = H / 5.6
const m4 = new THREE.Matrix4()
let triangulos = 0
variantes.forEach((v, iv) => {
  const mios = arboles.filter((_, i) => i % SEMILLAS.length === iv)
  for (const { geo, mat } of v.piezas) {
    const im = new THREE.InstancedMesh(geo, mat, mios.length)
    mios.forEach(([x, z], i) => {
      const giro = ((i * 2.399) % (2 * Math.PI)) + iv
      im.setMatrixAt(
        i,
        m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), giro), new THREE.Vector3(k, ky, k)),
      )
    })
    im.castShadow = !mat.transparent
    im.receiveShadow = true
    scene.add(im)
    triangulos += ((geo.index ? geo.index.count : geo.attributes.position.count) / 3) * mios.length
  }
})

// medidas para el script de captura
let n = 0,
  tIni = 0
const stats = { modo, huerto, arboles: arboles.length, triangulos, generacion_ms: Math.round(tGen), fps: null, llamadas: null }
window.__stats = stats
function frame(t) {
  renderer.render(scene, cam)
  stats.llamadas = renderer.info.render.calls
  if (!tIni) tIni = t
  n++
  if (t - tIni > 4000 && stats.fps == null) {
    stats.fps = +((1000 * n) / (t - tIni)).toFixed(1)
    window.__listo = true
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
