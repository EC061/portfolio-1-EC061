import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/**
 * View manager.
 *
 * There is exactly one PerspectiveCamera. Switching to a rider view does
 * not copy a transform -- it re-parents that camera into the ride's
 * hierarchy, under the seat frame, and lets the matrix chain do the work.
 * That is also what makes the rider view a hierarchy *test*: if a parent
 * transform is wrong, the ground view might look plausible but the rider
 * view will lurch, and you will see it immediately.
 *
 * The same re-parenting is what WebXR needs. three's WebXRManager composes
 * the headset pose with `camera.parent.matrixWorld`, so a camera parented
 * to the seat is a headset bolted to the seat, with no extra code.
 */
export class ViewManager {
  constructor (camera, scene, domElement) {
    this.camera = camera
    this.scene = scene
    this.dom = domElement

    this.controls = new OrbitControls(camera, domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.minDistance = 6
    this.controls.maxDistance = 190
    this.controls.maxPolarAngle = Math.PI * 0.495
    this.controls.target.set(0, 8, 0)

    this.views = []
    this.current = null
    this._droneT = 0
    this._tmp = new THREE.Vector3()
  }

  add (view) {
    this.views.push(view)
    return view
  }

  /** Ground-level free camera. */
  addOrbit (id, label, { position, target, minD = 6, maxD = 190 }) {
    return this.add({ id, label, kind: 'orbit', position, target, minD, maxD })
  }

  /** Camera parented into a ride hierarchy. */
  addRider (id, label, mount, { fov = 72 } = {}) {
    return this.add({ id, label, kind: 'rider', mount, fov })
  }

  /** Scripted flight around the park. */
  addDrone (id, label, path, lookAt) {
    const curve = new THREE.CatmullRomCurve3(path, true, 'catmullrom', 0.25)
    return this.add({ id, label, kind: 'drone', curve, lookAt })
  }

  setView (id) {
    const v = this.views.find(x => x.id === id) || this.views[0]
    if (this.current === v) return v
    this.current = v

    // detach from wherever it was, without inheriting a stale transform
    if (this.camera.parent) this.camera.parent.remove(this.camera)

    if (v.kind === 'rider') {
      v.mount.add(this.camera)
      this.camera.position.set(0, 0, 0)
      this.camera.rotation.set(0, 0, 0)
      this.camera.fov = v.fov
      this.controls.enabled = false
    } else {
      this.scene.add(this.camera)
      this.camera.fov = 55
      if (v.kind === 'orbit') {
        this.camera.position.copy(v.position)
        this.controls.target.copy(v.target)
        this.controls.minDistance = v.minD
        this.controls.maxDistance = v.maxD
        this.controls.enabled = true
        this.controls.update()
      } else {
        this.controls.enabled = false
      }
    }
    this.camera.updateProjectionMatrix()
    return v
  }

  update (dt) {
    const v = this.current
    if (!v) return
    if (v.kind === 'orbit') {
      this.controls.update()
    } else if (v.kind === 'drone') {
      this._droneT = (this._droneT + dt * 0.016) % 1
      v.curve.getPointAt(this._droneT, this.camera.position)
      this._tmp.copy(v.lookAt)
      this._tmp.y += Math.sin(this._droneT * Math.PI * 2) * 3
      this.camera.lookAt(this._tmp)
    }
  }

  /** Where the shadow frustum should be centred. */
  focusPoint (out = new THREE.Vector3()) {
    const v = this.current
    if (v?.kind === 'orbit') return out.copy(this.controls.target)
    return out.setFromMatrixPosition(this.camera.matrixWorld)
  }

  get isRider () { return this.current?.kind === 'rider' }
}
