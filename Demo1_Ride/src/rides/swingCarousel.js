import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { ringPointsXZ } from '../lib/bulbs.js'

/**
 * ==========================================================
 *  SWING CAROUSEL (chair-o-plane)
 * ==========================================================
 *
 *  root
 *   └─ spin   (L1) rotation.y  -- the whole canopy turns
 *       └─ tilt  (L2) rotation.z -- the canopy is hung off-axis and tilts
 *           └─ hanger[i] (L3) rotation.y = theta_i, fixed
 *               └─ flare[i] (L4) rotation.z -- chains fly out with speed
 *                   └─ seat[i]  (L5) rotation.y -- the chair yaws to face
 *                       └─ camera         the direction of travel
 *
 * The flare angle is not keyframed. A chair on a chain of length L hung
 * at radius r0 settles where the chain tension, gravity and the
 * centripetal requirement balance:
 *
 *     tan(phi) = omega^2 * (r0 + L*sin(phi)) / g
 *
 * which is implicit in phi, so it is solved by fixed-point iteration each
 * frame and then chased with a damped spring so the chairs lag the
 * platform when it speeds up -- exactly what they do in real life.
 *
 * Level 2 is the frame that makes the hierarchy obvious: tilting the
 * canopy raises the chairs on one side of the circle and drops them on
 * the other, and no chair has any idea that is happening. Its local
 * transform never mentions the tilt.
 */

const N_SEATS = 24
const CANOPY_Y = 12.6
const HANG_R = 6.6      // radius of the chain hinges on the canopy, m
const CHAIN_L = 6.4     // chain length, m
const PERIOD = 9.5      // seconds per revolution at speed 1.0
const G = 9.81

export function createSwingCarousel ({ scene, M, rig, bulbs, position = new THREE.Vector3(0, 0, 0) }) {
  const root = new THREE.Group()
  root.name = 'swingCarousel'
  root.position.copy(position)
  scene.add(root)

  /* ---------------- static base ---------------- */
  {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(11, 11.6, 0.6, 48, 1), M.decking)
    pad.position.y = 0.3
    pad.castShadow = true
    pad.receiveShadow = true
    root.add(pad)

    const parts = []
    const col = new THREE.CylinderGeometry(0.95, 1.45, CANOPY_Y, 18, 1)
    col.translate(0, CANOPY_Y / 2, 0)
    parts.push(col)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const stay = new THREE.CylinderGeometry(0.085, 0.085, 9.2, 5, 1)
      stay.rotateZ(0.42)
      stay.translate(2.0, 4.4, 0)
      stay.rotateY(a)
      parts.push(stay)
    }
    const tower = new THREE.Mesh(mergeGeometries(parts, false), M.steel)
    tower.castShadow = true
    tower.receiveShadow = true
    root.add(tower)
    parts.forEach(g => g.dispose())

    // ticket rail
    const rail = new THREE.Mesh(new THREE.TorusGeometry(11.2, 0.05, 5, 64), M.steelDark)
    rail.rotation.x = Math.PI / 2
    rail.position.y = 1.0
    rail.castShadow = true
    root.add(rail)
  }

  /* ---------------- L1: the turntable ---------------- */
  const spin = new THREE.Group()
  spin.name = 'L1_carouselSpin'
  spin.position.y = CANOPY_Y
  root.add(spin)

  /* ---------------- L2: the tilt frame ---------------- */
  const tilt = new THREE.Group()
  tilt.name = 'L2_canopyTilt'
  spin.add(tilt)

  {
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(8.4, 3.0, 24, 1, true), M.tent)
    canopy.position.y = 1.7
    canopy.castShadow = true
    canopy.receiveShadow = true
    tilt.add(canopy)

    const scallop = new THREE.Mesh(new THREE.CylinderGeometry(8.4, 8.0, 0.8, 24, 1, true), M.tentB)
    scallop.position.y = -0.1
    scallop.castShadow = true
    tilt.add(scallop)

    const ring = new THREE.Mesh(new THREE.TorusGeometry(HANG_R, 0.14, 6, 56), M.steel)
    ring.rotation.x = Math.PI / 2
    ring.castShadow = true
    tilt.add(ring)

    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), M.gold)
    finial.position.y = 3.5
    finial.castShadow = true
    tilt.add(finial)

    bulbs.strand(tilt, ringPointsXZ(8.3, 40, -0.35), {
      radius: 0.1, glowSize: 1.0, pattern: 'chase', speed: 4.2,
      palette: [0xfff0c0, 0x66ffcc, 0xff77aa],
    })
    bulbs.strand(tilt, ringPointsXZ(3.2, 16, 2.1), {
      radius: 0.09, glowSize: 0.85, pattern: 'pulse', speed: 3.0,
      palette: [0xffd27a],
    })
  }

  /* ---------------- instanced swing parts ---------------- */
  const chainGeo = (() => {
    const parts = []
    for (const sx of [-0.24, 0.24]) {
      const c = new THREE.CylinderGeometry(0.025, 0.025, CHAIN_L, 4, 1)
      c.translate(sx, -CHAIN_L / 2, 0)
      parts.push(c)
    }
    const yoke = new THREE.BoxGeometry(0.62, 0.07, 0.07)
    yoke.translate(0, -CHAIN_L + 0.05, 0)
    parts.push(yoke)
    const eye = new THREE.TorusGeometry(0.11, 0.03, 5, 10)
    eye.translate(0, 0.04, 0)
    parts.push(eye)
    return mergeGeometries(parts, false)
  })()

  const seatPaint = (() => {
    const parts = []
    const pan = new THREE.BoxGeometry(0.62, 0.09, 0.52)
    parts.push(pan)
    const back = new THREE.BoxGeometry(0.62, 0.62, 0.08)
    back.translate(0, 0.34, -0.26)
    parts.push(back)
    const g = mergeGeometries(parts, false)
    // the chair faces the direction of travel (-Z in the flare frame),
    // so the backrest has to end up behind the rider, not in front
    g.rotateY(Math.PI)
    g.translate(0, -CHAIN_L - 0.02, 0)
    return g
  })()

  const seatFrame = (() => {
    const parts = []
    const bar = new THREE.CylinderGeometry(0.035, 0.035, 0.66, 5, 1)
    bar.rotateZ(Math.PI / 2)
    bar.translate(0, 0.22, 0.26)
    parts.push(bar)
    for (const sx of [-0.31, 0.31]) {
      const side = new THREE.CylinderGeometry(0.028, 0.028, 0.42, 5, 1)
      side.rotateX(-0.6)
      side.translate(sx, 0.18, 0.16)
      parts.push(side)
    }
    const g = mergeGeometries(parts, false)
    g.rotateY(Math.PI)
    g.translate(0, -CHAIN_L - 0.02, 0)
    return g
  })()

  const chainI = new THREE.InstancedMesh(chainGeo, M.steelDark, N_SEATS)
  const seatI = new THREE.InstancedMesh(seatPaint, M.hullB, N_SEATS)
  const frameI = new THREE.InstancedMesh(seatFrame, M.gold, N_SEATS)
  const instanced = [chainI, seatI, frameI]
  for (const m of instanced) {
    m.castShadow = true
    m.receiveShadow = true
    m.frustumCulled = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scene.add(m)
  }

  /* ---------------- L3..L5 ---------------- */
  const swings = []
  for (let i = 0; i < N_SEATS; i++) {
    const theta = (i / N_SEATS) * Math.PI * 2

    const hanger = new THREE.Group()          // L3
    hanger.name = `L3_hanger_${i}`
    hanger.rotation.y = theta
    tilt.add(hanger)

    const flare = new THREE.Group()           // L4
    flare.name = `L4_flare_${i}`
    flare.position.set(HANG_R, 0, 0)
    hanger.add(flare)

    const seat = new THREE.Group()            // L5
    seat.name = `L5_seat_${i}`
    flare.add(seat)

    swings.push({ i, theta, hanger, flare, seat, phi: 0, phiDot: 0, yaw: 0, jitter: Math.random() * 6.28 })
  }

  /* ---------------- lights ---------------- */
  rig.addPoint(new THREE.Vector3(position.x, CANOPY_Y + 1.2, position.z), {
    color: 0xffd08a, night: 180, distance: 40, decay: 1.7,
  })
  // a cold spot from a pole, pointed back at the canopy, so the chairs get
  // a rim light as they fly through it
  rig.addSpot(
    new THREE.Vector3(position.x - 13, 11.5, position.z - 11),
    new THREE.Vector3(position.x, CANOPY_Y - 3, position.z),
    { color: 0x8fd0ff, night: 420, angle: 0.38, penumbra: 0.5, distance: 46, decay: 1.3 }
  )

  /* ---------------- animation ---------------- */
  let angle = 0
  let omega = 0
  let tiltPhase = 0

  /** Solve tan(phi) = w^2 (r0 + L sin phi) / g by fixed point. */
  function equilibrium (w) {
    let phi = 0
    for (let k = 0; k < 6; k++) {
      const r = HANG_R + CHAIN_L * Math.sin(phi)
      phi = Math.atan2(w * w * r, G)
    }
    return phi
  }

  function update (dt, t, ctx) {
    const target = (Math.PI * 2 / PERIOD) * ctx.speed
    omega += (target - omega) * Math.min(1, dt * 0.32)
    angle += omega * dt
    spin.rotation.z = 0
    spin.rotation.y = angle

    // L2: the canopy tilt. Ramps in with speed, wobbles slowly.
    tiltPhase += dt * 0.31
    const tiltAmount = THREE.MathUtils.clamp(omega / (Math.PI * 2 / PERIOD), 0, 1)
    tilt.rotation.z = Math.sin(tiltPhase) * 0.105 * tiltAmount
    tilt.rotation.x = Math.cos(tiltPhase * 0.77) * 0.055 * tiltAmount

    const eq = equilibrium(omega)
    for (const s of swings) {
      // damped spring toward equilibrium, so the chairs lag on spin-up
      const k = 9.0, c = 2.4
      s.phiDot += (-k * (s.phi - eq) - c * s.phiDot) * dt
      s.phiDot += Math.sin(t * 2.3 + s.jitter) * 0.05 * dt * (0.3 + tiltAmount)
      s.phi += s.phiDot * dt
      s.flare.rotation.z = -s.phi

      // L5: the chair yaws to trail the direction of travel
      const targetYaw = -0.16 * (omega / (Math.PI * 2 / PERIOD)) + Math.sin(t * 1.4 + s.jitter) * 0.05
      s.yaw += (targetYaw - s.yaw) * Math.min(1, dt * 3)
      s.seat.rotation.y = s.yaw
    }

    root.updateMatrixWorld(true)
    for (const s of swings) {
      chainI.setMatrixAt(s.i, s.flare.matrixWorld)
      seatI.setMatrixAt(s.i, s.seat.matrixWorld)
      frameI.setMatrixAt(s.i, s.seat.matrixWorld)
    }
    for (const m of instanced) m.instanceMatrix.needsUpdate = true
  }

  const riderMount = new THREE.Group()
  riderMount.name = 'riderMount_swing'
  // In the flare frame +X is radially outward, so a platform turning
  // about +Y carries the chair toward -Z. A camera looks down its own
  // -Z, so rotation.y = 0 is already "facing the direction of travel".
  riderMount.position.set(0, -CHAIN_L + 0.78, 0.06)
  riderMount.rotation.y = 0
  swings[0].seat.add(riderMount)

  return {
    name: 'Swing carousel',
    root,
    update,
    riderMount,
    focus: new THREE.Vector3(position.x, 7, position.z),
    stats: { levels: 5, seats: N_SEATS, instancedDrawCalls: instanced.length },
    dispose () { chainGeo.dispose(); seatPaint.dispose(); seatFrame.dispose() },
  }
}
