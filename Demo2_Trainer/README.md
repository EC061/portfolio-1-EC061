# Demo 2 — Sports Trainer (Unity, Quest)

> **Status: not started.** This folder is scaffolding — the brief, the
> plan, and the list of numbers that will need sources. Nothing here has
> been built or measured yet. Everything marked TODO is genuinely
> outstanding, not a placeholder for something that exists.

| | |
|---|---|
| **Release (APK)** | <!-- TODO: GitHub Release link, tag `demo2-v1.0` --> |
| **Video** | <!-- TODO: YouTube link --> |
| **Stack** | Unity, Android / ARM64 / IL2CPP, OpenXR + Meta feature set |
| **Sport** | <!-- TODO: pick one and commit to it --> |

---

## What this has to be

A **single-user training environment for one sport** — a batting cage, a
serving lane, a driving bay, a keeper's goalmouth — not a game. The
grading is about physics breadth and accuracy, tracked interaction,
spatial audio, and a repetition-with-feedback loop.

## What it must demonstrate

### Four distinct, interacting physics systems

1. **Launch** — pitching machine / server / bowler. Exit speed, launch
   angle and spin are set here, and the training loop varies them.
2. **Flight** — gravity plus force rules. At minimum quadratic drag; the
   interesting one is the **Magnus force** from spin, which is what makes
   a curveball curve and a slice slice.
3. **Contact with a tracked implement** — bat / racket / club / glove.
   Restitution and friction at the impact, with the implement's velocity
   taken from tracked poses.
4. **Surface interaction** — bounce, roll, rolling friction, and the
   transition between them.
5. *(optional fifth)* wind or weather.

### Accuracy, in real units

Every one of these is a number that must come from somewhere citable, and
the video has to show a validation of at least one of them:

| Parameter | Unit | Source needed |
|---|---|---|
| ball mass | kg | governing body's equipment rules |
| ball radius | m | governing body's equipment rules |
| drag coefficient Cd | — | published wind-tunnel data for that ball |
| lift/Magnus coefficient Cl | — | published data, usually as a function of spin ratio |
| coefficient of restitution | — | governing body or published testing |
| launch speed range | m/s | competition statistics |
| spin rate range | rad/s or rpm | competition tracking data |
| surface friction | — | published or measured |

**Fixed timestep is a deliberate choice, not a default.** Decide the
value, write down why, and show that the ball does not tunnel through the
bat or the ground — either via continuous collision detection or a small
enough step, and say which and why in the video.

**Validation to show on camera** (pick at least one, measure it live):
- time from release to plate / net / hole against the published figure
- lateral break of a spinning ball over its flight
- carry distance for a given launch speed and angle

### Tracked objects only

Headset and controllers are the entire interface. No locomotion beyond
room-scale tracking. The implement is **kinematic**, parented to the
controller, and its velocity is **derived from tracked poses** — not from
a rigidbody, and not from the controller's reported velocity alone if
that proves noisy.

### Training loop

Repetition with feedback. Speed and spin readouts, hit quality, target
zones, a session score. It has to be practisable, not a one-shot.

### Immersive audio

Spatialised 3D audio positioned in the world — ball approach, impact,
ambience. A 2D stereo impact sound does not count.

---

## Plan

<!-- TODO: replace this section with what you actually build. -->

1. Pick the sport. Bias toward one with good public parameter data.
2. Build the flight solver first, headless, and validate it against a
   published trajectory before any VR work happens. This is the part the
   grade and the quiz are really about.
3. Then the launcher, then the implement, then the surface.
4. Then the training loop and the audio.
5. Instrument it last (see `Study/` if this is the demo you instrument).

## Controls

<!-- TODO -->

## Sources for real-world parameters

<!-- TODO: one row per number, with a link. Do not ship a number here
     that you cannot point at a source for — the quiz will ask. -->

## Third-party assets

<!-- TODO: list every asset with its licence, or state "none". -->

## Known issues

<!-- TODO: written honestly. The rubric explicitly asks what needs
     fixing, and the video has to say it out loud. -->
