import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { buildGondolaGeometry } from '../lib/gondola.js'
import { ringPointsXY } from '../lib/bulbs.js'

/**
 * ==========================================================
 *  FERRIS WHEEL -- the hierarchy demo
 * ==========================================================
 *
 *  rideRoot                         world placement
 *   └─ tower/hub                    static steelwork
 *       └─ spin        (L1)  rotation.z = wheelAngle
 *           └─ arm[i]   (L2)  fixed offset out to the rim at angle theta_i
 *               └─ level[i] (L3)  rotation.z = -wheelAngle    <-- the point
 *                   └─ rock[i]  (L4)  damped pendulum, driven by the
 *                   │                 centripetal acceleration that L1+L2
 *                   │                 impose on this gondola's pivot
 *                       └─ seat[i] (L5)  bench frame
 *                           └─ camera     rider view, inherits all of it
 *
 * Level 3 is the frame that "would be wrong without the hierarchy". The
 * gondola's world orientation is the product of every matrix above it;
 * the only way to keep it upright is to cancel the parent's rotation in
 * the child's local frame. Turn levelling off in the panel and the tubs
 * rotate rigidly with the rim and tip the riders out at the top -- that
 * is the un-hierarchied answer, drawn live next to the right one.
 *
 * Level 4 could not exist without level 3 either: the pendulum angle is
 * measured against world gravity, which is only meaningful because its
 * parent frame is world-aligned.
 */

const R = 18.0          // rim radius, m
const HUB_Y = 21.0      // hub height, m
const HALF_W = 1.75     // half the gap between the two rims, m
const N_CARS = 16
const PERIOD = 38.0     // seconds per revolution at speed 1.0
const G = 9.81
const PEND_L = 1.85     // gondola pivot to centre of mass, m

export function createFerrisWheel ({ scene, M, rig, bulbs, position = new THREE.Vector3(0, 0, 0) }) {
  const root = new THREE.Group()
  root.name = 'ferrisWheel'
  root.position.copy(position)
  scene.add(root)

  /* ---------------- static steel ---------------- */
  const steel = []
  const dark = []
  const gold = []

  // hub barrel + bearings
  const hub = new THREE.CylinderGeometry(1.25, 1.25, HALF_W * 2 + 1.2, 16, 1)
  hub.rotateX(Math.PI / 2)
  hub.translate(0, HUB_Y, 0)
  steel.push(hub)
  for (const sz of [-1, 1]) {
    const brg = new THREE.CylinderGeometry(1.9, 1.9, 0.6, 18, 1)
    brg.rotateX(Math.PI / 2)
    brg.translate(0, HUB_Y, sz * (HALF_W + 0.75))
    steel.push(brg)
    const cap = new THREE.SphereGeometry(0.85, 14, 10)
    cap.translate(0, HUB_Y, sz * (HALF_W + 1.1))
    gold.push(cap)
  }

  // four splayed A-frame legs
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      // the leg is authored with its TOP at the origin so the rotation
      // pivots about the hub, not about the foot -- get this backwards
      // and you build a wheel standing on a single point
      const len = Math.hypot(HUB_Y, 9.5)
      const leg = new THREE.CylinderGeometry(0.34, 0.52, len, 10, 1)
      leg.translate(0, -len / 2, 0)
      leg.rotateZ(sx * Math.atan2(9.5, HUB_Y))
      leg.translate(0, HUB_Y, sz * (HALF_W + 1.4))
      steel.push(leg)
    }
    // cross bracing on each A-frame
    for (let k = 1; k <= 4; k++) {
      const y = k * (HUB_Y / 5)
      const half = 9.5 * (1 - y / HUB_Y)
      const bar = new THREE.CylinderGeometry(0.11, 0.11, half * 2, 6, 1)
      bar.rotateZ(Math.PI / 2)
      bar.translate(0, y, sz * (HALF_W + 1.4))
      dark.push(bar)
      for (const sx of [-1, 1]) {
        const dLen = Math.hypot(half, HUB_Y / 5)
        const d = new THREE.CylinderGeometry(0.075, 0.075, dLen, 5, 1)
        d.rotateZ(sx * Math.atan2(half, HUB_Y / 5))
        d.translate(sx * half / 2, y + HUB_Y / 10, sz * (HALF_W + 1.4))
        dark.push(d)
      }
    }
  }
  // tie beams between the two A-frames
  for (const x of [-9.5, 9.5]) {
    const tie = new THREE.CylinderGeometry(0.13, 0.13, (HALF_W + 1.4) * 2, 6, 1)
    tie.rotateX(Math.PI / 2)
    tie.translate(x, 0.6, 0)
    dark.push(tie)
  }

  // machinery deck + drive tyre
  const deck = new THREE.CylinderGeometry(11.5, 12.5, 0.8, 40, 1)
  deck.translate(0, 0.4, 0)
  const deckMesh = new THREE.Mesh(deck, M.decking)
  deckMesh.receiveShadow = true
  deckMesh.castShadow = true
  root.add(deckMesh)

  const steelMesh = new THREE.Mesh(mergeGeometries(steel, false), M.steel)
  const darkMesh = new THREE.Mesh(mergeGeometries(dark, false), M.steelDark)
  const goldMesh = new THREE.Mesh(mergeGeometries(gold, false), M.gold)
  for (const m of [steelMesh, darkMesh, goldMesh]) {
    m.castShadow = true
    m.receiveShadow = true
    m.matrixAutoUpdate = false
    root.add(m)
  }
  steel.forEach(g => g.dispose()); dark.forEach(g => g.dispose()); gold.forEach(g => g.dispose())

  /* ---------------- L1: the rotating wheel ---------------- */
  const spin = new THREE.Group()
  spin.name = 'L1_wheelSpin'
  spin.position.y = HUB_Y
  root.add(spin)

  {
    const parts = []
    for (const sz of [-1, 1]) {
      const rim = new THREE.TorusGeometry(R, 0.26, 8, 96)
      rim.translate(0, 0, sz * HALF_W)
      parts.push(rim)
      const inner = new THREE.TorusGeometry(R * 0.30, 0.16, 6, 48)
      inner.translate(0, 0, sz * HALF_W)
      parts.push(inner)
      // tension spokes
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2
        // spans exactly from the inner ring to the rim -- get the length
        // and the centre out of step and the spokes poke out past the rim
        const sp = new THREE.CylinderGeometry(0.055, 0.055, R - R * 0.30, 4, 1)
        sp.translate(0, (R + R * 0.30) / 2, 0)
        sp.rotateZ(a)
        sp.translate(0, 0, sz * HALF_W)
        parts.push(sp)
      }
    }
    // zig-zag bracing between the rims -- this is what makes it read as a
    // real structure rather than two hoops floating side by side
    for (let i = 0; i < 48; i++) {
      const a0 = (i / 48) * Math.PI * 2
      const a1 = ((i + 1) / 48) * Math.PI * 2
      const p0 = new THREE.Vector3(Math.cos(a0) * R, Math.sin(a0) * R, -HALF_W)
      const p1 = new THREE.Vector3(Math.cos(a1) * R, Math.sin(a1) * R, HALF_W)
      const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5)
      const dir = new THREE.Vector3().subVectors(p1, p0)
      const bar = new THREE.CylinderGeometry(0.06, 0.06, dir.length(), 4, 1)
      bar.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()))
      bar.translate(mid.x, mid.y, mid.z)
      parts.push(bar)
    }
    const wheelMesh = new THREE.Mesh(mergeGeometries(parts, false), M.steel)
    wheelMesh.castShadow = true
    wheelMesh.receiveShadow = true
    spin.add(wheelMesh)
    parts.forEach(g => g.dispose())
  }

  // festoon on the rims + a spoke chase; parented to `spin`, so they
  // rotate with the wheel without a single per-frame matrix write
  for (const sz of [-1, 1]) {
    bulbs.strand(spin, ringPointsXY(R + 0.42, 60, sz * HALF_W), {
      radius: 0.11, glowSize: 1.15, pattern: 'chase', speed: 3.2,
      palette: [0xffe2a8, 0xff5a66, 0xffe2a8, 0x6fd8ff],
    })
  }
  {
    const spokeBulbs = []
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      for (let k = 1; k <= 5; k++) {
        const r = R * (0.30 + (k / 6) * 0.66)
        spokeBulbs.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0))
      }
    }
    bulbs.strand(spin, spokeBulbs, {
      radius: 0.09, glowSize: 0.9, pattern: 'pulse', speed: 2.0,
      palette: [0xffd2f0, 0xa6b4ff],
    })
  }

  /* ---------------- gondola geometry, instanced ---------------- */
  const geo = buildGondolaGeometry({ segments: 44 })
  const half = N_CARS / 2
  const paintA = new THREE.InstancedMesh(geo.paint, M.hull, half)
  const paintB = new THREE.InstancedMesh(geo.paint, M.hullB, N_CARS - half)
  const deckI = new THREE.InstancedMesh(geo.deck, M.deck, N_CARS)
  const frameI = new THREE.InstancedMesh(geo.frame, M.steel, N_CARS)
  const instanced = [paintA, paintB, deckI, frameI]
  for (const m of instanced) {
    m.castShadow = true
    m.receiveShadow = true
    m.frustumCulled = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scene.add(m)
  }

  /* ---------------- L2..L5: one chain per gondola ---------------- */
  const cars = []
  for (let i = 0; i < N_CARS; i++) {
    const theta = (i / N_CARS) * Math.PI * 2

    const arm = new THREE.Group()                     // L2
    arm.name = `L2_arm_${i}`
    arm.position.set(Math.cos(theta) * R, Math.sin(theta) * R, 0)
    spin.add(arm)

    const level = new THREE.Group()                   // L3
    level.name = `L3_level_${i}`
    arm.add(level)

    const rock = new THREE.Group()                    // L4
    rock.name = `L4_rock_${i}`
    level.add(rock)

    const seat = new THREE.Group()                    // L5
    seat.name = `L5_seat_${i}`
    rock.add(seat)

    cars.push({ i, theta, arm, level, rock, seat, phi: 0, phiDot: 0, wobble: Math.random() * 6.28 })
  }

  /* ---------------- the light rig that rides on an arm ---------------- */
  // Mounted on car 4's arm, so the beams sweep the whole park once per
  // revolution. Deliberately shadowless: a shadow-casting spot on a
  // moving parent re-renders its depth map every single frame.
  const rigCar = cars[4]
  {
    const truss = []
    const bar = new THREE.CylinderGeometry(0.09, 0.09, 3.2, 6, 1)
    bar.rotateX(Math.PI / 2)
    bar.translate(0, 0.55, 0)
    truss.push(bar)
    for (const sz of [-1.1, 1.1]) {
      const can = new THREE.CylinderGeometry(0.30, 0.38, 0.62, 12, 1)
      can.rotateX(Math.PI / 2.2)
      can.translate(0, 0.42, sz)
      truss.push(can)
    }
    const trussMesh = new THREE.Mesh(mergeGeometries(truss, false), M.steelDark)
    trussMesh.castShadow = true
    rigCar.arm.add(trussMesh)
    truss.forEach(g => g.dispose())
  }
  const armSpots = [
    rig.addSpot(new THREE.Vector3(0, 0.42, -1.1), new THREE.Vector3(0, -12, -4), {
      parent: rigCar.arm, color: 0xffd9a0, night: 700, angle: 0.20, penumbra: 0.55,
      distance: 90, decay: 1.35,
    }),
    rig.addSpot(new THREE.Vector3(0, 0.42, 1.1), new THREE.Vector3(0, -12, 4), {
      parent: rigCar.arm, color: 0x9fd4ff, night: 520, angle: 0.22, penumbra: 0.6,
      distance: 90, decay: 1.35,
    }),
  ]

  // hub lamp: one real point light selling the whole wheel at night
  rig.addPoint(new THREE.Vector3(position.x, HUB_Y, position.z), {
    color: 0xffc177, night: 260, distance: 60, decay: 1.6,
  })
  // a shadow-casting spot from the ground washing the tower
  rig.addSpot(
    new THREE.Vector3(position.x + 17, 1.2, position.z + 15),
    new THREE.Vector3(position.x, HUB_Y * 0.7, position.z),
    { color: 0xfff0d8, night: 240, angle: 0.34, penumbra: 0.4, distance: 72, decay: 1.2, shadow: true }
  )

  /* ---------------- animation ---------------- */
  const dummy = new THREE.Object3D()
  let angle = 0
  let omega = 0

  function update (dt, t, ctx) {
    const targetOmega = (Math.PI * 2 / PERIOD) * ctx.speed
    // spin up / down like a real drive tyre rather than snapping
    omega += (targetOmega - omega) * Math.min(1, dt * 0.55)
    angle += omega * dt
    spin.rotation.z = angle

    const aCent = omega * omega * R    // centripetal accel at every pivot

    for (const car of cars) {
      // L3: cancel the parent's rotation so the tub stays world-level
      car.level.rotation.z = ctx.levelling ? -angle : 0

      if (ctx.levelling) {
        // L4: pendulum in a frame that is accelerating. Effective gravity
        // is real gravity minus the pivot's acceleration; the tub hangs
        // along it. At the top of the wheel that tilts the car outward,
        // at the bottom it tilts it inward -- visible, and correct.
        const a = angle + car.theta
        const gx = aCent * Math.cos(a)
        const gy = -G + aCent * Math.sin(a)
        const target = Math.atan2(-gx, -gy)
        const k = G / PEND_L
        const c = 1.15
        const acc = -k * Math.sin(car.phi - target) - c * car.phiDot
        car.phiDot += acc * dt
        // riders shifting their weight
        car.phiDot += Math.sin(t * 1.7 + car.wobble) * 0.012 * ctx.speed
        car.phi += car.phiDot * dt
        car.rock.rotation.z = car.phi
      } else {
        car.phi *= 0.9
        car.phiDot = 0
        car.rock.rotation.z = car.phi
      }
    }

    // one matrix walk, then hand the world matrices to the instancers
    root.updateMatrixWorld(true)

    let ia = 0, ib = 0
    for (const car of cars) {
      const m = car.seat.matrixWorld
      if (car.i % 2 === 0) paintA.setMatrixAt(ia++, m)
      else paintB.setMatrixAt(ib++, m)
      deckI.setMatrixAt(car.i, m)
      frameI.setMatrixAt(car.i, m)
    }
    for (const m of instanced) m.instanceMatrix.needsUpdate = true
  }

  // rider camera mount: eye height above the bench, facing tangentially
  const riderMount = new THREE.Group()
  riderMount.name = 'riderMount_wheel'
  riderMount.position.set(0, -1.18, 0.62)
  riderMount.rotation.y = Math.PI
  cars[0].seat.add(riderMount)

  return {
    name: 'Ferris wheel',
    root,
    update,
    riderMount,
    cars,
    armSpots,
    focus: new THREE.Vector3(position.x, HUB_Y * 0.55, position.z),
    stats: {
      levels: 5,
      gondolas: N_CARS,
      gondolaTriangles: geo.stats.triangles,
      instancedDrawCalls: instanced.length,
    },
    dispose () {
      geo.paint.dispose(); geo.deck.dispose(); geo.frame.dispose()
    },
  }
}
