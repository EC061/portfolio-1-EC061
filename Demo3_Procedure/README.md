# Demo 3 — Procedural Trainer (WebXR or Unity)

> **Status: not started.** This folder is scaffolding — the brief, the
> plan, and the decisions that still have to be made. Everything marked
> TODO is genuinely outstanding.

| | |
|---|---|
| **Live demo / Release** | <!-- TODO: public WebXR URL, or APK Release link --> |
| **Video** | <!-- TODO: YouTube link --> |
| **Stack** | <!-- TODO: WebXR or Unity — decide before building --> |
| **Procedure** | <!-- TODO: pick one and cite it --> |

---

## What this has to be

A hands-on procedure, taught or performed, **entirely within arm's
reach**. No locomotion problem to solve, no environment to build — the
whole demo is a table and the things on it. Candidates from the brief:
device assembly in order, lockout–tagout, the fire-extinguisher PASS
sequence, a lab spill response, first aid, an equipment start-up
checklist, a titration, a puzzle box, lock-picking, a circuit board, a
watchmaker's table.

## What it must demonstrate

### Procedure logic — the graded core

- **Six or more steps with explicit state.** A real state machine, not a
  pile of booleans. The current step is a value you can name and print.
- **Ordering constraints.** Step *n* is only available once its
  prerequisites are satisfied.
- **Prerequisite detection.** The system knows *why* a step is
  unavailable, not just that it is.
- **Wrong-step and wrong-part detection**, driven by triggers and
  collision events — picking up the wrong component, or doing the right
  thing at the wrong time, is caught and named.
- **Error feedback** that says what was wrong.
- **Completion** and **reset**.
- Optionally: one recoverable mistake, and one step where more than one
  order is legitimately valid.

> The quiz will ask something like *"what does the state machine do when
> the user picks up the wrong part?"* Design so that has a crisp answer.

### Manipulation

- Grab and release with **both hands**; held objects are kinematic in
  hand.
- Placement with **snapping or constraints** — not free-floating drops.
- At least one **tool interaction** or **two-handed operation**.
- At least one **constrained motion**: a hinge, a screw, a slider, or a
  latch. This is the one that needs real joint work rather than a lerp.

### Guidance

- In-world instructions and highlights that **follow the current step**.
- Optionally a cited source for the procedure, and hints for a stuck user.

### Content

Either a real procedure with a citation, or a game with a clear goal and
scoring. If it is a real procedure, the citation belongs in this README
and on screen in the video.

---

## Decisions still open

<!-- TODO: answer these before writing code. -->

1. **WebXR or Unity?** WebXR means a public URL and no APK, and the
   Demo 1 toolchain here already builds and ships that way. Unity means
   XR Interaction Toolkit does the grab/constraint work for you.
2. **Which procedure?** Pick one with a published, citable sequence.
3. **How is state represented?** Write the state machine down as a table
   of steps, prerequisites and failure modes *before* building it.
4. **Hand tracking?** Welcome, but controllers must work regardless.

## Controls

<!-- TODO -->

## Sources

<!-- TODO: the procedure's authoritative source, plus any third-party
     assets with licences. -->

## Known issues

<!-- TODO -->
