<img src="docs/headshot.jpg" alt="Edward Cheng" width="140" align="right" />

# Portfolio Project 1 — Edward Cheng

**CSCI 6830 · Virtual Reality · Fall 2026 · University of Georgia**
GitHub [@EC061](https://github.com/EC061) · Athens, GA

<!-- TODO (Edward): rewrite this bio in your own voice before you submit.
     It has to be 100 words or fewer — it is currently 76. -->

Graduate student at the University of Georgia, working through CSCI 6830.
My interest in this course is the unglamorous half of real-time graphics:
transform hierarchies that are correct rather than merely convincing,
physics with units attached, and frame budgets you can actually point at.
Four demos, four different ways of being wrong about motion. I would
rather ship something measured than something polished, and the READMEs
here say what is broken as loudly as what works.

---

## Demos

| Demo | Video | Live / Release | What it demonstrates |
|---|---|---|---|
| **[Demo 1 — Midway](Demo1_Ride/)** <br> carnival ride, WebXR | <!-- TODO --> | <!-- TODO --> | A five-level transform hierarchy driven in code: gondolas that cancel their parent's rotation to stay level, a pendulum solved against effective gravity, a rider camera parented into the seat. Procedural everything, day/night lighting, 129 draw calls. |
| **[Demo 2 — Trainer](Demo2_Trainer/)** <br> sports trainer, Unity/Quest | *not started* | *not started* | Four interacting physics systems in real units — launch, flight with drag and Magnus, tracked-implement contact, surface bounce — with a repetition-and-feedback training loop and spatialised audio. |
| **[Demo 3 — Procedure](Demo3_Procedure/)** <br> procedural trainer | *not started* | *not started* | A six-plus step procedure as an explicit state machine, with ordering constraints, wrong-part and wrong-order detection, two-handed manipulation and a constrained motion. |
| **[Demo 4 — Hunt](Demo4_Hunt/)** <br> scavenger hunt | *not started* | *not started* | Two distinct locomotion systems, switchable in-app, in a landmarked world with five targets among twenty distractors, plus a full comfort menu argued from sensory mismatch. |

**Graduate study (CSCI 6830):** [`Demo1_Ride/Study/`](Demo1_Ride/Study/) —
instrumentation plan, participant table and analysis for the carnival
ride. *Design written; not yet run.*

Each demo folder carries its own `README.md` (description, controls,
links, sources, known issues) and a `SCRIPT.md` (the video plan — beat
sheet, what to explain, and a pre-upload checklist).

---

## AI tooling

**Inventory**

- **App / agent:** Claude Code (terminal agent, not chat) — the agent
  held the working tree, ran the build, drove a headless Chromium, and
  edited files directly.
- **Model:** Claude Opus 5 (1M-context variant), one session.
- **Integrations:** the agent's own filesystem and shell tools; a browser
  automation MCP server used to load the built page, evaluate JavaScript
  inside it, read `renderer.info`, and capture frames back to disk for
  inspection.

**How it was actually used, and how the errors were caught**

Demo 1 was built agent-first rather than chat-first: I described the
rides and the constraints, and the agent wrote the modules, ran
`vite build`, loaded the result in a real browser, took screenshots, and
looked at them. That last step is the one that mattered. Roughly half the
bugs in this demo were invisible to the code and obvious in a frame, and
none of them would have been caught by asking a chat window whether the
code looked right.

The failures worth recording, because they are the ones the quiz could
reasonably ask about:

- **The Ferris wheel stood on a point.** The A-frame legs were authored
  with their *base* at the origin and then rotated about it, so both legs
  splayed upward from a single foot instead of down to two. The fix was
  to author the leg with its top at the origin — the rotation has to
  pivot about the hub, which is the joint the leg actually turns about.
- **The spokes poked out past the rim**, because the cylinder's length
  and its centre offset were derived independently and drifted apart.
- **Every festoon bulb rendered black.** Setting `vertexColors: true` to
  get instance colours makes three declare a `color` attribute in the
  vertex shader; with no buffer behind it the attribute defaults to
  black and multiplies the result to zero. Fixed by giving the shared
  bulb geometry a white `color` attribute and letting `instanceColor` do
  the tinting.
- **The rider camera sat inside the gondola's axle.** The pivot had been
  placed at seated eye height, which looks fine from the ground and puts
  a steel bar through the rider's head. Real gondolas hang from a bearing
  *above* the roof for exactly this reason, so the whole model was
  re-anchored.
- **The carousel chairs faced backwards** — the backrest was on the +Z
  side while the platform's direction of travel was −Z.
- **All the instanced ride geometry read as zero matrices** during one
  debugging pass. Not a bug in the demo at all: the automation tab was
  backgrounded, so `requestAnimationFrame` never fired and the update
  that writes those matrices never ran. Worth knowing before trusting any
  headless measurement.

Claims from the agent were checked rather than accepted. The draw-call,
triangle and frame-time figures in `Demo1_Ride/README.md` were read out
of `renderer.info` in the running page, with shadows toggled on and off
to isolate the shadow pass, rather than estimated. Where a number is
tuned by eye instead of derived — the two pendulum damping constants —
the README says so.

Everything in this repository is mine to explain, including the parts an
agent typed.

---

## Repository layout

```
.
├── Demo1_Ride/            three.js + Vite carnival ride  (built)
│   ├── src/               app source
│   ├── docs/img/          screenshots used by the README
│   ├── Study/             CSCI 6830 instrumentation study
│   ├── Dockerfile         node build -> nginx runtime, port 8080
│   ├── docker-compose.yml single port, for an external reverse proxy
│   ├── README.md
│   └── SCRIPT.md
├── Demo2_Trainer/         Unity / Quest sports trainer   (scaffold)
├── Demo3_Procedure/       procedural trainer             (scaffold)
├── Demo4_Hunt/            scavenger hunt                 (scaffold)
├── .github/workflows/
│   ├── demo1-image.yml    builds and pushes to GHCR on push to main
│   └── demo1-pages.yml    optional GitHub Pages deploy
├── docs/headshot.jpg
└── .gitignore             Unity standard + web build output
```

No build output, `Library/` folders or APKs are committed. Quest APKs go
to GitHub Releases.

## Deployment

Demo 1 ships as a container image, published automatically to GHCR:

```bash
docker pull ghcr.io/ec061/portfolio-1-ec061/demo1-ride:latest
docker compose -f Demo1_Ride/docker-compose.yml up -d   # :8080
```

It publishes one plain-HTTP port and expects a reverse proxy in front of
it to terminate TLS — WebXR requires a secure context, so the public URL
must be HTTPS. See [`Demo1_Ride/README.md`](Demo1_Ride/README.md#running-it)
for the full set of knobs.

## Licence

Code in this repository is MIT unless a subfolder says otherwise. Course
briefs and any third-party assets remain under their own terms.
