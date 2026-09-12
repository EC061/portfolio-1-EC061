# Demo 1 — video script

**Target: 4:30. Hard limits 3:00–6:00.**
Screen recording of the browser at 1080p+, your voice over it. No code
walkthrough — the rubric asks for *you using the demo while explaining
it*. Keep the control panel visible the whole time; it is the evidence.

Two rules that decide the grade more than anything else:

1. **Every graded feature must appear on screen.** If it is not in the
   video it is marked missing, even if it is in the build. Use the
   checklist at the bottom before you upload.
2. **Say the mechanism, not the effect.** "The gondolas stay level" is
   worth nothing. "The gondola's frame sets `rotation.z = -wheelAngle`,
   which cancels its parent's rotation" is the answer they want, and it
   is the same answer the quiz will ask for.

---

## Beat sheet

### 0:00 – 0:25 · Cold open, no preamble
**On screen:** night mode, Midway view, slowly orbiting.
**Say:** what it is in one sentence — a fairground in the browser, three
rides, three.js, WebXR. Name the one idea the demo is about: everything
that moves is a frame defined relative to its parent.

> Do not open with "Hi, my name is…, and today I'm going to…". Start on
> the thing.

### 0:25 – 1:45 · Hierarchy — the core of the grade
This is 40% of your speaking time. Do not rush it.

**On screen:** switch to day, Operator view (<kbd>2</kbd>), looking up at
the wheel. Press <kbd>F</kbd> to show the axis triads.

**Explain, in this order:**
1. **Name the chain out loud, level by level.** spin → arm → levelling
   frame → rocking frame → seat → camera. Point at the triads as you say
   each one. Say "five levels".
2. **Say what each level's local transform actually is.** L1 is a
   rotation about Z that increases with time; L2 is a fixed translation
   out to the rim; L3 is a rotation about Z of *minus* the wheel angle.
3. **Now break it.** Press <kbd>L</kbd>. Let it run for a good five
   seconds — long enough for a gondola to reach the top and tip over.
   Say: this is the same scene with one line switched off; the tubs are
   now rigidly bolted to the rim, because a child inherits the parent's
   full transform and nothing is cancelling it. Press <kbd>L</kbd> again.
4. **The pendulum depends on the levelling frame.** Push the speed slider
   to ~2×. Point out that the tubs lean *outward* at the top and *inward*
   at the bottom, and say why: the pivot is accelerating, so the tub
   hangs along effective gravity — real gravity minus the pivot's
   centripetal acceleration — and that angle is only meaningful because
   its parent frame is world-aligned.
5. **The light rig that rides on an arm.** Go back to night, find the
   moving pool of light on the plaza, and say the spotlights and their
   targets are parented to one gondola arm, so the beam sweeps once per
   revolution with no per-frame code.

**One sentence for each of the other two rides, no more:**
- Carousel: the chairs' flare angle is *solved*, not keyframed —
  `tan φ = ω²(r₀ + L sin φ)/g`, fixed-point iterated each frame. Tilt the
  canopy on level 2 and every chair rises and falls without knowing it.
- Teacups: three stacked rotations, one counter-rotating. The world path
  is an epitrochoid; in the graph it is three numbers.

### 1:45 – 2:20 · Views, from the seat
**On screen:** <kbd>3</kbd> (ride the wheel), then <kbd>4</kbd>, then
<kbd>5</kbd>. Ride each for a few seconds.

**Say:** there is one camera; switching view **re-parents** it into the
ride under the seat frame, so it inherits the whole matrix chain. Say why
that matters: the rider view is the hierarchy *test* — a bad parent
transform can look fine from the ground and is obvious from the seat.
Mention WebXR in one line: three composes the headset pose with
`camera.parent.matrixWorld`, so the same parenting is what makes it
rideable in a headset.

### 2:20 – 3:05 · Graphics and the model you built
**On screen:** orbit in close on a gondola at the bottom of the wheel.

**Explain:**
- The gondola is the model you authored: a closed rounded-rectangle
  outline swept along a hand-placed profile, 2,484 triangles.
- **The UVs, and this is a likely quiz question.** `u` is arc length
  around the outline, `v` is arc length along the profile — *not* index
  based. Say the reason: the corners pack sample points densely and the
  flanks pack them sparsely, so index-based UVs would squeeze the stripes
  at the corners. Point at a corner and a flank and note the stripes are
  the same width.
- The floor gets a **different** unwrap — planar, straight down Y —
  because planks are straight.
- Every texture is generated on a canvas at load, and each one's normal
  map is a Sobel pass over its own height. Point at the rivets on the
  wheel's steelwork: modelled as pixels, lit as geometry.
- One line on the sky: a shader dome that cross-fades day to stars, also
  baked to an environment map so the gold reflects the real sky.

### 3:05 – 3:50 · Lighting, day and night
**On screen:** drag the night slider slowly from 0 to 1 so the sunset
bump is visible, then sit at night.

**Explain, and physically point at each one:**
- **Diffuse:** the wooden ride decks — roughness 0.74, metalness 0, pure
  Lambert falloff across the boards.
- **Specular:** the gold hub cap and the lamp finials — metalness 1.0,
  roughness 0.22, a tight moving highlight. And the rivets, where the
  normal map splits one broad highlight into a row of small ones.
- **One directional light does sun *and* moon.** Say why: cross-fading
  one light means one shadow map is ever allocated and one shadow pass
  ever runs, at any time of day.
- **Night mode is where the ride's own lights matter:** name the types —
  point lights at the hub and the lamp posts, spots with gobo cookies on
  the tower and the carousel, and 558 emissive bulbs that are *not*
  lights at all.
- Say the bulb trick explicitly: hundreds of bulbs, never hundreds of
  lights. Each strand is one instanced mesh plus one additive point cloud
  — two draw calls — parented into the ride so it rotates for free.

### 3:50 – 4:20 · Performance, with numbers on screen
**On screen:** stats panel visible (<kbd>P</kbd>). Toggle **Shadows**
off and on so the viewer watches the numbers move. Then cycle
<kbd>Q</kbd> through the quality presets.

**Say the measured numbers, not adjectives:**
- 129 draw calls and 436k triangles in the day at Medium, holding the
  120 Hz cap.
- Shadows off: **71 calls, 157k triangles, half the CPU frame time.**
  That is the shadow pass re-drawing every caster from the light's point
  of view. State it as a cost you chose to pay.
- Batching: ~1,400 loose scenery pieces merged per material into about a
  dozen draw calls, because none of them move.
- Instancing *through* a hierarchy: the gondolas keep real nodes — that
  is the whole assignment — and hand each node's world matrix to an
  instanced mesh. 16 gondolas, 4 draw calls.
- One line on overdraw: the glow points are the only significant
  transparent pass, depth-write off, drawn last.

### 4:20 – 4:30 · What you verified, what is broken
Two sentences, both required by the rubric, both delivered flat and
without excuses.

- **Verified:** the levelling frame by toggling it on camera; the
  pendulum lean by running at 2× and checking the tubs lean outward at
  the top and inward at the bottom; the draw-call and triangle counts
  from `renderer.info`, which is what the stats panel reads.
- **Broken / not done:** the arm spotlights cast no shadows because a
  moving shadow-casting spot re-renders its map every frame; no
  volumetric beams; the canopy underside reads dark because it is a
  single-sided shell drawn double-sided; no WebXR controller input, so
  you set everything before entering VR.

Close on the night midway. No sign-off needed.

---

## Pre-upload checklist

Tick every line by scrubbing your own recording.

- [ ] At least three levels of nested motion **named out loud**, in order
- [ ] The levelling frame **toggled off and back on**, on camera
- [ ] A statement of why the child must cancel the parent's rotation
- [ ] The light rig that rides on an arm, pointed at
- [ ] Ground view **and** a rider view, switched live
- [ ] A sentence saying the rider camera is a **child** in the hierarchy
- [ ] The hand-built model shown close up, with the UV scheme explained
- [ ] A named diffuse highlight and a named specular highlight
- [ ] Directional, point **and** spot lights named
- [ ] Night mode, with the ride's own lights doing the work
- [ ] Stats panel visible with real numbers; shadow cost demonstrated
- [ ] "What I verified" and "what needs fixing" both said
- [ ] Runs 3:00–6:00
- [ ] Uploaded to YouTube, **played back in a signed-out browser**
- [ ] The link is in `Demo1_Ride/README.md` and in the root README table
