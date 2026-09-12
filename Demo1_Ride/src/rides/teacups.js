import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { ringPointsXZ } from '../lib/bulbs.js'

/**
 * ==========================================================
 *  TEACUPS -- three rotations stacked on one axis
 * ==========================================================
 *
 *  root
 *   └─ platform (L1) rotation.y = a      the whole floor turns
 *       └─ pod[j]   (L2) rotation.y = -b  three turntables counter-rotating
 *           └─ cup[k]  (L3) rotation.y = c   each cup spins on its pod
 *               └─ seat    (L4) small lean from the lateral acceleration
 *                   └─ camera
 *
 * This is the ride where the hierarchy is the entire experience. A cup's
 * world path is the composition of three rotations about three different
 * (moving) centres -- an epitrochoid you could not write down in closed
 * form and would never author by hand. In the scene graph it is three
 * numbers.
 *
 * The counter-rotating pods are the "wrong without the hierarchy" case
 * here: pod b is negative, so the cups fight the floor, and the world
 * speed of a cup swings between a+b and a-b twice per pod revolution.
 */

const N_PODS = 3
const CUPS_PER_POD = 3
const POD_R = 5.4       // pod centre distance from the floor centre, m
const CUP_R = 2.3       // cup distance from its pod centre, m
const FLOOR_PERIOD = 12.0
const POD_PERIOD = 7.0

export function createTeacups ({ scene, M, rig, bulbs, position = new THREE.Vector3(0, 0, 0) }) {
  const root = new THREE.Group()
  root.name = 'teacups'
  root.position.copy(position)
  scene.add(root)

  /* ---------------- static shell ---------------- */
  {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 10.2, 1.1, 40, 1), M.decking)
    skirt.position.y = 0.55
    skirt.castShadow = true
    skirt.receiveShadow = true
    root.add(skirt)

    const fence = new THREE.Mesh(new THREE.TorusGeometry(10.1, 0.06, 5, 60), M.gold)
    fence.rotation.x = Math.PI / 2
    fence.position.y = 1.5
    fence.castShadow = true
    root.add(fence)

    // a little roof on four posts, so the cups sit in shadow at noon --
    // a cheap way to show the directional light's shadow moving
    const posts = []
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      const p = new THREE.CylinderGeometry(0.16, 0.2, 6.2, 8, 1)
      p.translate(Math.cos(a) * 8.9, 3.1, Math.sin(a) * 8.9)
      posts.push(p)
    }
    const postMesh = new THREE.Mesh(mergeGeometries(posts, false), M.steel)
    postMesh.castShadow = true
    root.add(postMesh)
    posts.forEach(g => g.dispose())

    const roof = new THREE.Mesh(new THREE.ConeGeometry(11.4, 2.6, 16, 1, true), M.tentB)
    roof.position.y = 7.5
    roof.castShadow = true
    roof.receiveShadow = true
    root.add(roof)

    bulbs.strand(root, ringPointsXZ(11.2, 34, 6.35), {
      radius: 0.1, glowSize: 1.0, pattern: 'chase', speed: -3.6,
      palette: [0xffe3a0, 0xff8bd0],
    })

    const board = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.35), M.signFace('TEA CUPS', 'HOLD ON'))
    board.position.set(0, 9.1, 0.05)
    root.add(board)
    const board2 = board.clone()
    board2.material = M.signFace('TEA CUPS', 'HOLD ON')
    board2.rotation.y = Math.PI
    board2.position.z = -0.05
    root.add(board2)
    root.userData.signs = [board.material, board2.material]
  }

  /* ---------------- L1 ---------------- */
  const platform = new THREE.Group()
  platform.name = 'L1_teacupFloor'
  platform.position.y = 1.1
  root.add(platform)

  const floor = new THREE.Mesh(new THREE.CylinderGeometry(9.4, 9.4, 0.22, 48, 1), M.decking)
  floor.receiveShadow = true
  floor.castShadow = true
  platform.add(floor)

  /* ---------------- cup geometry (lathed) ---------------- */
  const cupBody = (() => {
    // hand-placed lathe profile: a saucer that flares into a cup
    const pts = [
      [0.00, 0.00], [1.18, 0.00], [1.30, 0.10], [1.24, 0.16],
      [0.60, 0.22], [0.66, 0.50], [0.86, 0.92], [1.02, 1.36],
      [1.06, 1.52], [0.99, 1.54], [0.93, 1.34], [0.78, 0.92],
      [0.58, 0.50], [0.52, 0.24], [0.00, 0.20],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    const g = new THREE.LatheGeometry(pts, 28)
    // LatheGeometry's own UVs are (theta, profile index) -- fine for a
    // radially symmetric painted cup, and it means the stripes line up
    // with the stripes on the Ferris wheel gondolas.
    return g
  })()

  const cupTrim = (() => {
    const parts = []
    const lip = new THREE.TorusGeometry(1.04, 0.07, 6, 28)
    lip.rotateX(Math.PI / 2)
    lip.translate(0, 1.5, 0)
    parts.push(lip)
    const handle = new THREE.TorusGeometry(0.36, 0.075, 6, 18, Math.PI * 1.35)
    handle.rotateY(Math.PI / 2)
    handle.rotateZ(-0.4)
    handle.translate(1.18, 1.02, 0)
    parts.push(handle)
    const wheel = new THREE.TorusGeometry(0.42, 0.06, 6, 20)
    wheel.translate(0, 1.12, 0)
    parts.push(wheel)
    const spoke = new THREE.CylinderGeometry(0.035, 0.035, 0.84, 5, 1)
    spoke.rotateZ(Math.PI / 2)
    spoke.translate(0, 1.12, 0)
    parts.push(spoke)
    return mergeGeometries(parts, false)
  })()

  const cupSeat = (() => {
    const parts = []
    const ring = new THREE.CylinderGeometry(0.86, 0.86, 0.12, 20, 1)
    ring.translate(0, 0.62, 0)
    parts.push(ring)
    return mergeGeometries(parts, false)
  })()

  const N = N_PODS * CUPS_PER_POD
  const bodyI = new THREE.InstancedMesh(cupBody, M.hull, N)
  const trimI = new THREE.InstancedMesh(cupTrim, M.gold, N)
  const seatI = new THREE.InstancedMesh(cupSeat, M.deck, N)
  const instanced = [bodyI, trimI, seatI]
  for (const m of instanced) {
    m.castShadow = true
    m.receiveShadow = true
    m.frustumCulled = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scene.add(m)
  }

  /* ---------------- L2 / L3 / L4 ---------------- */
  const pods = []
  const cups = []
  for (let j = 0; j < N_PODS; j++) {
    const a = (j / N_PODS) * Math.PI * 2
    const pod = new THREE.Group()                       // L2
    pod.name = `L2_pod_${j}`
    pod.position.set(Math.cos(a) * POD_R, 0.11, Math.sin(a) * POD_R)
    platform.add(pod)

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.16, 28, 1), M.steelDark)
    disc.receiveShadow = true
    disc.castShadow = true
    pod.add(disc)

    bulbs.strand(pod, ringPointsXZ(3.4, 14, 0.12), {
      radius: 0.07, glowSize: 0.6, pattern: 'chase', speed: 5.5,
      palette: [0xffffff, 0x66ccff],
    })

    for (let k = 0; k < CUPS_PER_POD; k++) {
      const b = (k / CUPS_PER_POD) * Math.PI * 2
      const cup = new THREE.Group()                      // L3
      cup.name = `L3_cup_${j}_${k}`
      cup.position.set(Math.cos(b) * CUP_R, 0.08, Math.sin(b) * CUP_R)
      pod.add(cup)

      const seat = new THREE.Group()                     // L4
      seat.name = `L4_cupSeat_${j}_${k}`
      cup.add(seat)

      const idx = cups.length
      cups.push({ idx, cup, seat, spin: Math.random() * 6.28, rate: 0.7 + Math.random() * 0.9, lean: 0 })
    }
    pods.push({ pod, j })
  }

  rig.addPoint(new THREE.Vector3(position.x, 6.6, position.z), {
    color: 0xffd9b0, night: 150, distance: 34, decay: 1.8,
  })
  rig.addSpot(
    new THREE.Vector3(position.x + 2, 7.0, position.z + 2),
    new THREE.Vector3(position.x, 1.2, position.z),
    { color: 0xffe9c0, night: 300, angle: 0.85, penumbra: 0.7, distance: 22, decay: 1.6, cookie: false }
  )

  /* ---------------- animation ---------------- */
  let aFloor = 0, aPod = 0
  let wFloor = 0, wPod = 0
  const prevWorld = new THREE.Vector3()
  const nowWorld = new THREE.Vector3()
  const vel = new THREE.Vector3()
  const prevVel = new THREE.Vector3()

  function update (dt, t, ctx) {
    const tf = (Math.PI * 2 / FLOOR_PERIOD) * ctx.speed
    const tp = (Math.PI * 2 / POD_PERIOD) * ctx.speed
    wFloor += (tf - wFloor) * Math.min(1, dt * 0.5)
    wPod += (tp - wPod) * Math.min(1, dt * 0.5)
    aFloor += wFloor * dt
    aPod += wPod * dt

    platform.rotation.y = aFloor
    // the floor itself is not perfectly flat -- a slow undulation, which
    // every pod and cup inherits without knowing about it
    platform.rotation.x = Math.sin(t * 0.55) * 0.022 * ctx.speed
    platform.rotation.z = Math.cos(t * 0.41) * 0.022 * ctx.speed

    for (const p of pods) p.pod.rotation.y = -aPod    // counter-rotation

    for (const c of cups) {
      // riders spinning the wheel: a wandering rate, not a constant one
      c.rate += (Math.sin(t * 0.7 + c.spin) * 1.6 - c.rate) * dt * 0.6
      c.spin += c.rate * dt * (0.6 + ctx.speed)
      c.cup.rotation.y = c.spin
    }

    root.updateMatrixWorld(true)

    for (const c of cups) {
      // L4: lean the seat into the lateral acceleration, measured from the
      // cup's own world motion rather than assumed
      nowWorld.setFromMatrixPosition(c.cup.matrixWorld)
      if (c.prev) {
        vel.subVectors(nowWorld, c.prev).divideScalar(Math.max(dt, 1e-4))
        if (c.prevVel) {
          prevVel.copy(c.prevVel)
          const ax = (vel.x - prevVel.x) / Math.max(dt, 1e-4)
          const az = (vel.z - prevVel.z) / Math.max(dt, 1e-4)
          const mag = Math.min(Math.hypot(ax, az) / 30, 1)
          c.lean += (mag * 0.10 - c.lean) * Math.min(1, dt * 4)
          const dir = Math.atan2(az, ax)
          c.seat.rotation.set(Math.sin(dir) * c.lean, 0, -Math.cos(dir) * c.lean)
        }
        c.prevVel = vel.clone()
      }
      c.prev = nowWorld.clone()
    }

    root.updateMatrixWorld(true)
    for (const c of cups) {
      bodyI.setMatrixAt(c.idx, c.seat.matrixWorld)
      trimI.setMatrixAt(c.idx, c.seat.matrixWorld)
      seatI.setMatrixAt(c.idx, c.seat.matrixWorld)
    }
    for (const m of instanced) m.instanceMatrix.needsUpdate = true
  }

  const riderMount = new THREE.Group()
  riderMount.name = 'riderMount_teacup'
  // seated on the bench ring against the cup wall, looking outward over
  // the rim -- the whole point of the ride is the world going past
  riderMount.position.set(0.42, 1.86, 0)
  riderMount.rotation.y = -Math.PI / 2
  cups[0].seat.add(riderMount)

  return {
    name: 'Teacups',
    root,
    update,
    riderMount,
    focus: new THREE.Vector3(position.x, 3.2, position.z),
    stats: { levels: 4, cups: N, instancedDrawCalls: instanced.length },
    dispose () { cupBody.dispose(); cupTrim.dispose(); cupSeat.dispose() },
  }
}
