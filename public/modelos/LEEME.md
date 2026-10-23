# Modelos 3D

## `warthog.glb`: Clearpath Warthog

Robot de la escena en calidad Alta (R2 del diseño «escena 3D más realista»). Armado con las mallas oficiales del
repositorio [warthog-cpr/warthog](https://github.com/warthog-cpr/warthog) (commit `55555b6d`, 30-04-2024,
`warthog_description/meshes`), ubicadas según su URDF (`warthog.urdf.xacro`, configuración con ruedas y sin accesorios).
Lo genera `node scripts/warthog-glb.mjs`, que baja las mallas de ese commit: no hace falta ROS ni Blender.

- Ejes de three.js (y arriba, x adelante, el lado derecho en +z); origen en el suelo, bajo el centro del robot.
- Cuerpo agrupado por material (colores del URDF: guardabarros amarillos, chasis negro); las cuatro ruedas son nodos
  `rueda_{del,tras}_{izq,der}` que comparten una malla, simplificada al 35 % (13.280 triángulos en total, ~540 kB).
- Medidas comprobadas contra el manual: 1,52 × 1,39 m, neumático de 0,61 m, tope de los guardabarros a ~0,84 m (con
  antenas, 1,13 m).

### Licencia de las mallas (BSD-3-Clause)

Copyright 2021 Clearpath Robotics Inc.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following
   disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following
   disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products
   derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
