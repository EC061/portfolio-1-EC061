import * as THREE from 'three'
import * as T from './textures.js'

/**
 * One place where every material in the park is created, so the whole
 * scene shares a small fixed set of programs. Two meshes that use the
 * same material instance can batch; two that use identical-but-separate
 * materials cannot, and each new material/defines combination is another
 * shader program to compile at load.
 */

/** Clone a cached texture so a second user can tile it differently
 *  without re-uploading the pixels (clones share `source`). */
function tiled (t, rx, ry = rx) {
  const c = t.clone()
  c.repeat.set(rx, ry)
  c.wrapS = c.wrapT = THREE.RepeatWrapping
  c.needsUpdate = true
  return c
}

function pairTiled (p, rx, ry = rx) {
  return { map: tiled(p.map, rx, ry), normalMap: tiled(p.normalMap, rx, ry) }
}

export function createMaterials (renderer) {
  const grass = T.grass(renderer)
  const asphalt = T.asphalt(renderer)
  const wood = T.wood(renderer)
  const metal = T.metal(renderer)
  const paint = T.stripes(renderer, '#d93a3f', '#f6efe0', 16, 'hull')
  const paintB = T.stripes(renderer, '#2f6fd0', '#f6efe0', 16, 'hullB')
  const tent = T.canvasStripe(renderer, '#f4f1e8', '#d8383c', 14)
  const tentB = T.canvasStripe(renderer, '#f4f1e8', '#2f7fbf', 14)
  const leaves = T.foliage(renderer)

  const g = pairTiled(grass, 64)
  const a = pairTiled(asphalt, 18)

  const M = {
    ground: new THREE.MeshStandardMaterial({
      ...g, roughness: 0.97, metalness: 0.0,
      normalScale: new THREE.Vector2(1.1, 1.1),
    }),
    path: new THREE.MeshStandardMaterial({
      ...a, roughness: 0.88, metalness: 0.0,
      normalScale: new THREE.Vector2(0.7, 0.7),
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),

    // ride hull -- the striped paint that the hand-authored UVs sample
    // DoubleSide: the gondola canopy and the teacup lathe are open
    // shells, and a rider sits underneath both of them. The cost is
    // giving up backface culling on ~8% of the scene's triangles; the
    // alternative is authoring a second inner skin for each, which costs
    // more triangles than the culling saves.
    hull: new THREE.MeshStandardMaterial({
      ...pairTiled(paint, 1, 1), roughness: 0.42, metalness: 0.06,
      envMapIntensity: 0.9, side: THREE.DoubleSide,
    }),
    hullB: new THREE.MeshStandardMaterial({
      ...pairTiled(paintB, 1, 1), roughness: 0.42, metalness: 0.06,
      envMapIntensity: 0.9, side: THREE.DoubleSide,
    }),
    deck: new THREE.MeshStandardMaterial({
      ...pairTiled(wood, 1.4, 1.4), roughness: 0.74, metalness: 0.0,
    }),
    decking: new THREE.MeshStandardMaterial({
      ...pairTiled(wood, 10, 10), roughness: 0.8, metalness: 0.0,
    }),
    steel: new THREE.MeshStandardMaterial({
      ...pairTiled(metal, 2, 2), roughness: 0.34, metalness: 0.92,
      envMapIntensity: 1.15, color: 0xdfe4ee,
    }),
    steelDark: new THREE.MeshStandardMaterial({
      ...pairTiled(metal, 3, 3), roughness: 0.52, metalness: 0.85,
      color: 0x6e7687, envMapIntensity: 0.8,
    }),
    tent: new THREE.MeshStandardMaterial({
      ...pairTiled(tent, 1, 1), roughness: 0.88, metalness: 0.0,
      side: THREE.DoubleSide,
    }),
    tentB: new THREE.MeshStandardMaterial({
      ...pairTiled(tentB, 1, 1), roughness: 0.88, metalness: 0.0,
      side: THREE.DoubleSide,
    }),
    leaves: new THREE.MeshStandardMaterial({
      ...pairTiled(leaves, 1.6, 1.6), roughness: 0.92, metalness: 0.0,
      color: 0xbfd6a8,
    }),
    bark: new THREE.MeshStandardMaterial({
      ...pairTiled(wood, 1, 2.5), roughness: 0.95, metalness: 0.0, color: 0x8a6a4a,
    }),
    hill: new THREE.MeshStandardMaterial({ color: 0x3c5a44, roughness: 1.0, metalness: 0.0 }),

    // bulbs: emissive standard so they still catch the sun by day and
    // read as the light source at night
    bulb: new THREE.MeshStandardMaterial({
      color: 0x2a2318, emissive: 0xffc266, emissiveIntensity: 0.0,
      roughness: 0.25, metalness: 0.1,
    }),
    bulbRed: new THREE.MeshStandardMaterial({
      color: 0x2a1616, emissive: 0xff4a55, emissiveIntensity: 0.0,
      roughness: 0.25, metalness: 0.1,
    }),
    bulbCyan: new THREE.MeshStandardMaterial({
      color: 0x142428, emissive: 0x55e0ff, emissiveIntensity: 0.0,
      roughness: 0.25, metalness: 0.1,
    }),

    cable: new THREE.MeshStandardMaterial({ color: 0x15161c, roughness: 0.9, metalness: 0.2 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1c1e26, roughness: 0.95, metalness: 0.0 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 1.0, envMapIntensity: 1.6 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xffcf70, roughness: 0.22, metalness: 1.0, envMapIntensity: 1.4 }),
  }

  M.signFace = (text, sub) => new THREE.MeshStandardMaterial({
    map: T.sign(text, { sub }),
    emissiveMap: T.sign(text, { sub }),
    emissive: 0xffffff,
    emissiveIntensity: 0.0,
    roughness: 0.6,
    metalness: 0.0,
  })

  M.glow = new THREE.PointsMaterial({
    map: T.glowSprite(),
    size: 0.62,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    opacity: 0.0,
    toneMapped: false,
  })

  M.dispose = () => {
    for (const v of Object.values(M)) if (v?.isMaterial) v.dispose()
    T.disposeTextureCache()
  }

  return M
}
