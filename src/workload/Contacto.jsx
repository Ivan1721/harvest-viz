// Sombreado de contacto de la calidad alta (R1): oclusión ambiental en pantalla (N8AO, CC0) a media resolución.
// Oscurece donde se juntan el suelo, los troncos, la copa y los cosecheros. Módulo aparte para que el posprocesado
// (~80 kB comprimido) solo se descargue al usar la calidad alta.
import { EffectComposer, N8AO } from '@react-three/postprocessing'

export default function Contacto() {
  return (
    <EffectComposer multisampling={4}>
      <N8AO halfRes quality="performance" aoRadius={1.6} distanceFalloff={1} intensity={2.2} />
    </EffectComposer>
  )
}
