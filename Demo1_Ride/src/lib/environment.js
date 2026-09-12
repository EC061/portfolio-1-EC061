import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { catenary } from './bulbs.js'
import { makeNoise } from './textures.js'

const rng = makeNoise(7717)

/**
 * Static scenery.
 *
 * Everything here is authored as loose little geometries and then merged
 * per material before it reaches the scene, so ~1400 individual pieces of
 * fence, tree, booth and lamp post arrive at the GPU as about a dozen
 * draw calls. Nothing in this file moves, so the merge costs nothing at
 * runtime -- the transforms are baked into the vertex buffer once.
 */
class Batch {
  constructor () { this.byMat = new Map() }

  add (mat, geo, matrix) {
    const g = matrix ? geo.clone().applyMatrix4(matrix) : geo
    if (!this.byMat.has(mat)) this.byMat.set(mat, [])
    this.byMat.get(mat).push(g)
    return this
  }

  flush (parent, { cast = true, receive = true, name = 'batch' } = {}) {
    const out = []
    for (const [mat, list] of this.byMat) {
      const merged = mergeGeometries(list, false)
      if (!merged) continue
      const mesh = new THREE.Mesh(merged, mat)
      mesh.castShadow = cast
      mesh.receiveShadow = receive
      mesh.name = `${name}:${mat.uuid.slice(0, 6)}`
      mesh.matrixAutoUpdate = false
      mesh.updateMatrix()
      parent.add(mesh)
      out.push(mesh)
      for (const g of list) g.dispose?.()
    }
    this.byMat.clear()
    return out
  }
}

const M4 = () => new THREE.Matrix4()
function trs (x, y, z, ry = 0, s = 1, rx = 0) {
  const m = M4()
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0))
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s))
  return m
}

export const PARK = {
  plazaRadius: 46,
  fenceRadius: 74,
  ridePads: [
    { x: 0, z: 0, r: 22 },      // ferris wheel
    { x: -30, z: 22, r: 13 },   // swing carousel
    { x: 30, z: 20, r: 11 },    // teacups
  ],
}

function clearOfRides (x, z, pad = 4) {
  for (const p of PARK.ridePads) {
    if (Math.hypot(x - p.x, z - p.z) < p.r + pad) return false
  }
  return true
}

export function buildEnvironment (scene, M, rig, bulbs) {
  const group = new THREE.Group()
  group.name = 'environment'
  scene.add(group)

  /* ---------- ground ---------- */
  M.ground.envMapIntensity = 0.5
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 1, 1), M.ground)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  ground.name = 'ground'
  group.add(ground)

  // the trodden midway: a disc plus a ring road, lifted a hair and given
  // a polygon offset so it never z-fights with the grass
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(PARK.plazaRadius, 72), M.path)
  plaza.rotation.x = -Math.PI / 2
  plaza.position.y = 0.02
  plaza.receiveShadow = true
  group.add(plaza)

  const ringRoad = new THREE.Mesh(new THREE.RingGeometry(PARK.plazaRadius + 6, PARK.plazaRadius + 12, 84, 1), M.path)
  ringRoad.rotation.x = -Math.PI / 2
  ringRoad.position.y = 0.018
  ringRoad.receiveShadow = true
  group.add(ringRoad)

  /* ---------- distant hills ---------- */
  {
    const hills = new Batch()
    const cone = new THREE.ConeGeometry(1, 1, 7, 1)
    cone.translate(0, 0.5, 0)
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + rng.rnd() * 0.06
      const d = 300 + rng.rnd() * 120
      const s = 40 + rng.rnd() * 70
      const m = M4().compose(
        new THREE.Vector3(Math.cos(a) * d, -6, Math.sin(a) * d),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng.rnd() * 3, 0)),
        new THREE.Vector3(s * (1.4 + rng.rnd()), s * (0.34 + rng.rnd() * 0.3), s * (1.4 + rng.rnd()))
      )
      hills.add(M.hill, cone, m)
    }
    const meshes = hills.flush(group, { cast: false, receive: false, name: 'hills' })
    for (const mesh of meshes) mesh.frustumCulled = false
    cone.dispose()
  }

  /* ---------- trees ---------- */
  {
    const trunkGeo = new THREE.CylinderGeometry(0.17, 0.30, 3.2, 6, 1)
    trunkGeo.translate(0, 1.6, 0)
    const leafGeo = new THREE.IcosahedronGeometry(1, 1)
    const batch = new Batch()
    let placed = 0
    for (let i = 0; i < 3000 && placed < 220; i++) {
      const a = rng.rnd() * Math.PI * 2
      const d = 58 + Math.pow(rng.rnd(), 0.62) * 190
      const x = Math.cos(a) * d, z = Math.sin(a) * d
      if (!clearOfRides(x, z, 6)) continue
      if (Math.hypot(x, z) < PARK.fenceRadius + 3 && Math.abs(Math.atan2(z, x)) < 0.28) continue // keep the gate clear
      placed++
      const s = 0.8 + rng.rnd() * 0.9
      const ry = rng.rnd() * 6.28
      batch.add(M.bark, trunkGeo, trs(x, 0, z, ry, s))
      for (let k = 0; k < 3; k++) {
        const r = (1.5 + rng.rnd() * 0.8) * s
        batch.add(M.leaves, leafGeo, M4().compose(
          new THREE.Vector3(x + (rng.rnd() - 0.5) * 1.6 * s, (3.0 + rng.rnd() * 1.6) * s, z + (rng.rnd() - 0.5) * 1.6 * s),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.rnd() * 3, rng.rnd() * 3, rng.rnd() * 3)),
          new THREE.Vector3(r, r * 0.82, r)
        ))
      }
    }
    batch.flush(group, { cast: true, receive: true, name: 'trees' })
    trunkGeo.dispose(); leafGeo.dispose()
  }

  /* ---------- perimeter fence ---------- */
  {
    const batch = new Batch()
    const post = new THREE.BoxGeometry(0.16, 1.5, 0.16)
    post.translate(0, 0.75, 0)
    const N = 190
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      if (Math.abs(a) < 0.2 || Math.abs(a - Math.PI * 2) < 0.2) continue // gate gap
      batch.add(M.steelDark, post, trs(Math.cos(a) * PARK.fenceRadius, 0, Math.sin(a) * PARK.fenceRadius, -a))
    }
    for (const y of [0.55, 1.25]) {
      const rail = new THREE.TorusGeometry(PARK.fenceRadius, 0.045, 5, 220)
      rail.rotateX(Math.PI / 2)
      rail.translate(0, y, 0)
      batch.add(M.steelDark, rail)
    }
    batch.flush(group, { cast: true, receive: false, name: 'fence' })
    post.dispose()
  }

  /* ---------- booths around the plaza ---------- */
  {
    const batch = new Batch()
    const wall = new THREE.BoxGeometry(4.4, 2.6, 3.2)
    wall.translate(0, 1.3, 0)
    const counter = new THREE.BoxGeometry(4.8, 0.18, 0.9)
    counter.translate(0, 1.15, 1.75)
    const roof = new THREE.ConeGeometry(3.9, 1.5, 8, 1)
    roof.translate(0, 3.4, 0)
    const booths = 11
    for (let i = 0; i < booths; i++) {
      const a = (i / booths) * Math.PI * 2 + 0.34
      const d = PARK.plazaRadius - 4.5
      const x = Math.cos(a) * d, z = Math.sin(a) * d
      if (!clearOfRides(x, z, 6)) continue
      const m = trs(x, 0, z, -a + Math.PI / 2)
      batch.add(M.decking, wall, m)
      batch.add(M.decking, counter, m)
      batch.add(i % 2 ? M.tent : M.tentB, roof, m)
    }
    batch.flush(group, { cast: true, receive: true, name: 'booths' })
    wall.dispose(); counter.dispose(); roof.dispose()
  }

  /* ---------- lamp posts + festoon strings ---------- */
  const festoonPts = []
  {
    const batch = new Batch()
    const pole = new THREE.CylinderGeometry(0.11, 0.17, 7.0, 8, 1)
    pole.translate(0, 3.5, 0)
    const cap = new THREE.SphereGeometry(0.26, 10, 8)
    cap.translate(0, 7.1, 0)
    const N = 14
    const R = PARK.plazaRadius + 2.4
    const tops = []
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const x = Math.cos(a) * R, z = Math.sin(a) * R
      batch.add(M.steelDark, pole, trs(x, 0, z))
      batch.add(M.gold, cap, trs(x, 0, z))
      tops.push(new THREE.Vector3(x, 6.6, z))
    }
    // festoon between neighbours: one cable tube per span, merged, and
    // one shared bulb strand for every bulb on every span
    for (let i = 0; i < N; i++) {
      const a = tops[i], b = tops[(i + 1) % N]
      const pts = catenary(a, b, 1.5, 14)
      const curve = new THREE.CatmullRomCurve3(pts)
      batch.add(M.cable, new THREE.TubeGeometry(curve, 14, 0.022, 4, false))
      for (let k = 1; k < pts.length - 1; k++) festoonPts.push(pts[k].clone().setY(pts[k].y - 0.16))
    }
    batch.flush(group, { cast: true, receive: false, name: 'lamps' })
    pole.dispose(); cap.dispose()

    bulbs.strand(group, festoonPts, {
      radius: 0.1, glowSize: 1.05, pattern: 'twinkle', speed: 1.1,
      palette: [0xffd9a0, 0xffb066, 0xfff0cf],
    })

    // only three of the fourteen posts get a real point light; the rest
    // are sold entirely by the emissive bulbs and the glow sprites
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.6
      rig.addPoint(new THREE.Vector3(Math.cos(a) * R, 6.4, Math.sin(a) * R), {
        color: 0xffb45c, night: 90, distance: 42, decay: 1.9,
      })
    }
  }

  /* ---------- entrance arch ---------- */
  {
    const batch = new Batch()
    const gx = PARK.fenceRadius
    const leg = new THREE.CylinderGeometry(0.34, 0.42, 9.0, 10, 1)
    leg.translate(0, 4.5, 0)
    batch.add(M.steel, leg, trs(gx, 0, 4.6))
    batch.add(M.steel, leg, trs(gx, 0, -4.6))
    const span = new THREE.BoxGeometry(0.5, 0.5, 9.6)
    batch.add(M.steel, span, trs(gx, 9.0, 0))
    const truss = new THREE.TorusGeometry(4.8, 0.16, 5, 28, Math.PI)
    truss.rotateY(Math.PI / 2)
    batch.add(M.steel, truss, trs(gx, 9.0, 0))
    batch.flush(group, { name: 'arch' })
    leg.dispose(); span.dispose(); truss.dispose()

    const board = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 2.25), M.signFace('MIDWAY', 'EST. 2026'))
    board.position.set(gx - 0.32, 10.4, 0)
    board.rotation.y = Math.PI / 2
    board.castShadow = false
    group.add(board)
    const back = board.clone()
    back.material = M.signFace('MIDWAY', 'EST. 2026')
    back.rotation.y = -Math.PI / 2
    back.position.x = gx + 0.32
    group.add(back)
    group.userData.signs = [board.material, back.material]

    bulbs.strand(group, [
      ...Array.from({ length: 22 }, (_, i) => new THREE.Vector3(gx, 12.0 - 0.0, -4.4 + i * 0.42)),
      ...Array.from({ length: 22 }, (_, i) => new THREE.Vector3(gx, 8.75, -4.4 + i * 0.42)),
    ], { radius: 0.11, glowSize: 1.2, pattern: 'chase', speed: 5.0, palette: [0xffe9b0, 0xff6b6b] })

    rig.addSpot(new THREE.Vector3(gx - 6, 11, 0), new THREE.Vector3(gx, 10.4, 0), {
      color: 0xfff2d0, night: 120, angle: 0.36, penumbra: 0.5, distance: 26, cookie: false,
    })
  }

  /* ---------- park benches ---------- */
  {
    const batch = new Batch()
    const seat = new THREE.BoxGeometry(2.0, 0.12, 0.55)
    seat.translate(0, 0.48, 0)
    const backr = new THREE.BoxGeometry(2.0, 0.5, 0.1)
    backr.translate(0, 0.82, -0.26)
    const legG = new THREE.BoxGeometry(0.12, 0.48, 0.5)
    legG.translate(0, 0.24, 0)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.15
      const d = PARK.plazaRadius - 11
      const x = Math.cos(a) * d, z = Math.sin(a) * d
      if (!clearOfRides(x, z, 3)) continue
      const m = trs(x, 0, z, -a + Math.PI / 2)
      batch.add(M.decking, seat, m)
      batch.add(M.decking, backr, m)
      batch.add(M.steelDark, legG, trs(x - Math.sin(-a + Math.PI / 2) * 0, 0, z).multiply(M4()))
      for (const s of [-0.8, 0.8]) {
        const lm = trs(x, 0, z, -a + Math.PI / 2)
        lm.multiply(M4().makeTranslation(s, 0, 0))
        batch.add(M.steelDark, legG, lm)
      }
    }
    batch.flush(group, { name: 'benches' })
    seat.dispose(); backr.dispose(); legG.dispose()
  }

  return { group, ground, plaza, festoonCount: festoonPts.length }
}
