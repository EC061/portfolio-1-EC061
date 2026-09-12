import * as THREE from 'three'

/**
 * Sky dome: one inside-out sphere, one draw call, no cubemap download.
 * A single `uNight` uniform cross-fades a daytime Rayleigh-ish gradient
 * with a starfield + moon, and the same uniform drives the light rig in
 * lighting.js, so the sky and the lamps can never disagree.
 */
const vert = /* glsl */`
varying vec3 vDir;
void main () {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`

const frag = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform float uNight;
uniform float uTime;
uniform vec3  uSunDir;

// cheap 3d hash for the starfield
float hash31 (vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float stars (vec3 d) {
  vec3 g = floor(d * 260.0);
  float h = hash31(g);
  float s = smoothstep(0.9975, 1.0, h);
  // per-star twinkle, slow enough not to look like dead pixels
  float tw = 0.65 + 0.35 * sin(uTime * 1.7 + h * 62.8);
  return s * tw;
}

void main () {
  vec3 d = normalize(vDir);
  float up = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  float horizon = pow(1.0 - abs(d.y), 8.0);

  // ---- day ----
  vec3 zenithD  = vec3(0.19, 0.42, 0.86);
  vec3 midD     = vec3(0.55, 0.74, 0.95);
  vec3 horizonD = vec3(0.92, 0.88, 0.80);
  vec3 day = mix(midD, zenithD, smoothstep(0.5, 1.0, up));
  day = mix(day, horizonD, horizon);
  float sun = max(dot(d, uSunDir), 0.0);
  day += vec3(1.0, 0.82, 0.55) * pow(sun, 36.0) * 0.85;      // aureole
  day += vec3(1.0, 0.95, 0.85) * smoothstep(0.9985, 0.9995, sun) * 6.0; // disc

  // ---- night ----
  vec3 zenithN  = vec3(0.015, 0.025, 0.070);
  vec3 horizonN = vec3(0.090, 0.075, 0.130);
  vec3 night = mix(horizonN, zenithN, smoothstep(0.0, 0.65, up));
  // light pollution from the midway itself, warm and low
  night += vec3(0.20, 0.10, 0.03) * pow(1.0 - abs(d.y), 14.0) * 0.55;
  night += vec3(0.90, 0.94, 1.00) * stars(d) * smoothstep(-0.05, 0.25, d.y);
  // milky way band
  float band = exp(-pow((d.y * 2.2 - d.x * 0.8), 2.0) * 4.0);
  night += vec3(0.10, 0.12, 0.20) * band * 0.35;
  // moon, opposite the sun
  vec3 moonDir = normalize(vec3(-uSunDir.x, abs(uSunDir.y) * 0.8 + 0.35, -uSunDir.z));
  float m = max(dot(d, moonDir), 0.0);
  night += vec3(0.85, 0.88, 1.0) * smoothstep(0.9993, 0.99975, m) * 3.0;
  night += vec3(0.35, 0.40, 0.60) * pow(m, 220.0) * 0.6;

  vec3 col = mix(day, night, uNight);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`

export function createSky (radius = 900) {
  const uniforms = {
    uNight: { value: 0 },
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.55, 0.3).normalize() },
  }
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 32),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    })
  )
  mesh.name = 'sky'
  mesh.frustumCulled = false
  mesh.renderOrder = -1000
  return { mesh, uniforms }
}

/**
 * Bake the dome into a PMREM so metal actually reflects the sky instead
 * of a flat ambient term. Only re-run on discrete night steps -- it is a
 * handful of small render passes, cheap once, wasteful per frame.
 */
export class SkyEnvironment {
  constructor (renderer) {
    this.pmrem = new THREE.PMREMGenerator(renderer)
    this.pmrem.compileEquirectangularShader()
    this.scene = new THREE.Scene()
    this.rt = null
    this._last = -1
  }

  update (skyMesh, night, scene) {
    const step = Math.round(night * 4) / 4
    if (step === this._last) return
    this._last = step
    const saved = skyMesh.material.uniforms.uNight.value
    skyMesh.material.uniforms.uNight.value = step
    this.scene.add(skyMesh)
    const next = this.pmrem.fromScene(this.scene, 0.04, 1, 1200)
    scene.add(skyMesh)
    skyMesh.material.uniforms.uNight.value = saved
    this.rt?.dispose()
    this.rt = next
    scene.environment = next.texture
  }

  dispose () {
    this.rt?.dispose()
    this.pmrem.dispose()
  }
}
