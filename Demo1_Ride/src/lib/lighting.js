import * as THREE from 'three'
import { gobo } from './textures.js'

const DAY_SUN = new THREE.Vector3(58, 72, 34)
const NIGHT_SUN = new THREE.Vector3(-46, 54, -60)

const lerp = (a, b, t) => a + (b - a) * t

/**
 * The light rig.
 *
 * One `key` directional light does double duty: at night = 0 it is the
 * sun (warm, strong, one shadow map); at night = 1 it has swung round to
 * the moon position and gone cold and dim. Cross-fading one light instead
 * of owning two means exactly one shadow map is ever allocated and
 * exactly one shadow pass ever runs, whatever the time of day.
 *
 * Everything else -- the bulb point lights, the spot rig bolted to a
 * moving Ferris wheel arm, the tower spot -- is registered here with a
 * day intensity and a night intensity and fades between them.
 */
export class LightRig {
  constructor (scene) {
    this.scene = scene
    this.registered = []
    this.night = 0
    this._shadows = true
    this._dir = DAY_SUN.clone().normalize()

    this.hemi = new THREE.HemisphereLight(0xbcd6ff, 0x4a5236, 0.45)
    this.hemi.position.set(0, 60, 0)
    scene.add(this.hemi)

    this.key = new THREE.DirectionalLight(0xfff0d6, 4.2)
    this.key.position.copy(DAY_SUN)
    this.key.castShadow = true
    this.key.shadow.mapSize.set(2048, 2048)
    this.key.shadow.camera.near = 10
    this.key.shadow.camera.far = 260
    this.key.shadow.bias = -0.0009
    this.key.shadow.normalBias = 0.035
    this._fitShadow(78)
    scene.add(this.key)
    scene.add(this.key.target)

    // a cool fill from the opposite side so unlit faces are not black --
    // this is the "bounce" that a single directional light cannot give
    this.fill = new THREE.DirectionalLight(0x90b4ff, 0.22)
    this.fill.position.set(-52, 34, -44)
    scene.add(this.fill)

    this.ambient = new THREE.AmbientLight(0xffffff, 0.05)
    scene.add(this.ambient)
  }

  _fitShadow (half) {
    const c = this.key.shadow.camera
    c.left = -half; c.right = half; c.top = half; c.bottom = -half
    c.updateProjectionMatrix()
  }

  /** @param {THREE.Light} light */
  register (light, dayIntensity, nightIntensity, opts = {}) {
    this.registered.push({ light, day: dayIntensity, night: nightIntensity, ...opts })
    return light
  }

  /** A warm bulb-style point light. Kept few and deliberate: each one
   *  adds a loop iteration to every lit fragment in the scene. */
  addPoint (pos, { color = 0xffb45c, day = 0, night = 6, distance = 34, decay = 1.7 } = {}) {
    const l = new THREE.PointLight(color, 0, distance, decay)
    l.position.copy(pos)
    this.scene.add(l)
    return this.register(l, day, night)
  }

  /** A spot with a gobo cookie so the cone has structure instead of
   *  being a clean ice-cream cone. `parent` lets the caller bolt it into
   *  a moving part of a ride hierarchy. */
  addSpot (pos, targetPos, {
    color = 0xfff0cc, day = 0, night = 60, angle = 0.42, penumbra = 0.45,
    distance = 60, decay = 1.4, shadow = false, parent = null, cookie = true,
  } = {}) {
    const l = new THREE.SpotLight(color, 0, distance, angle, penumbra, decay)
    l.position.copy(pos)
    if (cookie) l.map = gobo()
    if (shadow) {
      l.castShadow = true
      l.shadow.mapSize.set(1024, 1024)
      l.shadow.camera.near = 1
      l.shadow.camera.far = distance
      l.shadow.bias = -0.0012
      l.shadow.normalBias = 0.03
      l.shadow.focus = 1.0
    }
    const host = parent || this.scene
    host.add(l)
    l.target.position.copy(targetPos)
    host.add(l.target)
    return this.register(l, day, night, { shadow })
  }

  setShadows (on) {
    this._shadows = on
    this.key.castShadow = on
    for (const r of this.registered) if (r.shadow) r.light.castShadow = on
  }

  setQuality ({ shadowMapSize, shadowExtent }) {
    if (this.key.shadow.mapSize.x !== shadowMapSize) {
      this.key.shadow.mapSize.set(shadowMapSize, shadowMapSize)
      this.key.shadow.map?.dispose()
      this.key.shadow.map = null
    }
    this._fitShadow(shadowExtent)
  }

  /** @param {number} n 0 = noon, 1 = midnight */
  setNight (n) {
    this.night = n
    const t = THREE.MathUtils.smoothstep(n, 0.0, 1.0)

    this._dir = new THREE.Vector3().lerpVectors(DAY_SUN, NIGHT_SUN, t).normalize()
    this.key.position.copy(this.key.target.position).addScaledVector(this._dir, 130)
    this.key.color.setRGB(
      lerp(1.00, 0.55, t),
      lerp(0.94, 0.66, t),
      lerp(0.84, 1.00, t)
    )
    // the sun does not just dim, it reddens first: keep a sunset bump
    const sunset = Math.exp(-Math.pow((n - 0.42) / 0.18, 2))
    this.key.intensity = lerp(4.2, 0.18, t) + sunset * 0.9
    this.key.color.r += sunset * 0.25
    this.key.color.g -= sunset * 0.10
    this.key.color.b -= sunset * 0.22

    this.hemi.intensity = lerp(0.45, 0.07, t)
    this.hemi.color.setRGB(lerp(0.74, 0.09, t), lerp(0.84, 0.11, t), lerp(1.0, 0.22, t))
    this.hemi.groundColor.setRGB(lerp(0.29, 0.05, t), lerp(0.32, 0.05, t), lerp(0.21, 0.07, t))

    this.fill.intensity = lerp(0.22, 0.05, t)
    this.ambient.intensity = lerp(0.05, 0.015, t)

    for (const r of this.registered) r.light.intensity = lerp(r.day, r.night, t)

    return t
  }

  /** Keep the shadow frustum centred on whatever we are looking at, so a
   *  2048 map is spent on the part of the park that is on screen. */
  follow (point) {
    this.key.target.position.set(point.x, 0, point.z)
    this.key.position.copy(this.key.target.position).addScaledVector(this._dir, 130)
    this.key.target.updateMatrixWorld()
    this.key.updateMatrixWorld()
  }

  get sunDirection () {
    return this._dir.clone()
  }
}
