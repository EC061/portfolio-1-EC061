import * as THREE from 'three'

/**
 * Every texture in this project is generated at load time on a 2D canvas.
 * That keeps the repo asset-free and the payload tiny, and it means the UV
 * layouts and the pixels were authored by the same hand -- when the README
 * says "u is normalised perimeter arc length", the stripes in this file are
 * what that u is sampling.
 */

const cache = new Map()

function canvas (size, h = size) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = h
  return { c, x: c.getContext('2d', { willReadFrequently: true }) }
}

function finish (c, { repeat = 1, srgb = true, aniso = 8, renderer = null } = {}) {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = renderer ? Math.min(aniso, renderer.capabilities.getMaxAnisotropy()) : aniso
  t.needsUpdate = true
  return t
}

function memo (key, fn) {
  if (!cache.has(key)) cache.set(key, fn())
  return cache.get(key)
}

/* ------------------------------------------------------------------ *
 * value noise - one shared, seeded lattice so every texture that asks
 * for "grain" is grain from the same world.
 * ------------------------------------------------------------------ */
function mulberry32 (a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeNoise (seed = 1337) {
  const rnd = mulberry32(seed)
  const N = 256
  const lat = new Float32Array(N * N)
  for (let i = 0; i < lat.length; i++) lat[i] = rnd()
  const at = (x, y) => lat[(y & (N - 1)) * N + (x & (N - 1))]
  const smooth = (t) => t * t * (3 - 2 * t)

  const value = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    const xf = smooth(x - xi), yf = smooth(y - yi)
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1)
    return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf
  }

  return {
    rnd,
    value,
    /** tileable fbm: frequencies are integers so the pattern wraps at 1.0 */
    fbm (u, v, octaves = 5, freq = 4, gain = 0.5) {
      let sum = 0, amp = 1, norm = 0, f = freq
      for (let o = 0; o < octaves; o++) {
        sum += amp * value(u * f, v * f)
        norm += amp
        amp *= gain
        f *= 2
      }
      return sum / norm
    },
  }
}

const noise = makeNoise(20260912)

/* ------------------------------------------------------------------ *
 * height -> tangent-space normal map (Sobel). Costs one extra texture
 * fetch per pixel in the shader but gives the metal and wood a lit
 * surface instead of a flat decal.
 * ------------------------------------------------------------------ */
export function normalFromHeight (heightCanvas, strength = 2.0) {
  const w = heightCanvas.width, h = heightCanvas.height
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data
  const { c, x } = canvas(w, h)
  const out = x.createImageData(w, h)
  const lum = (px, py) => {
    const i = (((py + h) % h) * w + ((px + w) % w)) * 4
    return (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255
  }
  for (let y = 0; y < h; y++) {
    for (let X = 0; X < w; X++) {
      const dx = (lum(X + 1, y - 1) + 2 * lum(X + 1, y) + lum(X + 1, y + 1)) -
                 (lum(X - 1, y - 1) + 2 * lum(X - 1, y) + lum(X - 1, y + 1))
      const dy = (lum(X - 1, y + 1) + 2 * lum(X, y + 1) + lum(X + 1, y + 1)) -
                 (lum(X - 1, y - 1) + 2 * lum(X, y - 1) + lum(X + 1, y - 1))
      let nx = -dx * strength, ny = -dy * strength, nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len; ny /= len; nz /= len
      const i = (y * w + X) * 4
      out.data[i] = (nx * 0.5 + 0.5) * 255
      out.data[i + 1] = (ny * 0.5 + 0.5) * 255
      out.data[i + 2] = (nz * 0.5 + 0.5) * 255
      out.data[i + 3] = 255
    }
  }
  x.putImageData(out, 0, 0)
  return c
}

function pair (heightCanvas, colorCanvas, opts = {}) {
  const map = finish(colorCanvas, opts)
  const normalMap = finish(normalFromHeight(heightCanvas, opts.bump ?? 2), { ...opts, srgb: false })
  return { map, normalMap }
}

/* ------------------------------------------------------------------ *
 * ground
 * ------------------------------------------------------------------ */
export function grass (renderer, size = 512) {
  return memo('grass', () => {
    const { c, x } = canvas(size)
    const img = x.createImageData(size, size)
    for (let y = 0; y < size; y++) {
      for (let X = 0; X < size; X++) {
        const u = X / size, v = y / size
        const n = noise.fbm(u, v, 5, 6)
        const clump = noise.fbm(u + 3.1, v + 7.7, 3, 2)
        // mowing stripes: the groundskeeper went back and forth
        const mow = Math.sin(v * Math.PI * 8) > 0 ? 0.045 : -0.02
        const g = 0.30 + 0.34 * n + 0.16 * clump + mow
        const i = (y * size + X) * 4
        img.data[i] = 255 * (0.16 + 0.30 * n + 0.10 * clump)
        img.data[i + 1] = 255 * g
        img.data[i + 2] = 255 * (0.11 + 0.16 * n)
        img.data[i + 3] = 255
      }
    }
    x.putImageData(img, 0, 0)
    // scattered dry blades for high-frequency detail
    for (let i = 0; i < 2600; i++) {
      const px = noise.rnd() * size, py = noise.rnd() * size
      x.strokeStyle = `rgba(${140 + noise.rnd() * 70 | 0},${150 + noise.rnd() * 60 | 0},60,0.16)`
      x.lineWidth = 1
      x.beginPath()
      x.moveTo(px, py)
      x.lineTo(px + (noise.rnd() - 0.5) * 5, py - 2 - noise.rnd() * 4)
      x.stroke()
    }
    const h = canvas(size)
    h.x.drawImage(c, 0, 0)
    return pair(h.c, c, { renderer, repeat: 1, bump: 0.6, aniso: 16 })
  })
}

export function asphalt (renderer, size = 512) {
  return memo('asphalt', () => {
    const { c, x } = canvas(size)
    const img = x.createImageData(size, size)
    for (let y = 0; y < size; y++) {
      for (let X = 0; X < size; X++) {
        const n = noise.fbm(X / size, y / size, 5, 12)
        const g = 0.30 + 0.22 * n
        const i = (y * size + X) * 4
        img.data[i] = 255 * g * 1.02
        img.data[i + 1] = 255 * g * 0.99
        img.data[i + 2] = 255 * g * 0.95
        img.data[i + 3] = 255
      }
    }
    x.putImageData(img, 0, 0)
    for (let i = 0; i < 900; i++) {
      const r = 1 + noise.rnd() * 3
      x.fillStyle = `rgba(${90 + noise.rnd() * 110 | 0},${85 + noise.rnd() * 100 | 0},${80 + noise.rnd() * 90 | 0},0.5)`
      x.beginPath()
      x.arc(noise.rnd() * size, noise.rnd() * size, r, 0, 7)
      x.fill()
    }
    const h = canvas(size)
    h.x.drawImage(c, 0, 0)
    return pair(h.c, c, { renderer, bump: 1.2 })
  })
}

/* ------------------------------------------------------------------ *
 * ride surfaces
 * ------------------------------------------------------------------ */

/** Vertical stripes. The gondola hull's u runs along the hull perimeter,
 *  so stripe count here == number of painted bands around the tub. */
export function stripes (renderer, a = '#e8443f', b = '#fdf4e3', count = 14, key = 'stripe') {
  return memo(`${key}:${a}:${b}:${count}`, () => {
    const size = 512
    const { c, x } = canvas(size)
    const w = size / count
    for (let i = 0; i < count; i++) {
      x.fillStyle = i % 2 ? b : a
      x.fillRect(i * w, 0, Math.ceil(w), size)
    }
    // hand-painted edge: soften the band borders and add paint wear
    const img = x.getImageData(0, 0, size, size)
    for (let y = 0; y < size; y++) {
      for (let X = 0; X < size; X++) {
        const i = (y * size + X) * 4
        const n = noise.fbm(X / size, y / size, 4, 9)
        const wear = 0.86 + 0.24 * n
        img.data[i] *= wear
        img.data[i + 1] *= wear
        img.data[i + 2] *= wear
      }
    }
    x.putImageData(img, 0, 0)
    // gold pinstripe down the centre of every band
    x.strokeStyle = 'rgba(214,168,74,0.85)'
    x.lineWidth = 3
    for (let i = 0; i < count; i++) {
      x.beginPath()
      x.moveTo(i * w + w / 2, 0)
      x.lineTo(i * w + w / 2, size)
      x.stroke()
    }
    const h = canvas(size)
    h.x.drawImage(c, 0, 0)
    return pair(h.c, c, { renderer, bump: 0.5 })
  })
}

export function wood (renderer, size = 512) {
  return memo('wood', () => {
    const { c, x } = canvas(size)
    const planks = 6
    const ph = size / planks
    for (let p = 0; p < planks; p++) {
      const base = 0.44 + noise.rnd() * 0.14
      const img = x.createImageData(size, Math.ceil(ph))
      for (let y = 0; y < ph; y++) {
        for (let X = 0; X < size; X++) {
          // grain: stretched noise along the plank + ring lines
          const g = noise.fbm(X / size * 1.0, (p * ph + y) / size * 9, 4, 6)
          const rings = 0.5 + 0.5 * Math.sin((g * 9 + X / size * 2.5) * 6.28)
          const v = base * (0.72 + 0.36 * g) * (0.88 + 0.18 * rings)
          const i = (y * size + X) * 4
          img.data[i] = 255 * v * 1.30
          img.data[i + 1] = 255 * v * 0.92
          img.data[i + 2] = 255 * v * 0.60
          img.data[i + 3] = 255
        }
      }
      x.putImageData(img, 0, p * ph)
      // plank gap
      x.fillStyle = 'rgba(24,14,8,0.75)'
      x.fillRect(0, p * ph, size, 3)
    }
    const h = canvas(size)
    h.x.drawImage(c, 0, 0)
    return pair(h.c, c, { renderer, bump: 1.6 })
  })
}

export function metal (renderer, size = 512, tint = [0.72, 0.75, 0.82]) {
  return memo(`metal:${tint.join(',')}`, () => {
    const { c, x } = canvas(size)
    const img = x.createImageData(size, size)
    for (let y = 0; y < size; y++) {
      for (let X = 0; X < size; X++) {
        // brushed: noise stretched 20:1 horizontally
        const n = noise.fbm(X / size * 22, y / size * 1.1, 4, 8)
        const v = 0.70 + 0.26 * n
        const i = (y * size + X) * 4
        img.data[i] = 255 * v * tint[0]
        img.data[i + 1] = 255 * v * tint[1]
        img.data[i + 2] = 255 * v * tint[2]
        img.data[i + 3] = 255
      }
    }
    x.putImageData(img, 0, 0)
    // rivets on a grid - these read clearly in the specular highlight
    for (let gy = 0; gy < 8; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        const px = gx * size / 8 + size / 16
        const py = gy * size / 8 + size / 16
        const g = x.createRadialGradient(px - 2, py - 2, 0.5, px, py, 6)
        g.addColorStop(0, 'rgba(255,255,255,0.95)')
        g.addColorStop(0.6, 'rgba(150,155,165,0.7)')
        g.addColorStop(1, 'rgba(40,44,55,0.45)')
        x.fillStyle = g
        x.beginPath()
        x.arc(px, py, 6, 0, 7)
        x.fill()
      }
    }
    const h = canvas(size)
    h.x.drawImage(c, 0, 0)
    return pair(h.c, c, { renderer, bump: 2.4 })
  })
}

export function canvasStripe (renderer, a = '#f2f2ef', b = '#d8383c', count = 12) {
  return memo(`tent:${a}:${b}:${count}`, () => {
    const size = 512
    const { c, x } = canvas(size)
    const w = size / count
    for (let i = 0; i < count; i++) {
      x.fillStyle = i % 2 ? b : a
      x.fillRect(i * w, 0, Math.ceil(w), size)
    }
    // weave + sag wrinkles
    const img = x.getImageData(0, 0, size, size)
    for (let y = 0; y < size; y++) {
      for (let X = 0; X < size; X++) {
        const i = (y * size + X) * 4
        const weave = 0.94 + 0.06 * Math.sin(X * 1.9) * Math.sin(y * 1.9)
        const sag = 0.93 + 0.12 * noise.fbm(X / size * 3, y / size * 10, 3, 4)
        const k = weave * sag
        img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k
      }
    }
    x.putImageData(img, 0, 0)
    const h = canvas(size)
    h.x.drawImage(c, 0, 0)
    return pair(h.c, c, { renderer, bump: 1.0 })
  })
}

export function foliage (renderer, size = 256) {
  return memo('foliage', () => {
    const { c, x } = canvas(size)
    x.fillStyle = '#20401f'
    x.fillRect(0, 0, size, size)
    for (let i = 0; i < 5200; i++) {
      const px = noise.rnd() * size, py = noise.rnd() * size
      const n = noise.fbm(px / size, py / size, 3, 5)
      const g = 60 + n * 120
      x.fillStyle = `rgba(${(20 + n * 70) | 0},${g | 0},${(24 + n * 40) | 0},0.75)`
      x.beginPath()
      x.ellipse(px, py, 2 + noise.rnd() * 4, 1.5 + noise.rnd() * 3, noise.rnd() * 3.14, 0, 7)
      x.fill()
    }
    const h = canvas(size)
    h.x.drawImage(c, 0, 0)
    return pair(h.c, c, { renderer, bump: 1.4 })
  })
}

/* ------------------------------------------------------------------ *
 * signage - drawn with text so the UV layout is obvious on screen
 * ------------------------------------------------------------------ */
export function sign (text, { fg = '#1a1026', bg = '#ffcf5c', sub = '' } = {}) {
  return memo(`sign:${text}:${sub}:${bg}`, () => {
    const w = 1024, h = 256
    const { c, x } = canvas(w, h)
    const g = x.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, bg)
    g.addColorStop(1, '#ff9a3c')
    x.fillStyle = g
    x.fillRect(0, 0, w, h)
    x.strokeStyle = 'rgba(26,16,38,0.85)'
    x.lineWidth = 10
    x.strokeRect(14, 14, w - 28, h - 28)
    x.fillStyle = fg
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.font = `700 ${sub ? 96 : 120}px ui-sans-serif, system-ui, sans-serif`
    x.fillText(text, w / 2, sub ? h / 2 - 26 : h / 2)
    if (sub) {
      x.font = '500 44px ui-sans-serif, system-ui, sans-serif'
      x.fillText(sub, w / 2, h / 2 + 58)
    }
    // bulb dots around the border
    x.fillStyle = 'rgba(255,255,255,0.9)'
    for (let i = 0; i < 26; i++) {
      const px = 34 + i * (w - 68) / 25
      x.beginPath(); x.arc(px, 34, 7, 0, 7); x.fill()
      x.beginPath(); x.arc(px, h - 34, 7, 0, 7); x.fill()
    }
    const t = finish(c, { repeat: 1 })
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}

/** Soft radial sprite used for the bulb glow point cloud. */
export function glowSprite () {
  return memo('glow', () => {
    const size = 128
    const { c, x } = canvas(size)
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0.00, 'rgba(255,255,255,1)')
    g.addColorStop(0.16, 'rgba(255,240,205,0.92)')
    g.addColorStop(0.42, 'rgba(255,190,110,0.30)')
    g.addColorStop(1.00, 'rgba(255,160,70,0)')
    x.fillStyle = g
    x.fillRect(0, 0, size, size)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}

/** Cookie texture for the spotlights so the beams have shape. */
export function gobo () {
  return memo('gobo', () => {
    const size = 256
    const { c, x } = canvas(size)
    x.fillStyle = '#000'
    x.fillRect(0, 0, size, size)
    const g = x.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.55, '#cccccc')
    g.addColorStop(1, '#000000')
    x.fillStyle = g
    x.beginPath(); x.arc(size / 2, size / 2, size / 2, 0, 7); x.fill()
    // 8 blades, like a par-can barn door
    x.globalCompositeOperation = 'destination-out'
    x.strokeStyle = '#000'
    x.lineWidth = 6
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4
      x.beginPath()
      x.moveTo(size / 2, size / 2)
      x.lineTo(size / 2 + Math.cos(a) * size, size / 2 + Math.sin(a) * size)
      x.stroke()
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
}

export function disposeTextureCache () {
  for (const v of cache.values()) {
    if (v?.isTexture) v.dispose()
    else if (v?.map) { v.map.dispose(); v.normalMap?.dispose() }
  }
  cache.clear()
}
