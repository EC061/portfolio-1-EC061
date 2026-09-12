import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * ============================================================
 *  The one model in this scene that is genuinely hand-authored.
 * ============================================================
 *
 * The gondola is built from a single closed 2D outline (a rounded
 * rectangle in the XZ plane, 1.5 m across x 2.5 m along the axle) which is
 * swept along a hand-placed 2D profile to make the tub, then capped.
 *
 * UV LAYOUT -- three deliberately different unwraps, one per material:
 *
 *  1. HULL + RIM  (painted)
 *     u = arc length around the outline / total perimeter
 *     v = arc length along the sweep profile / total profile length
 *     Both axes are arc-length parameterised, not index parameterised.
 *     That is the whole point: the outline's corner arcs pack points
 *     close together and its straight runs pack them far apart, so an
 *     index-based u would squeeze the painted stripes at the corners and
 *     stretch them along the flanks. With arc length, every stripe is the
 *     same number of centimetres wide the whole way round, and the
 *     vertical seam lands at the stern (u = 0 = 1) where the hanger
 *     bracket hides it.
 *
 *  2. CANOPY  (painted, same texture)
 *     u = arc length around the eave, v = 0..1 from eave to ridge.
 *     The canopy is a fan of scaled copies of the same outline, so the
 *     stripes on the roof line up exactly with the stripes on the hull.
 *
 *  3. FLOOR + BENCHES  (wood)
 *     Planar projection straight down Y: u = x / width, v = z / length.
 *     Deck planks are straight, so they get a straight projection --
 *     wrapping the arc-length unwrap onto the floor would bend the planks
 *     around the corners.
 *
 * The returned geometries are in gondola-local space with the origin at
 * the hanger pivot, which is what lets the wheel hierarchy hang them.
 */

// The origin is the hanger pivot, and the pivot has to sit ABOVE the
// canopy -- on a real gondola the bearing is over the roof and the arms
// come down the outside, precisely so that nothing structural passes
// through the space the riders occupy. Putting the axle at seated eye
// height is the classic way to build a gondola that looks fine from the
// ground and is unusable from the seat.
const RIM_Y = -1.57
const FLOOR_Y = RIM_Y - 0.85
const EAVE_Y = RIM_Y + 1.07
const HALF_X = 0.75
const HALF_Z = 1.25
const CORNER_R = 0.55

/* ---------- 1. the outline ---------- */

function roundedRectOutline (hx, hz, r, segPerCorner = 10) {
  const pts = []
  const corners = [
    [hx - r, hz - r, 0],
    [-hx + r, hz - r, Math.PI / 2],
    [-hx + r, -hz + r, Math.PI],
    [hx - r, -hz + r, 3 * Math.PI / 2],
  ]
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= segPerCorner; i++) {
      const a = a0 + (i / segPerCorner) * Math.PI / 2
      const p = new THREE.Vector2(cx + Math.cos(a) * r, cz + Math.sin(a) * r)
      if (pts.length && p.distanceTo(pts[pts.length - 1]) < 1e-6) continue
      pts.push(p)
    }
  }
  return pts
}

/** Resample a closed polyline to `n` points spaced equally by arc length. */
function resampleClosed (pts, n) {
  const seg = []
  let total = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    const d = a.distanceTo(b)
    seg.push({ a, b, d, s: total })
    total += d
  }
  const out = []
  for (let i = 0; i < n; i++) {
    const target = (i / n) * total
    let k = 0
    while (k < seg.length - 1 && seg[k].s + seg[k].d < target) k++
    const t = (target - seg[k].s) / seg[k].d
    out.push(new THREE.Vector2().lerpVectors(seg[k].a, seg[k].b, t))
  }
  out.perimeter = total
  return out
}

/** Outward 2D normals, oriented away from the centroid. */
function outwardNormals (loop) {
  const c = new THREE.Vector2()
  for (const p of loop) c.add(p)
  c.divideScalar(loop.length)
  return loop.map((p, i) => {
    const prev = loop[(i - 1 + loop.length) % loop.length]
    const next = loop[(i + 1) % loop.length]
    const t = new THREE.Vector2().subVectors(next, prev).normalize()
    const n = new THREE.Vector2(t.y, -t.x)
    if (n.dot(new THREE.Vector2().subVectors(p, c)) < 0) n.negate()
    return n
  })
}

/* ---------- 2. the sweep ---------- */

/**
 * Sweep `loop` along `profile` (offset along the outward normal, height).
 * Produces the arc-length UVs described at the top of this file.
 */
function sweep (loop, normals, profile, { uRepeat = 1, flip = false } = {}) {
  const N = loop.length
  const M = profile.length

  // cumulative arc length around the outline -> u
  const uCoord = new Float32Array(N + 1)
  let acc = 0
  for (let i = 1; i <= N; i++) {
    acc += loop[i % N].distanceTo(loop[i - 1])
    uCoord[i] = acc
  }
  for (let i = 0; i <= N; i++) uCoord[i] = (uCoord[i] / acc) * uRepeat

  // cumulative arc length along the profile -> v
  const vCoord = new Float32Array(M)
  let vacc = 0
  for (let j = 1; j < M; j++) {
    vacc += Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1])
    vCoord[j] = vacc
  }
  for (let j = 0; j < M; j++) vCoord[j] = vCoord[j] / (vacc || 1)

  const pos = []
  const uv = []
  for (let i = 0; i <= N; i++) {
    const p = loop[i % N]
    const n = normals[i % N]
    for (let j = 0; j < M; j++) {
      const [off, y] = profile[j]
      pos.push(p.x + n.x * off, y, p.y + n.y * off)
      uv.push(uCoord[i], vCoord[j])
    }
  }

  const idx = []
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M - 1; j++) {
      const a = i * M + j
      const b = (i + 1) * M + j
      if (flip) idx.push(a, a + 1, b, a + 1, b + 1, b)
      else idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Fan of scaled outline copies -- used for the canopy. */
function fanCap (loop, rings, { uRepeat = 1 } = {}) {
  const N = loop.length
  const c = new THREE.Vector2()
  for (const p of loop) c.add(p)
  c.divideScalar(N)

  const uCoord = new Float32Array(N + 1)
  let acc = 0
  for (let i = 1; i <= N; i++) {
    acc += loop[i % N].distanceTo(loop[i - 1])
    uCoord[i] = acc
  }
  for (let i = 0; i <= N; i++) uCoord[i] = (uCoord[i] / acc) * uRepeat

  const pos = []
  const uv = []
  for (let i = 0; i <= N; i++) {
    const p = loop[i % N]
    rings.forEach((r, j) => {
      pos.push(c.x + (p.x - c.x) * r.scale, r.y, c.y + (p.y - c.y) * r.scale)
      uv.push(uCoord[i], j / (rings.length - 1))
    })
  }
  const M = rings.length
  const idx = []
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M - 1; j++) {
      const a = i * M + j, b = (i + 1) * M + j
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Triangle fan over the outline with a planar (top-down) projection. */
function planarFloor (loop, y, inset, { tile = 1 } = {}) {
  const c = new THREE.Vector2()
  for (const p of loop) c.add(p)
  c.divideScalar(loop.length)
  const normals = outwardNormals(loop)

  const pos = [c.x, y, c.y]
  const uv = []
  const spanX = HALF_X * 2, spanZ = HALF_Z * 2
  const push = (x, z) => uv.push((x / spanX + 0.5) * tile, (z / spanZ + 0.5) * tile * (spanZ / spanX))
  push(c.x, c.y)
  loop.forEach((p, i) => {
    const n = normals[i]
    const x = p.x + n.x * inset, z = p.y + n.y * inset
    pos.push(x, y, z)
    push(x, z)
  })
  const idx = []
  for (let i = 1; i <= loop.length; i++) idx.push(0, i, i === loop.length ? 1 : i + 1)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/* ---------- 3. assembly ---------- */

function box (w, h, d, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.rotateY(ry)
  g.translate(x, y, z)
  return g
}

/** A cylinder spanning two points -- the honest way to build a strut. */
function strut (a, b, r) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const g = new THREE.CylinderGeometry(r, r, dir.length(), 8, 1)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), dir.clone().normalize()))
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
  return g
}

function tube (r, len, x, y, z, axis = 'y') {
  const g = new THREE.CylinderGeometry(r, r, len, 10, 1)
  if (axis === 'z') g.rotateX(Math.PI / 2)
  if (axis === 'x') g.rotateZ(Math.PI / 2)
  g.translate(x, y, z)
  return g
}

/**
 * @returns {{paint: BufferGeometry, deck: BufferGeometry, frame: BufferGeometry,
 *            seatOffsets: Vector3[], stats: object}}
 */
export function buildGondolaGeometry ({ segments = 44 } = {}) {
  const raw = roundedRectOutline(HALF_X, HALF_Z, CORNER_R)
  const loop = resampleClosed(raw, segments)
  const normals = outwardNormals(loop)

  // profile: [offset along outward normal, height]
  // down the outside, over the rim lip, back down the inside
  // [outward offset, depth below the rim]
  const hullProfile = [
    [-0.40, -0.85],
    [-0.30, -0.75],
    [-0.14, -0.57],
    [-0.04, -0.27],
    [0.00, -0.10],
    [0.02, 0.00],           // rim lip, flared out a touch
    [-0.05, 0.00],          // over the top
    [-0.07, -0.11],
    [-0.12, -0.27],
    [-0.22, -0.57],
    [-0.38, -0.75],
    [-0.46, -0.85],
  ].map(([off, d]) => [off, RIM_Y + d])

  const hull = sweep(loop, normals, hullProfile, { uRepeat: 1 })

  // canopy: eave ring at 1.10x the outline, ridge collapsed to 12%
  const canopy = fanCap(loop, [
    { scale: 1.14, y: EAVE_Y },
    { scale: 1.10, y: EAVE_Y + 0.07 },
    { scale: 0.86, y: EAVE_Y + 0.20 },
    { scale: 0.52, y: EAVE_Y + 0.30 },
    { scale: 0.16, y: EAVE_Y + 0.35 },
    { scale: 0.00, y: EAVE_Y + 0.36 },
  ], { uRepeat: 1 })

  // rim tube follows the same outline, so it never parts from the hull
  const rimCurve = new THREE.CatmullRomCurve3(
    loop.map(p => new THREE.Vector3(p.x, RIM_Y + 0.015, p.y)), true, 'centripetal'
  )
  const rim = new THREE.TubeGeometry(rimCurve, segments, 0.055, 6, true)

  const floor = planarFloor(loop, FLOOR_Y + 0.02, -0.46, { tile: 1.0 })

  // two benches facing each other across the tub's short axis
  const benchGeos = []
  const seatOffsets = []
  const PAN_Y = RIM_Y - 0.43
  for (const s of [-1, 1]) {
    benchGeos.push(box(1.06, 0.09, 0.46, 0, PAN_Y, s * 0.66))            // seat pan
    benchGeos.push(box(1.06, 0.42, 0.07, 0, PAN_Y + 0.20, s * 0.90))     // backrest
    benchGeos.push(box(0.10, 0.36, 0.40, -0.48, PAN_Y - 0.20, s * 0.66)) // legs
    benchGeos.push(box(0.10, 0.36, 0.40, 0.48, PAN_Y - 0.20, s * 0.66))
    // seated eye, 0.78 m above the pan -- 0.35 m clear of the rim, so a
    // rider looks out over the edge and not at the inside of the tub
    seatOffsets.push(new THREE.Vector3(0, PAN_Y + 0.82, s * 0.62))
  }

  // hanger frame: pivot axle along Z at y = 0, a short drop at each end,
  // then A-frame legs splaying down the OUTSIDE of the canopy to the rim
  const SHOULDER_Y = -0.46
  const frameGeos = [
    tube(0.085, 2.90, 0, 0, 0, 'z'),                       // pivot axle
    tube(0.075, 0.46, 0, SHOULDER_Y / 2, 1.34, 'y'),
    tube(0.075, 0.46, 0, SHOULDER_Y / 2, -1.34, 'y'),
  ]
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      frameGeos.push(strut(
        new THREE.Vector3(0, SHOULDER_Y, sz * 1.34),
        new THREE.Vector3(sx * 0.68, RIM_Y + 0.04, sz * 1.34),
        0.05
      ))
    }
    // canopy posts at the corners
    for (const sx of [-1, 1]) {
      frameGeos.push(tube(0.040, EAVE_Y - RIM_Y, sx * (HALF_X - 0.10), (RIM_Y + EAVE_Y) / 2, sz * (HALF_Z - 0.16), 'y'))
    }
  }
  frameGeos.push(rim)

  const paint = mergeGeometries([hull, canopy], false)
  const deck = mergeGeometries([floor, ...benchGeos], false)
  const frame = mergeGeometries(frameGeos, false)

  const tris = [paint, deck, frame].reduce((n, g) => n + g.index.count / 3, 0)

  return {
    paint,
    deck,
    frame,
    seatOffsets,
    stats: { triangles: tris, perimeter: loop.perimeter, segments },
  }
}
