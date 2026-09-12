import * as THREE from 'three'
import { glowSprite } from './textures.js'

const BULB_GEO = new THREE.IcosahedronGeometry(1, 0) // 20 tris; nobody will count them
// `vertexColors: true` makes three declare a `color` attribute in the
// vertex shader. Without a real buffer behind it the default attribute is
// black and every bulb goes out, so give the shared geometry a white one
// and let instanceColor do the actual tinting.
BULB_GEO.setAttribute('color', new THREE.BufferAttribute(
  new Float32Array(BULB_GEO.attributes.position.count * 3).fill(1), 3))

/**
 * Festoon lighting.
 *
 * Hundreds of bulbs, but never hundreds of lights. Each strand is exactly
 * two draw calls -- an InstancedMesh of emissive spheres and an additive
 * Points cloud for the bloom -- and both are parented straight into the
 * ride hierarchy, so a strand bolted to the wheel rim rotates with the
 * wheel for free with no per-frame matrix work.
 *
 * The chase animation writes per-instance colours into an InstancedBuffer
 * rather than touching transforms, so the matrices are uploaded once.
 */
export class Bulbs {
  constructor () {
    this.strands = []
    this.glowTex = glowSprite()
    this.enabled = true
    this._glowVisible = true
  }

  /**
   * @param {THREE.Object3D} parent  node in the scene graph to attach to
   * @param {THREE.Vector3[]} points bulb positions in the parent's local space
   */
  strand (parent, points, {
    radius = 0.085,
    glowSize = 0.85,
    palette = [0xffd08a, 0xffd08a, 0xff5566, 0x66e2ff],
    pattern = 'chase',
    speed = 2.4,
    order = null,
  } = {}) {
    const n = points.length
    if (!n) return null

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.0,
      roughness: 0.3,
      metalness: 0.0,
      vertexColors: true,
      toneMapped: true,
    })
    // vColor comes from instanceColor; three multiplies it into the
    // diffuse term by default -- push it onto the emissive term too so a
    // dark instance is genuinely a bulb that is off.
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor;'
      )
    }

    const mesh = new THREE.InstancedMesh(BULB_GEO, mat, n)
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.frustumCulled = false

    const dummy = new THREE.Object3D()
    const colors = new Float32Array(n * 3)
    const base = new Float32Array(n * 3)
    const glowPos = new Float32Array(n * 3)
    const c = new THREE.Color()

    points.forEach((p, i) => {
      dummy.position.copy(p)
      dummy.scale.setScalar(radius)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      c.setHex(palette[i % palette.length]).convertSRGBToLinear()
      base[i * 3] = c.r; base[i * 3 + 1] = c.g; base[i * 3 + 2] = c.b
      glowPos[i * 3] = p.x; glowPos[i * 3 + 1] = p.y; glowPos[i * 3 + 2] = p.z
    })
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
    mesh.instanceMatrix.needsUpdate = true
    parent.add(mesh)

    const gGeo = new THREE.BufferGeometry()
    gGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3))
    gGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    const gMat = new THREE.PointsMaterial({
      map: this.glowTex,
      size: glowSize,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      toneMapped: false,
    })
    const glow = new THREE.Points(gGeo, gMat)
    glow.frustumCulled = false
    glow.renderOrder = 5
    parent.add(glow)

    const strand = {
      mesh, glow, n, base, colors,
      glowColors: gGeo.attributes.color,
      pattern, speed,
      order: order || points.map((_, i) => i),
      phase: Math.random() * 6.28,
    }
    this.strands.push(strand)
    return strand
  }

  setGlowVisible (v) {
    this._glowVisible = v
    for (const s of this.strands) s.glow.visible = v && this.enabled
  }

  /**
   * @param {number} t seconds
   * @param {number} night 0..1
   */
  update (t, night) {
    const lit = THREE.MathUtils.smoothstep(night, 0.12, 0.62)
    for (const s of this.strands) {
      const { n, base, colors, order } = s
      const gc = s.glowColors.array
      for (let k = 0; k < n; k++) {
        const i = order[k]
        let a
        switch (s.pattern) {
          case 'chase':
            a = 0.5 + 0.5 * Math.cos((k / n) * Math.PI * 2 * 4 - t * s.speed + s.phase)
            a = 0.22 + 0.78 * Math.pow(a, 3)
            break
          case 'twinkle':
            a = 0.55 + 0.45 * Math.sin(t * s.speed + k * 1.7 + s.phase)
            break
          case 'pulse':
            a = 0.45 + 0.55 * Math.sin(t * s.speed + s.phase)
            break
          default:
            a = 1
        }
        // by day the bulbs are dull painted glass; the emissive only
        // takes over as the sky goes out
        const e = a * (0.06 + 2.6 * lit)
        colors[i * 3] = base[i * 3] * e
        colors[i * 3 + 1] = base[i * 3 + 1] * e
        colors[i * 3 + 2] = base[i * 3 + 2] * e
        const g = a * lit * 1.15
        gc[i * 3] = base[i * 3] * g
        gc[i * 3 + 1] = base[i * 3 + 1] * g
        gc[i * 3 + 2] = base[i * 3 + 2] * g
      }
      s.mesh.instanceColor.needsUpdate = true
      s.glowColors.needsUpdate = true
      s.glow.visible = this._glowVisible && lit > 0.01
    }
  }

  get bulbCount () {
    return this.strands.reduce((a, s) => a + s.n, 0)
  }

  get drawCalls () {
    return this.strands.length * 2
  }
}

/** Evenly spaced points around a circle in the XY plane (wheel-friendly). */
export function ringPointsXY (radius, count, z = 0, phase = 0) {
  const out = []
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2
    out.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, z))
  }
  return out
}

/** Evenly spaced points around a circle in the XZ plane (carousel-friendly). */
export function ringPointsXZ (radius, count, y = 0, phase = 0) {
  const out = []
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2
    out.push(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius))
  }
  return out
}

/** Sagging catenary between two points, sampled for festoon strings. */
export function catenary (a, b, sag, count) {
  const out = []
  for (let i = 0; i <= count; i++) {
    const t = i / count
    const p = new THREE.Vector3().lerpVectors(a, b, t)
    p.y -= sag * Math.sin(Math.PI * t) * (1 - 0.25 * Math.cos(Math.PI * t))
    out.push(p)
  }
  return out
}
