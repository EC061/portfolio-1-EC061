import * as THREE from 'three'
import { VRButton } from 'three/addons/webxr/VRButton.js'

import { createMaterials } from './lib/materials.js'
import { createSky, SkyEnvironment } from './lib/sky.js'
import { LightRig } from './lib/lighting.js'
import { Bulbs } from './lib/bulbs.js'
import { buildEnvironment, PARK } from './lib/environment.js'
import { ViewManager } from './lib/cameras.js'
import { createFerrisWheel } from './rides/ferrisWheel.js'
import { createSwingCarousel } from './rides/swingCarousel.js'
import { createTeacups } from './rides/teacups.js'

/* ------------------------------------------------------------------ *
 * quality presets
 * ------------------------------------------------------------------ */
const QUALITY = {
  low: { label: 'Low', pixelRatio: 1.0, shadowMapSize: 1024, shadowExtent: 54, shadowType: THREE.PCFShadowMap, glow: false },
  medium: { label: 'Medium', pixelRatio: 1.5, shadowMapSize: 2048, shadowExtent: 76, shadowType: THREE.PCFSoftShadowMap, glow: true },
  high: { label: 'High', pixelRatio: 2.0, shadowMapSize: 4096, shadowExtent: 92, shadowType: THREE.PCFSoftShadowMap, glow: true },
}
const QUALITY_ORDER = ['low', 'medium', 'high']

const state = {
  night: 0,
  targetNight: 0,
  speed: 1.0,
  paused: false,
  shadows: true,
  glow: true,
  levelling: true,
  frames: false,
  quality: 'medium',
  time: 0,
}

/* ------------------------------------------------------------------ *
 * renderer
 * ------------------------------------------------------------------ */
const canvas = document.getElementById('app')
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
})
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.06
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.xr.enabled = true
renderer.xr.setReferenceSpaceType('local')

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0xbcd0e8, 0.0032)

const camera = new THREE.PerspectiveCamera(55, 1, 0.12, 1400)
scene.add(camera)

/* ------------------------------------------------------------------ *
 * world
 * ------------------------------------------------------------------ */
const M = createMaterials(renderer)
const sky = createSky(900)
scene.add(sky.mesh)
const skyEnv = new SkyEnvironment(renderer)

const rig = new LightRig(scene)
const bulbs = new Bulbs()

const env = buildEnvironment(scene, M, rig, bulbs)

const wheel = createFerrisWheel({ scene, M, rig, bulbs, position: new THREE.Vector3(0, 0, 0) })
const swing = createSwingCarousel({ scene, M, rig, bulbs, position: new THREE.Vector3(-30, 0, 22) })
const cups = createTeacups({ scene, M, rig, bulbs, position: new THREE.Vector3(30, 0, 20) })
const rides = [wheel, swing, cups]

const signMaterials = [...(env.group.userData.signs || []), ...(cups.root.userData.signs || [])]

/* ------------------------------------------------------------------ *
 * frame gizmos -- draw the hierarchy itself
 * ------------------------------------------------------------------ */
const gizmos = new THREE.Group()
gizmos.name = 'frameGizmos'
gizmos.visible = false
scene.add(gizmos)
{
  // one axis triad per named frame, but only on the first chain of each
  // ride: 100 triads would out-draw the rides they are explaining
  const wanted = /^L\d_/
  const firstOnly = /_(\d+)(_(\d+))?$/
  for (const ride of rides) {
    ride.root.traverse((o) => {
      if (!wanted.test(o.name)) return
      const m = o.name.match(firstOnly)
      if (m && (m[1] !== '0' || (m[3] !== undefined && m[3] !== '0'))) return
      const size = o.name.startsWith('L1') ? 6 : o.name.startsWith('L2') ? 3.2 : 1.8
      const axes = new THREE.AxesHelper(size)
      axes.material.depthTest = false
      axes.material.transparent = true
      axes.material.opacity = 0.95
      axes.renderOrder = 900
      o.add(axes)
      gizmos.userData.list = gizmos.userData.list || []
      gizmos.userData.list.push(axes)
      axes.visible = false
    })
  }
}
function setGizmos (on) {
  for (const a of gizmos.userData.list || []) a.visible = on
}

/* ------------------------------------------------------------------ *
 * views
 * ------------------------------------------------------------------ */
const views = new ViewManager(camera, scene, canvas)
views.addOrbit('midway', 'Midway', {
  position: new THREE.Vector3(34, 15, 52),
  target: new THREE.Vector3(0, 9, 0),
})
views.addOrbit('operator', 'Operator', {
  position: new THREE.Vector3(6, 2.6, 22),
  target: new THREE.Vector3(0, 14, 0),
  minD: 3, maxD: 60,
})
views.addRider('wheel', 'Ride: wheel', wheel.riderMount, { fov: 74 })
views.addRider('swing', 'Ride: swings', swing.riderMount, { fov: 80 })
views.addRider('cups', 'Ride: teacups', cups.riderMount, { fov: 82 })
views.addDrone('drone', 'Drone', [
  new THREE.Vector3(56, 19, 40), new THREE.Vector3(0, 26, 62), new THREE.Vector3(-58, 16, 34),
  new THREE.Vector3(-62, 11, -26), new THREE.Vector3(0, 24, -58), new THREE.Vector3(58, 14, -30),
], new THREE.Vector3(0, 12, 0))

// a standing spot on the plaza used when a headset session starts from a
// ground view -- in XR the camera's own position is ignored, only its
// parent counts, so ground views need a real mount too
const xrGround = new THREE.Group()
xrGround.position.set(4, 0, 34)
xrGround.rotation.y = Math.PI
scene.add(xrGround)
views.addRider('xr-ground', 'Standing', xrGround, { fov: 70 })

const VIEW_KEYS = ['midway', 'operator', 'wheel', 'swing', 'cups', 'drone']

const ticker = document.getElementById('ticker')
const tickerText = document.getElementById('ticker-text')
let tickerTimer = 0
function say (html, seconds = 4.5) {
  tickerText.innerHTML = html
  ticker.classList.add('show')
  tickerTimer = seconds
}

const VIEW_NOTES = {
  midway: 'Ground view. Drag to orbit, scroll to zoom.',
  operator: 'Operator’s position at the wheel base — look up to watch the gondolas counter-rotate.',
  wheel: 'Camera is a <b>child of the gondola seat</b>: five transforms deep. Untick <b>Level gondolas</b> to see the ride without the levelling frame.',
  swing: 'Camera rides chair 0. The flare angle is solved from ω, not keyframed.',
  cups: 'Three stacked rotations. The path is an epitrochoid nobody authored.',
  drone: 'Scripted flight around the park.',
}

function setView (id) {
  const v = views.setView(id)
  document.querySelectorAll('#views .chip').forEach(c => c.classList.toggle('on', c.dataset.id === v.id))
  if (VIEW_NOTES[v.id]) say(VIEW_NOTES[v.id])
  return v
}

/* ------------------------------------------------------------------ *
 * UI
 * ------------------------------------------------------------------ */
const el = (id) => document.getElementById(id)

const viewsBox = el('views')
for (const id of VIEW_KEYS) {
  const v = views.views.find(x => x.id === id)
  const b = document.createElement('button')
  b.className = 'chip'
  b.textContent = v.label
  b.dataset.id = id
  b.onclick = () => setView(id)
  viewsBox.appendChild(b)
}

const qualityBox = el('quality')
for (const q of QUALITY_ORDER) {
  const b = document.createElement('button')
  b.className = 'chip' + (q === state.quality ? ' on' : '')
  b.textContent = QUALITY[q].label
  b.dataset.q = q
  b.onclick = () => applyQuality(q)
  qualityBox.appendChild(b)
}

function applyQuality (q) {
  state.quality = q
  const p = QUALITY[q]
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, p.pixelRatio))
  renderer.shadowMap.type = p.shadowType
  rig.setQuality(p)
  bulbs.setGlowVisible(state.glow && p.glow)
  document.querySelectorAll('#quality .chip').forEach(c => c.classList.toggle('on', c.dataset.q === q))
  // shadow map type is a shader define; existing programs must recompile
  scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true }) })
  say(`Quality <b>${p.label}</b> — shadow map ${p.shadowMapSize}², pixel ratio ≤ ${p.pixelRatio}`)
}

const nightSlider = el('night')
const nightLabel = el('night-label')
nightSlider.oninput = () => { state.targetNight = parseFloat(nightSlider.value) }

const speedSlider = el('speed')
const speedLabel = el('speed-label')
speedSlider.oninput = () => {
  state.speed = parseFloat(speedSlider.value)
  speedLabel.textContent = `${state.speed.toFixed(2)}×`
}

el('t-shadows').onchange = (e) => {
  state.shadows = e.target.checked
  renderer.shadowMap.enabled = state.shadows
  rig.setShadows(state.shadows)
  scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true }) })
  say(state.shadows ? 'Shadows on.' : 'Shadows off — watch the frame time and the draw calls.')
}
el('t-glow').onchange = (e) => {
  state.glow = e.target.checked
  bulbs.setGlowVisible(state.glow && QUALITY[state.quality].glow)
}
el('t-level').onchange = (e) => setLevelling(e.target.checked)
el('t-frames').onchange = (e) => { state.frames = e.target.checked; setGizmos(state.frames) }
el('t-pause').onchange = (e) => { state.paused = e.target.checked }

function setLevelling (on) {
  state.levelling = on
  el('t-level').checked = on
  say(on
    ? 'Levelling frame <b>on</b>: each gondola cancels its parent’s rotation and stays upright.'
    : 'Levelling frame <b>off</b>: the gondolas are now rigidly bolted to the rim. This is the hierarchy error the frame exists to prevent.', 6)
}

el('panel-toggle').onclick = () => {
  const h = el('hud')
  h.classList.toggle('collapsed')
  el('panel-toggle').textContent = h.classList.contains('collapsed') ? '+' : '–'
}

/* ---- WebXR ---- */
{
  const btn = VRButton.createButton(renderer)
  el('xr-slot').appendChild(btn)
  let restore = null
  renderer.xr.addEventListener('sessionstart', () => {
    if (!views.isRider) {
      restore = views.current?.id
      setView('xr-ground')
    }
  })
  renderer.xr.addEventListener('sessionend', () => {
    if (restore) { setView(restore); restore = null }
  })
}

/* ---- keyboard ---- */
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const k = e.key.toLowerCase()
  if (k >= '1' && k <= '6') { setView(VIEW_KEYS[+k - 1]); return }
  switch (k) {
    case 'n':
      state.targetNight = state.targetNight > 0.5 ? 0 : 1
      nightSlider.value = String(state.targetNight)
      break
    case 'p': {
      const s = el('stats')
      s.hidden = !s.hidden
      break
    }
    case 'q': {
      const i = (QUALITY_ORDER.indexOf(state.quality) + 1) % QUALITY_ORDER.length
      applyQuality(QUALITY_ORDER[i])
      break
    }
    case 'l': setLevelling(!state.levelling); break
    case 'f': el('t-frames').checked = !state.frames; state.frames = !state.frames; setGizmos(state.frames); break
    case 'h': el('panel-toggle').click(); break
    case ' ':
      e.preventDefault()
      state.paused = !state.paused
      el('t-pause').checked = state.paused
      break
  }
})

/* ------------------------------------------------------------------ *
 * resize
 * ------------------------------------------------------------------ */
function resize () {
  const w = window.innerWidth, h = window.innerHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize)

/* ------------------------------------------------------------------ *
 * stats
 * ------------------------------------------------------------------ */
const statEls = {
  fps: el('s-fps'), ms: el('s-ms'), calls: el('s-calls'),
  tris: el('s-tris'), lights: el('s-lights'), progs: el('s-progs'),
}
let frames = 0, accum = 0, msAccum = 0

function updateStats (dt) {
  frames++
  accum += dt
  msAccum += dt
  if (accum < 0.25) return
  const info = renderer.info
  statEls.fps.textContent = Math.round(frames / accum)
  statEls.ms.textContent = (msAccum / frames * 1000).toFixed(1)
  statEls.calls.textContent = info.render.calls
  statEls.tris.textContent = info.render.triangles.toLocaleString()
  let lit = 0, shadowed = 0
  scene.traverse(o => { if (o.isLight) { lit++; if (o.castShadow) shadowed++ } })
  statEls.lights.textContent = `${lit} / ${shadowed}`
  statEls.progs.textContent = info.programs?.length ?? 0
  frames = 0; accum = 0; msAccum = 0
}

/* ------------------------------------------------------------------ *
 * night response for things the light rig does not own
 * ------------------------------------------------------------------ */
const FOG_DAY = new THREE.Color(0xc2d4ea)
const FOG_NIGHT = new THREE.Color(0x0a0d1c)
const fogColor = new THREE.Color()

function applyNight (n) {
  const t = rig.setNight(n)
  sky.uniforms.uNight.value = n
  sky.uniforms.uSunDir.value.copy(rig.sunDirection)
  fogColor.copy(FOG_DAY).lerp(FOG_NIGHT, t)
  scene.fog.color.copy(fogColor)
  scene.fog.density = THREE.MathUtils.lerp(0.0032, 0.0058, t)
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.06, 1.30, t)
  const litSign = THREE.MathUtils.smoothstep(n, 0.15, 0.6)
  for (const m of signMaterials) m.emissiveIntensity = litSign * 1.4
  nightLabel.textContent = n < 0.12 ? 'Day' : n < 0.42 ? 'Afternoon' : n < 0.72 ? 'Dusk' : 'Night'
  skyEnv.update(sky.mesh, n, scene)
}

/* ------------------------------------------------------------------ *
 * loop
 * ------------------------------------------------------------------ */
const clock = new THREE.Clock()
const focus = new THREE.Vector3()

function frame () {
  const dt = Math.min(clock.getDelta(), 0.05)

  if (Math.abs(state.night - state.targetNight) > 0.0008) {
    state.night += (state.targetNight - state.night) * Math.min(1, dt * 1.6)
    applyNight(state.night)
  }

  if (!state.paused) {
    state.time += dt
    const ctx = { speed: state.speed, levelling: state.levelling }
    for (const r of rides) r.update(dt, state.time, ctx)
    bulbs.update(state.time, state.night)
  }

  sky.uniforms.uTime.value = state.time
  views.update(dt)
  sky.mesh.position.setFromMatrixPosition(camera.matrixWorld)

  // keep the single shadow map spent on what is actually on screen
  views.focusPoint(focus)
  rig.follow(focus)

  renderer.render(scene, camera)
  updateStats(dt)

  if (tickerTimer > 0) {
    tickerTimer -= dt
    if (tickerTimer <= 0) ticker.classList.remove('show')
  }
}

/* ------------------------------------------------------------------ *
 * boot
 * ------------------------------------------------------------------ */
resize()
applyQuality(state.quality)
applyNight(0)
setView('midway')

// warm the shader cache before the first frame so the opening seconds are
// not a slideshow of program compiles
renderer.compile(scene, camera)

el('hud').hidden = false
el('stats').hidden = false
const loader = el('loader')
loader.classList.add('gone')
setTimeout(() => loader.remove(), 700)

renderer.setAnimationLoop(frame)

say('Welcome to the <b>Midway</b>. Press <b>N</b> for night, <b>1</b>–<b>6</b> to change view.', 6)

// a tiny amount of console output for the marker, and for me
console.log('%cMidway', 'font:700 16px sans-serif;color:#ffb648', '\n' +
  rides.map(r => `  ${r.name}: ${JSON.stringify(r.stats)}`).join('\n') +
  `\n  festoon bulbs: ${bulbs.bulbCount} in ${bulbs.drawCalls} draw calls` +
  `\n  park: plaza r=${PARK.plazaRadius}m, fence r=${PARK.fenceRadius}m`)

// expose for poking at in devtools / for the write-up
window.MIDWAY = { THREE, scene, renderer, rides, rig, bulbs, views, state, M, sky, applyNight, setView, applyQuality }
